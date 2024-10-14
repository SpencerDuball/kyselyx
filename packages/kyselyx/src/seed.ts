import fs from "fs-extra";
import { FileMigrationProvider, Migrator, type Kysely, type MigrationInfo } from "kysely";
import ora from "ora";
import path from "path";
import { getConfig, MIGRATION_LOCK_TABLE_NAME, MIGRATION_TABLE_NAME, SEED_TABLE_NAME } from "./config.js";
import { FileSeedProvider, NO_SEEDS, Seeder, type SeedInfo, type SeedResult } from "./seeder/index.js";
import { getTimestamp } from "./utils.js";

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
 * This function will return the date up to which the seeds should be applied in ms.
 *
 * This function will look at the applied an unapplied migrations and return a times in milliseconds
 * that does not exceed the last unapplied migration.
 */
async function getSeedMaxDate(db: Kysely<any>, migrationsFolder: string) {
  const provider = new FileMigrationProvider({ fs, path, migrationFolder: path.resolve(migrationsFolder) });
  const migrator = new Migrator({
    db,
    provider,
    migrationTableName: MIGRATION_TABLE_NAME,
    migrationLockTableName: MIGRATION_LOCK_TABLE_NAME,
  });
  const migrations = await migrator.getMigrations();

  let maxDateMs = Infinity;
  let lastAppliedMigration: MigrationInfo | null = null;
  for (let migration of migrations) {
    if (migration.executedAt) lastAppliedMigration = migration;
    else if (!migration.executedAt && lastAppliedMigration) {
      maxDateMs = getTimestamp(migration);
    }
  }

  return maxDateMs;
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
  const provider = new FileSeedProvider({ fs, path, seedFolder: path.resolve(seedsFolder) });
  const seeder = new Seeder({ stores, provider, seedTableName: SEED_TABLE_NAME });

  // ensure seed files have correct naming
  const seeds = await seeder.getSeeds();
  seeds.forEach((seed) => getTimestamp(seed));

  // get the seed max date
  feed.text = "Determining the max seed date ...";
  const maxDateMs = await getSeedMaxDate(stores.db, getConfig().migrationsFolder);
  feed.clear();

  let error: unknown;
  let results: SeedResult[] | undefined;

  feed.text = "Applying seeds ...";
  if (maxDateMs === Infinity && !name) {
    ({ error, results } = await seeder.seedToLatest());
  } else {
    // get the max seed
    let maxSeed: SeedInfo | undefined;
    if (maxDateMs === Infinity) maxSeed = seeds.at(-1);
    for (const seed of seeds) if (getTimestamp(seed) < maxDateMs) maxSeed = seed;

    // maxSeed should always be found
    if (!maxSeed) throw new Error("Could not find the max seed to be executed.");

    if (name) {
      // find the seed with the name specified
      let namedSeed: SeedInfo | undefined;
      for (const seed of seeds) if (name === seed.name) namedSeed = seed;

      if (!namedSeed) {
        feed.fail(`Could not find a seed with name: ${name}.`);
        process.exit(1);
      }

      // apply the seed if in valid date range
      if (getTimestamp(namedSeed) < maxDateMs) {
        ({ error, results } = await seeder.seedTo(namedSeed.name));
      } else {
        feed.fail(`Could not apply seed because it's timestamp exceeds unapplied migrations: ${namedSeed.name}.`);
        process.exit(1);
      }
    } else ({ error, results } = await seeder.seedTo(maxSeed.name));
  }
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
 * Displays the status of all migrations, showing which have been applied and which have not.
 */
export async function status() {
  let feed = ora({ text: "Connecting to the database ...", stream: process.stdout }).start();
  const { stores, seedsFolder } = getConfig();
  feed.clear();

  // get the seeds
  if (!fs.existsSync(seedsFolder)) {
    feed.fail(`Seeds folder not found: ${seedsFolder}`);
    process.exit(1);
  }
  const provider = new FileSeedProvider({ fs, path, seedFolder: path.resolve(seedsFolder) });
  const migrator = new Seeder({ stores, provider, seedTableName: SEED_TABLE_NAME });
  const seeds = await migrator.getSeeds();

  // collect a snapshot of the seeds info
  let lastAppliedSeed: SeedInfo | null = null;
  let totalAppliedSeeds = 0;
  for (const seed of seeds) {
    if (seed.executedAt !== undefined) {
      lastAppliedSeed = seed;
      totalAppliedSeeds++;
    }
  }

  // display the information
  let statusLine = [
    `Total Seeds: ${seeds.length}`,
    `Applied Seeds: ${totalAppliedSeeds}`,
    `Last Seed: ${lastAppliedSeed?.name ?? "None"}`,
  ].join("     ");
  console.log(statusLine);
  console.log(Array(statusLine.length).fill("-").join(""));

  for (const seed of seeds) {
    if (seed.executedAt) feed.succeed(`Seed ${seed.name} applied.`);
    else feed.fail(`Seed ${seed.name} not applied.`);
  }
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

  // get the seeds
  if (!fs.existsSync(seedsFolder)) {
    feed.fail(`Seeds folder not found: ${seedsFolder}`);
    process.exit(1);
  }
  const provider = new FileSeedProvider({ fs, path, seedFolder: path.resolve(seedsFolder) });
  const seeder = new Seeder({ stores, provider, seedTableName: SEED_TABLE_NAME });
  const seeds = await seeder.getSeeds();

  // ensure the seed files have correct naming
  seeds.forEach((s) => getTimestamp(s));

  const appliedSeeds = seeds.filter((m) => m.executedAt !== undefined);
  if (appliedSeeds.length === 0) {
    feed.succeed("No seeds to undo.");
  } else {
    // find the seed to rollback to
    let undoTarget: "NO_SEEDS" | SeedInfo | null = null;
    if (!name && appliedSeeds.length === 1) {
      undoTarget = "NO_SEEDS";
    } else if (!name && appliedSeeds.length > 1) {
      undoTarget = appliedSeeds.at(-1)!;
    } else if (name) {
      undoTarget = appliedSeeds.find((m) => m.name === name) ?? null;
    }

    if (!undoTarget) {
      feed.fail(`Migration ${name} not found.`);
      process.exit(1);
    }

    // rollback the seeds
    let error: unknown;
    let results: SeedResult[] | undefined;

    if (undoTarget === "NO_SEEDS") {
      feed.start(`Rolling back all seeds ...`);
      ({ error, results } = await seeder.seedTo(NO_SEEDS));
    } else {
      const priorToTargetIdx = seeds.findIndex((m) => m.name === undoTarget.name) - 1;
      const seedTo = priorToTargetIdx >= 0 ? seeds[priorToTargetIdx]!.name : NO_SEEDS;
      feed.start(`Rolling back to seed before ${undoTarget.name} ...`);
      ({ error, results } = await seeder.seedTo(seedTo));
    }

    if (error || results === undefined) {
      feed.fail(`Error rolling back seeds.`);
      console.error(error);
      process.exit(1);
    }

    for (const result of results) {
      if (result.status === "Success") feed.succeed(`Rolled back seed ${result.seedName} successfully.`);
      else if (result.status === "Error") feed.fail(`Error rolling back ${result.seedName}.`);
    }
  }
}

/**
 * Undo all seeds.
 */
export async function undoAll() {
  let feed = ora({ text: "Connecting to the database ...", stream: process.stdout }).start();
  const { stores, seedsFolder } = getConfig();
  feed.clear();

  // create seeder
  if (!fs.existsSync(seedsFolder)) {
    feed.fail(`Seeds folder not found: ${seedsFolder}`);
    process.exit(1);
  }
  const provider = new FileSeedProvider({ fs, path, seedFolder: path.resolve(seedsFolder) });
  const seeder = new Seeder({ stores, provider, seedTableName: SEED_TABLE_NAME });

  // ensure all seeds have correct naming
  const seeds = await seeder.getSeeds();
  seeds.forEach((s) => getTimestamp(s));

  let totalAppliedSeeds = 0;
  for (let seed of seeds) seed.executedAt && totalAppliedSeeds++;

  if (totalAppliedSeeds === 0) {
    feed.succeed("No seeds to undo.");
  } else {
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
