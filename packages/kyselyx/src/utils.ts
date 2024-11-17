import fs from "fs-extra";
import { FileMigrationProvider, type MigrationInfo, Migrator, type NoMigrations } from "kysely";
import { err, ok, type Result, ResultAsync } from "neverthrow";
import path from "path";
import { getConfig, MIGRATION_LOCK_TABLE_NAME, MIGRATION_TABLE_NAME, SEED_TABLE_NAME } from "./config.js";
import { BaseError, ConfigError, KyselyError, MigrationError, SeedError } from "./errors.js";
import { FileSeedProvider } from "./seeder/file-seed-provider.js";
import { NO_SEEDS, type NoSeeds, Seeder, type SeedInfo } from "./seeder/seed.js";

/**
 * Returns the identity of the passed argument. This is syntatic sugar.
 */
const identity = <T>(x: T) => x;

// -------------------------------------------------------------------------------------------------
// Migration Utilities
// -------------------------------------------------------------------------------------------------

export interface Migration extends MigrationInfo {
  label: string;
  timestamp: number;
}
export interface AppliedMigration extends Migration {
  executedAt: Date;
}
export interface UnappliedMigration extends Migration {
  executedAt: undefined;
}

/**
 * Returns true if the migration is a NoMigrations object.
 */
export function isNoMigrations(migration: any): migration is NoMigrations {
  const isObject = typeof migration === "object" && migration !== null;
  return isObject && "__noMigrations__" in migration && migration.__noMigrations__ === true;
}

/**
 * Reads the configuration and returns a migrator object.
 */
export function getMigrator(): Result<Migrator, ConfigError> {
  return getConfig().andThen(({ stores: { db }, migrationsFolder }) => {
    if (!fs.existsSync(migrationsFolder))
      return err(new ConfigError("3cb1db", `Migrations folder not found: ${migrationsFolder}`));

    const migrator = new Migrator({
      db,
      provider: new FileMigrationProvider({ fs, path, migrationFolder: path.resolve(migrationsFolder) }),
      migrationTableName: MIGRATION_TABLE_NAME,
      migrationLockTableName: MIGRATION_LOCK_TABLE_NAME,
    });

    return ok(migrator);
  });
}

/**
 * Get all migrations and returns a list of all migrations, applied migrations, and
 * unapplied migrations.
 */
export async function getMigrations(migrator: Migrator) {
  return ResultAsync.fromPromise(migrator.getMigrations(), KyselyError.fromThrown("6093e7")).andThen((migrations) => {
    const allMigrations: Migration[] = [];
    const unappliedMigrations: UnappliedMigration[] = [];
    const appliedMigrations: AppliedMigration[] = [];
    for (const migration of migrations) {
      const namePartsRes = getNameParts(migration);
      if (namePartsRes.isErr()) return err(namePartsRes.error);

      const { timestamp, label } = namePartsRes.value;
      const _migration = { ...migration, timestamp, label };
      allMigrations.push(_migration);
      if (_migration.executedAt) appliedMigrations.push(_migration as AppliedMigration);
      else unappliedMigrations.push(_migration as UnappliedMigration);
    }

    return ok({ allMigrations, unappliedMigrations, appliedMigrations });
  });
}

// -------------------------------------------------------------------------------------------------
// Seed Utilities
// -------------------------------------------------------------------------------------------------

export interface Seed extends SeedInfo {
  label: string;
  timestamp: number;
}
export interface AppliedSeed extends Seed {
  executedAt: Date;
}
export interface UnappliedSeed extends Seed {
  executedAt: undefined;
}

/**
 * Returns true if the seed is a NoSeeds object.
 */
export function isNoSeeds(seed: any): seed is NoSeeds {
  const isObject = typeof seed === "object" && seed !== null;
  return isObject && "__noSeeds__" in seed && seed.__noSeeds__ === true;
}

/**
 * Reads the configuration and returns a seeder object.
 */
export function getSeeder(): Result<Seeder, ConfigError> {
  return getConfig().andThen(({ stores, seedsFolder }) => {
    if (!fs.existsSync(seedsFolder)) return err(new ConfigError("82bc3a", `Seeds folder not found: ${seedsFolder}`));

    const seeder = new Seeder({
      stores,
      provider: new FileSeedProvider({ fs, path, seedFolder: path.resolve(seedsFolder) }),
      seedTableName: SEED_TABLE_NAME,
    });

    return ok(seeder);
  });
}

