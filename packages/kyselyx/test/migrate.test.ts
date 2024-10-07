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

describe("running 'migrate'", () => {
  test("throw error when no migrations folder", async () => {
    // setup the 'kyselyx.config.ts' file
    await setupDefaultConfig();

    // run the migration
    const { stdout } = await asyncExec(`node --import tsx ${CLI_PATH} db:migrate`).catch((e) => ({
      stdout: e.stdout,
    }));
    expect(stdout).toContain("Migrations folder not found: ");
  });

  test("applies all migrations successfully", async () => {
    // setup the 'kyselyx.config.ts' file
    await setupDefaultConfig();

    // create migrations
    await asyncExec(`node --import tsx ${CLI_PATH} db:migrate:new users`);
    await asyncExec(`node --import tsx ${CLI_PATH} db:migrate:new sample`);
    await asyncExec(`node --import tsx ${CLI_PATH} db:migrate:new peanut_butter`);

    // run the migration
    const { stdout } = await asyncExec(`node --import tsx ${CLI_PATH} db:migrate`);

    expect(stdout).toMatch(/✔ Applied migration \d+_users successfully\./);
    expect(stdout).toMatch(/✔ Applied migration \d+_sample successfully\./);
    expect(stdout).toMatch(/✔ Applied migration \d+_peanut_butter successfully\./);
    expect(stdout).toMatch(/All migrations applied successfully.\n$/);
  });

  test("applies migrations up to a specific migration", async () => {
    // setup the 'kyselyx.config.ts' file
    await setupDefaultConfig();

    // create migrations
    await asyncExec(`node --import tsx ${CLI_PATH} db:migrate:new users`);
    await asyncExec(`node --import tsx ${CLI_PATH} db:migrate:new sample`);
    await asyncExec(`node --import tsx ${CLI_PATH} db:migrate:new peanut_butter`);

    const migrationFiles = await fs.readdir(path.resolve(TEST_DIR, "migrations"));
    const sampleMigrationFile = migrationFiles.find((f) => /\d+_sample\.ts/.test(f))!;
    const sampleMigration = path.basename(sampleMigrationFile, path.extname(sampleMigrationFile));

    // run the migration
    const { stdout } = await asyncExec(`node --import tsx ${CLI_PATH} db:migrate ${sampleMigration}`);

    expect(stdout).toMatch(/✔ Applied migration \d+_users successfully\./);
    expect(stdout).toMatch(/✔ Applied migration \d+_sample successfully\./);
    expect(stdout).not.toMatch(/✔ Applied migration \d+_peanut_butter successfully\./);
    expect(stdout).toMatch(/All migrations applied successfully.\n$/);
  });
});

describe("running 'undo'", () => {
  test("with no migrations", async () => {
    // setup the 'kyselyx.config.ts' file
    await setupDefaultConfig();

    // create a migrations folder
    await fs.mkdir(path.resolve(TEST_DIR, "migrations"));

    // attempt to undo a migration
    const { stdout } = await asyncExec(`node --import tsx ${CLI_PATH} db:migrate:undo`).catch((e) => {
      console.log(e);
      throw e;
    });
    expect(stdout).toContain("No migrations to undo.");
  });

  test("with migrations", async () => {
    // setup the 'kyselyx.config.ts' file
    await setupDefaultConfig();

    // create migrations
    await asyncExec(`node --import tsx ${CLI_PATH} db:migrate:new users`);
    await asyncExec(`node --import tsx ${CLI_PATH} db:migrate:new sample`);
    await asyncExec(`node --import tsx ${CLI_PATH} db:migrate:new peanut_butter`);

    // run the migration
    let { stdout } = await asyncExec(`node --import tsx ${CLI_PATH} db:migrate`);

    expect(stdout).toMatch(/✔ Applied migration \d+_users successfully\./);
    expect(stdout).toMatch(/✔ Applied migration \d+_sample successfully\./);
    expect(stdout).toMatch(/✔ Applied migration \d+_peanut_butter successfully\./);
    expect(stdout).toMatch(/All migrations applied successfully.\n$/);

    // undo the last migration
    ({ stdout } = await asyncExec(`node --import tsx ${CLI_PATH} db:migrate:undo`));
    console.log(stdout);
    expect(stdout).toMatch(/Rolling back to migration before \d+_peanut_butter .../);

    // undo the next migration
    ({ stdout } = await asyncExec(`node --import tsx ${CLI_PATH} db:migrate:undo`));
    console.log(stdout);
    expect(stdout).toMatch(/Rolling back to migration before \d+_sample .../);

    // undo the next migration
    ({ stdout } = await asyncExec(`node --import tsx ${CLI_PATH} db:migrate:undo`));
    console.log(stdout);
    expect(stdout).toMatch(/Rolling back all migrations .../);

    // attempt to undo another migration (none left to undo)
    ({ stdout } = await asyncExec(`node --import tsx ${CLI_PATH} db:migrate:undo`));
    console.log(stdout);
    expect(stdout).toContain("No migrations to undo.");
  });
});

