// Runs on staged files in the pre-commit hook: the hidden-character check,
// which only reads, then Biome with safe fixes.
export default {
  "*": [
    "node scripts/check-hidden-unicode.ts",
    "biome check --write --no-errors-on-unmatched --files-ignore-unknown=true",
  ],
};
