import { exec } from "child_process";
import { randomBytes } from "crypto";
import fs from "fs-extra";
import path from "path";
import "tsx/esm"; // This MUST be imported for the tests to run properly!
import { promisify } from "util";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { loadKyselyxConfig } from "../src/config.js";
import { exitFailure, getMigrations, getMigrator, getSeeder, getSeeds } from "../src/utils.js";
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
  test("should generate all TS migration files", async () => {
    await setupKyselyxConfigV1(TEST_DIR);

    // create migrations
    await asyncExec(`node ${CLI_PATH} generate:migration users`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:migration sample`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:migration peanut_butter`).catch(exitFailure);

    // check if migrations were created
    const migrations = await fs.readdir(path.resolve(TEST_DIR, "migrations"));
    expect(migrations.find((f) => /\d+_users\.ts/.test(f))).not.toBeUndefined();
    expect(migrations.find((f) => /\d+_sample\.ts/.test(f))).not.toBeUndefined();
    expect(migrations.find((f) => /\d+_peanut_butter\.ts/.test(f))).not.toBeUndefined();
  });

  test("should generate all JS migration files", async () => {
    await setupKyselyxConfigV1(TEST_DIR);

    // create migrations
    await asyncExec(`node ${CLI_PATH} generate:migration users --js`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:migration sample --js`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:migration peanut_butter --js`).catch(exitFailure);

    // check if migrations were created
    const migrations = await fs.readdir(path.resolve(TEST_DIR, "migrations"));
    expect(migrations.find((f) => /\d+_users\.js/.test(f))).not.toBeUndefined();
    expect(migrations.find((f) => /\d+_sample\.js/.test(f))).not.toBeUndefined();
    expect(migrations.find((f) => /\d+_peanut_butter\.js/.test(f))).not.toBeUndefined();
  });

  test("should generate both JS & TS migration files", async () => {
    await setupKyselyxConfigV1(TEST_DIR);

    // create migrations
    await asyncExec(`node ${CLI_PATH} generate:migration users --js`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:migration sample`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:migration peanut_butter --js`).catch(exitFailure);

    // check if migrations were created
    const migrations = await fs.readdir(path.resolve(TEST_DIR, "migrations"));
    expect(migrations.find((f) => /\d+_users\.js/.test(f))).not.toBeUndefined();
    expect(migrations.find((f) => /\d+_sample\.ts/.test(f))).not.toBeUndefined();
    expect(migrations.find((f) => /\d+_peanut_butter\.js/.test(f))).not.toBeUndefined();
  });
});

