import fs from "fs-extra";
import { Kysely } from "kysely";
import path from "path";
import { z } from "zod";

export const MIGRATION_TABLE_NAME = "kyselyx_migration";
export const MIGRATION_LOCK_TABLE_NAME = "kyselyx_migration_lock";
export const SEED_TABLE_NAME = "kyselyx_seed";

// -------------------------------------------------------------------------------------------------
// Config File
// -------------------------------------------------------------------------------------------------
// These types represent the user-facing configuration file.
// -------------------------------------------------------------------------------------------------
const ZConfigFile = z.object({
  /**
   * The data stores available. There will always be a `db` store which is an instance of Kysely.
   * There may be other arbitrary stores for example an `s3` store that users may specify. Passing
   * these extra stores will make them available when running seed scripts.
   */
  stores: z.object({ db: z.instanceof(Kysely) }).passthrough(),
  /**
   * The folder where all migrations are stored.
   */
  migrationsFolder: z.string().default("migrations"),
  /**
   * The folder where all seeds are stored.
   */
  seedsFolder: z.string().default("seeds"),
});
export type DefaultStores = { db: Kysely<any> };
export interface IConfigFile<T extends DefaultStores = DefaultStores> extends z.infer<typeof ZConfigFile> {
  stores: T;
}

// -------------------------------------------------------------------------------------------------
// Config Object
// -------------------------------------------------------------------------------------------------
// These types represent the internal config, this is what the tool uses and stores the final config
// after parsing the options from the config file and applying defaults.
// -------------------------------------------------------------------------------------------------
const ZConfig = z.object({
  configFile: z.string(),
  stores: z.object({ db: z.instanceof(Kysely) }).passthrough(),
  migrationsFolder: z.string(),
  seedsFolder: z.string(),
});
type IConfig = z.infer<typeof ZConfig>;

// -------------------------------------------------------------------------------------------------
// CLI Input
// -------------------------------------------------------------------------------------------------
// The available options to pass on the CLI.
// -------------------------------------------------------------------------------------------------
const ZCliOptions = z.object({
  /**
   * The path to the Kyselyx configuration file.
   */
  file: z.string().optional(),
  /**
   * The folder where all migrations are stored. This supercedes the migration folder in the config
   * file.
   */
  migrationsFolder: z.string().optional(),
  /**
   * The folder where all seeds are stored. This supercedes the seed folder in the config file.
   */
  seedsFolder: z.string().optional(),
});
type ICliOptions = z.infer<typeof ZCliOptions>;

// -------------------------------------------------------------------------------------------------

let _config: IConfig | null = null;

/**
 * Returns the parsed configuration object.
 *
 * Note: This should be called only after `loadKyselyxConfig` has been called.
 */
export function getConfig() {
  if (!_config) throw new Error("Kyselyx configuration not loaded.");
  return _config;
}

/**
 * Loads the Kyselyx configuration file and applies the CLI options.
 */
export async function loadKyselyxConfig(cli: ICliOptions) {
  // check for the config file
  let filePath: string | undefined = undefined;
  if (cli.file) {
    filePath = cli.file;
  } else {
    const possibleFilePaths = [
      "kyselyx.config.ts",
      "kyselyx.config.js",
      ".config/kyselyx.config.ts",
      ".config/kyselyx.config.js",
    ];
    for (const p of possibleFilePaths) {
      if (await fs.exists(p)) {
        filePath = p;
        break;
      }
    }
  }
  if (!filePath) throw new Error("Could not find Kyselyx configuration file.");

  // load and validate the config file
  const { default: _cfg } = await import(path.resolve(process.cwd(), filePath));
  const cfg = ZConfigFile.passthrough()
    .catch(({ error }) => {
      throw new Error(`There are errors in your kyselyx config file: ${error.message}`);
    })
    .parse(_cfg);

  // set the 'migrationsFolder' and 'seedsFolder'
  cfg.migrationsFolder = cli.migrationsFolder || cfg.migrationsFolder;
  cfg.seedsFolder = cli.seedsFolder || cfg.seedsFolder;

  // set the configFile
  cfg.configFile = filePath;

  _config = ZConfig.parse(cfg);
}
