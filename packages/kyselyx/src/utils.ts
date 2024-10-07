import { type MigrationInfo } from "kysely";
import { type SeedInfo } from "./seeder/seed.js";

export function getTimestamp(item: MigrationInfo | SeedInfo) {
  let timestamp = /(?<timestamp>^\d+)_.*$/.exec(item.name)?.groups?.timestamp;

  if (!timestamp) {
    if ("migration" in item) {
      throw new Error(
        `Invalid migration name "${item.name}", migration name must start with a timestamp in milliseconds.`,
      );
    } else {
      throw new Error(`Invalid seed name "${item.name}", seed name must start with a timestamp in milliseconds.`);
    }
  }

  let timestampMs = parseInt(timestamp);
  if (isNaN(timestampMs)) {
    throw new Error(`Invalid timestamp in "${item.name}".`);
  }

  return timestampMs;
}
