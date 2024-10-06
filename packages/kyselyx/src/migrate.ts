import fs from "fs-extra";
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
 * Creates a new migration file with the specified name.
 */
export async function new_(name: string) {
  const { migrationsFolder } = getConfig();

  // generate the migration file
  let feed = ora(`Creating migration file ...`).start();
  const migrationId = `${Date.now()}_${name}`;
  await fs.ensureDir(migrationsFolder);
  await fs.writeFile(path.resolve(migrationsFolder, `${migrationId}.ts`), template);
  feed.succeed(`Created migration file: "${migrationId}.ts"`);
}
