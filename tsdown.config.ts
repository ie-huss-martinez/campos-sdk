import { defineConfig } from "tsdown";

// One entry, built as ES module and CommonJS, each with its own declarations
// (ADR 0003). Nothing is minified or bundled in: the package has no runtime
// dependencies, and readable output is easier to audit.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  platform: "neutral",
  target: "es2022",
  dts: true,
  // No source maps: src/ isn't published, and the output is readable as it is.
  sourcemap: false,
  clean: true,
  minify: false,
  // The build must not reach the network or read the environment.
  env: {},
  publint: false,
  attw: false,
});
