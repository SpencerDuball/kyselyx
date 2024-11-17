import { exec } from "child_process";
import { randomBytes } from "crypto";
import fs from "fs-extra";
import path from "path";
import { promisify } from "util";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { loadKyselyxConfig } from "../src/config.js";
import { exitFailure, getSeeder, getSeeds } from "../src/utils.js";
import { setupKyselyxConfigV1 } from "./utils/config.js";

const CLI_PATH = path.resolve(__dirname, "../dist/cli.js");
const asyncExec = promisify(exec);

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

describe("function 'generate'", () => {
  test("should generate all TS seed files", async () => {
    await setupKyselyxConfigV1(TEST_DIR);

    // create migrations & seeds
    await asyncExec(`node ${CLI_PATH} generate:migration users`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:migration sample`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:migration peanut_butter`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:seed users`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:seed sample`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:seed peanut_butter`).catch(exitFailure);

    // check if seeds were created
    const seeds = await fs.readdir(path.resolve(TEST_DIR, "seeds"));
    expect(seeds.find((f) => /\d+_users\.ts/.test(f))).not.toBeUndefined();
    expect(seeds.find((f) => /\d+_sample\.ts/.test(f))).not.toBeUndefined();
    expect(seeds.find((f) => /\d+_peanut_butter\.ts/.test(f))).not.toBeUndefined();
  });

  test("should generate all JS seed files", async () => {
    await setupKyselyxConfigV1(TEST_DIR);

    // create migrations & seeds
    await asyncExec(`node ${CLI_PATH} generate:migration users`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:migration sample`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:migration peanut_butter`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:seed users --js`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:seed sample --js`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:seed peanut_butter --js`).catch(exitFailure);

    // check if seeds were created
    const seeds = await fs.readdir(path.resolve(TEST_DIR, "seeds"));
    expect(seeds.find((f) => /\d+_users\.js/.test(f))).not.toBeUndefined();
    expect(seeds.find((f) => /\d+_sample\.js/.test(f))).not.toBeUndefined();
    expect(seeds.find((f) => /\d+_peanut_butter\.js/.test(f))).not.toBeUndefined();
  });

  test("should generate all JS & TS seed files", async () => {
    await setupKyselyxConfigV1(TEST_DIR);

    // create migrations & seeds
    await asyncExec(`node ${CLI_PATH} generate:migration users`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:migration sample`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:migration peanut_butter`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:seed users --js`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:seed sample`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:seed peanut_butter --js`).catch(exitFailure);

    // check if seeds were created
    const seeds = await fs.readdir(path.resolve(TEST_DIR, "seeds"));
    expect(seeds.find((f) => /\d+_users\.js/.test(f))).not.toBeUndefined();
    expect(seeds.find((f) => /\d+_sample\.ts/.test(f))).not.toBeUndefined();
    expect(seeds.find((f) => /\d+_peanut_butter\.js/.test(f))).not.toBeUndefined();
  });
});

describe("function 'seed'", () => {
  describe("when all migrations applied", () => {
    test("succeeds when seed=valid (not specified)", async () => {
      await setupKyselyxConfigV1(TEST_DIR);

      // create migrations & seeds
      await asyncExec(`node ${CLI_PATH} generate:seed before`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed before_2`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed before_3`).catch(exitFailure);
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
      const { appliedSeeds } = (await getSeeds(seeder)).match((i) => i, exitFailure);

      // confirm all seeds were appplied
      expect(appliedSeeds.find((m) => /\d+_before/.test(m.name))).not.toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_before_2/.test(m.name))).not.toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_before_3/.test(m.name))).not.toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_users/.test(m.name))).not.toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_users_2/.test(m.name))).not.toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_sample/.test(m.name))).not.toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_sample_2/.test(m.name))).not.toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_peanut_butter/.test(m.name))).not.toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_peanut_butter_2/.test(m.name))).not.toBeUndefined();
    });

    test("succeeds when seed=valid (first seed)", async () => {
      await setupKyselyxConfigV1(TEST_DIR);

      // create migrations & seeds
      await asyncExec(`node ${CLI_PATH} generate:seed before`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed before_2`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed before_3`).catch(exitFailure);
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
      await asyncExec(`node ${CLI_PATH} db:seed before`).catch(exitFailure);

      // load kyselyx config & get seeds
      await loadKyselyxConfig({});
      const seeder = getSeeder().match((i) => i, exitFailure);
      const { appliedSeeds } = (await getSeeds(seeder)).match((i) => i, exitFailure);

      // confirm all seeds were appplied
      expect(appliedSeeds.find((m) => /\d+_before/.test(m.name))).not.toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_before_2/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_before_3/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_users/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_users_2/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_sample/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_sample_2/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_peanut_butter/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_peanut_butter_2/.test(m.name))).toBeUndefined();
    });

    test("succeeds when seed=valid (not last seed)", async () => {
      await setupKyselyxConfigV1(TEST_DIR);

      // create migrations & seeds
      await asyncExec(`node ${CLI_PATH} generate:seed before`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed before_2`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed before_3`).catch(exitFailure);
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
      await asyncExec(`node ${CLI_PATH} db:seed sample`).catch(exitFailure);

      // load kyselyx config & get seeds
      await loadKyselyxConfig({});
      const seeder = getSeeder().match((i) => i, exitFailure);
      const { appliedSeeds } = (await getSeeds(seeder)).match((i) => i, exitFailure);

      // confirm all seeds were appplied
      expect(appliedSeeds.find((m) => /\d+_before/.test(m.name))).not.toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_before_2/.test(m.name))).not.toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_before_3/.test(m.name))).not.toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_users/.test(m.name))).not.toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_users_2/.test(m.name))).not.toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_sample/.test(m.name))).not.toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_sample_2/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_peanut_butter/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_peanut_butter_2/.test(m.name))).toBeUndefined();
    });

    test("succeeds when seed=valid (last seed)", async () => {
      await setupKyselyxConfigV1(TEST_DIR);

      // create migrations & seeds
      await asyncExec(`node ${CLI_PATH} generate:seed before`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed before_2`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed before_3`).catch(exitFailure);
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
      await asyncExec(`node ${CLI_PATH} db:seed peanut_butter_2`).catch(exitFailure);

      // load kyselyx config & get seeds
      await loadKyselyxConfig({});
      const seeder = getSeeder().match((i) => i, exitFailure);
      const { appliedSeeds } = (await getSeeds(seeder)).match((i) => i, exitFailure);

      // confirm all seeds were appplied
      expect(appliedSeeds.find((m) => /\d+_before/.test(m.name))).not.toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_before_2/.test(m.name))).not.toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_before_3/.test(m.name))).not.toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_users/.test(m.name))).not.toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_users_2/.test(m.name))).not.toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_sample/.test(m.name))).not.toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_sample_2/.test(m.name))).not.toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_peanut_butter/.test(m.name))).not.toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_peanut_butter_2/.test(m.name))).not.toBeUndefined();
    });

    test("fails when seed=invalid (bad seed name)", async () => {
      await setupKyselyxConfigV1(TEST_DIR);

      // create migrations & seeds
      await asyncExec(`node ${CLI_PATH} generate:seed before`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed before_2`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed before_3`).catch(exitFailure);
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
      await expect(() =>
        asyncExec(`node ${CLI_PATH} db:seed breanna_coffee`).catch(exitFailure),
      ).rejects.toThrowError();

      // load kyselyx config & get seeds
      await loadKyselyxConfig({});
      const seeder = getSeeder().match((i) => i, exitFailure);
      const { appliedSeeds } = (await getSeeds(seeder)).match((i) => i, exitFailure);

      // confirm all seeds were appplied
      expect(appliedSeeds.find((m) => /\d+_before/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_before_2/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_before_3/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_users/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_users_2/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_sample/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_sample_2/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_peanut_butter/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_peanut_butter_2/.test(m.name))).toBeUndefined();
    });
  });

  describe("when not all migrations applied", () => {
    test("succeeds when seed=valid (not specified)", async () => {
      await setupKyselyxConfigV1(TEST_DIR);

      // create migrations & seeds
      await asyncExec(`node ${CLI_PATH} generate:seed before`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed before_2`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed before_3`).catch(exitFailure);
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
      await asyncExec(`node ${CLI_PATH} db:migrate sample`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} db:seed`).catch(exitFailure);

      // load kyselyx config & get seeds
      await loadKyselyxConfig({});
      const seeder = getSeeder().match((i) => i, exitFailure);
      const { appliedSeeds } = (await getSeeds(seeder)).match((i) => i, exitFailure);

      // confirm all seeds were appplied
      expect(appliedSeeds.find((m) => /\d+_before/.test(m.name))).not.toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_before_2/.test(m.name))).not.toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_before_3/.test(m.name))).not.toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_users/.test(m.name))).not.toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_users_2/.test(m.name))).not.toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_sample/.test(m.name))).not.toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_sample_2/.test(m.name))).not.toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_peanut_butter/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_peanut_butter_2/.test(m.name))).toBeUndefined();
    });

    test("succeeds when seed=valid (first seed)", async () => {
      await setupKyselyxConfigV1(TEST_DIR);

      // create migrations & seeds
      await asyncExec(`node ${CLI_PATH} generate:seed before`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed before_2`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed before_3`).catch(exitFailure);
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
      await asyncExec(`node ${CLI_PATH} db:migrate sample`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} db:seed before`).catch(exitFailure);

      // load kyselyx config & get seeds
      await loadKyselyxConfig({});
      const seeder = getSeeder().match((i) => i, exitFailure);
      const { appliedSeeds } = (await getSeeds(seeder)).match((i) => i, exitFailure);

      // confirm all seeds were appplied
      expect(appliedSeeds.find((m) => /\d+_before/.test(m.name))).not.toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_before_2/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_before_3/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_users/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_users_2/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_sample/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_sample_2/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_peanut_butter/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_peanut_butter_2/.test(m.name))).toBeUndefined();
    });

    test("succeeds when seed=valid (not last seed)", async () => {
      await setupKyselyxConfigV1(TEST_DIR);

      // create migrations & seeds
      await asyncExec(`node ${CLI_PATH} generate:seed before`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed before_2`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed before_3`).catch(exitFailure);
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
      await asyncExec(`node ${CLI_PATH} db:migrate sample`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} db:seed users`).catch(exitFailure);

      // load kyselyx config & get seeds
      await loadKyselyxConfig({});
      const seeder = getSeeder().match((i) => i, exitFailure);
      const { appliedSeeds } = (await getSeeds(seeder)).match((i) => i, exitFailure);

      // confirm all seeds were appplied
      expect(appliedSeeds.find((m) => /\d+_before/.test(m.name))).not.toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_before_2/.test(m.name))).not.toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_before_3/.test(m.name))).not.toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_users/.test(m.name))).not.toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_users_2/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_sample/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_sample_2/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_peanut_butter/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_peanut_butter_2/.test(m.name))).toBeUndefined();
    });

    test("succeeds when seed=valid (last seed)", async () => {
      await setupKyselyxConfigV1(TEST_DIR);

      // create migrations & seeds
      await asyncExec(`node ${CLI_PATH} generate:seed before`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed before_2`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed before_3`).catch(exitFailure);
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
      await asyncExec(`node ${CLI_PATH} db:migrate sample`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} db:seed sample_2`).catch(exitFailure);

      // load kyselyx config & get seeds
      await loadKyselyxConfig({});
      const seeder = getSeeder().match((i) => i, exitFailure);
      const { appliedSeeds } = (await getSeeds(seeder)).match((i) => i, exitFailure);

      // confirm all seeds were appplied
      expect(appliedSeeds.find((m) => /\d+_before/.test(m.name))).not.toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_before_2/.test(m.name))).not.toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_before_3/.test(m.name))).not.toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_users/.test(m.name))).not.toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_users_2/.test(m.name))).not.toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_sample/.test(m.name))).not.toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_sample_2/.test(m.name))).not.toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_peanut_butter/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_peanut_butter_2/.test(m.name))).toBeUndefined();
    });

    test("fails when seed=invalid (bad seed name)", async () => {
      await setupKyselyxConfigV1(TEST_DIR);

      // create migrations & seeds
      await asyncExec(`node ${CLI_PATH} generate:seed before`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed before_2`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed before_3`).catch(exitFailure);
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
      await asyncExec(`node ${CLI_PATH} db:migrate sample`).catch(exitFailure);
      await expect(() =>
        asyncExec(`node ${CLI_PATH} db:seed breanna_coffee`).catch(exitFailure),
      ).rejects.toThrowError();

      // load kyselyx config & get seeds
      await loadKyselyxConfig({});
      const seeder = getSeeder().match((i) => i, exitFailure);
      const { appliedSeeds } = (await getSeeds(seeder)).match((i) => i, exitFailure);

      // confirm all seeds were appplied
      expect(appliedSeeds.find((m) => /\d+_before/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_before_2/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_before_3/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_users/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_users_2/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_sample/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_sample_2/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_peanut_butter/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_peanut_butter_2/.test(m.name))).toBeUndefined();
    });

    test("fails when seed=invalid (exceeds max seed timestamp)", async () => {
      await setupKyselyxConfigV1(TEST_DIR);

      // create migrations & seeds
      await asyncExec(`node ${CLI_PATH} generate:seed before`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed before_2`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed before_3`).catch(exitFailure);
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
      await asyncExec(`node ${CLI_PATH} db:migrate sample`).catch(exitFailure);
      await expect(() => asyncExec(`node ${CLI_PATH} db:seed peanut_butter`).catch(exitFailure)).rejects.toThrowError();

      // load kyselyx config & get seeds
      await loadKyselyxConfig({});
      const seeder = getSeeder().match((i) => i, exitFailure);
      const { appliedSeeds } = (await getSeeds(seeder)).match((i) => i, exitFailure);

      // confirm all seeds were appplied
      expect(appliedSeeds.find((m) => /\d+_before/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_before_2/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_before_3/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_users/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_users_2/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_sample/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_sample_2/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_peanut_butter/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_peanut_butter_2/.test(m.name))).toBeUndefined();
    });
  });

  describe("when no migrations applied", () => {
    test("succeeds when seed=valid (not specified)", async () => {
      await setupKyselyxConfigV1(TEST_DIR);

      // create migrations & seeds
      await asyncExec(`node ${CLI_PATH} generate:seed before`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed before_2`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed before_3`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:migration users`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed users`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed users_2`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:migration sample`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed sample`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed sample_2`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:migration peanut_butter`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed peanut_butter`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed peanut_butter_2`).catch(exitFailure);

      // apply seeds
      await asyncExec(`node ${CLI_PATH} db:seed`).catch(exitFailure);

      // load kyselyx config & get seeds
      await loadKyselyxConfig({});
      const seeder = getSeeder().match((i) => i, exitFailure);
      const { appliedSeeds } = (await getSeeds(seeder)).match((i) => i, exitFailure);

      // confirm all seeds were appplied
      expect(appliedSeeds.find((m) => /\d+_before/.test(m.name))).not.toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_before_2/.test(m.name))).not.toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_before_3/.test(m.name))).not.toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_users/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_users_2/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_sample/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_sample_2/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_peanut_butter/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_peanut_butter_2/.test(m.name))).toBeUndefined();
    });

    test("succeeds when seed=valid (first seed)", async () => {
      await setupKyselyxConfigV1(TEST_DIR);

      // create migrations & seeds
      await asyncExec(`node ${CLI_PATH} generate:seed before`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed before_2`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed before_3`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:migration users`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed users`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed users_2`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:migration sample`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed sample`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed sample_2`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:migration peanut_butter`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed peanut_butter`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed peanut_butter_2`).catch(exitFailure);

      // apply seeds
      await asyncExec(`node ${CLI_PATH} db:seed before`).catch(exitFailure);

      // load kyselyx config & get seeds
      await loadKyselyxConfig({});
      const seeder = getSeeder().match((i) => i, exitFailure);
      const { appliedSeeds } = (await getSeeds(seeder)).match((i) => i, exitFailure);

      // confirm all seeds were appplied
      expect(appliedSeeds.find((m) => /\d+_before/.test(m.name))).not.toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_before_2/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_before_3/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_users/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_users_2/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_sample/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_sample_2/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_peanut_butter/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_peanut_butter_2/.test(m.name))).toBeUndefined();
    });

    test("succeeds when seed=valid (not last seed)", async () => {
      await setupKyselyxConfigV1(TEST_DIR);

      // create migrations & seeds
      await asyncExec(`node ${CLI_PATH} generate:seed before`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed before_2`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed before_3`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:migration users`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed users`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed users_2`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:migration sample`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed sample`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed sample_2`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:migration peanut_butter`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed peanut_butter`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed peanut_butter_2`).catch(exitFailure);

      // apply seeds
      await asyncExec(`node ${CLI_PATH} db:seed before_2`).catch(exitFailure);

      // load kyselyx config & get seeds
      await loadKyselyxConfig({});
      const seeder = getSeeder().match((i) => i, exitFailure);
      const { appliedSeeds } = (await getSeeds(seeder)).match((i) => i, exitFailure);

      // confirm all seeds were appplied
      expect(appliedSeeds.find((m) => /\d+_before/.test(m.name))).not.toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_before_2/.test(m.name))).not.toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_before_3/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_users/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_users_2/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_sample/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_sample_2/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_peanut_butter/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_peanut_butter_2/.test(m.name))).toBeUndefined();
    });

    test("succeeds when seed=valid (last seed)", async () => {
      await setupKyselyxConfigV1(TEST_DIR);

      // create migrations & seeds
      await asyncExec(`node ${CLI_PATH} generate:seed before`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed before_2`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed before_3`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:migration users`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed users`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed users_2`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:migration sample`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed sample`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed sample_2`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:migration peanut_butter`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed peanut_butter`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed peanut_butter_2`).catch(exitFailure);

      // apply seeds
      await asyncExec(`node ${CLI_PATH} db:seed before_3`).catch(exitFailure);

      // load kyselyx config & get seeds
      await loadKyselyxConfig({});
      const seeder = getSeeder().match((i) => i, exitFailure);
      const { appliedSeeds } = (await getSeeds(seeder)).match((i) => i, exitFailure);

      // confirm all seeds were appplied
      expect(appliedSeeds.find((m) => /\d+_before/.test(m.name))).not.toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_before_2/.test(m.name))).not.toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_before_3/.test(m.name))).not.toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_users/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_users_2/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_sample/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_sample_2/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_peanut_butter/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_peanut_butter_2/.test(m.name))).toBeUndefined();
    });

    test("fails when seed=invalid (bad seed name)", async () => {
      await setupKyselyxConfigV1(TEST_DIR);

      // create migrations & seeds
      await asyncExec(`node ${CLI_PATH} generate:seed before`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed before_2`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed before_3`).catch(exitFailure);
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
      await expect(() =>
        asyncExec(`node ${CLI_PATH} db:seed breanna_coffee`).catch(exitFailure),
      ).rejects.toThrowError();

      // load kyselyx config & get seeds
      await loadKyselyxConfig({});
      const seeder = getSeeder().match((i) => i, exitFailure);
      const { appliedSeeds } = (await getSeeds(seeder)).match((i) => i, exitFailure);

      // confirm all seeds were appplied
      expect(appliedSeeds.find((m) => /\d+_before/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_before_2/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_before_3/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_users/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_users_2/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_sample/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_sample_2/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_peanut_butter/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_peanut_butter_2/.test(m.name))).toBeUndefined();
    });

    test("fails when seed=invalid (exceeds max seed timestamp)", async () => {
      await setupKyselyxConfigV1(TEST_DIR);

      // create migrations & seeds
      await asyncExec(`node ${CLI_PATH} generate:seed before`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed before_2`).catch(exitFailure);
      await asyncExec(`node ${CLI_PATH} generate:seed before_3`).catch(exitFailure);
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
      await expect(() => asyncExec(`node ${CLI_PATH} db:seed users`).catch(exitFailure)).rejects.toThrowError();

      // load kyselyx config & get seeds
      await loadKyselyxConfig({});
      const seeder = getSeeder().match((i) => i, exitFailure);
      const { appliedSeeds } = (await getSeeds(seeder)).match((i) => i, exitFailure);

      // confirm all seeds were appplied
      expect(appliedSeeds.find((m) => /\d+_before/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_before_2/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_before_3/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_users/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_users_2/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_sample/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_sample_2/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_peanut_butter/.test(m.name))).toBeUndefined();
      expect(appliedSeeds.find((m) => /\d+_peanut_butter_2/.test(m.name))).toBeUndefined();
    });
  });
});

