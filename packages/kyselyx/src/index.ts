import { type Migration } from "kysely";

export {
  MIGRATION_LOCK_TABLE_NAME,
  MIGRATION_TABLE_NAME,
  SEED_TABLE_NAME,
  type DefaultStores,
  type ICliOptions,
  type IConfigFile,
} from "./config.js";

export type MigrationUp = Migration["up"];
export type MigrationDown = NonNullable<Migration["down"]>;
