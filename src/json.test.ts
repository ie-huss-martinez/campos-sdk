import { describe, expect, it } from "vitest";
import { rawInteger, writeJson } from "./json.ts";

describe("writeJson", () => {
  it("writes keys in insertion order, compactly", () => {
    expect(writeJson({ b: 1, a: [true, "x"], c: { d: 0.5 } })).toBe(
      '{"b":1,"a":[true,"x"],"c":{"d":0.5}}',
    );
  });

  it("writes an integer from its digits, beyond what a number holds exactly", () => {
    expect(writeJson({ n: rawInteger("9007199254740993") })).toBe('{"n":9007199254740993}');
    // biome-ignore lint/correctness/noPrecisionLoss: shows what JSON.stringify does to such a number.
    expect(JSON.stringify({ n: 9007199254740993 })).toBe('{"n":9007199254740992}');
  });

  it("escapes text", () => {
    expect(writeJson('"\\\n')).toBe('"\\"\\\\\\n"');
  });

  it("refuses what JSON can't hold", () => {
    expect(() => writeJson(Number.NaN)).toThrow(RangeError);
    expect(() => writeJson(rawInteger("012"))).toThrow(RangeError);
    expect(() => writeJson(rawInteger("1e3"))).toThrow(RangeError);
  });
});
