import path from "path";
import { z } from "zod";
import type { Seed, SeedProvider } from "./seed.js";

/**
 * Reads all seeds from a folder in node.js.
 *
 * ### Examples
 *
 * ```ts
 * import { promises as fs } from 'fs'
 * import path from 'path'
 *
 * new FileSeedProvider({
 *   fs,
 *   path,
 *   seedFolder: 'path/to/seeds/folder'
 * })
 * ```
 */
export class FileSeedProvider implements SeedProvider {
  readonly #props: FileSeedProviderProps;

  constructor(props: FileSeedProviderProps) {
    this.#props = props;
  }

  async getSeeds(): Promise<Record<string, Seed>> {
    const seeds: Record<string, Seed> = {};
    const files = await this.#props.fs
      .readdir(this.#props.seedFolder)
      .then((files) => files.filter((file) => /(.ts|.mts|.js|.mjs)$/.test(file)));

    for await (const seedFile of files) {
      const file = path.join(this.#props.seedFolder, seedFile);
      const seed = await import(file);

      const seedKey = /(?<seedKey>.*)(.ts|.mts|.js|.mjs)/.exec(seedFile)?.groups?.seedKey!;

      if (isSeed(seed?.default)) {
        seeds[seedKey] = seed.default;
      } else if (isSeed(seed)) {
        seeds[seedKey] = seed;
      }
    }

    return seeds;
  }
}

function isSeed(obj: unknown): obj is Seed {
  return z.object({ up: z.function(), down: z.function() }).safeParse(obj).success;
}

export interface FileSeedProviderFS {
  readdir(path: string): Promise<string[]>;
}

export interface FileSeedProviderPath {
  join(...path: string[]): string;
}

export interface FileSeedProviderProps {
  fs: FileSeedProviderFS;
  path: FileSeedProviderPath;
  seedFolder: string;
}
