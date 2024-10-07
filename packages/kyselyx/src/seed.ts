import fs from "fs-extra";
import { FileMigrationProvider, Migrator, type Kysely, type MigrationInfo } from "kysely";
import ora from "ora";
import path from "path";
import { getConfig, MIGRATION_LOCK_TABLE_NAME, MIGRATION_TABLE_NAME, SEED_TABLE_NAME } from "./config.js";
import { FileSeedProvider, Seeder, type SeedInfo } from "./seeder/index.js";
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
    else if (lastAppliedMigration) {
      maxDateMs = getTimestamp(migration);
    }
  }

  return maxDateMs;
}

/**
 * Applies all seeds up to the latest seed, or to the specified seed.
 *
 * This function will look at the applied an unapplied migrations and only apply the seeds that
 * up to the last applied migration.
 *
 * @param name The name of the seed to seed to.
 */
export async function seed(name?: string) {
  let feed = ora({ text: "Connecting to the database ...", stream: process.stdout }).start();
  const { stores, seedsFolder } = getConfig();
  feed.clear();

  // get the seed max date
  feed.text = "Determining the max seed date ...";
  const maxDateMs = await getSeedMaxDate(stores.db, getConfig().migrationsFolder);
  feed.clear();

  // apply the seeds
  // if (!fs.existsSync(seedsFolder)) {
  //   feed.fail(`Seeds folder not found: ${seedsFolder}`);
  //   process.exit(1);
  // }
  // const provider = new FileSeedProvider({ fs, path, seedFolder: path.resolve(seedsFolder) });
  // const seeder = new Seeder({ stores, provider, seedTableName: SEED_TABLE_NAME });

  // let error: unknown;
  // let results: SeedResult[] | undefined;

  // if (!name) {
  //   ({ error, results } = await migrator.seedToLatest());
  // } else {
  //   const seeds = await migrator.getSeeds();
  //   if (!seeds.find((m) => m.name === name)) {
  //     feed.fail(`Seed ${name} not found.`);
  //     process.exit(1);
  //   }
  //   ({ error, results } = await migrator.seedTo(name));
  // }

  // // process the results
  // results?.forEach((it) => {
  //   if (it.status === "Success") feed.succeed(`Applied seed ${it.seedName} successfully.`);
  //   else if (it.status === "Error") feed.fail(`Error applying ${it.seedName}.`);
  // });

  // if (error) {
  //   feed.fail(`Error applying seed: ${error}`);
  //   console.error(error);
  //   process.exit(1);
  // } else {
  //   feed.succeed("All seeds applied successfully.");
  // }
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
