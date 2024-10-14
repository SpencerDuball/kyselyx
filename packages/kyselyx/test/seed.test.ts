import { exec } from "child_process";
import { randomBytes } from "crypto";
import fs from "fs-extra";
import path from "path";
import { promisify } from "util";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { setupKyselyxConfigV1 } from "./utils/config";
import { getMigrationInfo, getSeedInfo } from "./utils/status";

const CLI_PATH = path.resolve(__dirname, "../dist/cli.js");
const asyncExec = promisify(exec);

// Each test will use a dynamic import via the `loadKyselyxConfig` function. If another test has
// a config file with the same name, but different configuration the cached config file will be
// used. For this reason, using a unique directory for each test is necessary.
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

describe("function 'new_'", () => {
  test("creates seeds successfully", async () => {
    await setupKyselyxConfigV1(TEST_DIR);

    // create seeds
    await asyncExec(`node ${CLI_PATH} db:seed:new users`);
    await asyncExec(`node ${CLI_PATH} db:seed:new sample`);
    await asyncExec(`node ${CLI_PATH} db:seed:new peanut_butter`);

    // check if seeds were created
    const seeds = await fs.readdir(path.resolve(TEST_DIR, "seeds"));
    expect(seeds.find((f) => /\d+_users/.test(f))).not.toBeUndefined();
    expect(seeds.find((f) => /\d+_sample/.test(f))).not.toBeUndefined();
    expect(seeds.find((f) => /\d+_peanut_butter/.test(f))).not.toBeUndefined();
  });
});

