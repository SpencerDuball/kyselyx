import typescript from "@rollup/plugin-typescript";

/** @type {import('rollup').RollupOptionsFunction} */
const config = async () => [
  {
    input: "src/index.ts",
    output: {
      dir: "dist",
      format: "es",
      sourcemap: true,
      preserveModules: true,
    },
    plugins: [typescript({ tsconfig: "tsconfig.json" })],
  },
  {
    input: "src/cli.ts",
    output: {
      dir: "dist",
      format: "es",
      sourcemap: true,
      preserveModules: true,
    },
    plugins: [typescript({ tsconfig: "tsconfig.json" })],
  },
];

export default config;
