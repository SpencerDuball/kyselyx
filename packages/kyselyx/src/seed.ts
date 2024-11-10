import fs from "fs-extra";
import ora from "ora";
import path from "path";
import "tsx/esm"; // This MUST be imported for the tests to run properly!
import { getConfig } from "./config.js";
import { exitFailure } from "./utils.js";

/**
 * Returns the string contents of a new seed file.
 *
 * @param configFile The path to the Kyselyx configuration file.
 * @param seedFile The path to the seed file.
 */
function tempalateJs(configFile: string, seedFile: string) {
  // get the relative path of the config file from the seed file
  let relativePath = path.relative(path.dirname(seedFile), configFile);
  // ensure the extension is ".js"
  relativePath = relativePath.replace(/\.\w+$/, ".js");

  return [
    `/**`,
    ` * The 'up' function runs when the seed is applied.`,
    ` *`,
    ` * @param {import("${relativePath}")["default"]["stores"]} stores`,
    ` * @returns {Promise<void>}`,
    ` */`,
    `async function up({ db }) {}`,
    ``,
    `/**`,
    ` * The 'down' function runs when the seed is removed.`,
    ` *`,
    ` * @param {import("${relativePath}")["default"]["stores"]} stores`,
    ` * @returns {Promise<void>}`,
    ` */`,
    `async function down({ db }) {}`,
    ``,
  ].join("\n");
}

/**
 * Returns the string contents of a new seed file.
 *
 * @param configFile The path to the Kyselyx configuration file.
 * @param seedFile The path to the seed file.
 */
function templateTs(configFile: string, seedFile: string) {
  // get the relative path of the config file from the seed file
  let relativePath = path.relative(path.dirname(seedFile), configFile);
  // ensure the extension is ".ts"
  relativePath = relativePath.replace(/\.\w+$/, ".ts");

  return [
    `import type config from "${relativePath}";`,
    ``,
    `type IStores = typeof config.stores;`,
    ``,
    `/**`,
    ` * The 'up' function runs when the seed is applied.`,
    ` */`,
    `async function up({ db }: IStores): Promise<void> {}`,
    ``,
    `/**`,
    ` * The 'down' function runs when the seed is removed.`,
    ` */`,
    `async function down({ db }: IStores): Promise<void> {}`,
    ``,
  ].join("\n");
}

/**
 * Generates a new seed file.
 *
 * @param name The label of the seed to generate.
 * @param opts Options for generating the migration file.
 * @param opts.js Generate a JavaScript seed file.
 */
export async function generate(name: string, opts = { js: false }) {
  const { configFile, seedsFolder } = getConfig().match((i) => i, exitFailure);

  // generate the seed file
  let feed = ora({ stream: process.stdout }).start("Generating seed ...");
  const seedId = `${Date.now()}_${name}`;
  await fs.ensureDir(seedsFolder);
  const seedFile = path.resolve(seedsFolder, `${seedId}.${opts.js ? "js" : "ts"}`);
  if (opts.js) {
    await fs.writeFile(path.resolve(seedsFolder, `${seedId}.js`), tempalateJs(configFile, seedFile));
    feed.succeed(`Created seed file: "${seedId}.js"`);
  } else {
    await fs.writeFile(path.resolve(seedsFolder, `${seedId}.ts`), templateTs(configFile, seedFile));
    feed.succeed(`Created seed file: "${seedId}.ts"`);
  }
}
