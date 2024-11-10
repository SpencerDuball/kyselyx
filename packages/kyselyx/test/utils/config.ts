import fs from "fs-extra";
import path from "path";

/**
 * Sets up a mock project with Kyselyx:
 * - Creates 'kyselyx.config.ts' file in root.
 * - Uses implicit 'migrationsFolder'.
 * - Uses implicit 'seedsFolder'.
 */
export async function setupKyselyxConfigV1(testDir: string) {
  const kyselyxContents = [
    'import SQLite from "better-sqlite3";',
    'import { Kysely, SqliteDialect } from "kysely";',
    "",
    'type ITest = "TypeScript only feature (type) to ensure parsing works with kyselyx.config.ts file.";',
    "",
    "const config = {",
    "  stores: {",
    `    db: new Kysely({ dialect: new SqliteDialect({ database: new SQLite("${path.resolve(testDir, "test.db")}") }) }),`,
    "  },",
    "};",
    "",
    "export default config;",
  ];
  await fs.ensureDir(path.resolve(testDir));
  await fs.writeFile(path.resolve(testDir, "kyselyx.config.ts"), kyselyxContents.join("\n"));

  return {
    configFile: path.resolve(testDir, "kyselyx.config.ts"),
    migarationsFolder: path.resolve(testDir, "migrations"),
    seedsFolder: path.resolve(testDir, "seeds"),
  };
}

/**
 * Sets up a mock project with Kyselyx:
 * - Creates 'kyselyx.config.js' file in root.
 * - Uses implicit 'migrationsFolder'.
 * - Uses implicit 'seedsFolder'.
 */
export async function setupKyselyxConfigV2(testDir: string) {
  const kyselyxContents = [
    'import SQLite from "better-sqlite3";',
    'import { Kysely, SqliteDialect } from "kysely";',
    "",
    "const config = {",
    "  stores: {",
    `    db: new Kysely({ dialect: new SqliteDialect({ database: new SQLite("${path.resolve(testDir, "test.db")}") }) }),`,
    "  },",
    "};",
    "",
    "export default config;",
  ];
  await fs.ensureDir(path.resolve(testDir));
  await fs.writeFile(path.resolve(testDir, "kyselyx.config.js"), kyselyxContents.join("\n"));

  return {
    configFile: path.resolve(testDir, "kyselyx.config.js"),
    migarationsFolder: path.resolve(testDir, "migrations"),
    seedsFolder: path.resolve(testDir, "seeds"),
  };
}

/**
 * Sets up a mock project with Kyselyx:
 * - Creates 'kyselyx.config.ts' file in '.config' folder.
 * - Uses implicit 'migrationsFolder'.
 * - Uses implicit 'seedsFolder'.
 */
export async function setupKyselyxConfigV3(testDir: string) {
  const kyselyxContents = [
    'import SQLite from "better-sqlite3";',
    'import { Kysely, SqliteDialect } from "kysely";',
    "",
    'type ITest = "TypeScript only feature (type) to ensure parsing works with kyselyx.config.ts file.";',
    "",
    "const config = {",
    "  stores: {",
    `    db: new Kysely({ dialect: new SqliteDialect({ database: new SQLite("${path.resolve(testDir, "test.db")}") }) }),`,
    "  },",
    "};",
    "",
    "export default config;",
  ];
  await fs.ensureDir(path.resolve(testDir, ".config"));
  await fs.writeFile(path.resolve(testDir, ".config", "kyselyx.config.ts"), kyselyxContents.join("\n"));

  return {
    configFile: path.resolve(testDir, ".config", "kyselyx.config.ts"),
    migarationsFolder: path.resolve(testDir, "migrations"),
    seedsFolder: path.resolve(testDir, "seeds"),
  };
}

/**
 * Sets up a mock project with Kyselyx:
 * - Creates 'kyselyx.config.js' file in config folder.
 * - Uses implicit 'migrationsFolder'.
 * - Uses implicit 'seedsFolder'.
 */
export async function setupKyselyxConfigV4(testDir: string) {
  const kyselyxContents = [
    'import SQLite from "better-sqlite3";',
    'import { Kysely, SqliteDialect } from "kysely";',
    "",
    "const config = {",
    "  stores: {",
    `    db: new Kysely({ dialect: new SqliteDialect({ database: new SQLite("${path.resolve(testDir, "test.db")}") }) }),`,
    "  },",
    "};",
    "",
    "export default config;",
  ];
  await fs.ensureDir(path.resolve(testDir, ".config"));
  await fs.writeFile(path.resolve(testDir, ".config", "kyselyx.config.js"), kyselyxContents.join("\n"));

  return {
    configFile: path.resolve(testDir, ".config", "kyselyx.config.js"),
    migarationsFolder: path.resolve(testDir, "migrations"),
    seedsFolder: path.resolve(testDir, "seeds"),
  };
}

/**
 * Sets up a mock project with Kyselyx:
 * - Creates Kyselyx config file, 'spaghetti.ts' in a non-standard location '.random/spaghetti.ts'.
 * - Uses 'migrationsFolder' supplied by CLI, ".random/migrations".
 * - Uses 'seedsFolder' supplied by CLI, ".random/seeds".
 */