describe.only("function 'undo'", () => {
  test("when no seeds applied", async () => {
    await setupKyselyxConfigV1(TEST_DIR);

    // create migrations & seeds
    await asyncExec(`node ${CLI_PATH} generate:seed before`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:seed before_2`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:seed before_3`).catch(exitFailure);
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

    // load kyselyx config & get seeds
    await loadKyselyxConfig({});
    const seeder = getSeeder().match((i) => i, exitFailure);
    let { appliedSeeds } = (await getSeeds(seeder)).match((i) => i, exitFailure);

    // confirm no seeds were appplied
    expect(appliedSeeds.find((m) => /\d+_before/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_before_2/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_before_3/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_users/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_users_2/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_sample/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_sample_2/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_peanut_butter/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_peanut_butter_2/.test(m.name))).toBeUndefined();

    // undo seed
    await asyncExec(`node ${CLI_PATH} db:seed:undo:all`).catch(exitFailure);
    ({ appliedSeeds } = (await getSeeds(seeder)).match((i) => i, exitFailure));

    // confirm no seeds are appplied
    expect(appliedSeeds.find((m) => /\d+_before/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_before_2/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_before_3/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_users/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_users_2/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_sample/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_sample_2/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_peanut_butter/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_peanut_butter_2/.test(m.name))).toBeUndefined();
  });

  test("when dropping all seeds without a named seed", async () => {
    await setupKyselyxConfigV1(TEST_DIR);

    // create migrations & seeds
    await asyncExec(`node ${CLI_PATH} generate:seed before`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:migration users`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:seed users`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:migration sample`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:seed sample`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:migration peanut_butter`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:seed peanut_butter`).catch(exitFailure);

    // apply migrations & seeds
    await asyncExec(`node ${CLI_PATH} db:migrate`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} db:seed`).catch(exitFailure);

    // load kyselyx config & get seeds
    await loadKyselyxConfig({});
    const seeder = getSeeder().match((i) => i, exitFailure);
    let { appliedSeeds } = (await getSeeds(seeder)).match((i) => i, exitFailure);

    // confirm no seeds were appplied
    expect(appliedSeeds.find((m) => /\d+_before/.test(m.name))).not.toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_users/.test(m.name))).not.toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_sample/.test(m.name))).not.toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_peanut_butter/.test(m.name))).not.toBeUndefined();

    // undo seed
    await asyncExec(`node ${CLI_PATH} db:seed:undo`).catch(exitFailure);
    ({ appliedSeeds } = (await getSeeds(seeder)).match((i) => i, exitFailure));

    // confirm no seeds are appplied
    expect(appliedSeeds.find((m) => /\d+_before/.test(m.name))).not.toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_users/.test(m.name))).not.toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_sample/.test(m.name))).not.toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_peanut_butter/.test(m.name))).toBeUndefined();

    // undo seed
    await asyncExec(`node ${CLI_PATH} db:seed:undo`).catch(exitFailure);
    ({ appliedSeeds } = (await getSeeds(seeder)).match((i) => i, exitFailure));

    // confirm no seeds are appplied
    expect(appliedSeeds.find((m) => /\d+_before/.test(m.name))).not.toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_users/.test(m.name))).not.toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_sample/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_peanut_butter/.test(m.name))).toBeUndefined();

    // undo seed
    await asyncExec(`node ${CLI_PATH} db:seed:undo`).catch(exitFailure);
    ({ appliedSeeds } = (await getSeeds(seeder)).match((i) => i, exitFailure));

    // confirm no seeds are appplied
    expect(appliedSeeds.find((m) => /\d+_before/.test(m.name))).not.toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_users/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_sample/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_peanut_butter/.test(m.name))).toBeUndefined();
  });

  test("when a valid named seed specified (first seed)", async () => {
    await setupKyselyxConfigV1(TEST_DIR);

    // create migrations & seeds
    await asyncExec(`node ${CLI_PATH} generate:seed before`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:migration users`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:seed users`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:migration sample`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:seed sample`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:migration peanut_butter`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:seed peanut_butter`).catch(exitFailure);

    // apply migrations & seeds
    await asyncExec(`node ${CLI_PATH} db:migrate`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} db:seed`).catch(exitFailure);

    // load kyselyx config & get seeds
    await loadKyselyxConfig({});
    const seeder = getSeeder().match((i) => i, exitFailure);
    let { appliedSeeds } = (await getSeeds(seeder)).match((i) => i, exitFailure);

    // confirm no seeds were appplied
    expect(appliedSeeds.find((m) => /\d+_before/.test(m.name))).not.toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_users/.test(m.name))).not.toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_sample/.test(m.name))).not.toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_peanut_butter/.test(m.name))).not.toBeUndefined();

    // undo seed
    await asyncExec(`node ${CLI_PATH} db:seed:undo before`).catch(exitFailure);
    ({ appliedSeeds } = (await getSeeds(seeder)).match((i) => i, exitFailure));

    // confirm no seeds are appplied
    expect(appliedSeeds.find((m) => /\d+_before/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_users/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_sample/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_peanut_butter/.test(m.name))).toBeUndefined();
  });

  test("when a valid named seed specified (mid seed)", async () => {
    await setupKyselyxConfigV1(TEST_DIR);

    // create migrations & seeds
    await asyncExec(`node ${CLI_PATH} generate:seed before`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:migration users`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:seed users`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:migration sample`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:seed sample`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:migration peanut_butter`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:seed peanut_butter`).catch(exitFailure);

    // apply migrations & seeds
    await asyncExec(`node ${CLI_PATH} db:migrate`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} db:seed`).catch(exitFailure);

    // load kyselyx config & get seeds
    await loadKyselyxConfig({});
    const seeder = getSeeder().match((i) => i, exitFailure);
    let { appliedSeeds } = (await getSeeds(seeder)).match((i) => i, exitFailure);

    // confirm no seeds were appplied
    expect(appliedSeeds.find((m) => /\d+_before/.test(m.name))).not.toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_users/.test(m.name))).not.toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_sample/.test(m.name))).not.toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_peanut_butter/.test(m.name))).not.toBeUndefined();

    // undo seed
    await asyncExec(`node ${CLI_PATH} db:seed:undo sample`).catch(exitFailure);
    ({ appliedSeeds } = (await getSeeds(seeder)).match((i) => i, exitFailure));

    // confirm no seeds are appplied
    expect(appliedSeeds.find((m) => /\d+_before/.test(m.name))).not.toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_users/.test(m.name))).not.toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_sample/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_peanut_butter/.test(m.name))).toBeUndefined();
  });

  test("when a valid named seed specified (last seed)", async () => {
    await setupKyselyxConfigV1(TEST_DIR);

    // create migrations & seeds
    await asyncExec(`node ${CLI_PATH} generate:seed before`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:migration users`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:seed users`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:migration sample`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:seed sample`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:migration peanut_butter`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:seed peanut_butter`).catch(exitFailure);

    // apply migrations & seeds
    await asyncExec(`node ${CLI_PATH} db:migrate`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} db:seed`).catch(exitFailure);

    // load kyselyx config & get seeds
    await loadKyselyxConfig({});
    const seeder = getSeeder().match((i) => i, exitFailure);
    let { appliedSeeds } = (await getSeeds(seeder)).match((i) => i, exitFailure);

    // confirm no seeds were appplied
    expect(appliedSeeds.find((m) => /\d+_before/.test(m.name))).not.toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_users/.test(m.name))).not.toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_sample/.test(m.name))).not.toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_peanut_butter/.test(m.name))).not.toBeUndefined();

    // undo seed
    await asyncExec(`node ${CLI_PATH} db:seed:undo peanut_butter`).catch(exitFailure);
    ({ appliedSeeds } = (await getSeeds(seeder)).match((i) => i, exitFailure));

    // confirm no seeds are appplied
    expect(appliedSeeds.find((m) => /\d+_before/.test(m.name))).not.toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_users/.test(m.name))).not.toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_sample/.test(m.name))).not.toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_peanut_butter/.test(m.name))).toBeUndefined();
  });

  test("fails when an invalid seed specified (outside of applied seeds)", async () => {
    await setupKyselyxConfigV1(TEST_DIR);

    // create migrations & seeds
    await asyncExec(`node ${CLI_PATH} generate:seed before`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:migration users`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:seed users`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:migration sample`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:seed sample`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:migration peanut_butter`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:seed peanut_butter`).catch(exitFailure);

    // apply migrations & seeds
    await asyncExec(`node ${CLI_PATH} db:migrate`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} db:seed sample`).catch(exitFailure);

    // load kyselyx config & get seeds
    await loadKyselyxConfig({});
    const seeder = getSeeder().match((i) => i, exitFailure);
    let { appliedSeeds } = (await getSeeds(seeder)).match((i) => i, exitFailure);

    // confirm no seeds were appplied
    expect(appliedSeeds.find((m) => /\d+_before/.test(m.name))).not.toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_users/.test(m.name))).not.toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_sample/.test(m.name))).not.toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_peanut_butter/.test(m.name))).toBeUndefined();

    // undo seed
    await asyncExec(`node ${CLI_PATH} db:seed:undo peanut_butter`).catch(exitFailure);
    ({ appliedSeeds } = (await getSeeds(seeder)).match((i) => i, exitFailure));

    // confirm no seeds are appplied
    expect(appliedSeeds.find((m) => /\d+_before/.test(m.name))).not.toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_users/.test(m.name))).not.toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_sample/.test(m.name))).not.toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_peanut_butter/.test(m.name))).toBeUndefined();
  });

  test("fails when an invalid seed specified (bad seed name)", async () => {
    await setupKyselyxConfigV1(TEST_DIR);

    // create migrations & seeds
    await asyncExec(`node ${CLI_PATH} generate:seed before`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:migration users`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:seed users`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:migration sample`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:seed sample`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:migration peanut_butter`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:seed peanut_butter`).catch(exitFailure);

    // apply migrations & seeds
    await asyncExec(`node ${CLI_PATH} db:migrate`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} db:seed sample`).catch(exitFailure);

    // load kyselyx config & get seeds
    await loadKyselyxConfig({});
    const seeder = getSeeder().match((i) => i, exitFailure);
    let { appliedSeeds } = (await getSeeds(seeder)).match((i) => i, exitFailure);

    // confirm no seeds were appplied
    expect(appliedSeeds.find((m) => /\d+_before/.test(m.name))).not.toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_users/.test(m.name))).not.toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_sample/.test(m.name))).not.toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_peanut_butter/.test(m.name))).toBeUndefined();

    // undo seed
    await asyncExec(`node ${CLI_PATH} db:seed:undo breanna_coffee`).catch(exitFailure);
    ({ appliedSeeds } = (await getSeeds(seeder)).match((i) => i, exitFailure));

    // confirm no seeds are appplied
    expect(appliedSeeds.find((m) => /\d+_before/.test(m.name))).not.toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_users/.test(m.name))).not.toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_sample/.test(m.name))).not.toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_peanut_butter/.test(m.name))).toBeUndefined();
  });
});

