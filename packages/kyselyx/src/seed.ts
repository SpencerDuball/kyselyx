import fs from "fs-extra";
import ora from "ora";
import path from "path";
import { getConfig, SEED_TABLE_NAME } from "./config.js";
import { FileSeedProvider, NO_SEEDS, Seeder, type NoSeeds } from "./seeder/index.js";
import { getMaxSeed, getSeeds, isNoSeeds, type AppliedSeed } from "./utils.js";

/**
 * Returns the string contents of a new new seed file.
 *
 * This function needs the `configFile` and `seedFile` to generate the correct import path for the
 * type hints in the seed file.
 */
function template(configFile: string, seedFile: string) {
  // get the relative path of the config file from the seed file
  let relativePath = path.relative(path.dirname(seedFile), configFile);
  // ensure the extension is ".js"
  relativePath = relativePath.replace(/\.\w+$/, ".js");

  return [
    `import type config from "${relativePath}";`,
    ``,
    `type IStores = (typeof config)["stores"];`,
    ``,
    `async function up({ db }: IStores) {}`,
    ``,
    `async function down({ db }: IStores) {}`,
    ``,
    `export { up, down };`,
  ].join("\n");
}

/**
 * Applies all seeds up to the latest seed, or to the specified seed.
 *
 * This function will look at the applied and unapplied migrations and only apply the seeds that
 * up to the last applied migration.
 *
 * @param name The name of the seed to seed to.
 */
export async function seed(name?: string) {
  let feed = ora({ text: "Connecting to the database ...", stream: process.stdout }).start();
  const { stores, seedsFolder } = getConfig();
  feed.clear();

  // create the seeder
  if (!fs.existsSync(seedsFolder)) {
    feed.fail(`Seeds folder not found: ${seedsFolder}`);
    process.exit(1);
  }
  const seeder = new Seeder({
    stores,
    provider: new FileSeedProvider({ fs, path, seedFolder: path.resolve(seedsFolder) }),
    seedTableName: SEED_TABLE_NAME,
  });

  // get the seeds
  const { allSeeds } = await getSeeds(seeder);

  // get the seed max date
  feed.text = "Determining the max seed date ...";
  const maxSeed = await getMaxSeed();
  feed.clear();

  if (maxSeed === null) {
    feed.fail("No seeds are available to be applied, please ensure appropriate migrations are applied.");
    process.exit(1);
  }

  // determine the target seed
  let tgtSeed = maxSeed;
  if (name && !isNoSeeds(maxSeed)) {
    // collect the target seed
    const nameSeed = allSeeds.find((s) => s.name === name);
    if (!nameSeed) {
      feed.fail(`Could not find seed with name: ${name}.`);
      process.exit(1);
    }

    // ensure named seed does NOT execeed the max seed timestamp
    if (nameSeed.timestamp > maxSeed.timestamp) {
      feed.fail(
        `Specified seed is greater than the max seed available to be applied. Please ensure appropriate migrations are applied.`,
      );
      process.exit(1);
    }

    // update the target seed to the named seed
    tgtSeed = nameSeed;
  }

  feed.text = "Applying seeds ...";
  const { error, results } = await seeder.seedTo(isNoSeeds(tgtSeed) ? NO_SEEDS : tgtSeed.name);
  feed.clear();

  // process the results
  results?.forEach((it) => {
    if (it.status === "Success") feed.succeed(`Applied seed ${it.seedName} successfully.`);
    else if (it.status === "Error") feed.fail(`Error applying ${it.seedName}.`);
  });

  if (error) {
    feed.fail(`Error applying seeds.`);
    process.exit(1);
  } else {
    feed.succeed("All seeds applied successfully.");
  }
}

/**
 * Displays the status of all seeds, showing which have been applied and which have not.
 */
export async function status() {
  let feed = ora({ text: "Connecting to the database ...", stream: process.stdout }).start();
  const { stores, seedsFolder } = getConfig();
  feed.clear();

  // create the seeder
  if (!fs.existsSync(seedsFolder)) {
    feed.fail(`Seeds folder not found: ${seedsFolder}`);
    process.exit(1);
  }
  const seeder = new Seeder({
    stores,
    provider: new FileSeedProvider({ fs, path, seedFolder: path.resolve(seedsFolder) }),
    seedTableName: SEED_TABLE_NAME,
  });

  // get the seeds
  const { unappliedSeeds, appliedSeeds } = await getSeeds(seeder);

  // display the information
  let statusLine = [
    `Total Seeds: ${appliedSeeds.length + unappliedSeeds.length}`,
    `Applied Seeds: ${appliedSeeds.length}`,
    `Last Seed: ${appliedSeeds.at(-1)?.name ?? "NONE"}`,
  ].join("     ");
  console.log(statusLine);
  console.log(Array(statusLine.length).fill("-").join(""));

  for (const seed of appliedSeeds) feed.succeed(`Seed ${seed.name} applied.`);
  for (const seed of unappliedSeeds) feed.fail(`Seed ${seed.name} not applied.`);
}

