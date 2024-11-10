import fs from "fs-extra";
import { FileMigrationProvider, type MigrationInfo, Migrator, type NoMigrations } from "kysely";
import { err, ok, type Result, ResultAsync } from "neverthrow";
import path from "path";
import { getConfig, MIGRATION_LOCK_TABLE_NAME, MIGRATION_TABLE_NAME } from "./config.js";
import { ConfigError, KyselyError, MigrationError, SeedError } from "./errors.js";
import { type NoSeeds, type SeedInfo } from "./seeder/seed.js";

/**
 * Exits the process with a failure message.
 */
export function exitFailure<T extends Error>(e: T): never {
  console.error(e.message);
  process.exit(1);
}

/**
 * Handles any error and adds a trace ID.
 */
export function traceError<T extends Error>(traceId: string, ctor: { new (message: string): T }) {
  return function (e: any): T {
    if (e instanceof Error) return new ctor(`(${traceId}) ${e.message}`);
    else return new ctor(`(${traceId}) An error occurred.`);
  };
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
 * Reads the configuration and returns a migrator object.
 */
export function getMigrator(): Result<Migrator, ConfigError> {
  return getConfig().andThen(({ stores: { db }, migrationsFolder }) => {
    if (!fs.existsSync(migrationsFolder))
      return err(new ConfigError(`Migrations folder not found: ${migrationsFolder}`));

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
        new MigrationError(`Invalid migration name "${item.name}", migration name must start with a valid epoch time.`),
      );
    else return err(new SeedError(`Invalid seed name "${item.name}", seed name must start with a valid epoch time.`));
  }

  if (!label) {
    if ("migration" in item)
      return err(new MigrationError(`Invalid migration name "${item.name}", migration name must have a label.`));
    else return err(new SeedError(`Invalid seed name "${item.name}", seed name must have a label.`));
  }

  return ok({ timestamp: timestampMs, label });
}

/**
 * Get all migrations and returns a list of all migrations, applied migrations, and
 * unapplied migrations.
 */
export async function getMigrations(migrator: Migrator) {
  return ResultAsync.fromPromise(migrator.getMigrations(), traceError("9c2a", KyselyError)).andThen((migrations) => {
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
