import { Kysely, sql } from "kysely";

/**
 * The 'up' function runs when the migration is applied.
 */
async function up(db: Kysely<any>): Promise<void> {}

/**
 * The 'down' function runs when the migration is removed.
 */
async function down(db: Kysely<any>): Promise<void> {}

export { up, down };