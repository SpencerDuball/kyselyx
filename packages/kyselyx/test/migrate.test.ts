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

afterEach(async () => {
  await fs.rm(TEST_DIR, { recursive: true, force: true });
});

describe("function 'new_'", () => {
  test("creates migrations successfully", async () => {
    await setupKyselyxConfigV1(TEST_DIR);

    // create migrations
    await asyncExec(`node ${CLI_PATH} db:migrate:new users`);
    await asyncExec(`node ${CLI_PATH} db:migrate:new sample`);
    await asyncExec(`node ${CLI_PATH} db:migrate:new peanut_butter`);

    // check if migrations were created
    const migrations = await fs.readdir(path.resolve(TEST_DIR, "migrations"));
    expect(migrations.find((f) => /\d+_users\.ts/.test(f))).not.toBeUndefined();
    expect(migrations.find((f) => /\d+_sample\.ts/.test(f))).not.toBeUndefined();
    expect(migrations.find((f) => /\d+_peanut_butter\.ts/.test(f))).not.toBeUndefined();
  });
});

describe("function 'migrate'", () => {
  test("successfully applies all migrations", async () => {
    await setupKyselyxConfigV1(TEST_DIR);

    // create migrations
    await asyncExec(`node ${CLI_PATH} db:migrate:new users`);
    await asyncExec(`node ${CLI_PATH} db:migrate:new sample`);
    await asyncExec(`node ${CLI_PATH} db:migrate:new peanut_butter`);

    // apply all migrations
    await asyncExec(`node ${CLI_PATH} db:migrate`);

    // confirm all migrations were applied
    const migrations = await getMigrationInfo();
    const appliedMigrations = migrations.filter((m) => m.executedAt !== undefined);
    expect(appliedMigrations.find((m) => /\d+_users/.test(m.name))).not.toBeUndefined();
    expect(appliedMigrations.find((m) => /\d+_sample/.test(m.name))).not.toBeUndefined();
    expect(appliedMigrations.find((m) => /\d+_peanut_butter/.test(m.name))).not.toBeUndefined();
  });

  test("successfully applies to target migration", async () => {
    await setupKyselyxConfigV1(TEST_DIR);

    // create migrations
    await asyncExec(`node ${CLI_PATH} db:migrate:new users`);
    await asyncExec(`node ${CLI_PATH} db:migrate:new sample`);
    await asyncExec(`node ${CLI_PATH} db:migrate:new peanut_butter`);

    // get all migrations
    const migrations = await getMigrationInfo();

    // apply migrations up to the "sample" migration
    const sampleMigration = migrations.find((m) => /\d+_sample/.test(m.name));
    await asyncExec(`node ${CLI_PATH} db:migrate ${sampleMigration?.name}`);

    // confirm only up to the "sample" migration was applied
    const appliedMigrations = await getMigrationInfo().then((all) => all.filter((m) => m.executedAt !== undefined));
    expect(appliedMigrations.find((m) => /\d+_users/.test(m.name))).not.toBeUndefined();
    expect(appliedMigrations.find((m) => /\d+_sample/.test(m.name))).not.toBeUndefined();
    expect(appliedMigrations.find((m) => /\d+_peanut_butter/.test(m.name))).toBeUndefined();
  });
});

