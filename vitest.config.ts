import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
    // A timeout only catches a hang; the library does no I/O.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts"],
      reporter: ["text", "html"],
      // The library produces a legal record, so every line and function of
      // it is exercised by a test (ADR 0003). A line left out says why, with
      // `/* v8 ignore next -- <reason> */`.
      thresholds: {
        lines: 100,
        functions: 100,
        statements: 100,
        branches: 95,
      },
    },
  },
});
