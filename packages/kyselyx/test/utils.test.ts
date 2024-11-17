import { exec } from "child_process";
import { randomBytes } from "crypto";
import fs from "fs-extra";
import { NO_MIGRATIONS } from "kysely";
import path from "path";
import "tsx/esm"; // This MUST be imported for the tests to run properly!
import { promisify } from "util";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { loadKyselyxConfig } from "../src/config.js";
import { NO_SEEDS } from "../src/seeder/seed.js";
import {
  type Migration,
  doesNameMatch,
  exitFailure,
  getMigrations,
  getMigrator,
  getNameParts,
  getSeeder,
  getSeeds,
  getTargetSeed,
  isNoSeeds,
} from "../src/utils.js";
import { setupKyselyxConfigV1 } from "./utils/config.js";

const CLI_PATH = path.resolve(__dirname, "../dist/cli.js");
const asyncExec = promisify(exec);

/**
 * A helper function for creating a migration objects for testing.
 */
function createMigration(timestamp: number, label: string): Migration {
  return {
    timestamp,
    label,
    name: `${timestamp}_${label}`,
    executedAt: undefined,
    migration: { up: async () => {}, down: async () => {} },
  };
}

describe("doesNameMatch", () => {
  test("matches when name match exactly", () => {
    const name = "1612345678_create_table";
    const item = createMigration(1612345678, "create_table");
    const result = doesNameMatch(name)(item);
    expect(result).toBe(true);
  });

  test("matches when labels match & no timestamp", () => {
    const name = "create_table";
    const item = createMigration(1612345678, "create_table");
    const result = doesNameMatch(name)(item);
    expect(result).toBe(true);
  });

  test("matches when labels match & timestamp matches partially", () => {
    const name = "78_create_table";
    const item = createMigration(1612345678, "create_table");
    const result = doesNameMatch(name)(item);
    expect(result).toBe(true);
  });

  test("does not match when labels do not match", () => {
    const name = "1612345678_create_table";
    const item = createMigration(1612345678, "create_table_2");
    const result = doesNameMatch(name)(item);
    expect(result).toBe(false);
  });

  test("does not match when labels do not match & no timestamp", () => {
    const name = "create_table";
    const item = createMigration(1612345678, "create_table_2");
    const result = doesNameMatch(name)(item);
    expect(result).toBe(false);
  });

  test("does not match when labels match & timestamp does not match", () => {
    const name = "1612345678_create_table";
    const item = createMigration(161234567, "create_table");
    const result = doesNameMatch(name)(item);
    expect(result).toBe(false);
  });
});

describe("getNameParts", () => {
  test("returns parts when name is valid", () => {
    const item = createMigration(1612345678, "create_table");
    const result = getNameParts(item);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.timestamp).toBe(1612345678);
      expect(result.value.label).toBe("create_table");
    }
  });

  test("returns error when timestamp is missing", () => {
    const item = createMigration(NaN, "create_table");
    const result = getNameParts(item);
    expect(result.isErr()).toBe(true);
  });

  test("returns error when label is missing", () => {
    const item = createMigration(1612345678, "");
    const result = getNameParts(item);
    expect(result.isErr()).toBe(true);
  });
});