/**
 * Undo the last seed or all seeds up to the specified name provided.
 *
 * @param name The name of the seed to rollback to.
 */
export async function undo(name?: string) {
  let feed = ora({ text: "Connecting to the database ...", stream: process.stdout }).start();
  const { stores, seedsFolder } = getConfig();
  feed.clear();

  // create the seeder
  if (!fs.existsSync(seedsFolder)) {
    feed.fail(`Seeds folder not found: ${seedsFolder}`);
    process.exit(1);
  }
  const seeder = new Seeder({
    stores,
    provider: new FileSeedProvider({ fs, path, seedFolder: path.resolve(seedsFolder) }),
    seedTableName: SEED_TABLE_NAME,
  });

  // get the seeds
  const { appliedSeeds } = await getSeeds(seeder);

  let undoTarget: NoSeeds | AppliedSeed | null = null;
  if (appliedSeeds.length === 0) {
    feed.succeed("No seeds to undo.");
    process.exit(0);
  } else if (!name && appliedSeeds.length === 1) undoTarget = NO_SEEDS;
  else if (!name && appliedSeeds.length > 1) undoTarget = appliedSeeds.at(-2) ?? null;
  else if (name) undoTarget = appliedSeeds.find((m) => m.name === name) ?? null;

  if (!undoTarget) {
    feed.fail(`Seed ${name} not found.`);
    process.exit(1);
  } else if ("name" in undoTarget && undoTarget.name === appliedSeeds.at(-1)!.name) {
    feed.succeed(`Seed ${name} is already latest seed.`);
    process.exit(0);
  }

  // rollback seeds
  feed.start(`Rolling back seeds ...`);
  const { error, results } = await seeder.seedTo("name" in undoTarget ? undoTarget.name : NO_SEEDS);

  if (error || results === undefined) {
    feed.fail(`Error rolling back seeds.`);
    console.error(error);
    process.exit(1);
  }

  for (let result of results) {
    if (result.status === "Success") feed.succeed(`Rolled back seed ${result.seedName} successfully.`);
    else if (result.status === "Error") feed.fail(`Error rolling back ${result.seedName}.`);
  }
}

/**
 * Undo all seeds.
 */
export async function undoAll() {
  let feed = ora({ text: "Connecting to the database ...", stream: process.stdout }).start();
  const { stores, seedsFolder } = getConfig();
  feed.clear();

  // create the seeder
  if (!fs.existsSync(seedsFolder)) {
    feed.fail(`Seeds folder not found: ${seedsFolder}`);
    process.exit(1);
  }
  const seeder = new Seeder({
    stores,
    provider: new FileSeedProvider({ fs, path, seedFolder: path.resolve(seedsFolder) }),
    seedTableName: SEED_TABLE_NAME,
  });

  // get all seeds
  feed.text = "Getting all seeds ...";
  const { appliedSeeds } = await getSeeds(seeder);
  feed.clear();

  if (appliedSeeds.length === 0) feed.succeed("No seeds to undo.");
  else {
    // rollback seeds
    feed.text = "Rolling back all seeds ...";
    const { error, results } = await seeder.seedTo(NO_SEEDS);

    if (error || results === undefined) {
      feed.fail(`Error rolling back seeds.`);
      console.error(error);
      process.exit(1);
    }

    for (let result of results) {
      if (result.status !== "Success") {
        feed.fail(`Error rolling back ${result.seedName}.`);
        process.exit(1);
      }
    }

    feed.succeed("All seeds rolled back successfully.");
  }
}

/**
 * Creates a new migration file with the specified name.
 */
export async function new_(name: string) {
  const { configFile, seedsFolder } = getConfig();

  // Generate the seed file
  let feed = ora({ text: `Creating seed file ...`, stream: process.stdout }).start();
  const seedId = `${Date.now()}_${name}`;
  await fs.ensureDir(path.resolve(seedsFolder, seedId));
  const seedFile = path.resolve(seedsFolder, seedId, `run.ts`);
  await fs.writeFile(seedFile, template(configFile, seedFile));
  feed.succeed(`Created seed file: "${seedId}/run.ts"`);
}