describe("running 'undoAll'", () => {
  test("with no migrations", async () => {
    // setup the 'kyselyx.config.ts' file
    await setupDefaultConfig();

    // create a migrations folder
    await fs.mkdir(path.resolve(TEST_DIR, "migrations"));

    // attempt to undo a migration
    const { stdout } = await asyncExec(`node --import tsx ${CLI_PATH} db:migrate:undo:all`).catch((e) => {
      console.log(e);
      throw e;
    });
    expect(stdout).toContain("No migrations to undo.");
  });

  test("with migrations", async () => {
    // setup the 'kyselyx.config.ts' file
    await setupDefaultConfig();

    // create migrations
    await asyncExec(`node --import tsx ${CLI_PATH} db:migrate:new users`);
    await asyncExec(`node --import tsx ${CLI_PATH} db:migrate:new sample`);
    await asyncExec(`node --import tsx ${CLI_PATH} db:migrate:new peanut_butter`);

    // run the migration
    let { stdout } = await asyncExec(`node --import tsx ${CLI_PATH} db:migrate`);

    expect(stdout).toMatch(/✔ Applied migration \d+_users successfully\./);
    expect(stdout).toMatch(/✔ Applied migration \d+_sample successfully\./);
    expect(stdout).toMatch(/✔ Applied migration \d+_peanut_butter successfully\./);
    expect(stdout).toMatch(/All migrations applied successfully.\n$/);

    // undo all migrations
    ({ stdout } = await asyncExec(`node --import tsx ${CLI_PATH} db:migrate:undo:all`));
    expect(stdout).toMatch(/All migrations rolled back successfully./);
  });
});

describe("running 'status'", () => {
  test("throw error when no migrations folder", async () => {
    // setup the 'kyselyx.config.ts' file
    await setupDefaultConfig();

    // run the migration
    const { stdout } = await asyncExec(`node --import tsx ${CLI_PATH} db:migrate:status`).catch((e) => ({
      stdout: e.stdout,
    }));
    expect(stdout).toContain("Migrations folder not found: ");
  });

  test("applies migrations successfully", async () => {
    // setup the 'kyselyx.config.ts' file
    await setupDefaultConfig();

    // create migrations
    await asyncExec(`node --import tsx ${CLI_PATH} db:migrate:new users`);
    await asyncExec(`node --import tsx ${CLI_PATH} db:migrate:new sample`);
    await asyncExec(`node --import tsx ${CLI_PATH} db:migrate:new peanut_butter`);

    // run the migration
    let { stdout } = await asyncExec(`node --import tsx ${CLI_PATH} db:migrate`);

    expect(stdout).toMatch(/✔ Applied migration \d+_users successfully\./);
    expect(stdout).toMatch(/✔ Applied migration \d+_sample successfully\./);
    expect(stdout).toMatch(/✔ Applied migration \d+_peanut_butter successfully\./);
    expect(stdout).toMatch(/All migrations applied successfully.\n$/);

    // run the status
    stdout = await asyncExec(`node --import tsx ${CLI_PATH} db:migrate:status`).then((r) => r.stdout);
  });
});

afterAll(async () => {
  // cleanup
  await fs.rm(TEST_DIR, { recursive: true, force: true });
});