describe("getTargetSeed", () => {
  // Each test will use a dynamic import via the `loadKyselyxConfig` function. If another test has
  // a config file with the same name, but different configuration the cached config file will be
  // used. For this reason, using a unique directory for each test is necessary.
  let TEST_DIR: string;
  beforeEach(async () => {
    TEST_DIR = path.resolve(__dirname, `test-dir-${randomBytes(4).toString("hex")}`);
    await fs.rm(TEST_DIR, { recursive: true, force: true });
    await fs.mkdir(TEST_DIR);
    process.chdir(TEST_DIR);
  });

  afterEach(() => fs.rm(TEST_DIR, { recursive: true, force: true }));

  test("works when seed=NO_SEEDS", async () => {
    await setupKyselyxConfigV1(TEST_DIR);

    // create migrations & seeds
    await asyncExec(`node ${CLI_PATH} generate:seed before`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:seed before_2`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:migration users`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:seed users`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:seed users_2`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:migration sample`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:seed sample`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:seed sample_2`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:migration peanut_butter`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:seed peanut_butter`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:seed peanut_butter_2`).catch(exitFailure);

    // apply migrations & seeds
    await asyncExec(`node ${CLI_PATH} db:migrate`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} db:seed`).catch(exitFailure);

    // load kyselyx config & get target seed
    await loadKyselyxConfig({});
    const targetSeed = (await getTargetSeed({ seed: NO_SEEDS })).match((i) => i, exitFailure);
    expect(targetSeed).toBe(NO_SEEDS);
  });

  describe("when migrations=NO_MIGRATIONS", () => {
    test("and seed=undefined, has seed before migration", async () => {
      await setupKyselyxConfigV1(TEST_DIR);

      // create migrations & seeds
      await asyncExec(`node ${CLI_PATH} generate:seed before`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed before_2`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:migration users`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed users`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed users_2`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:migration sample`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed sample`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed sample_2`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:migration peanut_butter`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed peanut_butter`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed peanut_butter_2`).catch(exitFailure);

      // apply migrations & seeds
      await asyncExec(`node ${CLI_PATH} db:migrate`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} db:seed`).catch(exitFailure);

      // load kyselyx config
      await loadKyselyxConfig({});

      // get target seed
      const targetSeed = (await getTargetSeed({ migration: NO_MIGRATIONS })).match((i) => i, exitFailure);

      // ensure target seed is seed before first migration
      expect(isNoSeeds(targetSeed)).toBe(false);
      if (!isNoSeeds(targetSeed)) expect(targetSeed.name).toMatch(/\d+_before_2/);
    });

    test("and seed=undefined, no seed before migrations", async () => {
      await setupKyselyxConfigV1(TEST_DIR);

      // create migrations & seeds
      await asyncExec(`node ${CLI_PATH} generate:migration users`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed users`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed users_2`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:migration sample`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed sample`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed sample_2`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:migration peanut_butter`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed peanut_butter`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed peanut_butter_2`).catch(exitFailure);

      // apply migrations & seeds
      await asyncExec(`node ${CLI_PATH} db:migrate`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} db:seed`).catch(exitFailure);

      // load kyselyx config
      await loadKyselyxConfig({});

      // get target seed
      const targetSeed = (await getTargetSeed({ migration: NO_MIGRATIONS })).match((i) => i, exitFailure);

      // ensure target seed is seed before first migration
      expect(isNoSeeds(targetSeed)).toBe(true);
    });

    test("and seed=valid (less than max valid seed)", async () => {
      await setupKyselyxConfigV1(TEST_DIR);

      // create migrations & seeds
      await asyncExec(`node ${CLI_PATH} generate:seed before`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed before_2`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:migration users`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed users`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed users_2`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:migration sample`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed sample`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed sample_2`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:migration peanut_butter`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed peanut_butter`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed peanut_butter_2`).catch(exitFailure);

      // apply migrations & seeds
      await asyncExec(`node ${CLI_PATH} db:migrate`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} db:seed`).catch(exitFailure);

      // load kyselyx config & get seeds
      await loadKyselyxConfig({});
      const seeder = getSeeder().match((i) => i, exitFailure);
      const { allSeeds } = (await getSeeds(seeder)).match((i) => i, exitFailure);

      // get target seed
      const targetSeed = (await getTargetSeed({ migration: NO_MIGRATIONS, seed: allSeeds[0] })).match(
        (i) => i,
        exitFailure,
      );

      // ensure target seed is seed before first migration
      expect(isNoSeeds(targetSeed)).toBe(false);
      if (!isNoSeeds(targetSeed)) expect(targetSeed.name).toMatch(/\d+_before/);
    });

    test("and fails when seed=invalid (exceeds max valid seed)", async () => {
      await setupKyselyxConfigV1(TEST_DIR);

      // create migrations & seeds
      await asyncExec(`node ${CLI_PATH} generate:seed before`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed before_2`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:migration users`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed users`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed users_2`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:migration sample`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed sample`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed sample_2`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:migration peanut_butter`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed peanut_butter`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed peanut_butter_2`).catch(exitFailure);

      // apply migrations & seeds
      await asyncExec(`node ${CLI_PATH} db:migrate`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} db:seed`).catch(exitFailure);

      // load kyselyx config & get seeds
      await loadKyselyxConfig({});
      const seeder = getSeeder().match((i) => i, exitFailure);
      const { allSeeds } = (await getSeeds(seeder)).match((i) => i, exitFailure);

      // get target seed
      const targetSeed = (await getTargetSeed({ migration: NO_MIGRATIONS, seed: allSeeds.at(-1) })).match(
        (i) => i,
        (e) => e,
      );

      expect(targetSeed).toBeInstanceOf(Error);
      if (targetSeed instanceof Error) expect(targetSeed.traceId).toBe("f56b28");
    });
  });

  describe("when migrations=NO_MIGRATIONS", () => {
    test("and migration=valid, seed=undefined", async () => {
      await setupKyselyxConfigV1(TEST_DIR);

      // create migrations & seeds
      await asyncExec(`node ${CLI_PATH} generate:seed before`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed before_2`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:migration users`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed users`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed users_2`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:migration sample`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed sample`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed sample_2`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:migration peanut_butter`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed peanut_butter`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed peanut_butter_2`).catch(exitFailure);

      // apply migrations & seeds
      await asyncExec(`node ${CLI_PATH} db:migrate`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} db:seed`).catch(exitFailure);

      // load kyselyx config & get seeds
      await loadKyselyxConfig({});
      const migrator = getMigrator().match((i) => i, exitFailure);
      const { allMigrations } = (await getMigrations(migrator)).match((i) => i, exitFailure);

      // get the sample migration
      const sampleMigration = allMigrations.find((m) => /\d+_sample$/.test(m.name));
      if (!sampleMigration) throw new Error("Sample migration not found!");

      // get target seed
      const targetSeed = (await getTargetSeed({ migration: sampleMigration })).match(
        (i) => i,
        (e) => e,
      );

      expect(isNoSeeds(targetSeed)).toBe(false);
      if (!isNoSeeds(targetSeed)) expect(targetSeed.name).toMatch(/\d+_users_2$/);
    });

    test("and migration=valid, seed=valid (less than max seed)", async () => {
      await setupKyselyxConfigV1(TEST_DIR);

      // create migrations & seeds
      await asyncExec(`node ${CLI_PATH} generate:seed before`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed before_2`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:migration users`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed users`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed users_2`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:migration sample`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed sample`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed sample_2`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:migration peanut_butter`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed peanut_butter`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed peanut_butter_2`).catch(exitFailure);

      // apply migrations & seeds
      await asyncExec(`node ${CLI_PATH} db:migrate`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} db:seed`).catch(exitFailure);

      // load kyselyx config & get seeds
      await loadKyselyxConfig({});
      const migrator = getMigrator().match((i) => i, exitFailure);
      const { allMigrations } = (await getMigrations(migrator)).match((i) => i, exitFailure);
      const seeder = getSeeder().match((i) => i, exitFailure);
      const { allSeeds } = (await getSeeds(seeder)).match((i) => i, exitFailure);

      // get the sample migration
      const sampleMigration = allMigrations.find((m) => /\d+_sample$/.test(m.name));
      if (!sampleMigration) throw new Error("Sample migration not found!");

      // get the 'users' seed
      const usersSeed = allSeeds.find((s) => /\d+_users$/.test(s.name));
      if (!usersSeed) throw new Error("Users seed not found!");

      // get target seed
      const targetSeed = (await getTargetSeed({ migration: sampleMigration, seed: usersSeed })).match(
        (i) => i,
        (e) => e,
      );

      expect(isNoSeeds(targetSeed)).toBe(false);
      if (!isNoSeeds(targetSeed)) expect(targetSeed.name).toMatch(/\d+_users$/);
    });

    test("and migration=valid, seed=invalid (exceeds max seed)", async () => {
      await setupKyselyxConfigV1(TEST_DIR);

      // create migrations & seeds
      await asyncExec(`node ${CLI_PATH} generate:seed before`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed before_2`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:migration users`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed users`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed users_2`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:migration sample`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed sample`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed sample_2`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:migration peanut_butter`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed peanut_butter`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed peanut_butter_2`).catch(exitFailure);

      // apply migrations & seeds
      await asyncExec(`node ${CLI_PATH} db:migrate`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} db:seed`).catch(exitFailure);

      // load kyselyx config & get seeds
      await loadKyselyxConfig({});
      const migrator = getMigrator().match((i) => i, exitFailure);
      const { allMigrations } = (await getMigrations(migrator)).match((i) => i, exitFailure);
      const seeder = getSeeder().match((i) => i, exitFailure);
      const { allSeeds } = (await getSeeds(seeder)).match((i) => i, exitFailure);

      // get the sample migration
      const sampleMigration = allMigrations.find((m) => /\d+_sample$/.test(m.name));
      if (!sampleMigration) throw new Error("Sample migration not found!");

      // get the 'users' seed
      const usersSeed = allSeeds.find((s) => /\d+_sample$/.test(s.name));
      if (!usersSeed) throw new Error("Users seed not found!");

      // get target seed
      const targetSeed = (await getTargetSeed({ migration: sampleMigration, seed: usersSeed })).match(
        (i) => i,
        (e) => e,
      );

      expect(targetSeed).toBeInstanceOf(Error);
      if (targetSeed instanceof Error) expect(targetSeed.traceId).toBe("e6f580");
    });
  });
});