describe("function 'undoAll'", () => {
  test("when no seeds applied", async () => {
    await setupKyselyxConfigV1(TEST_DIR);

    // create migrations & seeds
    await asyncExec(`node ${CLI_PATH} generate:seed before`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:seed before_2`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:seed before_3`).catch(exitFailure);
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

    // load kyselyx config & get seeds
    await loadKyselyxConfig({});
    const seeder = getSeeder().match((i) => i, exitFailure);
    let { appliedSeeds } = (await getSeeds(seeder)).match((i) => i, exitFailure);

    // confirm all seeds were appplied
    expect(appliedSeeds.find((m) => /\d+_before/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_before_2/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_before_3/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_users/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_users_2/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_sample/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_sample_2/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_peanut_butter/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_peanut_butter_2/.test(m.name))).toBeUndefined();

    // undo all seeds
    await asyncExec(`node ${CLI_PATH} db:seed:undo:all`).catch(exitFailure);
    ({ appliedSeeds } = (await getSeeds(seeder)).match((i) => i, exitFailure));

    // confirm all seeds were dropped
    expect(appliedSeeds.find((m) => /\d+_before/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_before_2/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_before_3/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_users/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_users_2/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_sample/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_sample_2/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_peanut_butter/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_peanut_butter_2/.test(m.name))).toBeUndefined();
  });

  test("when some seeds applied", async () => {
    await setupKyselyxConfigV1(TEST_DIR);

    // create migrations & seeds
    await asyncExec(`node ${CLI_PATH} generate:seed before`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:seed before_2`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:seed before_3`).catch(exitFailure);
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
    await asyncExec(`node ${CLI_PATH} db:seed sample`).catch(exitFailure);

    // load kyselyx config & get seeds
    await loadKyselyxConfig({});
    const seeder = getSeeder().match((i) => i, exitFailure);
    let { appliedSeeds } = (await getSeeds(seeder)).match((i) => i, exitFailure);

    // confirm all seeds were appplied
    expect(appliedSeeds.find((m) => /\d+_before/.test(m.name))).not.toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_before_2/.test(m.name))).not.toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_before_3/.test(m.name))).not.toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_users/.test(m.name))).not.toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_users_2/.test(m.name))).not.toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_sample/.test(m.name))).not.toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_sample_2/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_peanut_butter/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_peanut_butter_2/.test(m.name))).toBeUndefined();

    // undo all seeds
    await asyncExec(`node ${CLI_PATH} db:seed:undo:all`).catch(exitFailure);
    ({ appliedSeeds } = (await getSeeds(seeder)).match((i) => i, exitFailure));

    // confirm all seeds were dropped
    expect(appliedSeeds.find((m) => /\d+_before/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_before_2/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_before_3/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_users/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_users_2/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_sample/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_sample_2/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_peanut_butter/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_peanut_butter_2/.test(m.name))).toBeUndefined();
  });

  test("when all seeds applied", async () => {
    await setupKyselyxConfigV1(TEST_DIR);

    // create migrations & seeds
    await asyncExec(`node ${CLI_PATH} generate:seed before`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:seed before_2`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:seed before_3`).catch(exitFailure);
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
    let { appliedSeeds } = (await getSeeds(seeder)).match((i) => i, exitFailure);

    // confirm all seeds were appplied
    expect(appliedSeeds.find((m) => /\d+_before/.test(m.name))).not.toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_before_2/.test(m.name))).not.toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_before_3/.test(m.name))).not.toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_users/.test(m.name))).not.toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_users_2/.test(m.name))).not.toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_sample/.test(m.name))).not.toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_sample_2/.test(m.name))).not.toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_peanut_butter/.test(m.name))).not.toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_peanut_butter_2/.test(m.name))).not.toBeUndefined();

    // undo all seeds
    await asyncExec(`node ${CLI_PATH} db:seed:undo:all`).catch(exitFailure);
    ({ appliedSeeds } = (await getSeeds(seeder)).match((i) => i, exitFailure));

    // confirm all seeds were dropped
    expect(appliedSeeds.find((m) => /\d+_before/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_before_2/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_before_3/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_users/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_users_2/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_sample/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_sample_2/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_peanut_butter/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_peanut_butter_2/.test(m.name))).toBeUndefined();
  });
});
