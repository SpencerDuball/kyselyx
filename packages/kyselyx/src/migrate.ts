import fs from "fs-extra";
import { FileMigrationProvider, Migrator, type MigrationInfo } from "kysely";
import ora from "ora";
import path from "path";
import { getConfig } from "./config.js";

const MIGRATION_TABLE_NAME = "kyselyx_migration";
const MIGRATION_LOCK_TABLE_NAME = "kyselyx_migration_lock";

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
 * Applies all migrations up to the lastest migration.
 */
export async function migrate() {
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
  const { error, results } = await migrator.migrateToLatest();

  // process the results
  results?.forEach((it) => {
    if (it.status === "Success") feed.succeed(`Applied migration ${it.migrationName} successfully.`);
    else if (it.status === "Error") feed.fail(`Error applying ${it.migrationName}.`);
    else if (it.status === "NotExecuted") feed.fail(`Migrations not executed due to prior error ${it.migrationName}.`);
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
    `Last Migration: ${lastAppliedMigration?.name || "NONE"}`,
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
