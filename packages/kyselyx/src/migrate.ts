import fs from "fs-extra";
import { NO_MIGRATIONS, type NoMigrations } from "kysely";
import ora from "ora";
import path from "path";
import { getConfig } from "./config.js";
import { MigrationError } from "./errors.js";
import { doesNameMatch, exitFailure, getMigrations, getMigrator, isNoMigrations, type Migration } from "./utils.js";

const template = [
  `import { Kysely, sql } from "kysely";`,
  ``,
  `async function up(db: Kysely<any>): Promise<void> {}`,
  ``,
  `async function down(db: Kysely<any>): Promise<void> {}`,
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

  if (!migration) exitFailure(new MigrationError("Could not find migration to migrate to."));

  // apply the migrations
  feed.start("Applying migrations ...");
  const { error, results } = await migrator.migrateTo(migration.name);
  feed.clear();

  // process the results
  results?.forEach((it) => {
    if (it.status === "Success") feed.succeed(`Applied migration ${it.migrationName} successfully.`);
    else if (it.status === "Error") feed.fail(`Failed to apply migration ${it.migrationName}.`);
  });

  if (error) exitFailure(new MigrationError("Error applying migrations."));
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
      if (namedMigrationIdx === -1) exitFailure(new MigrationError("Could not find migration to rollback to."));
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

  // TODO: Rollback applicable seeds

  // rollback the migrations
  feed.start("Rolling back migrations ...");
  const { error, results } = await migrator.migrateTo(isNoMigrations(migration) ? NO_MIGRATIONS : migration.name);
  feed.clear();

  // process the results
  results?.forEach((it) => {
    if (it.status === "Success") feed.succeed(`Rolled back migration ${it.migrationName} successfully.`);
    else if (it.status === "Error") feed.fail(`Failed to rollback migration ${it.migrationName}.`);
  });

  if (error) exitFailure(new MigrationError("Error rolling back migrations."));
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

  // TODO: Rollback applicable seeds

  // rollback all migrations
  feed.start("Rolling back migrations ...");
  const { error, results } = await migrator.migrateTo(NO_MIGRATIONS);
  feed.clear();

  // process the results
  results?.forEach((it) => {
    if (it.status === "Success") feed.succeed(`Rolled back migration ${it.migrationName} successfully.`);
    else if (it.status === "Error") feed.fail(`Failed to rollback migration ${it.migrationName}.`);
  });

  if (error) exitFailure(new MigrationError("Error rolling back migrations."));
  else feed.succeed("Migrations rolled back successfully.");
}

/**
 * Generates a new migration file.
 *
 * @param name The label of the migration to generate.
 */
export async function generate(name: string) {
  const { migrationsFolder } = getConfig().match((i) => i, exitFailure);

  // generate the migration file
  let feed = ora({ stream: process.stdout }).start("Generating migration ...");
  const migrationId = `${Date.now()}_${name}`;
  await fs.ensureDir(migrationsFolder);
  await fs.writeFile(path.resolve(migrationsFolder, `${migrationId}.ts`), template);
  feed.succeed(`Created migration file: "${migrationId}.ts"`);
}