/**
 * Get all seeds and returns a list of all seeds, applied seeds, and unapplied seeds.
 */
export async function getSeeds(seeder: Seeder) {
  return ResultAsync.fromPromise(seeder.getSeeds(), KyselyError.fromThrown("7dacfe")).andThen((seeds) => {
    const allSeeds: Seed[] = [];
    const unappliedSeeds: UnappliedSeed[] = [];
    const appliedSeeds: AppliedSeed[] = [];
    for (const seed of seeds) {
      const namePartsRes = getNameParts(seed);
      if (namePartsRes.isErr()) return err(namePartsRes.error);

      const { timestamp, label } = namePartsRes.value;
      const _seed = { ...seed, timestamp, label };
      allSeeds.push(_seed);
      if (_seed.executedAt) appliedSeeds.push(_seed as AppliedSeed);
      else unappliedSeeds.push(_seed as UnappliedSeed);
    }

    return ok({ allSeeds, unappliedSeeds, appliedSeeds });
  });
}

export interface IGetTargetSeedProps {
  /**
   * The migration to use as the limit for the seeds. If not supplied, the target will be the
   * maximum applied migration.
   */
  migration?: Migration | NoMigrations;
  /**
   * The requested seed to seed to. If not supplied, the target will be the maximum seed that can
   * be applied.
   */
  seed?: Seed | NoSeeds;
  /**
   * The seeder to use in operations with the database.
   */
  seeder?: Seeder;
  /**
   * The migrator to use in operations with the database.
   */
  migrator?: Migrator;
}

export async function getTargetSeed(props: IGetTargetSeedProps) {
  const seeder = props.seeder || getSeeder().match(identity, identity);
  if (seeder instanceof Error) return err(seeder);

  const migrator = props.migrator || getMigrator().match(identity, identity);
  if (migrator instanceof Error) return err(migrator);

  if (isNoSeeds(props.seed)) {
    return ok(NO_SEEDS);
  } else if (isNoMigrations(props.migration)) {
    // get all migrations and all seeds
    const allMigrations = (await getMigrations(migrator)).match(({ allMigrations }) => allMigrations, identity);
    if (allMigrations instanceof Error) return err(allMigrations);
    const seeds = (await getSeeds(seeder)).match(identity, identity);
    if (seeds instanceof Error) return err(seeds);

    // get the maximum timestamp for the seeds
    const maxTimestamp = allMigrations.at(0)?.timestamp ?? Infinity;
    if (props.seed) {
      // if there is a named seed, ensure it's timestamp is less than the max timestamp
      if (props.seed.timestamp <= maxTimestamp) return ok(props.seed);
      else return err(new SeedError("f56b28", `Seed timestamp is greater than the first migration timestamp.`));
    } else {
      let targetSeed: Seed | undefined;
      for (const seed of seeds.allSeeds) {
        if (seed.timestamp <= maxTimestamp) targetSeed = seed;
        else break;
      }
      if (targetSeed) return ok(targetSeed);
      else return ok(NO_SEEDS);
    }
  } else if (props.migration) {
    // get all seeds
    const allMigrations = (await getMigrations(migrator)).match(({ allMigrations }) => allMigrations, identity);
    if (allMigrations instanceof Error) return err(allMigrations);
    const seeds = (await getSeeds(seeder)).match(identity, identity);
    if (seeds instanceof Error) return err(seeds);

    // get the maximum timestamp for the seeds
    const migrationIdx = allMigrations.findIndex((m) => m.name === (props.migration as Migration).name);
    const maxTimestamp =
      props.migration === allMigrations.at(-1) ? Infinity : allMigrations.at(migrationIdx + 1)!.timestamp;
    if (props.seed) {
      // if there is a named seed, ensure it's timestamp is less than the max timestamp
      if (props.seed.timestamp <= maxTimestamp) return ok(props.seed);
      else return err(new SeedError("e6f580", `Seed timestamp is greater than the migration timestamp.`));
    } else {
      let targetSeed: Seed | undefined;
      for (const seed of seeds.allSeeds) {
        if (seed.timestamp <= maxTimestamp) targetSeed = seed;
        else break;
      }
      if (targetSeed) return ok(targetSeed);
      else return ok(NO_SEEDS);
    }
  } else {
    // get all migrations and all seeds
    const unappliedMigrations = (await getMigrations(migrator)).match(
      ({ unappliedMigrations }) => unappliedMigrations,
      identity,
    );
    if (unappliedMigrations instanceof Error) return err(unappliedMigrations);
    const seeds = (await getSeeds(seeder)).match(identity, identity);
    if (seeds instanceof Error) return err(seeds);

    // get the maximum timestamp for the seeds
    let maxTimestamp = unappliedMigrations.at(0)?.timestamp ?? Infinity;
    if (props.seed) {
      // if there is a named seed, ensure it's timestamp is less than the max timestamp
      if (props.seed.timestamp <= maxTimestamp) return ok(props.seed);
      else return err(new SeedError("1d869e", `Seed timestamp is greater than the last migration timestamp.`));
    } else {
      let targetSeed: Seed | undefined;
      for (const seed of seeds.allSeeds) {
        if (seed.timestamp <= maxTimestamp) targetSeed = seed;
        else break;
      }
      if (targetSeed) return ok(targetSeed);
      else return ok(NO_SEEDS);
    }
  }
}

