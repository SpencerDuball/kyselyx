import { exec } from "child_process";
import fs from "fs-extra";
import path from "path";
import { promisify } from "util";
import { afterAll, beforeEach, describe, expect, test } from "vitest";

const asyncExec = promisify(exec);

// Different test files may run in parallel, using a directory with a unique name ensures tests
// will not interfere with each other.
const TEST_DIR = path.resolve(__dirname, "testdir-b6aa3262");
const CLI_PATH = path.resolve(__dirname, "../src/cli.ts");
const DB_PATH = path.resolve(TEST_DIR, "test.db");

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
    `    db: new Kysely({ dialect: new SqliteDialect({ database: new SQLite("${DB_PATH}") }) }),`,
    "  },",
    "};",
    "",
    "export default config;",
  ].join("\n");
  await fs.writeFile(path.resolve(TEST_DIR, "kyselyx.config.ts"), kyselyxConfigTs);

  // create migrations
  await asyncExec(`node --import tsx ${CLI_PATH} db:migrate:new users`);
  await asyncExec(`node --import tsx ${CLI_PATH} db:migrate:new sample`);
  await asyncExec(`node --import tsx ${CLI_PATH} db:migrate:new peanut_butter`);

  // run the migration
  await asyncExec(`node --import tsx ${CLI_PATH} db:migrate`);
}

beforeEach(async () => {
  // ensure each tests starts with a clean directory
  await fs.rm(TEST_DIR, { recursive: true, force: true });
  await fs.mkdir(TEST_DIR);
  process.chdir(TEST_DIR);
});

describe("running 'new_'", () => {
  test("creates a new TS seed file", async () => {
    // setup and apply migrations
    await setupDefaultConfig();

    // create a new seed file
    await asyncExec(`node --import tsx ${CLI_PATH} db:seed:new users`);
    let seeds = await fs.readdir(path.resolve(TEST_DIR, "seeds"));
    expect(seeds.find((f) => /\d+_users/.test(f))).not.toBeUndefined();
  });
});

describe("running 'seed'", () => {
  test("applies all seeds up to the latest seed", async () => {
    // setup and apply migrations
    await setupDefaultConfig();

    // create a new seed file
  });
});

afterAll(async () => {
  // cleanup
  await fs.rm(TEST_DIR, { recursive: true, force: true });
});
