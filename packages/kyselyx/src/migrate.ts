import fs from "fs-extra";
import { FileMigrationProvider, Migrator, NO_MIGRATIONS, type MigrationResult, type NoMigrations } from "kysely";
import ora from "ora";
import path from "path";
import { getConfig, MIGRATION_LOCK_TABLE_NAME, MIGRATION_TABLE_NAME, SEED_TABLE_NAME } from "./config.js";
import { FileSeedProvider } from "./seeder/file-seed-provider.js";
import { NO_SEEDS, Seeder } from "./seeder/seed.js";
import { getMaxSeed, getMigrations, getSeeds, isNoSeeds, type AppliedMigration } from "./utils.js";

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
 * Applies all migrations up to the lastest migration, or to the specified migration.
 *
 * @param name The name of the migration to migrate to.
 */
export async function migrate(name?: string) {
  let feed = ora({ text: "Connecting to the database ...", stream: process.stdout }).start();
  const {
    stores: { db },
    migrationsFolder,
  } = getConfig();
  feed.clear();

  // create the migrator
  if (!fs.existsSync(migrationsFolder)) {
    feed.fail(`Migrations folder not found: ${migrationsFolder}`);
    process.exit(1);
  }
  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({ fs, path, migrationFolder: path.resolve(migrationsFolder) }),
    migrationTableName: MIGRATION_TABLE_NAME,
    migrationLockTableName: MIGRATION_LOCK_TABLE_NAME,
  });

  // get migrations
  feed.text = "Getting all migrations ...";
  const { allMigrations } = await getMigrations(migrator);
  feed.clear();

  // apply the migrations
  let error: unknown;
  let results: MigrationResult[] | undefined;

  if (!name) {
    ({ error, results } = await migrator.migrateToLatest());
  } else {
    if (!allMigrations.find((m) => m.name === name)) {
      feed.fail(`Migration ${name} not found.`);
      process.exit(1);
    }
    ({ error, results } = await migrator.migrateTo(name));
  }

  // process the results
  results?.forEach((it) => {
    if (it.status === "Success") feed.succeed(`Applied migration ${it.migrationName} successfully.`);
    else if (it.status === "Error") feed.fail(`Error applying ${it.migrationName}.`);
  });

  if (error) {
    feed.fail(`Error applying migrations.`);
    console.error(error);
    process.exit(1);
  } else {
    feed.succeed("All migrations applied successfully.");
  }
}

/**
 * Displays the status of all migrations, showing which have been applied and which have not.
 */
export async function status() {
  let feed = ora({ text: "Connecting to the database ...", stream: process.stdout }).start();
  const {
    stores: { db },
    migrationsFolder,
  } = getConfig();
  feed.clear();

  // create the migrator
  if (!fs.existsSync(migrationsFolder)) {
    feed.fail(`Migrations folder not found: ${migrationsFolder}`);
    process.exit(1);
  }
  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({ fs, path, migrationFolder: path.resolve(migrationsFolder) }),
    migrationTableName: MIGRATION_TABLE_NAME,
    migrationLockTableName: MIGRATION_LOCK_TABLE_NAME,
  });

  // get migrations
  feed.text = "Getting all migrations ...";
  const { unappliedMigrations, appliedMigrations } = await getMigrations(migrator);
  feed.clear();

  // display the information
  let statusLine = [
    `Total Migrations: ${unappliedMigrations.length + appliedMigrations.length}`,
    `Applied Migrations: ${appliedMigrations.length}`,
    `Last Migration: ${appliedMigrations.at(-1) ?? "NONE"}`,
  ].join("     ");
  console.log(statusLine);
  console.log(Array(statusLine.length).fill("-").join(""));

  for (let migration of appliedMigrations) feed.succeed(`Migration ${migration.name} applied.`);
  for (let migration of unappliedMigrations) feed.fail(`Migration ${migration.name} not applied.`);
}

/**
 * Undo the last migration or all migrations up to the specified name provided.
 *
 * @param name The name of the migration to rollback to.
 */
