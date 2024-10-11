import { randomBytes } from "crypto";
import fs from "fs-extra";
import path from "path";
import { afterEach, beforeEach, expect, test } from "vitest";
import { getConfig, loadKyselyxConfig } from "../src/config";
import {
  setupKyselyxConfigV1,
  setupKyselyxConfigV2,
  setupKyselyxConfigV3,
  setupKyselyxConfigV4,
  setupKyselyxConfigV5,
  setupKyselyxConfigV6,
} from "./utils/config.js";

let TEST_DIR: string;
beforeEach(async () => {
  TEST_DIR = path.resolve(__dirname, `testdir-${randomBytes(4).toString("hex")}`);
  await fs.rm(TEST_DIR, { recursive: true, force: true });
  await fs.mkdir(TEST_DIR);
  process.chdir(TEST_DIR);
});

afterEach(async () => {
  await fs.rm(TEST_DIR, { recursive: true, force: true });
});

test("with 'kyselyx.config.ts' in root, implicit 'migrationsFolder', implicit 'seedsFolder'", async () => {
  // ensure config file can be read correctly
  await setupKyselyxConfigV1(TEST_DIR);
  await expect(loadKyselyxConfig({})).resolves.not.toThrowError("Could not find Kyselyx configuration file.");
  expect(getConfig().configFile).toBe("kyselyx.config.ts");
  expect(getConfig().migrationsFolder).toBe("migrations");
  expect(getConfig().seedsFolder).toBe("seeds");
});

test("with 'kyselyx.config.js' in root, implicit 'migrationsFolder', implicit 'seedsFolder'", async () => {
  await setupKyselyxConfigV2(TEST_DIR);
  await expect(loadKyselyxConfig({})).resolves.not.toThrowError("Could not find Kyselyx configuration file.");
  expect(getConfig().configFile).toBe("kyselyx.config.js");
  expect(getConfig().migrationsFolder).toBe("migrations");
  expect(getConfig().seedsFolder).toBe("seeds");
});

test("with '.config/kyselyx.config.ts', implicit 'migrationsFolder', implicit 'seedsFolder'", async () => {
  await setupKyselyxConfigV3(TEST_DIR);
  await expect(loadKyselyxConfig({})).resolves.not.toThrowError("Could not find Kyselyx configuration file.");
  expect(getConfig().configFile).toBe(".config/kyselyx.config.ts");
  expect(getConfig().migrationsFolder).toBe("migrations");
  expect(getConfig().seedsFolder).toBe("seeds");
});

test("with '.config/kyselyx.config.js', implicit 'migrationsFolder', implicit 'seedsFolder'", async () => {
  await setupKyselyxConfigV4(TEST_DIR);
  await expect(loadKyselyxConfig({})).resolves.not.toThrowError("Could not find Kyselyx configuration file.");
  expect(getConfig().configFile).toBe(".config/kyselyx.config.js");
  expect(getConfig().migrationsFolder).toBe("migrations");
  expect(getConfig().seedsFolder).toBe("seeds");
});

test("with '.random/spaghetti.ts' Kyselyx config file, CLI supplied 'migrationsFolder', CLI supplied 'seedsFolder'", async () => {
  await setupKyselyxConfigV5(TEST_DIR);
  await expect(
    loadKyselyxConfig({
      file: ".random/spaghetti.ts",
      migrationsFolder: ".random/migrations",
      seedsFolder: ".random/seeds",
    }),
  ).resolves.not.toThrowError("Could not find Kyselyx configuration file.");
  expect(getConfig().configFile).toBe(".random/spaghetti.ts");
  expect(getConfig().migrationsFolder).toBe(".random/migrations");
  expect(getConfig().seedsFolder).toBe(".random/seeds");
});

test("with 'kyselyx.config.ts' in root, explicit 'migrationsFolder', explicit 'seedsFolder'", async () => {
  await setupKyselyxConfigV6(TEST_DIR);
  await expect(loadKyselyxConfig({})).resolves.not.toThrowError("Could not find Kyselyx configuration file.");
  expect(getConfig().configFile).toBe("kyselyx.config.ts");
  expect(getConfig().migrationsFolder).toBe(".kyselyx/migrations");
  expect(getConfig().seedsFolder).toBe(".kyselyx/seeds");
});
