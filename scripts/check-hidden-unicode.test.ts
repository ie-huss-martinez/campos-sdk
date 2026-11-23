import { describe, expect, it } from "vitest";
import { findHiddenCharacters, HIDDEN_CHARACTERS } from "./check-hidden-unicode.ts";

describe("findHiddenCharacters", () => {
  it("accepts ordinary text, including Spanish", () => {
    expect(findHiddenCharacters("Cuaderno de explotación: año, señal, «cita».\n")).toEqual([]);
  });

  it("reports each listed character with its line and column", () => {
    for (const [codePoint, name] of HIDDEN_CHARACTERS) {
      const text = `ok\nab${String.fromCodePoint(codePoint)}c`;
      expect(findHiddenCharacters(text)).toEqual([{ line: 2, column: 3, codePoint, name }]);
    }
  });

  it("reports tag characters", () => {
    expect(findHiddenCharacters(`x${String.fromCodePoint(0xe0041)}`)).toEqual([
      { line: 1, column: 2, codePoint: 0xe0041, name: "TAG CHARACTER" },
    ]);
  });

  it("counts columns in code points, not UTF-16 units", () => {
    expect(findHiddenCharacters(`🌾${String.fromCodePoint(0x200b)}`)).toEqual([
      { line: 1, column: 2, codePoint: 0x200b, name: "ZERO WIDTH SPACE" },
    ]);
  });
});
