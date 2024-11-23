import { Command } from "commander";
import "tsx/esm";
import { loadKyselyxConfig } from "./config.js";
import * as migrate from "./migrate.js";
import * as misc from "./misc.js";
import * as seed from "./seed.js";

async function main() {
  const program = new Command();
  program.name("kyselyx").description("A CLI for executing Kysely migrations and seeds.");
  program.option("-c, --config <path>", "Path to the Kyselyx configuration file.");
  program.option("-m, --migration-folder <path>", "Path to the folder where migrations are stored.");
  program.option("-s, --seed-folder <path>", "Path to the folder where seeds are stored.");

  await loadKyselyxConfig(program.opts()).then((res) => {
    if (res.isErr()) {
      console.error(res.error.message);
      process.exit(1);
    }
  });

  // define commands for migrations
  program
    .command("db:migrate")
    .argument(
      "[name]",
      "The name of the last migration to run. The name does not need to include the timestamp as long as it is unique. Ex: `1730972486240_users` or `users`.",
    )
    .summary("Run pending migrations")
    .description("Runs all pending migrations up to (and including) the optionally specified migration.")
    .action(migrate.migrate);
  program
    .command("db:migrate:undo")
    .argument(
      "[name]",
      "The name of the migration to revert. The name does not need to include the timestamp as long as it is unuque. Ex: `1730972486240_users` or `users`.",
    )
    .summary("Reverts applied migrations")
    .description(
      "Reverts a single migration, or all migrations up to (and including) the optionally specified migration. Any seeds with a timestamp greater than the reverted migration will also be reverted.",
    )
    .action(migrate.undo);
  program
    .command("db:migrate:undo:all")
    .summary("Reverts all applied migrations")
    .description("Reverts all applied migrations and any seeds with a timestamp greater than the first migration.")
    .action(migrate.undoAll);
  program
    .command("db:migrate:status")
    .summary("Shows the status of all migrations")
    .description("Prints info about each migration and it's status.")
    .action(migrate.status);

  // define commands for seeds
  program
    .command("db:seed")
    .argument(
      "[name]",
      "The name of the last seed to run. The name does not need to include the timestamp as long as it is unique. Ex: `1730972486240_users` or `users`.",
    )
    .summary("Run pending seeds")
    .description("Runs all pending seeds up to (and including) the optionally specified seed.")
    .action(seed.seed);
  program
    .command("db:seed:undo")
    .argument(
      "[name]",
      "The name of the seed to revert. The name does not need to include the timestamp as long as it is unique. Ex: `1730972486240_users` or `users`.",
    )
    .summary("Reverts applied seeds")
    .description("Reverts a single seed, or all seeds up to (and including) the optionally specified seed.")
    .action(seed.undo);
  program
    .command("db:seed:undo:all")
    .summary("Reverts all applied seeds")
    .description("Reverts all applied seeds.")
    .action(seed.undoAll);
  program
    .command("db:seed:status")
    .summary("Shows the status of all seeds")
    .description("Prints info about each seed and it's status.")
    .action(seed.status);

  // define commands that operate on both seeds & migrations
  program
    .command("db:purge")
    .summary("Purges the database")
    .description(
      "Reverts all seeds, migrations, and deletes all metadata (locks, seed/migration metadata) from the database. This is an escape hatch to reset a database to 'like new'.",
    )
    .action(misc.purge);
  program
    .command("db:setup")
    .summary("Runs all pending migrations and seeds")
    .description("Applies all pending migrations and seeds.")
    .action(misc.setup);
  program
    .command("db:reset")
    .summary("Purges the database and then runs all migrations and seeds")
    .description(
      "First applies a 'db:purge' and then a 'db:setup'. This will clear all data in the database and then reapply all migrations and seeds.",
    )
    .action(misc.reset);

  // define commands for generating migrations and seeds
  program
    .command("generate:migration")
    .argument("<name>", "The name of the migration to create.")
    .option("--js", "Generate a JavaScript migration file.")
    .summary("Generates a new migration file")
    .description(
      "Creates a new migration file with the specified name. Note that the name will have a timestamp prepended to it.",
    )
    .action(migrate.generate);
  program
    .command("generate:seed")
    .argument("<name>", "The name of the seed to create.")
    .option("--js", "Generate a JavaScript seed file.")
    .summary("Generates a new seed file")
    .description(
      "Creates a new seed file with the specified name. Note that the name will have a timestamp prepended to it.",
    )
    .action(seed.generate);

  program.parse();
}

main();
