import fs from "fs-extra";
import ora, { type Options } from "ora";
import path from "path";
import "tsx/esm"; // This MUST be imported for the tests to run properly!
import { getConfig } from "./config.js";
import { FileSystemError, SeedError } from "./errors.js";
import { NO_SEEDS, type NoSeeds } from "./seeder/seed.js";
import {
  doesNameMatch,
  exitFailure,
  exitOk,
  getSeeder,
  getSeeds,
  getTargetSeed,
  isNoSeeds,
  type Seed,
} from "./utils.js";

/**
 * Returns the string contents of a new seed file.
 *
 * @param configFile The path to the Kyselyx configuration file.
 * @param seedFile The path to the seed file.
 */
function tempalateJs(configFile: string, seedFile: string) {
  // get the relative path of the config file from the seed file
  let relativePath = path.relative(path.dirname(seedFile), configFile);
  // ensure the extension is ".js"
  relativePath = relativePath.replace(/\.\w+$/, ".js");

  return [
    `/**`,
    ` * The 'up' function runs when the seed is applied.`,
    ` *`,
    ` * @param {import("${relativePath}")["default"]["stores"]} stores`,
    ` * @returns {Promise<void>}`,
    ` */`,
    `async function up({ db }) {}`,
    ``,
    `/**`,
    ` * The 'down' function runs when the seed is removed.`,
    ` *`,
    ` * @param {import("${relativePath}")["default"]["stores"]} stores`,
    ` * @returns {Promise<void>}`,
    ` */`,
    `async function down({ db }) {}`,
    ``,
    `export { up, down };`,
  ].join("\n");
}

/**
 * Returns the string contents of a new seed file.
 *
 * @param configFile The path to the Kyselyx configuration file.
 * @param seedFile The path to the seed file.
 */
function templateTs(configFile: string, seedFile: string) {
  // get the relative path of the config file from the seed file
  let relativePath = path.relative(path.dirname(seedFile), configFile);
  // ensure the extension is ".ts"
  relativePath = relativePath.replace(/\.\w+$/, ".ts");

  return [
    `import type config from "${relativePath}";`,
    ``,
    `type IStores = typeof config.stores;`,
    ``,
    `/**`,
    ` * The 'up' function runs when the seed is applied.`,
    ` */`,
    `async function up({ db }: IStores): Promise<void> {}`,
    ``,
    `/**`,
    ` * The 'down' function runs when the seed is removed.`,
    ` */`,
    `async function down({ db }: IStores): Promise<void> {}`,
    ``,
    `export { up, down };`,
  ].join("\n");
}

/**
 * Applies all seeds up to the latest seed, or to the specified seed.
 *
 * This function will look at the applied and unapplied migrations and only apply the seeds up to
 * the last applied migration.
 *
 * @param name The name of the seed to seed to.
 * @param opts Options for running the script.
 * @param opts.ora Options for the spinner.
 */
export async function seed(name?: string, opts?: { ora?: Options }) {
  const seeder = getSeeder().match((i) => i, exitFailure);

  // retrieve all seeds
  let feed = ora({ stream: process.stdout, ...opts?.ora }).start("Getting seeds ...");
  const { allSeeds } = (await getSeeds(seeder)).match((i) => i, exitFailure);
  feed.clear();

  // find the seed (if supplied)
  let seed: Seed | undefined;
  if (name) {
    seed = allSeeds.find(doesNameMatch(name));
    if (!seed) exitFailure(new SeedError("eb3df1", `Could not find a seed to seed to.`));
  }

  // get the target seed
  feed.start("Finding target seed ...");
  const targetSeed = (await getTargetSeed({ seed })).match((i) => i, exitFailure);

  // apply the seeds
  feed.start("Applying seeds ...");
  const { error, results } = await seeder.seedTo(isNoSeeds(targetSeed) ? NO_SEEDS : targetSeed.name);

  let numSeedsApplied = 0;
  let lastAppliedSeed: string | null = null;

  // process the results
  results?.forEach((it) => {
    if (it.status === "Success") {
      numSeedsApplied += 1;
      lastAppliedSeed = it.seedName;
    }
  });

  if (error) exitFailure(new SeedError("c6d495", "Error applying seeds."));

  if (numSeedsApplied === 0) feed.succeed("No seeds to apply.");
  else feed.succeed(`Applied ${numSeedsApplied} seeds up to ${lastAppliedSeed} successfully.`);
}

/**
 * Undo the last seed or all seeds up to the specified name provided.
 *
 * @param name The name of the seed to rollback to.
 * @param opts Options for running the script.
 * @param opts.ora Options for the spinner.
 */
