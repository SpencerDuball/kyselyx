import fs from "fs-extra";
import { FileMigrationProvider, Migrator } from "kysely";
import path from "path";
import "tsx/esm";
import {
  getConfig,
  loadKyselyxConfig,
  MIGRATION_LOCK_TABLE_NAME,
  MIGRATION_TABLE_NAME,
  SEED_TABLE_NAME,
  type ICliOptions,
} from "../../src/config";
import { FileSeedProvider, Seeder } from "../../src/seeder";

/**
 * Gets the migration information from the database.
 */
export async function getMigrationInfo(cli: ICliOptions = {}) {
  await loadKyselyxConfig(cli);
  const {
    stores: { db },
    migrationsFolder,
  } = getConfig();

  const provider = new FileMigrationProvider({ fs, path, migrationFolder: path.resolve(migrationsFolder) });
  const migrator = new Migrator({
    db,
    provider,
    migrationTableName: MIGRATION_TABLE_NAME,
    migrationLockTableName: MIGRATION_LOCK_TABLE_NAME,
  });

  return migrator.getMigrations();
}

/**
 * Gets the seed information from the database.
 */
export async function getSeedInfo(cli: ICliOptions = {}) {
  await loadKyselyxConfig(cli);
  const { stores, seedsFolder } = getConfig();

  const provider = new FileSeedProvider({ fs, path, seedFolder: path.resolve(seedsFolder) });
  const seeder = new Seeder({ stores, provider, seedTableName: SEED_TABLE_NAME });

  return seeder.getSeeds();
}