describe("function 'seed'", () => {
  test("successfully applies all seeds", async () => {
    await setupKyselyxConfigV1(TEST_DIR);

    // create migrations & seeds
    await asyncExec(`node ${CLI_PATH} db:migrate:new users`);
    await asyncExec(`node ${CLI_PATH} db:seed:new users`);
    await asyncExec(`node ${CLI_PATH} db:migrate:new sample`);
    await asyncExec(`node ${CLI_PATH} db:seed:new sample`);
    await asyncExec(`node ${CLI_PATH} db:migrate:new peanut_butter`);
    await asyncExec(`node ${CLI_PATH} db:seed:new peanut_butter`);

    // apply all migrations
    await asyncExec(`node ${CLI_PATH} db:migrate`);

    // apply all seeds
    await asyncExec(`node ${CLI_PATH} db:seed`);

    // confirm all seeds applied
    const appliedSeeds = await getSeedInfo().then((all) => all.filter((s) => s.executedAt !== undefined));
    expect(appliedSeeds.find((s) => /\d+_users/.test(s.name))).not.toBeUndefined();
    expect(appliedSeeds.find((s) => /\d+_sample/.test(s.name))).not.toBeUndefined();
    expect(appliedSeeds.find((s) => /\d+_peanut_butter/.test(s.name))).not.toBeUndefined();
  });

  test("successfully applies all but 1 seed", async () => {
    await setupKyselyxConfigV1(TEST_DIR);

    // create migrations & seeds
    await asyncExec(`node ${CLI_PATH} db:migrate:new users`);
    await asyncExec(`node ${CLI_PATH} db:seed:new users`);
    await asyncExec(`node ${CLI_PATH} db:migrate:new sample`);
    await asyncExec(`node ${CLI_PATH} db:seed:new sample`);
    await asyncExec(`node ${CLI_PATH} db:migrate:new peanut_butter`);
    await asyncExec(`node ${CLI_PATH} db:seed:new peanut_butter`);

    // get all migrations
    const migrations = await getMigrationInfo();

    // apply migrations up to the "sample" migration
    const sampleMigration = migrations.find((m) => /\d+_sample/.test(m.name));
    await asyncExec(`node ${CLI_PATH} db:migrate ${sampleMigration?.name}`);

    // apply all seeds
    await asyncExec(`node ${CLI_PATH} db:seed`);

    // confirm only up to the "sample" migration was applied
    const appliedSeeds = await getSeedInfo().then((all) => all.filter((s) => s.executedAt !== undefined));
    expect(appliedSeeds.find((s) => /\d+_users/.test(s.name))).not.toBeUndefined();
    expect(appliedSeeds.find((s) => /\d+_sample/.test(s.name))).not.toBeUndefined();
    expect(appliedSeeds.find((s) => /\d+_peanut_butter/.test(s.name))).toBeUndefined();
  });

  test("successfully applies up to valid named seed", async () => {
    await setupKyselyxConfigV1(TEST_DIR);

    // create migrations & seeds
    await asyncExec(`node ${CLI_PATH} db:migrate:new users`);
    await asyncExec(`node ${CLI_PATH} db:seed:new users`);
    await asyncExec(`node ${CLI_PATH} db:migrate:new sample`);
    await asyncExec(`node ${CLI_PATH} db:seed:new sample`);
    await asyncExec(`node ${CLI_PATH} db:migrate:new peanut_butter`);
    await asyncExec(`node ${CLI_PATH} db:seed:new peanut_butter`);

    // get all migrations
    const migrations = await getMigrationInfo();

    // apply migrations up to the "sample" migration
    const sampleMigration = migrations.find((m) => /\d+_sample/.test(m.name));
    await asyncExec(`node ${CLI_PATH} db:migrate ${sampleMigration?.name}`);

    // apply up to valid named seed
    const usersSeed = await getSeedInfo().then((all) => all.find((s) => /\d+_users/.test(s.name)));
    await asyncExec(`node ${CLI_PATH} db:seed ${usersSeed?.name}`);

    // confirm only up to the "users" migration was applied
    const appliedSeeds = await getSeedInfo().then((all) => all.filter((s) => s.executedAt !== undefined));
    expect(appliedSeeds.find((s) => /\d+_users/.test(s.name))).not.toBeUndefined();
    expect(appliedSeeds.find((s) => /\d+_sample/.test(s.name))).toBeUndefined();
    expect(appliedSeeds.find((s) => /\d+_peanut_butter/.test(s.name))).toBeUndefined();
  });

  test("doesn't apply invalid named seed", async () => {
    await setupKyselyxConfigV1(TEST_DIR);

    // create migrations & seeds
    await asyncExec(`node ${CLI_PATH} db:migrate:new users`);
    await asyncExec(`node ${CLI_PATH} db:seed:new users`);
    await asyncExec(`node ${CLI_PATH} db:migrate:new sample`);
    await asyncExec(`node ${CLI_PATH} db:seed:new sample`);
    await asyncExec(`node ${CLI_PATH} db:migrate:new peanut_butter`);
    await asyncExec(`node ${CLI_PATH} db:seed:new peanut_butter`);

    // get all migrations
    const migrations = await getMigrationInfo();

    // apply migrations up to the "sample" migration
    const sampleMigration = migrations.find((m) => /\d+_sample/.test(m.name));
    await asyncExec(`node ${CLI_PATH} db:migrate ${sampleMigration?.name}`);

    // attempt to apply invalid named seed
    const peanutButterSeed = await getSeedInfo().then((all) => all.find((s) => /\d+_peanut_butter/.test(s.name)));
    expect(() => asyncExec(`node ${CLI_PATH} db:seed ${peanutButterSeed?.name}`)).rejects.toThrowError();
  });
});