describe("function 'undo'", () => {
  test("successfully undo migrations", async () => {
    await setupKyselyxConfigV1(TEST_DIR);

    // create migrations
    await asyncExec(`node ${CLI_PATH} db:migrate:new users`);
    await asyncExec(`node ${CLI_PATH} db:migrate:new sample`);
    await asyncExec(`node ${CLI_PATH} db:migrate:new peanut_butter`);

    // apply all migrations
    await asyncExec(`node ${CLI_PATH} db:migrate`);

    // confirm all migrations were applied
    let migrations = await getMigrationInfo();
    let appliedMigrations = migrations.filter((m) => m.executedAt !== undefined);
    expect(appliedMigrations.find((m) => /\d+_users/.test(m.name))).not.toBeUndefined();
    expect(appliedMigrations.find((m) => /\d+_sample/.test(m.name))).not.toBeUndefined();
    expect(appliedMigrations.find((m) => /\d+_peanut_butter/.test(m.name))).not.toBeUndefined();

    // undo first migration
    await asyncExec(`node ${CLI_PATH} db:migrate:undo`);

    // confirm only up to the "sample" migration was applied
    appliedMigrations = await getMigrationInfo().then((all) => all.filter((m) => m.executedAt !== undefined));
    expect(appliedMigrations.find((m) => /\d+_users/.test(m.name))).not.toBeUndefined();
    expect(appliedMigrations.find((m) => /\d+_sample/.test(m.name))).not.toBeUndefined();
    expect(appliedMigrations.find((m) => /\d+_peanut_butter/.test(m.name))).toBeUndefined();

    // undo second migration
    await asyncExec(`node ${CLI_PATH} db:migrate:undo`);

    // confirm only up to the "users" migration was applied
    appliedMigrations = await getMigrationInfo().then((all) => all.filter((m) => m.executedAt !== undefined));
    expect(appliedMigrations.find((m) => /\d+_users/.test(m.name))).not.toBeUndefined();
    expect(appliedMigrations.find((m) => /\d+_sample/.test(m.name))).toBeUndefined();
    expect(appliedMigrations.find((m) => /\d+_peanut_butter/.test(m.name))).toBeUndefined();

    // undo first migration
    await asyncExec(`node ${CLI_PATH} db:migrate:undo`);

    // confirm only up to the "users" migration was applied
    appliedMigrations = await getMigrationInfo().then((all) => all.filter((m) => m.executedAt !== undefined));
    expect(appliedMigrations.find((m) => /\d+_users/.test(m.name))).toBeUndefined();
    expect(appliedMigrations.find((m) => /\d+_sample/.test(m.name))).toBeUndefined();
    expect(appliedMigrations.find((m) => /\d+_peanut_butter/.test(m.name))).toBeUndefined();

    // attempt to undo a migration when there are no migrations
    const { stdout } = await asyncExec(`node ${CLI_PATH} db:migrate:undo`).catch((e) => {
      console.log(e);
      process.exit(1);
    });
    expect(stdout).toContain("No migrations to undo.");
  });

  test("successfully undo migrations and seeds", async () => {
    await setupKyselyxConfigV1(TEST_DIR);

    // create migrations & seeds
    await asyncExec(`node ${CLI_PATH} db:migrate:new users`);
    await asyncExec(`node ${CLI_PATH} db:seed:new users`);
    await asyncExec(`node ${CLI_PATH} db:migrate:new sample`);
    await asyncExec(`node ${CLI_PATH} db:seed:new sample`);
    await asyncExec(`node ${CLI_PATH} db:migrate:new peanut_butter`);
    await asyncExec(`node ${CLI_PATH} db:seed:new peanut_butter`);

    // apply all migrations & seeds
    await asyncExec(`node ${CLI_PATH} db:migrate`);
    await asyncExec(`node ${CLI_PATH} db:seed`);

    // confirm all migrations were applied
    let migrations = await getMigrationInfo();
    let appliedMigrations = migrations.filter((m) => m.executedAt !== undefined);
    expect(appliedMigrations.find((m) => /\d+_users/.test(m.name))).not.toBeUndefined();
    expect(appliedMigrations.find((m) => /\d+_sample/.test(m.name))).not.toBeUndefined();
    expect(appliedMigrations.find((m) => /\d+_peanut_butter/.test(m.name))).not.toBeUndefined();

    // confirm all seeds were applied
    let seeds = await getSeedInfo();
    let appliedSeeds = seeds.filter((s) => s.executedAt !== undefined);
    expect(appliedSeeds.find((s) => /\d+_users/.test(s.name))).not.toBeUndefined();
    expect(appliedSeeds.find((s) => /\d+_sample/.test(s.name))).not.toBeUndefined();
    expect(appliedSeeds.find((s) => /\d+_peanut_butter/.test(s.name))).not.toBeUndefined();

    // undo first migration
    await asyncExec(`node ${CLI_PATH} db:migrate:undo`);

    // confirm only up to the "sample" migration was applied
    appliedMigrations = await getMigrationInfo().then((all) => all.filter((m) => m.executedAt !== undefined));
    expect(appliedMigrations.find((m) => /\d+_users/.test(m.name))).not.toBeUndefined();
    expect(appliedMigrations.find((m) => /\d+_sample/.test(m.name))).not.toBeUndefined();
    expect(appliedMigrations.find((m) => /\d+_peanut_butter/.test(m.name))).toBeUndefined();

    // confirm only up to the "sample" seed was applied
    appliedSeeds = await getSeedInfo().then((all) => all.filter((s) => s.executedAt !== undefined));
    expect(appliedSeeds.find((s) => /\d+_users/.test(s.name))).not.toBeUndefined();
    expect(appliedSeeds.find((s) => /\d+_sample/.test(s.name))).not.toBeUndefined();
    expect(appliedSeeds.find((s) => /\d+_peanut_butter/.test(s.name))).toBeUndefined();

    // undo second migration
    await asyncExec(`node ${CLI_PATH} db:migrate:undo`);

    // confirm only up to the "users" migration was applied
    appliedMigrations = await getMigrationInfo().then((all) => all.filter((m) => m.executedAt !== undefined));
    expect(appliedMigrations.find((m) => /\d+_users/.test(m.name))).not.toBeUndefined();
    expect(appliedMigrations.find((m) => /\d+_sample/.test(m.name))).toBeUndefined();
    expect(appliedMigrations.find((m) => /\d+_peanut_butter/.test(m.name))).toBeUndefined();

    // confirm only up to the "users" seed was applied
    appliedSeeds = await getSeedInfo().then((all) => all.filter((s) => s.executedAt !== undefined));
    expect(appliedSeeds.find((s) => /\d+_users/.test(s.name))).not.toBeUndefined();
    expect(appliedSeeds.find((s) => /\d+_sample/.test(s.name))).toBeUndefined();
    expect(appliedSeeds.find((s) => /\d+_peanut_butter/.test(s.name))).toBeUndefined();

    // undo third migration
    await asyncExec(`node ${CLI_PATH} db:migrate:undo`);

    // confirm only up to the "users" migration was applied
    appliedMigrations = await getMigrationInfo().then((all) => all.filter((m) => m.executedAt !== undefined));
    expect(appliedMigrations.find((m) => /\d+_users/.test(m.name))).toBeUndefined();
    expect(appliedMigrations.find((m) => /\d+_sample/.test(m.name))).toBeUndefined();
    expect(appliedMigrations.find((m) => /\d+_peanut_butter/.test(m.name))).toBeUndefined();

    // confirm only up to the "users" seed was applied
    appliedSeeds = await getSeedInfo().then((all) => all.filter((s) => s.executedAt !== undefined));
    expect(appliedSeeds.find((s) => /\d+_users/.test(s.name))).toBeUndefined();
    expect(appliedSeeds.find((s) => /\d+_sample/.test(s.name))).toBeUndefined();
    expect(appliedSeeds.find((s) => /\d+_peanut_butter/.test(s.name))).toBeUndefined();
  });
});

