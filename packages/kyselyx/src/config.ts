import fs from "fs-extra";
import { Kysely } from "kysely";
import { err, ok, type Result, ResultAsync } from "neverthrow";
import path from "path";
import { z } from "zod";
import { ConfigError } from "./errors.js";

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
export type IConfig = z.infer<typeof ZConfig>;

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
export type ICliOptions = z.infer<typeof ZCliOptions>;

// -------------------------------------------------------------------------------------------------

let _config: IConfig | null = null;

/**
 * Returns the parsed configuration object.
 *
 * Note: This should be called only after `loadKyselyxConfig` has been called.
 */
export function getConfig(): Result<IConfig, ConfigError> {
  if (!_config) return err(new ConfigError("a7c8d1", "Kyselyx configuration not loaded."));
  else return ok(_config);
}

/**
 * Extracts the default export from a module.
 *
 * @see loadKyselyxConfig This function is called by `loadKyselyxConfig`.
 */
function getDefaultExport(module: any): Result<any, ConfigError> {
  if ("default" in module) return ok(module.default);
  else return err(new ConfigError("54eeac", "Kyselyx configuration file must have a default export."));
}

/**
 * Constructs an IConfig object from the module and CLI options.
 *
 * @see loadKyselyxConfig This function is called by `loadKyselyxConfig`.
 */
function getConfigFile(filePath: string, cli: ICliOptions) {
  return function (module: any): Result<IConfig, ConfigError> {
    const parseCfg = ZConfigFile.passthrough().safeParse(module);
    if (parseCfg.success) {
      let config = { ...parseCfg.data, configFile: filePath };
      if (cli.migrationsFolder) config.migrationsFolder = cli.migrationsFolder;
      if (cli.seedsFolder) config.seedsFolder = cli.seedsFolder;
      return ok(config);
    } else return err(ConfigError.fromThrown("9105f5")(parseCfg.error));
  };
}

/**
 * Loads the Kyselyx configuration file and applies the CLI options.
 */
export async function loadKyselyxConfig(cli: ICliOptions): Promise<Result<void, ConfigError>> {
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
    for (const p of possibleFilePaths) if (await fs.exists(p)) filePath = p;
  }
  if (!filePath) return err(new ConfigError("884647", "Could not find Kyselyx configuration file."));

  return ResultAsync.fromPromise(import(path.resolve(process.cwd(), filePath)), ConfigError.fromThrown("7211f9"))
    .andThen(getDefaultExport)
    .andThen(getConfigFile(filePath, cli))
    .andThen((config) => {
      _config = config;
      return ok(undefined);
    });
}