export async function setupKyselyxConfigV5(testDir: string) {
  const kyselyxContents = [
    'import SQLite from "better-sqlite3";',
    'import { Kysely, SqliteDialect } from "kysely";',
    "",
    'type ITest = "TypeScript only feature (type) to ensure parsing works with kyselyx.config.ts file.";',
    "",
    "const config = {",
    "  stores: {",
    `    db: new Kysely({ dialect: new SqliteDialect({ database: new SQLite("${path.resolve(testDir, "test.db")}") }) }),`,
    "  },",
    '  migrationsFolder: ".not-random/migrations",',
    '  seedsFolder: ".not-random/seeds",',
    "};",
    "",
    "export default config;",
  ];
  await fs.ensureDir(path.resolve(testDir, ".random"));
  await fs.writeFile(path.resolve(testDir, ".random", "spaghetti.ts"), kyselyxContents.join("\n"));

  return {
    configFile: path.resolve(testDir, ".random", "spaghetti.ts"),
    migarationsFolder: path.resolve(testDir, ".random", "migrations"),
    seedsFolder: path.resolve(testDir, ".random", "seeds"),
  };
}

/**
 * Sets up a mock project with Kyselyx:
 * - Creates 'kyselyx.config.ts' file in root.
 * - Uses explicit 'migrationsFolder'.
 * - Uses explicit 'seedsFolder'.
 */
export async function setupKyselyxConfigV6(testDir: string) {
  const kyselyxContents = [
    'import SQLite from "better-sqlite3";',
    'import { Kysely, SqliteDialect } from "kysely";',
    "",
    'type ITest = "TypeScript only feature (type) to ensure parsing works with kyselyx.config.ts file.";',
    "",
    "const config = {",
    "  stores: {",
    `    db: new Kysely({ dialect: new SqliteDialect({ database: new SQLite("${path.resolve(testDir, "test.db")}") }) }),`,
    "  },",
    '  migrationsFolder: ".kyselyx/migrations",',
    '  seedsFolder: ".kyselyx/seeds",',
    "};",
    "",
    "export default config;",
  ];
  await fs.ensureDir(path.resolve(testDir));
  await fs.ensureDir(path.resolve(testDir, ".kyselyx"));
  await fs.writeFile(path.resolve(testDir, "kyselyx.config.ts"), kyselyxContents.join("\n"));

  return {
    configFile: path.resolve(testDir, "spaghetti.ts"),
    migrationsFolder: path.resolve(testDir, ".kyselyx", "migrations"),
    seedsFolder: path.resolve(testDir, ".kyselyx", "seeds"),
  };
}

/**
 * Sets up a BAD mock project with Kyselyx:
 * - Adds syntax errors in the TS file.
 */
export async function setupBadKyselyxConfigV1(testDir: string) {
  const kyselyxContents = [
    'import SQLite from etter-sqlite3";',
    'import { Kysely, SqliteDialect } from "kysely";',
    "",
    'type ITest = "TypeScript only feature (type) to ensure parsing works with kyselyx.config.ts file.";',
    "",
    "const config = {",
    "  stores: {",
    `    db: new Kysely({ dialect: new SqliteDialect({ database: new SQLite("${path.resolve(testDir, "test.db")}") }) }),`,
    "  },",
    '  migrationsFolder: ".kyselyx/migrations",',
    '  seedsFolder: ".kyselyx/seeds",',
    "};",
    "",
    "export default config;",
  ];
  await fs.ensureDir(path.resolve(testDir));
  await fs.ensureDir(path.resolve(testDir, ".kyselyx"));
  await fs.writeFile(path.resolve(testDir, "kyselyx.config.ts"), kyselyxContents.join("\n"));

  return {
    configFile: path.resolve(testDir, "spaghetti.ts"),
    migrationsFolder: path.resolve(testDir, ".kyselyx", "migrations"),
    seedsFolder: path.resolve(testDir, ".kyselyx", "seeds"),
  };
}

/**
 * Sets up a BAD mock project with Kyselyx:
 * - No default export.
 */
export async function setupBadKyselyxConfigV2(testDir: string) {
  const kyselyxContents = [
    'import SQLite from "better-sqlite3";',
    'import { Kysely, SqliteDialect } from "kysely";',
    "",
    'type ITest = "TypeScript only feature (type) to ensure parsing works with kyselyx.config.ts file.";',
    "",
    "const config = {",
    "  stores: {",
    `    db: new Kysely({ dialect: new SqliteDialect({ database: new SQLite("${path.resolve(testDir, "test.db")}") }) }),`,
    "  },",
    "};",
    "",
  ];
  await fs.ensureDir(path.resolve(testDir));
  await fs.writeFile(path.resolve(testDir, "kyselyx.config.ts"), kyselyxContents.join("\n"));

  return {
    configFile: path.resolve(testDir, "kyselyx.config.ts"),
    migarationsFolder: path.resolve(testDir, "migrations"),
    seedsFolder: path.resolve(testDir, "seeds"),
  };
}

/**
 * Sets up a mock project with Kyselyx:
 * - Config has a misspelled property.
 */
export async function setupBadKyselyxConfigV3(testDir: string) {
  const kyselyxContents = [
    'import SQLite from "better-sqlite3";',
    'import { Kysely, SqliteDialect } from "kysely";',
    "",
    'type ITest = "TypeScript only feature (type) to ensure parsing works with kyselyx.config.ts file.";',
    "",
    "const config = {",
    "  storez: {",
    `    db: new Kysely({ dialect: new SqliteDialect({ database: new SQLite("${path.resolve(testDir, "test.db")}") }) }),`,
    "  },",
    "};",
    "",
    "export default config;",
  ];
  await fs.ensureDir(path.resolve(testDir));
  await fs.writeFile(path.resolve(testDir, "kyselyx.config.ts"), kyselyxContents.join("\n"));

  return {
    configFile: path.resolve(testDir, "kyselyx.config.ts"),
    migarationsFolder: path.resolve(testDir, "migrations"),
    seedsFolder: path.resolve(testDir, "seeds"),
  };
}
