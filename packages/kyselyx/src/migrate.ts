import fs from "fs-extra";
import { FileMigrationProvider, Migrator, NO_MIGRATIONS, type MigrationInfo, type MigrationResult } from "kysely";
import ora from "ora";
import path from "path";
import { getConfig, MIGRATION_LOCK_TABLE_NAME, MIGRATION_TABLE_NAME } from "./config.js";

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

  // apply the migrations
  if (!fs.existsSync(migrationsFolder)) {
    feed.fail(`Migrations folder not found: ${migrationsFolder}`);
    process.exit(1);
  }
  const provider = new FileMigrationProvider({ fs, path, migrationFolder: path.resolve(migrationsFolder) });
  const migrator = new Migrator({
    db,
    provider,
    migrationTableName: MIGRATION_TABLE_NAME,
    migrationLockTableName: MIGRATION_LOCK_TABLE_NAME,
  });

  let error: unknown;
  let results: MigrationResult[] | undefined;

  if (!name) {
    ({ error, results } = await migrator.migrateToLatest());
  } else {
    const migrations = await migrator.getMigrations();
    if (!migrations.find((m) => m.name === name)) {
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

  // get the migrations
  if (!fs.existsSync(migrationsFolder)) {
    feed.fail(`Migrations folder not found: ${migrationsFolder}`);
    process.exit(1);
  }
  const provider = new FileMigrationProvider({ fs, path, migrationFolder: path.resolve(migrationsFolder) });
  const migrator = new Migrator({
    db,
    provider,
    migrationTableName: MIGRATION_TABLE_NAME,
    migrationLockTableName: MIGRATION_LOCK_TABLE_NAME,
  });
  const migrations = await migrator.getMigrations();

  // collect a snapshot of the migrations info
  let lastAppliedMigration: MigrationInfo | null = null;
  let totalAppliedMigrations = 0;
  for (let migration of migrations) {
    if (migration.executedAt !== undefined) {
      lastAppliedMigration = migration;
      totalAppliedMigrations++;
    }
  }

  // display the information
  let statusLine = [
    `Total Migrations: ${migrations.length}`,
    `Applied Migrations: ${totalAppliedMigrations}`,
    `Last Migration: ${lastAppliedMigration?.name ?? "NONE"}`,
  ].join("     ");
  console.log(statusLine);
  console.log(Array(statusLine.length).fill("-").join(""));

  for (let migration of migrations) {
    if (migration.executedAt) feed.succeed(`Migration ${migration.name} applied.`);
    else feed.fail(`Migration ${migration.name} not applied.`);
  }
}

/**
 * Undo the last migration or all migrations up to the specified name provided.
 *
 * @param name The name of the migration to rollback to.
 */
export async function undo(name?: string) {
  let feed = ora({ text: "Connecting to the database ...", stream: process.stdout }).start();
  const {
    stores: { db },
    migrationsFolder,
    seedsFolder,
  } = getConfig();
  feed.clear();

  // get the migrations
  if (!fs.existsSync(migrationsFolder)) {
    feed.fail(`Migrations folder not found: ${migrationsFolder}`);
    process.exit(1);
  }
  const provider = new FileMigrationProvider({ fs, path, migrationFolder: path.resolve(migrationsFolder) });
  const migrator = new Migrator({
    db,
    provider,
    migrationTableName: MIGRATION_TABLE_NAME,
    migrationLockTableName: MIGRATION_LOCK_TABLE_NAME,
  });
  const migrations = await migrator.getMigrations();
  const appliedMigrations = migrations.filter((m) => m.executedAt !== undefined);

  if (appliedMigrations.length === 0) {
    feed.succeed("No migrations to undo.");
  } else {
    // find the migration to rollback to
    let undoTarget: "NO_MIGRATIONS" | MigrationInfo | null = null;
    if (!name && appliedMigrations.length === 1) {
      undoTarget = "NO_MIGRATIONS";
    } else if (!name && appliedMigrations.length > 1) {
      undoTarget = appliedMigrations.at(-1)!;
    } else if (name) {
      undoTarget = appliedMigrations.find((m) => m.name === name) ?? null;
    }

    if (!undoTarget) {
      feed.fail(`Migration ${name} not found.`);
      process.exit(1);
    }

    // TODO: rollback seeds that were applied after the target migration

    // rollback the migrations
    let error: unknown;
    let results: MigrationResult[] | undefined;

    if (undoTarget === "NO_MIGRATIONS") {
      feed.start(`Rolling back all migrations ...`);
      ({ error, results } = await migrator.migrateTo(NO_MIGRATIONS));
    } else {
      const priorToTargetIdx = migrations.findIndex((m) => m.name === undoTarget.name) - 1;
      const migrateTo = priorToTargetIdx >= 0 ? migrations[priorToTargetIdx]!.name : NO_MIGRATIONS;
      feed.start(`Rolling back to migration before ${undoTarget.name} ...`);
      ({ error, results } = await migrator.migrateTo(migrateTo));
    }

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
}

/**
 * Undo all migrations
 */
export async function undoAll() {
  let feed = ora({ text: "Connecting to the database ...", stream: process.stdout }).start();
  const {
    stores: { db },
    migrationsFolder,
    seedsFolder,
  } = getConfig();
  feed.clear();

  // undo all seeds

  // undo all migrations
  if (!fs.existsSync(migrationsFolder)) {
    feed.fail(`Migrations folder not found: ${migrationsFolder}`);
    process.exit(1);
  }
  const provider = new FileMigrationProvider({ fs, path, migrationFolder: path.resolve(migrationsFolder) });
  const migrator = new Migrator({
    db,
    provider,
    migrationTableName: MIGRATION_TABLE_NAME,
    migrationLockTableName: MIGRATION_LOCK_TABLE_NAME,
  });

  // get all migrations
  feed.text = "Getting all migrations ...";
  const migrations = await migrator.getMigrations();
  let totalAppliedMigrations = 0;
  for (let migration of migrations) migration.executedAt && totalAppliedMigrations++;

  if (totalAppliedMigrations === 0) {
    feed.succeed("No migrations to undo.");
  } else {
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
