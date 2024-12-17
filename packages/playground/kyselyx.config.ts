import SQLite from "better-sqlite3";
import { Kysely, SqliteDialect } from "kysely";
import { type DefaultStores, type IConfigFile } from "kyselyx";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, "test.db");

// create dialect
const dialect = new SqliteDialect({ database: new SQLite(DB_PATH) });
const db = new Kysely<any>({ dialect });

const config: IConfigFile<DefaultStores> = {
  stores: { db },
  migrationsFolder: "migrations",
  seedsFolder: "seeds",
};

export default config;
