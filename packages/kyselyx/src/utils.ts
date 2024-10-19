import fs from "fs-extra";
import { FileMigrationProvider, Migrator, NO_MIGRATIONS, type MigrationInfo, type NoMigrations } from "kysely";
import path from "path";
import { getConfig, MIGRATION_LOCK_TABLE_NAME, MIGRATION_TABLE_NAME, SEED_TABLE_NAME } from "./config.js";
import { FileSeedProvider } from "./seeder/file-seed-provider.js";
import { NO_SEEDS, Seeder, type NoSeeds, type SeedInfo } from "./seeder/seed.js";

export interface Migration extends MigrationInfo {
  timestamp: number;
}

export interface AppliedMigration extends Migration {
  executedAt: Date;
}

export interface UnappliedMigration extends Migration {
  executedAt: undefined;
}

/**
 * Accepts a seed or migration & returns the timestamp of it's creation.
 */
function getTimestamp(item: MigrationInfo | SeedInfo) {
  let timestamp = /(?<timestamp>^\d+)_.*$/.exec(item.name)?.groups?.timestamp;

  if (!timestamp) {
    if ("migration" in item) {
      throw new Error(
        `Invalid migration name "${item.name}", migration name must start with a timestamp in milliseconds.`,
      );
    } else {
      throw new Error(`Invalid seed name "${item.name}", seed name must start with a timestamp in milliseconds.`);
    }
  }

  let timestampMs = parseInt(timestamp);
  if (isNaN(timestampMs)) {
    throw new Error(`Invalid timestamp in "${item.name}".`);
  }

  return timestampMs;
}

/**
 * Gets all migrations and returns a list of all migrations, applied migrations, and
 * unapplied migrations.
 *
 * @param migrator The Migrator to make requests to the database.
 */
export async function getMigrations(migrator: Migrator) {
  const migrations = await migrator.getMigrations();

  const allMigrations: Migration[] = [];
  const unappliedMigrations: UnappliedMigration[] = [];
  const appliedMigrations: AppliedMigration[] = [];
  for (const migration of migrations) {
    const _migration = { ...migration, timestamp: getTimestamp(migration) };

    allMigrations.push(_migration);
    if (_migration.executedAt) appliedMigrations.push(_migration as AppliedMigration);
    else unappliedMigrations.push(_migration as UnappliedMigration);
  }

  return { allMigrations, unappliedMigrations, appliedMigrations };
}

export interface Seed extends SeedInfo {
  timestamp: number;
}

export interface AppliedSeed extends Seed {
  executedAt: Date;
}

export interface UnappliedSeed extends Seed {
  executedAt: undefined;
}

/**
 * Gets all seeds and returns a list of all seeds, applied seeds, and unapplied seeds.
 *
 * @param seeder The Seeder to make requests to the database.
 */
export async function getSeeds(seeder: Seeder) {
  const seeds = await seeder.getSeeds();

  const allSeeds: Seed[] = [];
  const unappliedSeeds: UnappliedSeed[] = [];
  const appliedSeeds: AppliedSeed[] = [];
  for (const seed of seeds) {
    const _seed = { ...seed, timestamp: getTimestamp(seed) };

    allSeeds.push(_seed);
    if (_seed.executedAt) appliedSeeds.push(_seed as AppliedSeed);
    else unappliedSeeds.push(_seed as UnappliedSeed);
  }

  return { allSeeds, unappliedSeeds, appliedSeeds };
}

/**
 * Gets the max seed that may be applied given the last applied migration. The seed's
 * timestamp may not exceed the timestamp of the last applied migration.
 *
 * @param migration The last applied migration.
 * @returns The max seed that may be applied, if there are no seeds available null is
 * returned.
 */
export async function getMaxSeed(migration?: Migration | NoMigrations) {
  const { stores, seedsFolder, migrationsFolder } = getConfig();

  // get all migrations
  const migrator = new Migrator({
    db: stores.db,
    provider: new FileMigrationProvider({ fs, path, migrationFolder: path.resolve(migrationsFolder) }),
    migrationTableName: MIGRATION_TABLE_NAME,
    migrationLockTableName: MIGRATION_LOCK_TABLE_NAME,
  });
  const { allMigrations, appliedMigrations } = await getMigrations(migrator);

  // determine the target migration (if not provided)
  if (!migration) migration = appliedMigrations.at(-1) ?? NO_MIGRATIONS;

  // determine the max timestamp for seeds
  let maxTimestamp = Infinity;
  if (isNoMigrations(migration) && allMigrations.at(0)) maxTimestamp = allMigrations.at(0)!.timestamp;
  else if (!isNoMigrations(migration)) {
    const _migration = migration; // to prevent TS from complaining
    const idxOfTgtMigration = allMigrations.findIndex((m) => m.name === _migration.name);
    const nextMigration = allMigrations.at(idxOfTgtMigration + 1);
    if (nextMigration) maxTimestamp = nextMigration.timestamp;
  }

  // get all seeds
  const seeder = new Seeder({
    stores,
    provider: new FileSeedProvider({ fs, path, seedFolder: path.resolve(seedsFolder) }),
    seedTableName: SEED_TABLE_NAME,
  });
  const { allSeeds } = await getSeeds(seeder);

  let maxSeed: Seed | NoSeeds | null = null;
  if (allSeeds.length === 0) {
    // return null to indicate there are no seeds defined
    maxSeed = null;
  } else if (maxTimestamp === Infinity) {
    // if the max timestamp is infinity, then the last seed is the max seed
    maxSeed = allSeeds.at(-1)!;
  } else {
    // we know some seeds exist, so max seed is either NO_SEEDS or a specific seed
    maxSeed = NO_SEEDS;
    for (const seed of allSeeds) {
      if (seed.timestamp < maxTimestamp) maxSeed = seed;
      else break;
    }
  }

  return maxSeed;
}

/**
 * Returns true if the migration is a NoMigrations object.
 */
export function isNoMigrations(migration: any): migration is NoMigrations {
  return "__noMigrations__" in migration && migration.__noMigrations__ === true;
}

/**
 * Returns true if the seed is a NoSeeds object.
 */
export function isNoSeeds(seed: any): seed is NoSeeds {
  return "__noSeeds__" in seed && seed.__noSeeds__ === true;
}
