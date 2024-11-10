import { exec } from "child_process";
import { randomBytes } from "crypto";
import fs from "fs-extra";
import path from "path";
import { promisify } from "util";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { exitFailure } from "../src/utils.js";
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
