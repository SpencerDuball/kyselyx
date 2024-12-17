import type config from "../kyselyx.config.ts";

type IStores = typeof config.stores;

/**
 * The 'up' function runs when the seed is applied.
 */
async function up({ db }: IStores): Promise<void> {}

/**
 * The 'down' function runs when the seed is removed.
 */
async function down({ db }: IStores): Promise<void> {}

export { up, down };