describe("function 'migrate'", () => {
  test("successfully applies all migrations", async () => {
    await setupKyselyxConfigV1(TEST_DIR);

    // create migrations
    await asyncExec(`node ${CLI_PATH} generate:migration users`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:migration sample`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:migration peanut_butter`).catch(exitFailure);

    // apply migrations
    await asyncExec(`node ${CLI_PATH} db:migrate`).catch((e) => console.error(e));

    // load kyselyx config & get migrations
    await loadKyselyxConfig({});
    const migrator = getMigrator().match((i) => i, exitFailure);
    const { appliedMigrations } = (await getMigrations(migrator)).match((i) => i, exitFailure);

    // confirm all migrations were applied
    expect(appliedMigrations.find((m) => /\d+_users/.test(m.name))).not.toBeUndefined();
    expect(appliedMigrations.find((m) => /\d+_sample/.test(m.name))).not.toBeUndefined();
    expect(appliedMigrations.find((m) => /\d+_peanut_butter/.test(m.name))).not.toBeUndefined();
  });

  test("successfully applies to a target with 'label' only", async () => {
    await setupKyselyxConfigV1(TEST_DIR);

    // create migrations
    await asyncExec(`node ${CLI_PATH} generate:migration users`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:migration sample`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:migration peanut_butter`).catch(exitFailure);

    // apply migrations
    await asyncExec(`node ${CLI_PATH} db:migrate sample`).catch(exitFailure);

    // load kyselyx config & get migrations
    await loadKyselyxConfig({});
    const migrator = getMigrator().match((i) => i, exitFailure);
    const { appliedMigrations } = (await getMigrations(migrator)).match((i) => i, exitFailure);

    // confirm all migrations were applied
    expect(appliedMigrations.find((m) => /\d+_users/.test(m.name))).not.toBeUndefined();
    expect(appliedMigrations.find((m) => /\d+_sample/.test(m.name))).not.toBeUndefined();
    expect(appliedMigrations.find((m) => /\d+_peanut_butter/.test(m.name))).toBeUndefined();
  });

  test("successfully applies to a target with 'timestamp' + 'label'", async () => {
    await setupKyselyxConfigV1(TEST_DIR);

    // create migrations
    await asyncExec(`node ${CLI_PATH} generate:migration users`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:migration sample`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:migration peanut_butter`).catch(exitFailure);

    // load kyselyx config & get migrator
    await loadKyselyxConfig({});
    const migrator = getMigrator().match((i) => i, exitFailure);

    // get the sample migration
    const sample = (await getMigrations(migrator)).match(
      (all) => all.allMigrations.find((m) => /\d+_sample/.test(m.name)),
      exitFailure,
    )!;

    // apply migrations
    await asyncExec(`node ${CLI_PATH} db:migrate ${sample.name}`).catch((e) => console.error(e));

    // load kyselyx config & get migrations
    const { appliedMigrations } = (await getMigrations(migrator)).match((i) => i, exitFailure);

    // confirm all migrations were applied
    expect(appliedMigrations.find((m) => /\d+_users/.test(m.name))).not.toBeUndefined();
    expect(appliedMigrations.find((m) => /\d+_sample/.test(m.name))).not.toBeUndefined();
    expect(appliedMigrations.find((m) => /\d+_peanut_butter/.test(m.name))).toBeUndefined();
  });

  test("successfully applies to a target with partial 'timestamp' + 'label'", async () => {
    await setupKyselyxConfigV1(TEST_DIR);

    // create migrations
    await asyncExec(`node ${CLI_PATH} generate:migration users`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:migration sample`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:migration peanut_butter`).catch(exitFailure);

    // load kyselyx config & get migrator
    await loadKyselyxConfig({});
    const migrator = getMigrator().match((i) => i, exitFailure);

    // get the sample migration
    const sample = (await getMigrations(migrator)).match(
      (all) => all.allMigrations.find((m) => /\d+_sample/.test(m.name)),
      exitFailure,
    )!;
    const partialTimestamp = sample.timestamp.toString().slice(-3);

    // apply migrations
    await asyncExec(`node ${CLI_PATH} db:migrate ${partialTimestamp}_${sample.label}`).catch(exitFailure);

    // load kyselyx config & get migrations
    const { appliedMigrations } = (await getMigrations(migrator)).match((i) => i, exitFailure);

    // confirm all migrations were applied
    expect(appliedMigrations.find((m) => /\d+_users/.test(m.name))).not.toBeUndefined();
    expect(appliedMigrations.find((m) => /\d+_sample/.test(m.name))).not.toBeUndefined();
    expect(appliedMigrations.find((m) => /\d+_peanut_butter/.test(m.name))).toBeUndefined();
  });

  test("fails to apply migrations with invalid 'timestamp' prefix", async () => {
    await setupKyselyxConfigV1(TEST_DIR);

    // create migrations
    await asyncExec(`node ${CLI_PATH} generate:migration users`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:migration sample`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:migration peanut_butter`).catch(exitFailure);

    // load kyselyx config & get migrator
    await loadKyselyxConfig({});
    const migrator = getMigrator().match((i) => i, exitFailure);

    // get the sample migration
    const sample = (await getMigrations(migrator)).match(
      (all) => all.allMigrations.find((m) => /\d+_sample/.test(m.name)),
      exitFailure,
    )!;
    const partialTimestamp = sample.timestamp.toString().slice(0, 3);

    // apply migrations
    await expect(asyncExec(`node ${CLI_PATH} db:migrate ${partialTimestamp}_${sample.label}`)).rejects.toThrowError();
  });

  test("fails to apply migrations with valid 'timestamp' + invalid 'label'", async () => {
    await setupKyselyxConfigV1(TEST_DIR);

    // create migrations
    await asyncExec(`node ${CLI_PATH} generate:migration users`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:migration sample`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:migration peanut_butter`).catch(exitFailure);

    // load kyselyx config & get migrator
    await loadKyselyxConfig({});
    const migrator = getMigrator().match((i) => i, exitFailure);

    // get the sample migration
    const sample = (await getMigrations(migrator)).match(
      (all) => all.allMigrations.find((m) => /\d+_sample/.test(m.name)),
      exitFailure,
    )!;
    const partialTimestamp = sample.timestamp.toString().slice(-3);

    // apply migrations
    await expect(
      asyncExec(`node ${CLI_PATH} db:migrate ${partialTimestamp}_${sample.label}ayo`),
    ).rejects.toThrowError();
  });
});

