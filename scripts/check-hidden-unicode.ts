// Fails when a tracked text file holds a character a reviewer can't see:
// bidirectional controls ("Trojan Source"), zero-width and other invisible
// characters, line and paragraph separators, and tag characters. Source writes
// them as escapes, such as "\u202E". The list is the SDK family's (sdk-core
// ADR 0052), copied in, not imported (ADR 0001).
//
// Usage: node scripts/check-hidden-unicode.ts [file ...]
// With no files, every file git tracks is checked.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** The characters reported, with their Unicode names. */
export const HIDDEN_CHARACTERS: ReadonlyMap<number, string> = new Map([
  [0x00ad, "SOFT HYPHEN"],
  [0x061c, "ARABIC LETTER MARK"],
  [0x180e, "MONGOLIAN VOWEL SEPARATOR"],
  [0x200b, "ZERO WIDTH SPACE"],
  [0x200c, "ZERO WIDTH NON-JOINER"],
  [0x200d, "ZERO WIDTH JOINER"],
  [0x200e, "LEFT-TO-RIGHT MARK"],
  [0x200f, "RIGHT-TO-LEFT MARK"],
  [0x2028, "LINE SEPARATOR"],
  [0x2029, "PARAGRAPH SEPARATOR"],
  [0x202a, "LEFT-TO-RIGHT EMBEDDING"],
  [0x202b, "RIGHT-TO-LEFT EMBEDDING"],
  [0x202c, "POP DIRECTIONAL FORMATTING"],
  [0x202d, "LEFT-TO-RIGHT OVERRIDE"],
  [0x202e, "RIGHT-TO-LEFT OVERRIDE"],
  [0x2060, "WORD JOINER"],
  [0x2061, "FUNCTION APPLICATION"],
  [0x2062, "INVISIBLE TIMES"],
  [0x2063, "INVISIBLE SEPARATOR"],
  [0x2064, "INVISIBLE PLUS"],
  [0x2066, "LEFT-TO-RIGHT ISOLATE"],
  [0x2067, "RIGHT-TO-LEFT ISOLATE"],
  [0x2068, "FIRST STRONG ISOLATE"],
  [0x2069, "POP DIRECTIONAL ISOLATE"],
  [0xfeff, "ZERO WIDTH NO-BREAK SPACE"],
]);

/** Tag characters, U+E0000 to U+E007F, can carry text nobody sees. */
const isTag = (codePoint: number): boolean => codePoint >= 0xe0000 && codePoint <= 0xe007f;

export interface Finding {
  readonly line: number;
  readonly column: number;
  readonly codePoint: number;
  readonly name: string;
}

/** Every hidden character in a text, with its line and column, from 1. */
export function findHiddenCharacters(text: string): Finding[] {
  const findings: Finding[] = [];
  let line = 1;
  let column = 1;
  for (const character of text) {
    const codePoint = character.codePointAt(0) ?? 0;
    const name =
      HIDDEN_CHARACTERS.get(codePoint) ?? (isTag(codePoint) ? "TAG CHARACTER" : undefined);
    if (name !== undefined) {
      findings.push({ line, column, codePoint, name });
    }
    if (character === "\n") {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }
  return findings;
}

/** A file is text unless its first 8 KiB hold a NUL byte, as git decides. */
const isBinary = (bytes: Buffer): boolean => bytes.subarray(0, 8192).includes(0);

const hex = (codePoint: number): string =>
  `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`;

function main(files: string[]): number {
  const paths =
    files.length > 0
      ? files
      : execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
  let failed = false;
  for (const path of paths) {
    const bytes = readFileSync(path);
    if (isBinary(bytes)) {
      continue;
    }
    for (const finding of findHiddenCharacters(bytes.toString("utf8"))) {
      failed = true;
      process.stderr.write(
        `${path}:${finding.line}:${finding.column}: ${hex(finding.codePoint)} ${finding.name}. Write it as an escape, or remove it.\n`,
      );
    }
  }
  return failed ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
