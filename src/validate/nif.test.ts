import { describe, expect, it } from "vitest";
import { checkNif } from "./nif.ts";

describe("checkNif", () => {
  it.each([
    "90000001N",
    "90000002J",
    "X9000001D",
    "Y9000002R",
    "Z9000003Q",
    "K9000004N",
    "B90000001",
    "Q9000002G",
    "G90000035",
    "G9000003E",
  ])("accepts %s", (nif) => {
    expect(checkNif(nif)).toBe("valid");
  });

  it.each([
    ["90000001A", "a DNI"],
    ["X9000001A", "an NIE"],
    ["K9000004A", "a K, L or M NIF"],
    ["B9000000A", "an entity whose check must be a digit"],
    ["Q90000027", "an entity whose check must be a letter"],
    ["G90000036", "an entity that takes a digit or a letter"],
    ["G9000003F", "an entity that takes a digit or a letter"],
  ])("rejects the check character of %s, %s", (nif) => {
    expect(checkNif(nif)).toBe("invalid-checksum");
  });

  it.each(["", "9000001N", "90000001n", "90000001 N", "90000001-N", "I9000001A", "XX9000001"])(
    "rejects the format of %j",
    (nif) => {
      expect(checkNif(nif)).toBe("invalid-format");
    },
  );
});
