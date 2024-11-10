import { randomBytes } from "crypto";
import fs from "fs-extra";
import path from "path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { getConfig, loadKyselyxConfig } from "../src/config.js";
import {
  setupBadKyselyxConfigV1,
  setupBadKyselyxConfigV2,
  setupBadKyselyxConfigV3,
  setupKyselyxConfigV1,
  setupKyselyxConfigV2,
  setupKyselyxConfigV3,
  setupKyselyxConfigV4,
  setupKyselyxConfigV5,
  setupKyselyxConfigV6,
} from "./utils/config.js";

// Each tests will use a dynamic import via the `loadKyselyxConfig` function. If another tests has
// a config file with the same name, but different configuration the cached config file will be
// used. For this reason, using a unique directory for each test is necessary.
let TEST_DIR: string;
beforeEach(async () => {
  TEST_DIR = path.resolve(__dirname, `testdir-${randomBytes(4).toString("hex")}`);
  await fs.rm(TEST_DIR, { recursive: true, force: true });
  await fs.mkdir(TEST_DIR);
  process.chdir(TEST_DIR);
});

afterEach(() => fs.rm(TEST_DIR, { recursive: true, force: true }));

describe("Config is correctly loaded", () => {
  test("with 'kyselyx.config.ts' in root, implicit 'migrationsFolder', implicit 'seedsFolder'", async () => {
    await setupKyselyxConfigV1(TEST_DIR);
    await loadKyselyxConfig({}).then((res) => expect(res.isOk()));

    const configRes = getConfig();
    expect(configRes.isOk()).toBe(true);
    if (configRes.isOk()) {
      expect(configRes.value.configFile).toBe("kyselyx.config.ts");
      expect(configRes.value.migrationsFolder).toBe("migrations");
      expect(configRes.value.seedsFolder).toBe("seeds");
    }
  });

  test("with 'kyselyx.config.js' in root, implicit 'migrationsFolder', implicit 'seedsFolder'", async () => {
    await setupKyselyxConfigV2(TEST_DIR);
    await loadKyselyxConfig({}).then((res) => expect(res.isOk()));

    const configRes = getConfig();
    expect(configRes.isOk()).toBe(true);
    if (configRes.isOk()) {
      expect(configRes.value.configFile).toBe("kyselyx.config.js");
      expect(configRes.value.migrationsFolder).toBe("migrations");
      expect(configRes.value.seedsFolder).toBe("seeds");
    }
  });

  test("with '.config/kyselyx.config.ts', implicit 'migrationsFolder', implicit 'seedsFolder'", async () => {
    await setupKyselyxConfigV3(TEST_DIR);
    await loadKyselyxConfig({}).then((res) => expect(res.isOk()));

    const configRes = getConfig();
    expect(configRes.isOk()).toBe(true);
    if (configRes.isOk()) {
      expect(configRes.value.configFile).toBe(".config/kyselyx.config.ts");
      expect(configRes.value.migrationsFolder).toBe("migrations");
      expect(configRes.value.seedsFolder).toBe("seeds");
    }
  });

  test("with '.config/kyselyx.config.js', implicit 'migrationsFolder', implicit 'seedsFolder'", async () => {
    await setupKyselyxConfigV4(TEST_DIR);
    await loadKyselyxConfig({}).then((res) => expect(res.isOk()));

    const configRes = getConfig();
    expect(configRes.isOk()).toBe(true);
    if (configRes.isOk()) {
      expect(configRes.value.configFile).toBe(".config/kyselyx.config.js");
      expect(configRes.value.migrationsFolder).toBe("migrations");
      expect(configRes.value.seedsFolder).toBe("seeds");
    }
  });

  test("with '.random/spaghetti.ts' Kyselyx config file, CLI supplied 'migrationsFolder', CLI supplied 'seedsFolder'", async () => {
    await setupKyselyxConfigV5(TEST_DIR);
    await loadKyselyxConfig({
      file: ".random/spaghetti.ts",
      migrationsFolder: ".random/migrations",
      seedsFolder: ".random/seeds",
    }).then((res) => expect(res.isOk()));

    const configRes = getConfig();
    expect(configRes.isOk()).toBe(true);
    if (configRes.isOk()) {
      expect(configRes.value.configFile).toBe(".random/spaghetti.ts");
      expect(configRes.value.migrationsFolder).toBe(".random/migrations");
      expect(configRes.value.seedsFolder).toBe(".random/seeds");
    }
  });

  test("with 'kyselyx.config.ts' in root, explicit 'migrationsFolder', explicit 'seedsFolder'", async () => {
    await setupKyselyxConfigV6(TEST_DIR);
    await loadKyselyxConfig({}).then((res) => expect(res.isOk()));

    const configRes = getConfig();
    expect(configRes.isOk()).toBe(true);
    if (configRes.isOk()) {
      expect(configRes.value.configFile).toBe("kyselyx.config.ts");
      expect(configRes.value.migrationsFolder).toBe(".kyselyx/migrations");
      expect(configRes.value.seedsFolder).toBe(".kyselyx/seeds");
    }
  });
});

describe("Config is not loaded", () => {
  test("when no config file is found", async () => {
    await loadKyselyxConfig({}).then((res) => expect(res.isErr()));
  });

  test("when config file has errors", async () => {
    await setupBadKyselyxConfigV1(TEST_DIR);
    await loadKyselyxConfig({}).then((res) => expect(res.isErr()));
  });

  test("when config file has no default export", async () => {
    await setupBadKyselyxConfigV2(TEST_DIR);
    await loadKyselyxConfig({}).then((res) => expect(res.isErr()));
  });

  test("when config file is missing properties", async () => {
    await setupBadKyselyxConfigV3(TEST_DIR);
    await loadKyselyxConfig({}).then((res) => expect(res.isErr()));
  });
});
