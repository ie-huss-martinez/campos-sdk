import { describe, expect, it } from "vitest";
import * as api from "./index.ts";

describe("the package's public API", () => {
  it("exports exactly these values", () => {
    expect(Object.keys(api).sort()).toEqual([
      "CATALOGUE_NAMES",
      "CUE_VERSIONS",
      "INTERFACE_VERSIONS",
      "ISSUE_CODES",
      "cueVersionForInterface",
      "renderCue",
      "validateLogbook",
    ]);
  });

  it("has unique issue codes and catalogue names", () => {
    expect(new Set(api.ISSUE_CODES).size).toBe(api.ISSUE_CODES.length);
    expect(new Set(api.CATALOGUE_NAMES).size).toBe(api.CATALOGUE_NAMES.length);
  });

  it("validates and renders end to end", () => {
    const result = api.validateLogbook({
      holding: {
        reaCode: "ES000000000005",
        holderNif: "Z9000003Q",
        managingUnitNif: "Z9000003Q",
        payingAgency: "01",
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const version = api.cueVersionForInterface("4.10.0");
      expect(version.ok).toBe(true);
      if (version.ok) {
        expect(api.renderCue(result.value, { version: version.value }).ok).toBe(true);
      }
    }
  });
});
