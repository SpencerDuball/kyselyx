import fs from "fs-extra";
import { NO_MIGRATIONS, type NoMigrations } from "kysely";
import ora from "ora";
import path from "path";
import { getConfig } from "./config.js";
import { ConfigError, FileSystemError, MigrationError, SeedError } from "./errors.js";
import { NO_SEEDS } from "./seeder/seed.js";
import {
  doesNameMatch,
  exitFailure,
  getMigrations,
  getMigrator,
  getSeeder,
  getTargetSeed,
  isNoMigrations,
  isNoSeeds,
  type Migration,
} from "./utils.js";

const templateTs = [
  `import { Kysely, sql } from "kysely";`,
  ``,
  `/**`,
  ` * The 'up' function runs when the migration is applied.`,
  ` */`,
  `async function up(db: Kysely<any>): Promise<void> {}`,
  ``,
  `/**`,
  ` * The 'down' function runs when the migration is removed.`,
  ` */`,
  `async function down(db: Kysely<any>): Promise<void> {}`,
  ``,
  `export { up, down };`,
].join("\n");

const templateJs = [
  `import { Kysely, sql } from "kysely";`,
  ``,
  `/**`,
  ` * The 'up' function runs when the migration is applied.`,
  ` *`,
  ` * @param {import("kysely").Kysely<any>} db`,
  ` * @returns {Promise<void>}`,
  ` */`,
  `async function up(db) {}`,
  ``,
  `/**`,
  ` * The 'down' function runs when the migration is removed.`,
  ` *`,
  ` * @param {import("kysely").Kysely<any>} db`,
  ` * @returns {Promise<void>}`,
  ` */`,
  `async function down(db) {}`,
  ``,
  `export { up, down };`,
].join("\n");

/**
 * Applied all migrations up to the latest migration, or to the specified migration.
 *
 * @param name The name of the migration to migrate to.
 */
export async function migrate(name?: string) {
  const migrator = getMigrator().match((i) => i, exitFailure);

  // retrieve all migrations
  let feed = ora({ stream: process.stdout }).start("Getting migrations ...");
  const { allMigrations } = (await getMigrations(migrator)).match((i) => i, exitFailure);
  feed.clear();

  // find the migration
  let migration: Migration | undefined;
  if (name) migration = allMigrations.find(doesNameMatch(name));
  else migration = allMigrations.at(-1);

  if (!migration) exitFailure(new MigrationError("cf085c", "Could not find migration to migrate to."));

  // apply the migrations
  feed.start("Applying migrations ...");
  const { error, results } = await migrator.migrateTo(migration.name);
  feed.clear();

  // process the results
  results?.forEach((it) => {
    if (it.status === "Success") feed.succeed(`Applied migration ${it.migrationName} successfully.`);
    else if (it.status === "Error") feed.fail(`Failed to apply migration ${it.migrationName}.`);
  });

  if (error) exitFailure(new MigrationError("1ac167", "Error applying migrations."));
  else feed.succeed("Migrations applied successfully.");
}

/**
 * Undo the last migration or all migrations up to the specified name provided.
 *
 * @param name The name of the migration to rollback to.
 */
export async function undo(name?: string) {
  const migrator = getMigrator().match((i) => i, exitFailure);

  // retrieve all migrations
  let feed = ora({ stream: process.stdout }).start("Getting migrations ...");
  const { appliedMigrations } = (await getMigrations(migrator)).match((i) => i, exitFailure);
  feed.clear();

  // find the migration to rollback to
  let migration: Migration | NoMigrations | undefined;
  if (name) {
    const namedMigration = appliedMigrations.find(doesNameMatch(name));
    if (namedMigration) {
      const namedMigrationIdx = appliedMigrations.indexOf(namedMigration);
      if (namedMigrationIdx === -1)
        exitFailure(new MigrationError("7eb0e2", "Could not find migration to rollback to."));
      else if (namedMigrationIdx === 0) migration = NO_MIGRATIONS;
      else migration = appliedMigrations.at(namedMigrationIdx - 1);
    }
  } else {
    if (appliedMigrations.length > 1) migration = appliedMigrations.at(-2);
    else if (appliedMigrations.length === 1) migration = NO_MIGRATIONS;
  }

  if (!migration) {
    if (name) feed.fail(`Could not find migration to rollback to.`);
    else feed.fail(`No migrations to rollback.`);
    return;
  }

  // find seed to rollback to
  feed.start("Finding seed to rollback to ...");
  (await getTargetSeed({ migration }))
    .map((targetSeed) =>
      getSeeder().map(async (seeder) => {
        console.log("migration: ", migration);
        console.log("targetSeed: ", targetSeed);
        feed.start("Rolling back seeds ...");
        const { error, results } = await seeder.seedTo(isNoSeeds(targetSeed) ? NO_SEEDS : targetSeed.name);
        feed.clear();

        // process the results
        results?.forEach((it) => {
          if (it.status === "Success") feed.succeed(`Dropped seed ${it.seedName} successfully.`);
          else if (it.status === "Error") feed.fail(`Failed to drop seed ${it.seedName}.`);
        });

        if (error) exitFailure(new SeedError("c82c50", "Error dropping seeds."));
        else feed.succeed("Seeds dropped successfully.");
      }),
    )
    .mapErr((e) => {
      if (e instanceof ConfigError) feed.succeed("No seeds to rollback.");
      else exitFailure(new SeedError("c6d495", "Error rolling back seeds."));
    });
  feed.clear();

  // rollback the migrations
  feed.start("Rolling back migrations ...");
  const { error, results } = await migrator.migrateTo(isNoMigrations(migration) ? NO_MIGRATIONS : migration.name);
  feed.clear();

  // process the results
  results?.forEach((it) => {
    if (it.status === "Success") feed.succeed(`Rolled back migration ${it.migrationName} successfully.`);
    else if (it.status === "Error") feed.fail(`Failed to rollback migration ${it.migrationName}.`);
  });

  if (error) exitFailure(new MigrationError("bc184e", "Error rolling back migrations."));
  else feed.succeed("Migrations rolled back successfully.");
}