describe("function 'undo'", () => {
  test("successfully reverts migrations without name", async () => {
    await setupKyselyxConfigV1(TEST_DIR);

    // create migrations & seeds
    await asyncExec(`node ${CLI_PATH} generate:migration users`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:seed users`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:migration sample`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:seed sample`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:migration peanut_butter`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:seed peanut_butter`).catch(exitFailure);

    // apply all migrations & seeds
    await asyncExec(`node ${CLI_PATH} db:migrate`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} db:seed`).catch(exitFailure);

    // load kyselyx config, get migrations, get seeds
    await loadKyselyxConfig({});
    const migrator = getMigrator().match((i) => i, exitFailure);
    let { appliedMigrations } = (await getMigrations(migrator)).match((i) => i, exitFailure);
    const seeder = getSeeder().match((i) => i, exitFailure);
    let { appliedSeeds } = (await getSeeds(seeder)).match((i) => i, exitFailure);

    // confirm all migrations & seeds were applied
    expect(appliedMigrations.find((m) => /\d+_users/.test(m.name))).not.toBeUndefined();
    expect(appliedMigrations.find((m) => /\d+_sample/.test(m.name))).not.toBeUndefined();
    expect(appliedMigrations.find((m) => /\d+_peanut_butter/.test(m.name))).not.toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_users/.test(m.name))).not.toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_sample/.test(m.name))).not.toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_peanut_butter/.test(m.name))).not.toBeUndefined();

    // rollback the first seed & migration
    await asyncExec(`node ${CLI_PATH} db:migrate:undo`).catch(exitFailure);
    ({ appliedMigrations } = (await getMigrations(migrator)).match((i) => i, exitFailure));
    ({ appliedSeeds } = (await getSeeds(seeder)).match((i) => i, exitFailure));
    expect(appliedMigrations.find((m) => /\d+_users/.test(m.name))).not.toBeUndefined();
    expect(appliedMigrations.find((m) => /\d+_sample/.test(m.name))).not.toBeUndefined();
    expect(appliedMigrations.find((m) => /\d+_peanut_butter/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_users/.test(m.name))).not.toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_sample/.test(m.name))).not.toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_peanut_butter/.test(m.name))).toBeUndefined();

    // rollback the second seed & migration
    await asyncExec(`node ${CLI_PATH} db:migrate:undo`).catch(exitFailure);
    ({ appliedMigrations } = (await getMigrations(migrator)).match((i) => i, exitFailure));
    ({ appliedSeeds } = (await getSeeds(seeder)).match((i) => i, exitFailure));
    expect(appliedMigrations.find((m) => /\d+_users/.test(m.name))).not.toBeUndefined();
    expect(appliedMigrations.find((m) => /\d+_sample/.test(m.name))).toBeUndefined();
    expect(appliedMigrations.find((m) => /\d+_peanut_butter/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_users/.test(m.name))).not.toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_sample/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_peanut_butter/.test(m.name))).toBeUndefined();

    // rollback the third seed & migration
    await asyncExec(`node ${CLI_PATH} db:migrate:undo`).catch(exitFailure);
    ({ appliedMigrations } = (await getMigrations(migrator)).match((i) => i, exitFailure));
    ({ appliedSeeds } = (await getSeeds(seeder)).match((i) => i, exitFailure));
    expect(appliedMigrations.find((m) => /\d+_users/.test(m.name))).toBeUndefined();
    expect(appliedMigrations.find((m) => /\d+_sample/.test(m.name))).toBeUndefined();
    expect(appliedMigrations.find((m) => /\d+_peanut_butter/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_users/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_sample/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_peanut_butter/.test(m.name))).toBeUndefined();

    // try to rollback again, there should be no migrations to rollback
    const { stdout } = await asyncExec(`node ${CLI_PATH} db:migrate:undo`).catch(exitFailure);
    expect(stdout).toMatch(/No migrations to rollback./);
  });

  test("successfully reverts all migrations with name (first migration)", async () => {
    await setupKyselyxConfigV1(TEST_DIR);

    // create migrations
    await asyncExec(`node ${CLI_PATH} generate:migration users`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:migration sample`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:migration peanut_butter`).catch(exitFailure);

    // apply all migrations
    await asyncExec(`node ${CLI_PATH} db:migrate`).catch(exitFailure);

    // load kyselyx config, get migrations, get seeds
    await loadKyselyxConfig({});
    const migrator = getMigrator().match((i) => i, exitFailure);
    let { appliedMigrations } = (await getMigrations(migrator)).match((i) => i, exitFailure);

    // confirm all migrations
    expect(appliedMigrations.find((m) => /\d+_users/.test(m.name))).not.toBeUndefined();
    expect(appliedMigrations.find((m) => /\d+_sample/.test(m.name))).not.toBeUndefined();
    expect(appliedMigrations.find((m) => /\d+_peanut_butter/.test(m.name))).not.toBeUndefined();

    // drop all migrations up to and including the 'users' migration, this will drop all migrations
    // since it is the first migration in the list
    await asyncExec(`node ${CLI_PATH} db:migrate:undo users`).catch(exitFailure);
    ({ appliedMigrations } = (await getMigrations(migrator)).match((i) => i, exitFailure));
    expect(appliedMigrations.find((m) => /\d+_users/.test(m.name))).toBeUndefined();
    expect(appliedMigrations.find((m) => /\d+_sample/.test(m.name))).toBeUndefined();
    expect(appliedMigrations.find((m) => /\d+_peanut_butter/.test(m.name))).toBeUndefined();
  });

  test("successfully reverts migrations with name (middle migration)", async () => {
    await setupKyselyxConfigV1(TEST_DIR);

    // create migrations
    await asyncExec(`node ${CLI_PATH} generate:migration users`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:migration sample`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:migration peanut_butter`).catch(exitFailure);

    // apply all migrations
    await asyncExec(`node ${CLI_PATH} db:migrate`).catch(exitFailure);

    // load kyselyx config, get migrations
    await loadKyselyxConfig({});
    const migrator = getMigrator().match((i) => i, exitFailure);
    let { appliedMigrations } = (await getMigrations(migrator)).match((i) => i, exitFailure);

    // confirm all migrations were applied
    expect(appliedMigrations.find((m) => /\d+_users/.test(m.name))).not.toBeUndefined();
    expect(appliedMigrations.find((m) => /\d+_sample/.test(m.name))).not.toBeUndefined();
    expect(appliedMigrations.find((m) => /\d+_peanut_butter/.test(m.name))).not.toBeUndefined();

    // drop all migrations up to and including the 'sample' migration
    await asyncExec(`node ${CLI_PATH} db:migrate:undo sample`).catch(exitFailure);
    ({ appliedMigrations } = (await getMigrations(migrator)).match((i) => i, exitFailure));
    expect(appliedMigrations.find((m) => /\d+_users/.test(m.name))).not.toBeUndefined();
    expect(appliedMigrations.find((m) => /\d+_sample/.test(m.name))).toBeUndefined();
    expect(appliedMigrations.find((m) => /\d+_peanut_butter/.test(m.name))).toBeUndefined();
  });

  test("successfully reverts migrations with name (last migration)", async () => {
    await setupKyselyxConfigV1(TEST_DIR);

    // create migrations
    await asyncExec(`node ${CLI_PATH} generate:migration users`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:migration sample`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:migration peanut_butter`).catch(exitFailure);

    // apply all migrations
    await asyncExec(`node ${CLI_PATH} db:migrate`).catch(exitFailure);

    // load kyselyx config, get migrations
    await loadKyselyxConfig({});
    const migrator = getMigrator().match((i) => i, exitFailure);
    let { appliedMigrations } = (await getMigrations(migrator)).match((i) => i, exitFailure);

    // confirm all migrations were applied
    expect(appliedMigrations.find((m) => /\d+_users/.test(m.name))).not.toBeUndefined();
    expect(appliedMigrations.find((m) => /\d+_sample/.test(m.name))).not.toBeUndefined();
    expect(appliedMigrations.find((m) => /\d+_peanut_butter/.test(m.name))).not.toBeUndefined();

    // drop all migrations up to and including the 'sample' migration
    await asyncExec(`node ${CLI_PATH} db:migrate:undo peanut_butter`).catch(exitFailure);
    ({ appliedMigrations } = (await getMigrations(migrator)).match((i) => i, exitFailure));
    expect(appliedMigrations.find((m) => /\d+_users/.test(m.name))).not.toBeUndefined();
    expect(appliedMigrations.find((m) => /\d+_sample/.test(m.name))).not.toBeUndefined();
    expect(appliedMigrations.find((m) => /\d+_peanut_butter/.test(m.name))).toBeUndefined();
  });
});

