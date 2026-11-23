// Fails when this package depends on any package of the @hussmartinez SDK
// family, directly or through another dependency (ADR 0001). It reads
// package.json's dependency fields and every package name in the lockfile.
//
// Usage: node scripts/check-independence.ts

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SCOPE = "@hussmartinez/";

const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
  "bundleDependencies",
  "bundledDependencies",
] as const;

/** Names in the scope that package.json depends on, field by field. */
export function scopedInManifest(manifest: Record<string, unknown>): string[] {
  const found: string[] = [];
  for (const field of DEPENDENCY_FIELDS) {
    const value = manifest[field];
    const names = Array.isArray(value)
      ? value.filter((name): name is string => typeof name === "string")
      : value !== null && typeof value === "object"
        ? Object.keys(value)
        : [];
    for (const name of names) {
      if (name.startsWith(SCOPE)) {
        found.push(`${field}: ${name}`);
      }
    }
  }
  // An alias, such as "x": "npm:@hussmartinez/sdk-core@1", hides the name in
  // the version range.
  for (const field of DEPENDENCY_FIELDS) {
    const value = manifest[field];
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      for (const [name, range] of Object.entries(value)) {
        if (typeof range === "string" && range.includes(SCOPE)) {
          found.push(`${field}: ${name} (${range})`);
        }
      }
    }
  }
  return found;
}

/** Package names in the scope that the lockfile mentions, other than `self`. */
export function scopedInLockfile(lockfile: string, self: string): string[] {
  const names = new Set<string>();
  for (const match of lockfile.matchAll(/@hussmartinez\/[a-z0-9._-]+/g)) {
    if (match[0] !== self) {
      names.add(match[0]);
    }
  }
  return [...names].sort();
}

function main(): number {
  const manifest = JSON.parse(readFileSync("package.json", "utf8")) as Record<string, unknown>;
  const self = typeof manifest["name"] === "string" ? manifest["name"] : "";
  const problems = [
    ...scopedInManifest(manifest).map((entry) => `package.json ${entry}`),
    ...scopedInLockfile(readFileSync("pnpm-lock.yaml", "utf8"), self).map(
      (name) => `pnpm-lock.yaml: ${name}`,
    ),
  ];
  for (const problem of problems) {
    process.stderr.write(
      `${problem}\n  campos-sdk depends on no @hussmartinez package, not even as a dev dependency (ADR 0001).\n`,
    );
  }
  return problems.length > 0 ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