/**
 * Undo all migrations.
 */
export async function undoAll() {
  const migrator = getMigrator().match((i) => i, exitFailure);

  // retrieve all migrations
  let feed = ora({ stream: process.stdout }).start("Getting migrations ...");
  const { appliedMigrations } = (await getMigrations(migrator)).match((i) => i, exitFailure);
  feed.clear();

  if (appliedMigrations.length === 0) {
    feed.fail("No migrations to rollback.");
    return;
  }

  // find seed to rollback to
  feed.start("Finding seed to rollback to ...");
  (await getTargetSeed({ migration: NO_MIGRATIONS }))
    .map((targetSeed) => {
      return getSeeder().map(async (seeder) => {
        feed.start("Rolling back seeds ...");
        const { error, results } = await seeder.seedTo(isNoSeeds(targetSeed) ? NO_SEEDS : targetSeed.name);
        feed.clear();

        // process the results
        results?.forEach((it) => {
          if (it.status === "Success") feed.succeed(`Dropped seed ${it.seedName} successfully.`);
          else if (it.status === "Error") feed.fail(`Failed to drop seed ${it.seedName}.`);
        });

        if (error) exitFailure(new SeedError("c82c50", "Error dropping seeds."));
        else feed.succeed("Seeds dropped successfully.");
      });
    })
    .mapErr((e) => {
      if (e instanceof ConfigError) feed.succeed("No seeds to rollback.");
      else exitFailure(new SeedError("c6d495", "Error rolling back seeds."));
    });
  feed.clear();

  // rollback all migrations
  feed.start("Rolling back migrations ...");
  const { error, results } = await migrator.migrateTo(NO_MIGRATIONS);
  feed.clear();

  // process the results
  results?.forEach((it) => {
    if (it.status === "Success") feed.succeed(`Rolled back migration ${it.migrationName} successfully.`);
    else if (it.status === "Error") feed.fail(`Failed to rollback migration ${it.migrationName}.`);
  });

  if (error) exitFailure(new MigrationError("a317f8", "Error rolling back migrations."));
  else feed.succeed("Migrations rolled back successfully.");
}

/**
 * Generates a new migration file.
 *
 * @param name The label of the migration to generate.
 * @param opts Options for generating the migration file.
 * @param opts.js Generate a JavaScript migration file.
 */
export async function generate(name: string, opts = { js: false }) {
  const { migrationsFolder } = getConfig().match((i) => i, exitFailure);

  // generate the migration file
  let feed = ora({ stream: process.stdout }).start("Generating migration ...");
  const migrationId = `${Date.now()}_${name}`;
  await fs.ensureDir(migrationsFolder).catch((e) => exitFailure(FileSystemError.fromThrown("353782")(e)));
  if (opts.js) {
    await fs
      .writeFile(path.resolve(migrationsFolder, `${migrationId}.js`), templateJs)
      .catch((e) => exitFailure(FileSystemError.fromThrown("1d7ef4")(e)));
    feed.succeed(`Created migration file: "${migrationId}.js"`);
  } else {
    await fs
      .writeFile(path.resolve(migrationsFolder, `${migrationId}.ts`), templateTs)
      .catch((e) => exitFailure(FileSystemError.fromThrown("992638")(e)));
    feed.succeed(`Created migration file: "${migrationId}.ts"`);
  }
}