describe("function 'undoAll'", () => {
  test("successfully reverts all migrations", async () => {
    await setupKyselyxConfigV1(TEST_DIR);

    // create migrations & seeds
    await asyncExec(`node ${CLI_PATH} generate:migration users`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:seed users`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:migration sample`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:seed sample`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:migration peanut_butter`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} generate:seed peanut_butter`).catch(exitFailure);

    // apply all migrations & seeds
    await asyncExec(`node ${CLI_PATH} db:migrate`).catch(exitFailure);
    await asyncExec(`node ${CLI_PATH} db:seed`).catch(exitFailure);

    // load kyselyx config, get migrations, get seeds
    await loadKyselyxConfig({});
    const migrator = getMigrator().match((i) => i, exitFailure);
    let { appliedMigrations } = (await getMigrations(migrator)).match((i) => i, exitFailure);
    const seeder = getSeeder().match((i) => i, exitFailure);
    let { appliedSeeds } = (await getSeeds(seeder)).match((i) => i, exitFailure);

    // confirm all migrations & seeds were applied
    expect(appliedMigrations.find((m) => /\d+_users/.test(m.name))).not.toBeUndefined();
    expect(appliedMigrations.find((m) => /\d+_sample/.test(m.name))).not.toBeUndefined();
    expect(appliedMigrations.find((m) => /\d+_peanut_butter/.test(m.name))).not.toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_users/.test(m.name))).not.toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_sample/.test(m.name))).not.toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_peanut_butter/.test(m.name))).not.toBeUndefined();

    // drop all migrations
    await asyncExec(`node ${CLI_PATH} db:migrate:undo:all`).catch(exitFailure);
    ({ appliedMigrations } = (await getMigrations(migrator)).match((i) => i, exitFailure));
    ({ appliedSeeds } = (await getSeeds(seeder)).match((i) => i, exitFailure));
    expect(appliedMigrations.find((m) => /\d+_users/.test(m.name))).toBeUndefined();
    expect(appliedMigrations.find((m) => /\d+_sample/.test(m.name))).toBeUndefined();
    expect(appliedMigrations.find((m) => /\d+_peanut_butter/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_users/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_sample/.test(m.name))).toBeUndefined();
    expect(appliedSeeds.find((m) => /\d+_peanut_butter/.test(m.name))).toBeUndefined();

    // try to rollback again, there should be no migrations to rollback
    const { stdout } = await asyncExec(`node ${CLI_PATH} db:migrate:undo:all`).catch(exitFailure);
    expect(stdout).toMatch(/No migrations to rollback./);
  });
});
