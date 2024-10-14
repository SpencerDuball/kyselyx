import { Command } from "commander";
import "tsx/esm";
import { loadKyselyxConfig } from "./config.js";
import * as migrate from "./migrate.js";
import * as seed from "./seed.js";

async function main() {
  const program = new Command();
  program.name("kyselyx").description("A CLI for executing Kysely migrations and seeds.");
  program.option("-c, --config <path>", "Path to the Kyselyx configuration file.");
  program.option("-m, --migration-folder <path>", "The folder where all migrations are stored.");
  program.option("-s, --seed-folder <path>", "The folder where all seeds are stored.");

  await loadKyselyxConfig(program.opts());

  program.command("db:migrate:new <name>").description("Create a new migration file.").action(migrate.new_);
  program
    .command("db:migrate [name]")
    .description("Run all pending migrations or up to the specified migration.")
    .action(migrate.migrate);
  program.command("db:migrate:status").description("Show the status of all migrations.").action(migrate.status);
  program
    .command("db:migrate:undo [name]")
    .description("Reverts last migration or to the specified migration.")
    .action(migrate.undo);
  program.command("db:migrate:undo:all").description("Reverts all migrations.").action(migrate.undoAll);

  program.command("db:seed:new <name>").description("Create a new seed file.").action(seed.new_);
  program
    .command("db:seed [name]")
    .description("Run all pending migrations or up to the specified migration.")
    .action(seed.seed);
  program.command("db:seed:status").description("Show the status of all seeds.").action(seed.status);
  program.command("db:seed:undo [name]").description("Reverts last seed or to the specified seed.").action(seed.undo);
  program.command("db:seed:undo:all").description("Reverts all seeds.").action(seed.undoAll);

  program.parse();
}

main();
