import { exec } from "child_process";
import fs from "fs-extra";
import path from "path";
import { promisify } from "util";
import { afterAll, beforeEach, describe, expect, test } from "vitest";

const asyncExec = promisify(exec);

// Different tests files may run in parallel, using a directory with a unique name ensures tests
// will not interfere with each other.
const TEST_DIR = path.resolve(__dirname, "testdir-2f7a4607");
const CLI_PATH = path.resolve(__dirname, "../src/cli.ts");

/**
 * Creates the default 'kyselyx.config.ts' file.
 */
async function setupDefaultConfig() {
  const kyselyxConfigTs = [
    'import SQLite from "better-sqlite3";',
    'import { Kysely, SqliteDialect } from "kysely";',
    "",
    "const config = {",
    "  stores: {",
    '    db: new Kysely({ dialect: new SqliteDialect({ database: new SQLite(":memory:") }) }),',
    "  },",
    "};",
    "",
    "export default config;",
  ].join("\n");
  await fs.writeFile(path.resolve(TEST_DIR, "kyselyx.config.ts"), kyselyxConfigTs);
}

beforeEach(async () => {
  // ensure each tests starts with a clean directory
  await fs.rm(TEST_DIR, { recursive: true, force: true });
  await fs.mkdir(TEST_DIR);
  process.chdir(TEST_DIR);
});

describe("running 'new_'", () => {
  test("creates migration when 'migrations' folder does not exist", async () => {
    // setup the 'kyselyx.config.ts' file
    let kyselyxConfigTs = [
      'import SQLite from "better-sqlite3";',
      'import { Kysely, SqliteDialect } from "kysely";',
      "",
      "const config = {",
      "  stores: {",
      '    db: new Kysely({ dialect: new SqliteDialect({ database: new SQLite(":memory:") }) }),',
      "  },",
      "};",
      "",
      "export default config;",
    ].join("\n");
    await fs.writeFile(path.resolve(TEST_DIR, "kyselyx.config.ts"), kyselyxConfigTs);

    // create a new migration
    await asyncExec(`node --import tsx ${CLI_PATH} db:migrate:new users`);
    let migrations = await fs.readdir(path.resolve(TEST_DIR, "migrations"));
    expect(migrations.find((f) => /\d+_users\.ts/.test(f))).not.toBeUndefined();

    // clear the 'migrations' folder to test when 'migrations' folder not default
    await fs.rm(TEST_DIR, { recursive: true, force: true });
    await fs.mkdir(TEST_DIR);
    process.chdir(TEST_DIR);

    // setup the 'kyselyx.config.ts' file
    kyselyxConfigTs = [
      'import SQLite from "better-sqlite3";',
      'import { Kysely, SqliteDialect } from "kysely";',
      "",
      "const config = {",
      "  stores: {",
      '    db: new Kysely({ dialect: new SqliteDialect({ database: new SQLite(":memory:") }) }),',
      "  },",
      "  migrationsFolder: 'migrations2',",
      "};",
      "",
      "export default config;",
    ].join("\n");
    await fs.writeFile(path.resolve(TEST_DIR, "kyselyx.config.ts"), kyselyxConfigTs);

    // create a new migration
    await asyncExec(`node --import tsx ${CLI_PATH} db:migrate:new users`);
    migrations = await fs.readdir(path.resolve(TEST_DIR, "migrations2"));
    expect(migrations.find((f) => /\d+_users\.ts/.test(f))).not.toBeUndefined();
  });
});

afterAll(async () => {
  // cleanup
  await fs.rm(TEST_DIR, { recursive: true, force: true });
});
