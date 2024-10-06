import fs from "fs-extra";
import path from "path";
import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { loadKyselyxConfig } from "../src/config";

// Different tests files may run in parallel, using a directory with a unique name ensures tests
// will not interfere with each other.
const TEST_DIR = path.resolve(__dirname, "testdir-6452eab0");

beforeEach(async () => {
  // ensure each tests starts with a clean directory
  await fs.rm(TEST_DIR, { recursive: true, force: true });
  await fs.mkdir(TEST_DIR);
  process.chdir(TEST_DIR);
});

describe("handles config file when config", () => {
  test("is 'kyselyx.config.ts' file", async () => {
    // create the config file
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
    expect(loadKyselyxConfig({})).resolves.not.toThrowError("Could not find Kyselyx configuration file.");
  });

  test("is 'kyselyx.config.js' file", async () => {
    // create the config file
    const kyselyxConfigJs = [
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
    await fs.writeFile(path.resolve(TEST_DIR, "kyselyx.config.js"), kyselyxConfigJs);
    expect(loadKyselyxConfig({})).resolves.not.toThrowError("Could not find Kyselyx configuration file.");
  });

  test("is '.config/kyselyx.config.ts' file", async () => {
    // create the config file
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
    await fs.ensureDir(path.resolve(TEST_DIR, ".config"));
    await fs.writeFile(path.resolve(TEST_DIR, ".config", "kyselyx.config.ts"), kyselyxConfigTs);
    expect(loadKyselyxConfig({})).resolves.not.toThrowError("Could not find Kyselyx configuration file.");
  });

  test("is '.config/kyselyx.config.js' file", async () => {
    // create the config file
    const kyselyxConfigJs = [
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
    await fs.ensureDir(path.resolve(TEST_DIR, ".config"));
    await fs.writeFile(path.resolve(TEST_DIR, ".config", "kyselyx.config.js"), kyselyxConfigJs);
    expect(loadKyselyxConfig({})).resolves.not.toThrowError("Could not find Kyselyx configuration file.");
  });

  test("is '.random/spaghetti.ts' file with CLI option", async () => {
    // create the config file
    const spaghettiTs = [
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
    await fs.ensureDir(path.resolve(TEST_DIR, "random"));
    await fs.writeFile(path.resolve(TEST_DIR, "random", "spaghetti.ts"), spaghettiTs);
    expect(loadKyselyxConfig({ file: "random/spaghetti.ts" })).resolves.not.toThrowError(
      "Could not find Kyselyx configuration file.",
    );
  });

  test("is missing", async () => {
    expect(loadKyselyxConfig({})).rejects.toThrowError("Could not find Kyselyx configuration file.");
  });
});

afterAll(async () => {
  // cleanup
  await fs.rm(TEST_DIR, { recursive: true, force: true });
});