describe("function 'undoAll'", () => {
  test("removes all migrations successfully", async () => {
    await setupKyselyxConfigV1(TEST_DIR);

    // create migrations & seeds
    await asyncExec(`node ${CLI_PATH} db:migrate:new users`);
    await asyncExec(`node ${CLI_PATH} db:seed:new users`);
    await asyncExec(`node ${CLI_PATH} db:migrate:new sample`);
    await asyncExec(`node ${CLI_PATH} db:seed:new sample`);
    await asyncExec(`node ${CLI_PATH} db:migrate:new peanut_butter`);
    await asyncExec(`node ${CLI_PATH} db:seed:new peanut_butter`);

    // apply all migrations & seeds
    await asyncExec(`node ${CLI_PATH} db:migrate`);
    await asyncExec(`node ${CLI_PATH} db:seed`);

    // confirm all migrations were applied
    let migrations = await getMigrationInfo();
    let appliedMigrations = migrations.filter((m) => m.executedAt !== undefined);
    expect(appliedMigrations.find((m) => /\d+_users/.test(m.name))).not.toBeUndefined();
    expect(appliedMigrations.find((m) => /\d+_sample/.test(m.name))).not.toBeUndefined();
    expect(appliedMigrations.find((m) => /\d+_peanut_butter/.test(m.name))).not.toBeUndefined();

    // confirm all seeds were applied
    let seeds = await getSeedInfo();
    let appliedSeeds = seeds.filter((s) => s.executedAt !== undefined);
    expect(appliedSeeds.find((s) => /\d+_users/.test(s.name))).not.toBeUndefined();
    expect(appliedSeeds.find((s) => /\d+_sample/.test(s.name))).not.toBeUndefined();
    expect(appliedSeeds.find((s) => /\d+_peanut_butter/.test(s.name))).not.toBeUndefined();

    // undo all migrations
    await asyncExec(`node ${CLI_PATH} db:migrate:undo:all`);

    // ensure all migrations are unapplied
    migrations = await getMigrationInfo();
    for (const migration of migrations) expect(migration.executedAt).toBeUndefined();

    // ensure all seeds are unapplied
    seeds = await getSeedInfo();
    for (const seed of seeds) expect(seed.executedAt).toBeUndefined();
  });
});