// -------------------------------------------------------------------------------------------------
// Generic Utilities
// -------------------------------------------------------------------------------------------------

/**
 * Exits the process with a failure message.
 */
export function exitFailure<T extends BaseError>(e: T): never {
  console.error(e.message);
  process.exit(1);
}

/**
 * Accepts a migration or seed object and returns an object with the timestamp and label.
 *
 * @example
 * getNameParts("1612345678_create_table") // { timestamp: 1612345678, label: "create_table" }
 */
export function getNameParts(
  item: MigrationInfo | SeedInfo,
): Result<{ timestamp: number; label: string }, MigrationError | SeedError> {
  const { timestamp, label } = /(?<timestamp>^\d+)_(?<label>.+)$/.exec(item.name)?.groups || {};

  const timestampMs = parseInt(timestamp || "");
  if (isNaN(timestampMs)) {
    if ("migration" in item)
      return err(
        new MigrationError(
          "b5ad2d",
          `Invalid migration name "${item.name}", migration name must start with a valid epoch time.`,
        ),
      );
    else
      return err(
        new SeedError("20f040", `Invalid seed name "${item.name}", seed name must start with a valid epoch time.`),
      );
  }

  if (!label) {
    if ("migration" in item)
      return err(
        new MigrationError("2a7630", `Invalid migration name "${item.name}", migration name must have a label.`),
      );
    else return err(new SeedError("7dd89b", `Invalid seed name "${item.name}", seed name must have a label.`));
  }

  return ok({ timestamp: timestampMs, label });
}

/**
 * Returns true if the passed name matches the migration or seed name.
 *
 * The name can be a partial name, and the timestamp can be omitted.
 *
 * @example
 * doesNameMatch("1612345678_users")("5678_users") // true
 * doesNameMatch("1612345678_users")("1612_users") // false
 * doesNameMatch("users")("users") // true
 * doesNameMatch("users")("users_table") // false
 */
export function doesNameMatch(name: string) {
  return function (item: Migration | Seed) {
    const { name_ts, name_lbl } = /((?<name_ts>^\d*)_)?(?<name_lbl>.*)/.exec(name)?.groups || {};

    if (name_ts && name_lbl) {
      // labels must match exactly
      if (name_lbl !== item.label) return false;

      // Compare partial timestamps in reverse order
      // Ex: "1612345678_users" vs "5678_users" -- Match!
      // Ex: "1612345678_users" vs "1612_users" -- No match!
      const item_ts = item.timestamp.toString();
      for (let i = -1; i >= -name_ts.length; i--) {
        const [name_char, item_char] = [name_ts.at(i), item_ts.at(i)];
        if (!item_char)
          return false; // Name timestamp is longer than item timestamp
        else if (name_char !== item_char) return false; // Mismatch found
      }

      // No mismatch was found
      return true;
    } else if (name_lbl) return name_lbl === item.label;
    else return false;
  };
}
