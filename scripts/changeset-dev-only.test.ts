import { describe, expect, it } from "vitest";
import { onlyDevFieldsChanged } from "./changeset-dev-only.ts";

const base = {
  name: "@hussmartinez/campos-sdk",
  version: "0.1.0",
  exports: { ".": "./dist/index.js" },
  devDependencies: { typescript: "7.0.2" },
  scripts: { build: "tsdown" },
};

describe("onlyDevFieldsChanged", () => {
  it("is false when nothing changed", () => {
    expect(onlyDevFieldsChanged(base, structuredClone(base))).toBe(false);
  });

  it("is true for a dev dependency bump, a script or the package manager", () => {
    expect(onlyDevFieldsChanged(base, { ...base, devDependencies: { typescript: "7.0.3" } })).toBe(
      true,
    );
    expect(onlyDevFieldsChanged(base, { ...base, scripts: { build: "tsdown --x" } })).toBe(true);
    expect(onlyDevFieldsChanged(base, { ...base, packageManager: "pnpm@12.23.0" })).toBe(true);
  });

  it("is false when a published field changed too", () => {
    expect(
      onlyDevFieldsChanged(base, {
        ...base,
        devDependencies: { typescript: "7.0.3" },
        dependencies: { anything: "1.0.0" },
      }),
    ).toBe(false);
    expect(onlyDevFieldsChanged(base, { ...base, exports: { ".": "./dist/other.js" } })).toBe(
      false,
    );
  });

  it("counts a removed published field as a change", () => {
    const { exports: _, ...withoutExports } = base;
    expect(onlyDevFieldsChanged(base, withoutExports)).toBe(false);
  });
});
