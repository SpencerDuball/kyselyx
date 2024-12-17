import ora, { type Options } from "ora";
import { getConfig, MIGRATION_LOCK_TABLE_NAME, MIGRATION_TABLE_NAME, SEED_TABLE_NAME } from "./config.js";
import { migrate, undoAll as undoAllMigrations } from "./migrate.js";
import { seed, undoAll as undoAllSeeds } from "./seed.js";
import { exitFailure } from "./utils.js";

/**
 * Reverts all seeds, migrations, and deletes all metadata (locks, seeds/migration metadata) from
 * the database. This is an escape hatch to reset a database to 'like new'.
 */
export async function purge(opts?: { ora?: Options }) {
  let feed = ora({ stream: process.stdout, ...opts?.ora });

  // undo seeds & migrations
  feed.start("Undoing seeds ...");
  await undoAllSeeds({ ora: { isSilent: true } });
  feed.text = "Undoing migrations ...";
  await undoAllMigrations({ ora: { isSilent: true } });

  // drop metadata tables
  const {
    stores: { db },
  } = getConfig().match((i) => i, exitFailure);

  feed.text = "Dropping kyselyx metadata tables ...";
  await db.schema.dropTable(SEED_TABLE_NAME).ifExists().execute();
  await db.schema.dropTable(MIGRATION_TABLE_NAME).ifExists().execute();
  await db.schema.dropTable(MIGRATION_LOCK_TABLE_NAME).ifExists().execute();

  feed.succeed("Successfully purged the database.");
}

/**
 * Runs all pending migrations and seeds.
 */
export async function setup(opts?: { ora?: Options }) {
  let feed = ora({ stream: process.stdout, ...opts?.ora });

  feed.start("Running migrations ...");
  await migrate(undefined, { ora: { isSilent: true } });
  feed.text = "Running seeds ...";
  await seed(undefined, { ora: { isSilent: true } });

  feed.succeed("Database setup complete.");
}

/**
 * Purges the database and then runs all migrations and seeds.
 */
export async function reset() {
  let feed = ora({ stream: process.stdout });

  feed.start("Puring the database ...");
  await purge({ ora: { isSilent: true } });
  feed.text = "Running migrations and seeds ...";
  await setup({ ora: { isSilent: true } });

  feed.succeed("Database reset complete.");
}
