import { describe, expect, it } from "vitest";
import { scopedInLockfile, scopedInManifest } from "./check-independence.ts";

describe("scopedInManifest", () => {
  it("accepts dependencies outside the scope", () => {
    expect(
      scopedInManifest({
        name: "@hussmartinez/campos-sdk",
        dependencies: {},
        devDependencies: { typescript: "7.0.2", "@biomejs/biome": "2.6.8" },
      }),
    ).toEqual([]);
  });

  it("reports the scope in every dependency field", () => {
    expect(
      scopedInManifest({
        dependencies: { "@hussmartinez/sdk-core": "0.1.0" },
        devDependencies: { "@hussmartinez/sdk-config": "0.13.4" },
        peerDependencies: { "@hussmartinez/ui": "^0.16.0" },
        optionalDependencies: { "@hussmartinez/ai-core": "0.1.0" },
        bundleDependencies: ["@hussmartinez/pdf-sdk"],
      }),
    ).toEqual([
      "dependencies: @hussmartinez/sdk-core",
      "devDependencies: @hussmartinez/sdk-config",
      "peerDependencies: @hussmartinez/ui",
      "optionalDependencies: @hussmartinez/ai-core",
      "bundleDependencies: @hussmartinez/pdf-sdk",
    ]);
  });

  it("reports an alias whose range names the scope", () => {
    expect(
      scopedInManifest({ devDependencies: { config: "npm:@hussmartinez/sdk-config@1" } }),
    ).toEqual(["devDependencies: config (npm:@hussmartinez/sdk-config@1)"]);
  });
});

describe("scopedInLockfile", () => {
  it("ignores the package itself", () => {
    expect(
      scopedInLockfile(
        "importers:\n  .: {}\n# @hussmartinez/campos-sdk\n",
        "@hussmartinez/campos-sdk",
      ),
    ).toEqual([]);
  });

  it("reports each scoped package once, including transitive ones", () => {
    const lockfile = [
      "packages:",
      "  '@hussmartinez/sdk-config@0.13.4':",
      "  some-tool@1.0.0:",
      "    dependencies:",
      "      '@hussmartinez/sdk-config': 0.13.4",
      "      '@hussmartinez/ui': 0.16.0",
    ].join("\n");
    expect(scopedInLockfile(lockfile, "@hussmartinez/campos-sdk")).toEqual([
      "@hussmartinez/sdk-config",
      "@hussmartinez/ui",
    ]);
  });
});