describe("function 'undo'", () => {
  test("successfully undo seeds", async () => {
    await setupKyselyxConfigV1(TEST_DIR);

    // create migrations & seeds
    await asyncExec(`node ${CLI_PATH} db:migrate:new users`);
    await asyncExec(`node ${CLI_PATH} db:seed:new users`);
    await asyncExec(`node ${CLI_PATH} db:migrate:new sample`);
    await asyncExec(`node ${CLI_PATH} db:seed:new sample`);
    await asyncExec(`node ${CLI_PATH} db:migrate:new peanut_butter`);
    await asyncExec(`node ${CLI_PATH} db:seed:new peanut_butter`);

    // apply all migrations
    await asyncExec(`node ${CLI_PATH} db:migrate`);

    // apply all seeds
    await asyncExec(`node ${CLI_PATH} db:seed`);

    // confirm all seeds applied
    let appliedSeeds = await getSeedInfo().then((all) => all.filter((s) => s.executedAt !== undefined));
    expect(appliedSeeds.find((s) => /\d+_users/.test(s.name))).not.toBeUndefined();
    expect(appliedSeeds.find((s) => /\d+_sample/.test(s.name))).not.toBeUndefined();
    expect(appliedSeeds.find((s) => /\d+_peanut_butter/.test(s.name))).not.toBeUndefined();

    // undo first seed
    await asyncExec(`node ${CLI_PATH} db:seed:undo`);

    // confirm only up to the "sample" seed was applied
    appliedSeeds = await getSeedInfo().then((all) => all.filter((s) => s.executedAt !== undefined));
    expect(appliedSeeds.find((s) => /\d+_users/.test(s.name))).not.toBeUndefined();
    expect(appliedSeeds.find((s) => /\d+_sample/.test(s.name))).not.toBeUndefined();
    expect(appliedSeeds.find((s) => /\d+_peanut_butter/.test(s.name))).toBeUndefined();

    // undo second seed
    await asyncExec(`node ${CLI_PATH} db:seed:undo`);

    // confirm only up to the "sample" seed was applied
    appliedSeeds = await getSeedInfo().then((all) => all.filter((s) => s.executedAt !== undefined));
    expect(appliedSeeds.find((s) => /\d+_users/.test(s.name))).not.toBeUndefined();
    expect(appliedSeeds.find((s) => /\d+_sample/.test(s.name))).toBeUndefined();
    expect(appliedSeeds.find((s) => /\d+_peanut_butter/.test(s.name))).toBeUndefined();

    // undo second seed
    await asyncExec(`node ${CLI_PATH} db:seed:undo`);

    // confirm only up to the "sample" seed was applied
    appliedSeeds = await getSeedInfo().then((all) => all.filter((s) => s.executedAt !== undefined));
    expect(appliedSeeds.find((s) => /\d+_users/.test(s.name))).toBeUndefined();
    expect(appliedSeeds.find((s) => /\d+_sample/.test(s.name))).toBeUndefined();
    expect(appliedSeeds.find((s) => /\d+_peanut_butter/.test(s.name))).toBeUndefined();
  });
});

describe("function 'undoAll'", () => {
  test("removes all seeds successfully", async () => {
    await setupKyselyxConfigV1(TEST_DIR);

    // create migrations & seeds
    await asyncExec(`node ${CLI_PATH} db:migrate:new users`);
    await asyncExec(`node ${CLI_PATH} db:seed:new users`);
    await asyncExec(`node ${CLI_PATH} db:migrate:new sample`);
    await asyncExec(`node ${CLI_PATH} db:seed:new sample`);
    await asyncExec(`node ${CLI_PATH} db:migrate:new peanut_butter`);
    await asyncExec(`node ${CLI_PATH} db:seed:new peanut_butter`);

    // apply all migrations
    await asyncExec(`node ${CLI_PATH} db:migrate`);

    // apply all seeds
    await asyncExec(`node ${CLI_PATH} db:seed`);

    // confirm all seeds applied
    let appliedSeeds = await getSeedInfo().then((all) => all.filter((s) => s.executedAt !== undefined));
    expect(appliedSeeds.find((s) => /\d+_users/.test(s.name))).not.toBeUndefined();
    expect(appliedSeeds.find((s) => /\d+_sample/.test(s.name))).not.toBeUndefined();
    expect(appliedSeeds.find((s) => /\d+_peanut_butter/.test(s.name))).not.toBeUndefined();

    // undo all seeds
    await asyncExec(`node ${CLI_PATH} db:seed:undo:all`);

    // confirm all seeds are undefined
    appliedSeeds = await getSeedInfo().then((all) => all.filter((s) => s.executedAt !== undefined));
    expect(appliedSeeds.find((s) => /\d+_users/.test(s.name))).toBeUndefined();
    expect(appliedSeeds.find((s) => /\d+_sample/.test(s.name))).toBeUndefined();
    expect(appliedSeeds.find((s) => /\d+_peanut_butter/.test(s.name))).toBeUndefined();
  });
});
