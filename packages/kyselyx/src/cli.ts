import { Command } from "commander";
import "tsx/esm";
import { loadKyselyxConfig } from "./config.js";
import { new_ } from "./migrate.js";

async function main() {
  const program = new Command();
  program.name("kyselyx").description("A CLI for executing Kysely migrations and seeds.");
  program.option("-c, --config <path>", "Path to the Kyselyx configuration file.");
  program.option("-m, --migration-folder <path>", "The folder where all migrations are stored.");
  program.option("-s, --seed-folder <path>", "The folder where all seeds are stored.");

  await loadKyselyxConfig(program.opts());

  program.command("db:migrate:new <name>").description("Create a new migration file.").action(new_);

  program.parse();
}

main();
