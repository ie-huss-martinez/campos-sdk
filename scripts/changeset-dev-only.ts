// The changeset check counts any change to package.json, but a change only to
// the fields that never reach users, such as a Dependabot bump of a dev
// dependency, needs no changeset (ADR 0003). When that is all that changed
// since the base, this restores package.json from the base in the working
// tree, so `changeset status` doesn't count it. It runs only in CI's
// changeset job, whose checkout is thrown away.
//
// Usage: node scripts/changeset-dev-only.ts <base-ref>

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

/** Fields that only affect development and are not part of what users install. */
export const DEV_ONLY_FIELDS: ReadonlySet<string> = new Set([
  "devDependencies",
  "scripts",
  "packageManager",
  "devEngines",
]);

/** Whether two manifests differ, and only in dev-only fields. */
export function onlyDevFieldsChanged(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): boolean {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  let changed = false;
  for (const key of keys) {
    if (!isDeepStrictEqual(before[key], after[key])) {
      if (!DEV_ONLY_FIELDS.has(key)) {
        return false;
      }
      changed = true;
    }
  }
  return changed;
}

function main(base: string | undefined): number {
  if (!base) {
    process.stderr.write("Usage: node scripts/changeset-dev-only.ts <base-ref>\n");
    return 2;
  }
  const previous = execFileSync("git", ["show", `${base}:package.json`], { encoding: "utf8" });
  const current = readFileSync("package.json", "utf8");
  if (
    onlyDevFieldsChanged(
      JSON.parse(previous) as Record<string, unknown>,
      JSON.parse(current) as Record<string, unknown>,
    )
  ) {
    writeFileSync("package.json", previous);
    process.stdout.write(
      "package.json changed only in dev-only fields, so it needs no changeset. Restored it from the base for this check.\n",
    );
  }
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv[2]);
}
