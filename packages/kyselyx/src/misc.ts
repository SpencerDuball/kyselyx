import ora from "ora";
import { getConfig, MIGRATION_LOCK_TABLE_NAME, MIGRATION_TABLE_NAME, SEED_TABLE_NAME } from "./config.js";
import { migrate, undoAll as undoAllMigrations } from "./migrate.js";
import { seed, undoAll as undoAllSeeds } from "./seed.js";
import { exitFailure } from "./utils.js";

/**
 * Reverts all seeds, migrations, and deletes all metadata (locks, seeds/migration metadata) from
 * the database. This is an escape hatch to reset a database to 'like new'.
 */
export async function purge() {
  let feed = ora({ stream: process.stdout });

  // undo seeds & migrations
  await undoAllSeeds();
  await undoAllMigrations();

  // drop metadata tables
  const {
    stores: { db },
  } = getConfig().match((i) => i, exitFailure);

  feed.start("Dropping Kyselyx metadata tables ...");
  await db.schema.dropTable(SEED_TABLE_NAME).ifExists().execute();
  await db.schema.dropTable(MIGRATION_TABLE_NAME).ifExists().execute();
  await db.schema.dropTable(MIGRATION_LOCK_TABLE_NAME).ifExists().execute();
  feed.succeed("Dropped Kyselyx metadata tables successfully.");
}

/**
 * Runs all pending migrations and seeds.
 */
export async function setup() {
  await migrate();
  await seed();
}

/**
 * Purges the database and then runs all migrations and seeds.
 */
export async function reset() {
  await purge();
  await setup();
}