export async function undo(name?: string) {
  let feed = ora({ text: "Connecting to the database ...", stream: process.stdout }).start();
  const { stores, migrationsFolder, seedsFolder } = getConfig();
  feed.clear();

  // create the migrator
  if (!fs.existsSync(migrationsFolder)) {
    feed.fail(`Migrations folder not found: ${migrationsFolder}`);
    process.exit(1);
  }
  const migrator = new Migrator({
    db: stores.db,
    provider: new FileMigrationProvider({ fs, path, migrationFolder: path.resolve(migrationsFolder) }),
    migrationTableName: MIGRATION_TABLE_NAME,
    migrationLockTableName: MIGRATION_LOCK_TABLE_NAME,
  });

  // get migrations
  feed.text = "Getting all migrations ...";
  const { appliedMigrations } = await getMigrations(migrator);
  feed.clear();

  // find the migration to rollback to
  let undoTarget: NoMigrations | AppliedMigration | null = null;
  if (appliedMigrations.length === 0) {
    feed.succeed("No migrations to undo.");
    return;
  } else if (!name && appliedMigrations.length === 1) undoTarget = NO_MIGRATIONS;
  else if (!name && appliedMigrations.length > 1) undoTarget = appliedMigrations.at(-2) ?? null;
  else if (name) undoTarget = appliedMigrations.find((m) => m.name === name) ?? null;

  if (!undoTarget) {
    feed.fail(`Migration ${name} not found.`);
    process.exit(1);
  } else if ("name" in undoTarget && undoTarget.name === appliedMigrations.at(-1)?.name) {
    feed.succeed(`Migration ${name} is already latest migration.`);
    return;
  }

  // undo seeds applied after target migration
  if (fs.existsSync(seedsFolder)) {
    feed.start("Getting the max seed that may be applied ...");
    const maxSeed = await getMaxSeed(undoTarget);
    feed.clear();

    if (maxSeed !== null) {
      const seeder = new Seeder({
        stores,
        provider: new FileSeedProvider({ fs, path, seedFolder: path.resolve(seedsFolder) }),
        seedTableName: SEED_TABLE_NAME,
      });

      feed.start("Getting the last seed applied ...");
      const currentSeed = await getSeeds(seeder).then(({ appliedSeeds }) => appliedSeeds.at(-1));
      feed.clear();

      let tgtSeed = maxSeed;
      if (currentSeed && !isNoSeeds(maxSeed) && currentSeed.timestamp <= maxSeed.timestamp) {
        feed.succeed("No seeds to undo.");
        tgtSeed = currentSeed;
      } else {
        feed.start("Rolling back seeds ...");
        const { error, results } = await seeder.seedTo(isNoSeeds(tgtSeed) ? NO_SEEDS : tgtSeed.name);

        if (error || results === undefined) {
          feed.fail("Error rolling back seeds.");
          console.error(error);
          process.exit(1);
        }

        for (let result of results) {
          if (result.status === "Success") feed.succeed(`Rolled back seed ${result.seedName} successfully.`);
          else if (result.status === "Error") feed.fail(`Error rolling back ${result.seedName}.`);
        }
      }
      feed.clear();
    }
  }

  // rollback migrations
  feed.start(`Rolling back migrations ...`);
  const { error, results } = await migrator.migrateTo("name" in undoTarget ? undoTarget.name : NO_MIGRATIONS);

  if (error || results === undefined) {
    feed.fail(`Error rolling back migrations.`);
    console.error(error);
    process.exit(1);
  }

  for (let result of results) {
    if (result.status === "Success") feed.succeed(`Rolled back migration ${result.migrationName} successfully.`);
    else if (result.status === "Error") feed.fail(`Error rolling back ${result.migrationName}.`);
  }
}

/**
 * Undo all migrations
 */
export async function undoAll() {
  let feed = ora({ text: "Connecting to the database ...", stream: process.stdout }).start();
  const { stores, seedsFolder, migrationsFolder } = getConfig();
  feed.clear();

  // create the migrator
  if (!fs.existsSync(migrationsFolder)) {
    feed.fail(`Migrations folder not found: ${migrationsFolder}`);
    process.exit(1);
  }
  const migrator = new Migrator({
    db: stores.db,
    provider: new FileMigrationProvider({ fs, path, migrationFolder: path.resolve(migrationsFolder) }),
    migrationTableName: MIGRATION_TABLE_NAME,
    migrationLockTableName: MIGRATION_LOCK_TABLE_NAME,
  });

  // get all migrations
  feed.text = "Getting all migrations ...";
  const { appliedMigrations } = await getMigrations(migrator);
  feed.clear();

  if (appliedMigrations.length === 0) {
    feed.succeed("No migrations to undo.");
  } else {
    if (fs.existsSync(seedsFolder)) {
      // undo seeds applied after first migration
      feed.start("Getting the max seed that may be applied ...");
      const maxSeed = await getMaxSeed(NO_MIGRATIONS);
      feed.clear();

      if (maxSeed !== null) {
        const seeder = new Seeder({
          stores,
          provider: new FileSeedProvider({ fs, path, seedFolder: path.resolve(seedsFolder) }),
          seedTableName: SEED_TABLE_NAME,
        });

        feed.start("Getting the last seed applied ...");
        const currentSeed = await getSeeds(seeder).then(({ appliedSeeds }) => appliedSeeds.at(-1));
        feed.clear();

        let tgtSeed = maxSeed;
        if (currentSeed && !isNoSeeds(maxSeed) && currentSeed.timestamp <= maxSeed.timestamp) {
          feed.succeed("No seeds to undo.");
          tgtSeed = currentSeed;
        } else {
          feed.start("Rolling back seeds ...");
          const { error, results } = await seeder.seedTo(isNoSeeds(tgtSeed) ? NO_SEEDS : tgtSeed.name);

          if (error || results === undefined) {
            feed.fail("Error rolling back seeds.");
            console.error(error);
            process.exit(1);
          }

          for (let result of results) {
            if (result.status === "Success") feed.succeed(`Rolled back seed ${result.seedName} successfully.`);
            else if (result.status === "Error") feed.fail(`Error rolling back ${result.seedName}.`);
          }
        }
        feed.clear();
      }
    }

    // rollback migrations
    feed.text = "Rolling back all migrations ...";
    const { error, results } = await migrator.migrateTo(NO_MIGRATIONS);

    if (error || results === undefined) {
      feed.fail(`Error rolling back migrations.`);
      console.error(error);
      process.exit(1);
    }

    for (let result of results) {
      if (result.status !== "Success") {
        feed.fail(`Error rolling back ${result.migrationName}.`);
        process.exit(1);
      }
    }

    feed.succeed("All migrations rolled back successfully.");
  }
}

/**
 * Creates a new migration file with the specified name.
 */
export async function new_(name: string) {
  const { migrationsFolder } = getConfig();

  // generate the migration file
  let feed = ora({ text: "Creating migration file ...", stream: process.stdout }).start();
  const migrationId = `${Date.now()}_${name}`;
  await fs.ensureDir(migrationsFolder);
  await fs.writeFile(path.resolve(migrationsFolder, `${migrationId}.ts`), template);
  feed.succeed(`Created migration file: "${migrationId}.ts"`);
}
