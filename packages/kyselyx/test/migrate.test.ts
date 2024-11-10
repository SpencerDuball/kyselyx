import { exec } from "child_process";
import { randomBytes } from "crypto";
import fs from "fs-extra";
import path from "path";
import "tsx/esm"; // This MUST be imported for the tests to run properly!
import { promisify } from "util";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { loadKyselyxConfig } from "../src/config.js";
import { exitFailure, getMigrations, getMigrator } from "../src/utils.js";
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
  test("should generate a migration file", async () => {
    await setupKyselyxConfigV1(TEST_DIR);

    // create migrations
    await asyncExec(`node ${CLI_PATH} generate:migration users`).catch((e) => console.error(e));
    await asyncExec(`node ${CLI_PATH} generate:migration sample`).catch((e) => console.error(e));
    await asyncExec(`node ${CLI_PATH} generate:migration peanut_butter`).catch((e) => console.error(e));

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
    await asyncExec(`node ${CLI_PATH} generate:migration users`).catch((e) => console.error(e));
    await asyncExec(`node ${CLI_PATH} generate:migration sample`).catch((e) => console.error(e));
    await asyncExec(`node ${CLI_PATH} generate:migration peanut_butter`).catch((e) => console.error(e));

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
    await asyncExec(`node ${CLI_PATH} generate:migration users`).catch((e) => console.error(e));
    await asyncExec(`node ${CLI_PATH} generate:migration sample`).catch((e) => console.error(e));
    await asyncExec(`node ${CLI_PATH} generate:migration peanut_butter`).catch((e) => console.error(e));

    // apply migrations
    await asyncExec(`node ${CLI_PATH} db:migrate sample`).catch((e) => console.error(e));

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
    await asyncExec(`node ${CLI_PATH} generate:migration users`).catch((e) => console.error(e));
    await asyncExec(`node ${CLI_PATH} generate:migration sample`).catch((e) => console.error(e));
    await asyncExec(`node ${CLI_PATH} generate:migration peanut_butter`).catch((e) => console.error(e));

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
    await asyncExec(`node ${CLI_PATH} generate:migration users`).catch((e) => console.error(e));
    await asyncExec(`node ${CLI_PATH} generate:migration sample`).catch((e) => console.error(e));
    await asyncExec(`node ${CLI_PATH} generate:migration peanut_butter`).catch((e) => console.error(e));

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
    await asyncExec(`node ${CLI_PATH} db:migrate ${partialTimestamp}_${sample.label}`).catch((e) => console.error(e));

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
    await asyncExec(`node ${CLI_PATH} generate:migration users`).catch((e) => console.error(e));
    await asyncExec(`node ${CLI_PATH} generate:migration sample`).catch((e) => console.error(e));
    await asyncExec(`node ${CLI_PATH} generate:migration peanut_butter`).catch((e) => console.error(e));

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
    await asyncExec(`node ${CLI_PATH} generate:migration users`).catch((e) => console.error(e));
    await asyncExec(`node ${CLI_PATH} generate:migration sample`).catch((e) => console.error(e));
    await asyncExec(`node ${CLI_PATH} generate:migration peanut_butter`).catch((e) => console.error(e));

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
    await asyncExec(`node ${CLI_PATH} generate:migration users`).catch((e) => console.error(e));
    await asyncExec(`node ${CLI_PATH} generate:migration sample`).catch((e) => console.error(e));
    await asyncExec(`node ${CLI_PATH} generate:migration peanut_butter`).catch((e) => console.error(e));
    // TODO: create the seeds

    // apply all migrations & seeds
    await asyncExec(`node ${CLI_PATH} db:migrate`).catch((e) => console.error(e));
    // TODO: apply all seeds

    // load kyselyx config, get migrations, get seeds
    await loadKyselyxConfig({});
    const migrator = getMigrator().match((i) => i, exitFailure);
    const { appliedMigrations } = (await getMigrations(migrator)).match((i) => i, exitFailure);
    // TODO: get appliedSeeds

    // confirm all migrations & seeds were applied
    expect(appliedMigrations.find((m) => /\d+_users/.test(m.name))).not.toBeUndefined();
    expect(appliedMigrations.find((m) => /\d+_sample/.test(m.name))).not.toBeUndefined();
    expect(appliedMigrations.find((m) => /\d+_peanut_butter/.test(m.name))).not.toBeUndefined();

    // TODO: finish the test
  });
});