export async function undo(name?: string, opts?: { ora?: Options }) {
  const seeder = getSeeder().match((i) => i, exitFailure);

  // retrieve all seeds
  let feed = ora({ stream: process.stdout, ...opts?.ora }).start("Getting seeds ...");
  const { appliedSeeds } = (await getSeeds(seeder)).match((i) => i, exitFailure);

  // find the seed to rollback to
  let seed: Seed | NoSeeds | undefined;
  if (name) {
    const namedSeed = appliedSeeds.find(doesNameMatch(name));
    if (namedSeed) {
      const namedSeedIdx = appliedSeeds.indexOf(namedSeed);
      if (namedSeedIdx === -1) exitFailure(new SeedError("f4b692", "Could not find seed to rollback to."));
      else if (namedSeedIdx === 0) seed = NO_SEEDS;
      else seed = appliedSeeds.at(namedSeedIdx - 1);
    }
  } else {
    if (appliedSeeds.length > 1) seed = appliedSeeds.at(-2);
    else if (appliedSeeds.length === 1) seed = NO_SEEDS;
  }

  if (!seed) {
    if (name) feed.fail(`Could not find seed to rollback to.`);
    else feed.succeed(`No seeds to rollback.`);
    return;
  }

  // rollback the seeds
  feed.start("Rolling back seeds ...");
  const { error, results } = await seeder.seedTo(isNoSeeds(seed) ? NO_SEEDS : seed.name);

  let numSeedsDropped = 0;

  // process the results
  results?.forEach((it) => {
    if (it.status === "Success") numSeedsDropped += 1;
  });

  if (error) exitFailure(new SeedError("bc184e", "Error rolling back seeds."));

  feed.succeed(`Dropped ${numSeedsDropped} seed(s) successfully .`);
}

/**
 * Undo all seeds.
 *
 * @param opts Options for running the script.
 * @param opts.ora Options for the spinner.
 */
export async function undoAll(opts: { ora?: Options }) {
  const seeder = getSeeder().match((i) => i, exitFailure);

  // retrieve all seeds
  let feed = ora({ stream: process.stdout, ...opts?.ora }).start("Getting seeds ...");
  const { appliedSeeds } = (await getSeeds(seeder)).match((i) => i, exitFailure);
  feed.clear();

  if (appliedSeeds.length === 0) {
    feed.succeed("No seeds to rollback.");
    return;
  }

  // rollback all seeds
  feed.start("Rolling back seeds ...");
  const { error, results } = await seeder.seedTo(NO_SEEDS);
  feed.clear();

  let numSeedsDropped = 0;

  // process the results
  results?.forEach((it) => {
    if (it.status === "Success") numSeedsDropped += 1;
  });

  if (error) exitFailure(new SeedError("e2a656", "Error rolling back seeds."));

  feed.succeed(`Rolled back ${numSeedsDropped} seeds rolled back successfully.`);
}

/**
 * Shows the status of all migrations.
 */
export async function status() {
  const seeder = getSeeder().match((i) => i, exitOk);

  // retrieve all migrations
  let feed = ora({ stream: process.stdout }).start("Getting migrations ...");
  const { allSeeds, appliedSeeds, unappliedSeeds } = (await getSeeds(seeder)).match((i) => i, exitFailure);
  feed.stop();

  // print the status
  let statusLine = [
    `Total Seeds: ${allSeeds.length}`,
    `Applied Seeds: ${appliedSeeds.length}`,
    `Unapplied Seeds: ${unappliedSeeds.length}`,
  ].join("     ");
  console.log(statusLine);
  console.log(Array(statusLine.length).fill("-").join(""));
  console.log(`Last Applied Seed: ${appliedSeeds.at(-1)?.name || "None"}`);
}

/**
 * Generates a new seed file.
 *
 * @param name The label of the seed to generate.
 * @param opts Options for generating the migration file.
 * @param opts.js Generate a JavaScript seed file.
 */
export async function generate(name: string, opts = { js: false }) {
  const { configFile, seedsFolder } = getConfig().match((i) => i, exitFailure);

  // generate the seed file
  let feed = ora({ stream: process.stdout }).start("Generating seed ...");
  const seedId = `${Date.now()}_${name}`;
  const seedFile = path.resolve(seedsFolder, `${seedId}.${opts.js ? "js" : "ts"}`);

  await fs.ensureDir(seedsFolder).catch((e) => exitFailure(FileSystemError.fromThrown("6b9a65")(e)));
  if (opts.js) {
    await fs
      .writeFile(path.resolve(seedsFolder, `${seedId}.js`), tempalateJs(configFile, seedFile))
      .catch((e) => exitFailure(FileSystemError.fromThrown("3b0fb7")(e)));
    feed.succeed(`Created seed file: "${seedId}.js"`);
  } else {
    await fs
      .writeFile(path.resolve(seedsFolder, `${seedId}.ts`), templateTs(configFile, seedFile))
      .catch((e) => exitFailure(FileSystemError.fromThrown("8c0fce")(e)));
    feed.succeed(`Created seed file: "${seedId}.ts"`);
  }
}
