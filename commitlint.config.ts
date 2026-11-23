import type { UserConfig } from "@commitlint/types";

// Commit messages are Conventional Commits with a lowercase subject. The pull
// request title becomes the commit on main with " (#NNN)" appended, so titles
// and branch commit subjects keep to 65 characters, and the header limit
// leaves room for the number. .github/workflows/pr-title.yml checks titles
// with the same types and limit: change the two together.
export const TYPES = [
  "feat",
  "fix",
  "docs",
  "refactor",
  "perf",
  "test",
  "build",
  "ci",
  "chore",
  "revert",
] as const;

export const SUBJECT_MAX_LENGTH = 65;

const config: UserConfig = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [2, "always", [...TYPES]],
    "header-max-length": [2, "always", SUBJECT_MAX_LENGTH],
    "subject-case": [2, "never", ["sentence-case", "start-case", "pascal-case", "upper-case"]],
    "body-max-line-length": [2, "always", 100],
  },
};

export default config;
