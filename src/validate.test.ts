import { describe, expect, it } from "vitest";
import { copy, fullLogbook, minimalLogbook, sparseLogbook } from "../test/fixtures.ts";
import type { Issue } from "./issues.ts";
import { MAX_FIELDS, MAX_ISSUES } from "./validate/context.ts";
import { validateLogbook } from "./validate.ts";

type Mutable = Record<string, unknown> & {
  holding: Record<string, unknown>;
  treatments: Array<Record<string, unknown> & { products?: Array<Record<string, unknown>> }>;
  fertilisations: Array<Record<string, unknown>>;
  fertilisationPlans: Array<Record<string, unknown>>;
  irrigations: Array<Record<string, unknown>>;
  cropDelimitations: Array<Record<string, unknown>>;
};

const full = (): Mutable => copy(fullLogbook) as unknown as Mutable;

/** The issues for an input, as `CODE at a.b.0`. */
const issues = (input: unknown, options?: Parameters<typeof validateLogbook>[1]): string[] => {
  const result = validateLogbook(input, options);
  return result.issues.map((issue: Issue) => `${issue.code} at ${issue.path.join(".")}`);
};

describe("validateLogbook", () => {
  it("accepts the full, minimal and sparse fixtures", () => {
    expect(issues(fullLogbook)).toEqual([]);
    expect(issues(minimalLogbook)).toEqual([]);
    expect(issues(sparseLogbook)).toEqual([]);
  });

  it.each([
    "holding",
    "cropDelimitations.0",
    "cropDelimitations.0.sigpac",
    "treatments.0",
    "treatments.0.dgcs.0",
    "treatments.0.targets",
    "treatments.0.otherMeasure",
    "treatments.0.products.0",
    "treatments.0.applicators.0",
    "treatments.0.applicators.0.equipment",
    "treatments.0.adviser",
    "fertilisations.0",
    "fertilisations.0.material",
    "fertilisations.0.material.macronutrients.0",
    "fertilisations.0.application",
    "fertilisations.0.equipment",
    "fertilisations.0.fertigation",
    "fertilisations.0.dgcs.0",
    "fertilisationPlans.0",
    "fertilisationPlans.0.dgcs.0",
    "irrigations.0",
    "irrigations.0.dgcs.0",
  ])("rejects %s when it isn't an object", (path) => {
    const input = full();
    const segments = path.split(".");
    const last = segments.pop() ?? "";
    let parent: Record<string, unknown> = input;
    for (const segment of segments) {
      parent = parent[segment] as Record<string, unknown>;
    }
    parent[last] = "x";
    expect(issues(input)).toContain(`INVALID_TYPE at ${path}`);
  });

  it("rejects a NIF that isn't text", () => {
    const input = full();
    input.holding["holderNif"] = 90000001;
    expect(issues(input)).toEqual(["INVALID_TYPE at holding.holderNif"]);
  });

  it("returns a frozen copy that shares nothing with the input", () => {
    const input = full();
    const result = validateLogbook(input);
    if (!result.ok) {
      throw new Error("expected success");
    }
    expect(result.value).toEqual(fullLogbook);
    expect(result.value).not.toBe(input);
    expect(result.value.holding).not.toBe(input.holding);
    expect(Object.isFrozen(result.value)).toBe(true);
    expect(Object.isFrozen(result.value.treatments?.[0]?.dgcs)).toBe(true);
    expect(Object.isFrozen(result.value.treatments?.[0]?.targets.diseases)).toBe(true);
  });

  it("rejects what isn't an object", () => {
    for (const input of [null, undefined, 1, "x", [], () => 1]) {
      expect(issues(input)).toEqual(["INVALID_TYPE at "]);
    }
  });

  it("reports every problem, not the first, with paths", () => {
    const input = full();
    input.holding["reaCode"] = "ES1";
    delete input.holding["holderNif"];
    input.treatments[0]!["efficacy"] = 10;
    expect(issues(input)).toEqual([
      "INVALID_FORMAT at holding.reaCode",
      "REQUIRED at holding.holderNif",
      "OUT_OF_RANGE at treatments.0.efficacy",
    ]);
  });

  it("tags an activity's issues with its identifier", () => {
    const input = full();
    input.irrigations[0]!["quantity"] = -1;
    const result = validateLogbook(input);
    expect(result.issues[0]).toMatchObject({
      code: "OUT_OF_RANGE",
      path: ["irrigations", 0, "quantity"],
      recordId: 4,
    });
  });

  it("never puts the rejected value in an issue", () => {
    const input = full();
    input.holding["holderNif"] = "90000001A";
    input.holding["managingUnitNif"] = "SECRET-NAME";
    const result = validateLogbook(input);
    const text = JSON.stringify(result.issues);
    expect(result.issues.map((i) => i.code)).toEqual(["INVALID_CHECKSUM", "INVALID_FORMAT"]);
    expect(text).not.toContain("90000001A");
    expect(text).not.toContain("SECRET-NAME");
  });

  describe("unknown fields", () => {
    it("names a field that looks like an identifier", () => {
      const input = full();
      input.holding["reaCodee"] = "x";
      expect(issues(input)).toEqual(["UNKNOWN_FIELD at holding.reaCodee"]);
    });

    it("hides a field name that could be data", () => {
      const input = full();
      input.holding["90000002J"] = "x";
      input.holding["Juan García"] = "x";
      input.holding["a".repeat(65)] = "x";
      expect(issues(input)).toEqual([
        "UNKNOWN_FIELD at holding.?",
        "UNKNOWN_FIELD at holding.?",
        "UNKNOWN_FIELD at holding.?",
      ]);
    });

    it("treats hostile keys as unknown and leaves prototypes alone", () => {
      const input = JSON.parse(
        '{"holding":{"reaCode":"ES000000000003","holderNif":"X9000001D","managingUnitNif":"X9000001D","payingAgency":"13","__proto__":{"polluted":1},"constructor":1}}',
      );
      expect(issues(input)).toEqual([
        "UNKNOWN_FIELD at holding.__proto__",
        "UNKNOWN_FIELD at holding.constructor",
      ]);
      expect(({} as Record<string, unknown>)["polluted"]).toBeUndefined();
    });
  });

  it("accepts the same text without the invisible character", () => {
    const input = full();
    input.treatments[0]!["notes"] = "FarmName";
    expect(issues(input)).toEqual([]);
  });

  it("refuses accessors in lists without calling them", () => {
    let called = false;
    const input = full();
    const justifications: unknown[] = [1];
    Object.defineProperty(justifications, 1, {
      enumerable: true,
      get: () => {
        called = true;
        return 2;
      },
    });
    input.treatments[0]!["justifications"] = justifications;
    expect(issues(input)).toEqual(["INVALID_TYPE at treatments.0.justifications.1"]);
    expect(called).toBe(false);
  });

  it("reports a repeated code in a list", () => {
    const input = full();
    input.treatments[0]!["justifications"] = [1, 2, 1];
    input.irrigations[0]!["waterOrigins"] = [1, 1];
    expect(issues(input)).toEqual([
      "DUPLICATE_ITEM at treatments.0.justifications.2",
      "DUPLICATE_ITEM at irrigations.0.waterOrigins.1",
    ]);
  });

  it("tags every issue inside an activity with its valid identifier", () => {
    const input = full();
    input.treatments[0]!["deleted"] = "yes";
    input.treatments[0]!["colour"] = "red";
    input.irrigations.push({ ...input.irrigations[0]!, id: 4 });
    input.fertilisations[0]!["id"] = -1;
    input.fertilisations[0]!["deleted"] = "no";
    const result = validateLogbook(input);
    expect(
      result.issues.map((issue) => [issue.code, issue.path.join("."), issue.recordId]),
    ).toEqual([
      ["UNKNOWN_FIELD", "treatments.0.colour", 1],
      ["INVALID_TYPE", "treatments.0.deleted", 1],
      ["OUT_OF_RANGE", "fertilisations.0.id", undefined],
      ["INVALID_TYPE", "fertilisations.0.deleted", undefined],
      ["DUPLICATE_ID", "irrigations.1.id", 4],
    ]);
  });

  it("refuses accessors without calling them", () => {
    let called = false;
    const holding = { ...minimalLogbook.holding };
    Object.defineProperty(holding, "notebookId", {
      enumerable: true,
      get: () => {
        called = true;
        return 1;
      },
    });
    expect(issues({ holding })).toEqual(["INVALID_TYPE at holding.notebookId"]);
    expect(called).toBe(false);
  });

  it("refuses objects with too many fields without reading them", () => {
    const holding: Record<string, unknown> = {};
    for (let index = 0; index <= MAX_FIELDS; index += 1) {
      holding[`f${index}`] = index;
    }
    expect(issues({ holding })).toEqual(["INVALID_LENGTH at holding"]);
  });

  it("stops after the issue limit", () => {
    const input = full();
    input.irrigations = Array.from({ length: 2000 }, () => ({}));
    const result = validateLogbook(input);
    expect(result.issues).toHaveLength(MAX_ISSUES);
    expect(result.issues.at(-1)?.code).toBe("TOO_MANY_ISSUES");
  });

  it("bounds lists before reading them", () => {
    const input = full();
    input.treatments[0]!["justifications"] = Array.from({ length: 101 }, () => 1);
    input.irrigations[0]!["dgcs"] = [];
    expect(issues(input)).toEqual([
      "INVALID_LENGTH at treatments.0.justifications",
      "AT_LEAST_ONE at irrigations.0.dgcs",
    ]);
    input.irrigations[0]!["dgcs"] = "x";
    expect(issues(input)).toContain("INVALID_TYPE at irrigations.0.dgcs");
  });

  describe("text", () => {
    it("counts code points and bounds length", () => {
      const input = full();
      input.treatments[0]!["notes"] = "🌾".repeat(150);
      expect(issues(input)).toEqual([]);
      input.treatments[0]!["notes"] = "🌾".repeat(151);
      expect(issues(input)).toEqual(["INVALID_LENGTH at treatments.0.notes"]);
      input.treatments[0]!["notes"] = "x".repeat(10_000);
      expect(issues(input)).toEqual(["INVALID_LENGTH at treatments.0.notes"]);
      input.treatments[0]!["notes"] = "";
      expect(issues(input)).toEqual(["INVALID_LENGTH at treatments.0.notes"]);
      input.treatments[0]!["notes"] = 5;
      expect(issues(input)).toEqual(["INVALID_TYPE at treatments.0.notes"]);
    });

    it.each([
      ["a line break", "\n"],
      ["a tab", "\t"],
      ["a NUL", "\u0000"],
      ["a C1 control", "\u0085"],
      ["a right-to-left override", "\u202E"],
      ["a zero-width space", "\u200B"],
      ["a byte order mark", "\uFEFF"],
      ["a tag character", "\u{E0041}"],
      ["a combining grapheme joiner", "\u034F"],
      ["a variation selector", "\uFE0F"],
      ["a Hangul filler", "\u115F"],
    ])("rejects %s", (_name, character) => {
      const input = full();
      input.treatments[0]!["notes"] = `ok${character}ok`;
      expect(issues(input)).toEqual(["INVALID_CHARACTER at treatments.0.notes"]);
    });

    it("checks formats", () => {
      const input = full();
      input.holding["siexCode"] = "XX000000000002";
      input.cropDelimitations[0]!["cadastralReference"] = "12345A12345678000AB1";
      input.treatments[0]!["time"] = "24:00:00";
      expect(issues(input)).toEqual([
        "INVALID_FORMAT at holding.siexCode",
        "INVALID_FORMAT at cropDelimitations.0.cadastralReference",
        "INVALID_FORMAT at treatments.0.time",
      ]);
    });

    it("accepts an urban cadastral reference", () => {
      const input = full();
      input.cropDelimitations[0]!["cadastralReference"] = "1234567AB1234C1234DE";
      expect(issues(input)).toEqual([]);
    });
  });

  describe("numbers", () => {
    it("checks whole numbers and ranges", () => {
      const input = full();
      input.treatments[0]!["id"] = 1.5;
      input.fertilisations[0]!["id"] = 10_000_000_000;
      input.irrigations[0]!["unit"] = "6";
      expect(issues(input)).toEqual([
        "INVALID_TYPE at treatments.0.id",
        "OUT_OF_RANGE at fertilisations.0.id",
        "INVALID_TYPE at irrigations.0.unit",
      ]);
    });

    it("checks decimals' range and places", () => {
      const input = full();
      input.irrigations[0]!["quantity"] = 999_999.99;
      expect(issues(input)).toEqual([]);
      input.irrigations[0]!["quantity"] = 1_000_000;
      expect(issues(input)).toEqual(["OUT_OF_RANGE at irrigations.0.quantity"]);
      input.irrigations[0]!["quantity"] = 0.1 + 0.2;
      expect(issues(input)).toEqual(["TOO_MANY_DECIMALS at irrigations.0.quantity"]);
      input.irrigations[0]!["quantity"] = 1e-7;
      expect(issues(input)).toEqual(["TOO_MANY_DECIMALS at irrigations.0.quantity"]);
      input.irrigations[0]!["quantity"] = Number.POSITIVE_INFINITY;
      expect(issues(input)).toEqual(["INVALID_TYPE at irrigations.0.quantity"]);
    });

    it("keeps long codes as digits", () => {
      const input = full();
      // biome-ignore lint/correctness/noPrecisionLoss: the point is a code a number can't hold.
      input.cropDelimitations[0]!["code"] = 9_007_199_254_740_993;
      expect(issues(input)).toEqual(["INVALID_TYPE at cropDelimitations.0.code"]);
      input.cropDelimitations[0]!["code"] = "0123";
      expect(issues(input)).toEqual(["INVALID_FORMAT at cropDelimitations.0.code"]);
      input.cropDelimitations[0]!["code"] = "12345678901234567";
      expect(issues(input)).toEqual(["INVALID_LENGTH at cropDelimitations.0.code"]);
    });

    it("checks booleans", () => {
      const input = full();
      input.cropDelimitations[0]!["irrigated"] = "true";
      expect(issues(input)).toEqual(["INVALID_TYPE at cropDelimitations.0.irrigated"]);
    });
  });

  describe("dates", () => {
    it.each([
      "2027-02-29",
      "2027-13-01",
      "2027-00-10",
      "2027-04-31",
      "27-01-01",
      "2027-1-01",
      "1899-12-31",
      "3000-01-01",
      "2027-01-01T00:00:00",
    ])("rejects %s", (value) => {
      const input = full();
      input.irrigations[0]!["start"] = value;
      expect(issues(input)).toContain("INVALID_DATE at irrigations.0.start");
    });

    it("accepts leap days", () => {
      const input = full();
      input.fertilisationPlans[0]!["generatedOn"] = "2028-02-29";
      expect(issues(input)).toEqual([]);
      input.fertilisationPlans[0]!["generatedOn"] = "2000-02-29";
      expect(issues(input)).toEqual([]);
      input.fertilisationPlans[0]!["generatedOn"] = "2100-02-29";
      expect(issues(input)).toEqual(["INVALID_DATE at fertilisationPlans.0.generatedOn"]);
      input.fertilisationPlans[0]!["generatedOn"] = 20280229;
      expect(issues(input)).toEqual(["INVALID_TYPE at fertilisationPlans.0.generatedOn"]);
    });

    it("checks that an end isn't before its start", () => {
      const input = full();
      input.treatments[0]!["end"] = "2027-03-03";
      input.cropDelimitations[0]!["to"] = "2026-09-30";
      input.cropDelimitations[0]!["areaTo"] = "2026-09-30";
      expect(issues(input)).toEqual([
        "DATE_ORDER at cropDelimitations.0.to",
        "DATE_ORDER at cropDelimitations.0.areaTo",
        "DATE_ORDER at treatments.0.end",
      ]);
    });
  });

  describe("crop delimitation references", () => {
    it("needs exactly one of dgc and declaredDgc", () => {
      const input = full();
      input.irrigations[0]!["dgcs"] = [{}, { dgc: "1", declaredDgc: "2" }];
      expect(issues(input)).toEqual([
        "EXACTLY_ONE at irrigations.0.dgcs.0",
        "EXACTLY_ONE at irrigations.0.dgcs.1",
      ]);
    });

    it("takes cropRecord only with dgc", () => {
      const input = full();
      input.fertilisationPlans[0]!["dgcs"] = [{ declaredDgc: "2", cropRecord: "3" }];
      expect(issues(input)).toEqual(["CONFLICT at fertilisationPlans.0.dgcs.0.cropRecord"]);
    });
  });

  describe("treatments", () => {
    it("needs a product or another measure", () => {
      const input = full();
      delete input.treatments[0]!["otherMeasure"];
      input.treatments[0]!["products"] = [];
      expect(issues(input)).toEqual(["AT_LEAST_ONE at treatments.0"]);
      delete input.treatments[0]!["products"];
      expect(issues(input)).toEqual(["AT_LEAST_ONE at treatments.0"]);
      (input.treatments[0] as Record<string, unknown>)["products"] = "x";
      expect(issues(input)).toEqual(["INVALID_TYPE at treatments.0.products"]);
    });

    it("needs a dose or a quantity per product, not both", () => {
      const input = full();
      input.treatments[0]!.products![0]!["quantity"] = 1;
      delete input.treatments[0]!.products![1]!["quantity"];
      expect(issues(input)).toEqual([
        "EXACTLY_ONE at treatments.0.products.0",
        "EXACTLY_ONE at treatments.0.products.1",
      ]);
    });

    it("needs at least one target, justification and applicator", () => {
      const input = full();
      input.treatments[0]!["targets"] = { diseases: [] };
      input.treatments[0]!["justifications"] = [];
      input.treatments[0]!["applicators"] = [];
      expect(issues(input)).toEqual([
        "AT_LEAST_ONE at treatments.0.justifications",
        "AT_LEAST_ONE at treatments.0.targets",
        "AT_LEAST_ONE at treatments.0.applicators",
      ]);
    });

    it("identifies equipment by exactly one registration", () => {
      const input = full();
      const applicators = input.treatments[0]!["applicators"] as Array<{
        equipment: Record<string, unknown>;
      }>;
      applicators[0]!.equipment["reganip"] = "R";
      delete applicators[1]!.equipment["unregisteredId"];
      expect(issues(input)).toEqual([
        "EXACTLY_ONE at treatments.0.applicators.0.equipment",
        "EXACTLY_ONE at treatments.0.applicators.1.equipment",
      ]);
    });

    it("takes only the two cover activities", () => {
      const input = full();
      input.treatments[0]!["coverActivity"] = "removal";
      expect(issues(input)).toEqual([]);
      input.treatments[0]!["coverActivity"] = "mowing";
      expect(issues(input)).toEqual(["INVALID_FORMAT at treatments.0.coverActivity"]);
    });
  });

  describe("fertilisations", () => {
    it("takes at most one of supplierNif, rega and nima", () => {
      const input = full();
      const material = input.fertilisations[0]!["material"] as Record<string, unknown>;
      material["nima"] = "NIMA-1";
      expect(issues(input)).toEqual(["CONFLICT at fertilisations.0.material"]);
      delete material["nima"];
      delete material["rega"];
      material["supplierNif"] = "B9000000A";
      expect(issues(input)).toEqual(["INVALID_CHECKSUM at fertilisations.0.material.supplierNif"]);
    });

    it("needs the water's quantity or dose in fertigation", () => {
      const input = full();
      const fertigation = input.fertilisations[0]!["fertigation"] as Record<string, unknown>;
      delete fertigation["quantity"];
      expect(issues(input)).toEqual(["AT_LEAST_ONE at fertilisations.0.fertigation"]);
      fertigation["dose"] = 2;
      expect(issues(input)).toEqual([]);
    });
  });

  it("reports identifiers used twice in one kind of record", () => {
    const input = full();
    input.irrigations.push({ ...input.irrigations[0]!, id: 4 });
    input.cropDelimitations.push({ ...input.cropDelimitations[0]! });
    input.treatments.push({ ...input.treatments[0]!, id: 4 });
    expect(issues(input)).toEqual([
      "DUPLICATE_ID at cropDelimitations.1.code",
      "DUPLICATE_ID at irrigations.1.id",
    ]);
  });

  it("requires each record's required fields", () => {
    const input = { holding: {}, treatments: [{}], fertilisationPlans: [{}] };
    expect(issues(input)).toEqual([
      "REQUIRED at holding.payingAgency",
      "REQUIRED at holding.reaCode",
      "REQUIRED at holding.holderNif",
      "REQUIRED at holding.managingUnitNif",
      "REQUIRED at treatments.0.id",
      "REQUIRED at treatments.0.start",
      "REQUIRED at treatments.0.end",
      "REQUIRED at treatments.0.justifications",
      "REQUIRED at treatments.0.efficacy",
      "AT_LEAST_ONE at treatments.0",
      "REQUIRED at treatments.0.dgcs",
      "REQUIRED at treatments.0.targets",
      "REQUIRED at treatments.0.applicators",
      "REQUIRED at fertilisationPlans.0.id",
      "REQUIRED at fertilisationPlans.0.generatedOn",
      "REQUIRED at fertilisationPlans.0.previousCrop",
      "REQUIRED at fertilisationPlans.0.nitrogenNeed",
      "REQUIRED at fertilisationPlans.0.phosphorusNeed",
      "REQUIRED at fertilisationPlans.0.potassiumNeed",
      "REQUIRED at fertilisationPlans.0.yieldTarget",
      "REQUIRED at fertilisationPlans.0.toolUsed",
      "REQUIRED at fertilisationPlans.0.dgcs",
    ]);
  });

  it("ignores fields set to undefined, as JSON would", () => {
    const input = full();
    input.treatments[0]!["notes"] = undefined;
    expect(issues(input)).toEqual([]);
  });
});

describe("catalogue snapshots", () => {
  /** Every catalogue the fixture uses, with the fixture's codes. */
  const snapshot = {
    payingAgency: [{ code: "07" }],
    crop: [{ code: 1 }, { code: 2 }, { code: 10 }],
    variety: [{ code: 101 }],
    croppingSystem: [{ code: 2 }],
    phenologicalStage: [{ code: 3 }],
    coverType: [{ code: 2 }],
    disease: [{ code: 11 }],
    pest: [{ code: 12 }],
    weed: [{ code: 13 }],
    growthRegulator: [{ code: 14 }],
    justification: [{ code: 1 }],
    protectionMeasure: [{ code: 4 }],
    protectionGoodPractice: [{ code: 6 }],
    productType: [{ code: 1 }, { code: 3 }],
    exceptionalAuthorisation: [{ code: 123 }],
    unit: [3, 4, 5, 6, 7, 8, 9].map((code) => ({ code })),
    efficacy: [{ code: 2 }],
    machineryTypeUne: [{ code: "UNE-01" }],
    energyType: [1, 2, 3].map((code) => ({ code })),
    fertiliserGoodPractice: [{ code: 3 }],
    fertiliserMaterial: [{ code: 20 }],
    fertiliserMaterialDetail: [{ code: 2001 }],
    manureTreatment: [{ code: 1 }],
    macronutrient: [{ code: 1 }],
    micronutrient: [{ code: 3 }],
    heavyMetal: [{ code: 2 }],
    fertilisationType: [{ code: 1 }],
    fertiliserApplicationMethod: [{ code: 2 }],
    irrigationGoodPractice: [{ code: 1 }, { code: 2 }],
    irrigationSystem: [{ code: 2 }],
    waterOrigin: [{ code: 1 }, { code: 2 }],
  };

  it("accepts codes in the snapshot", () => {
    expect(issues(fullLogbook, { catalogues: snapshot })).toEqual([]);
  });

  it("compares digit codes by value", () => {
    expect(
      issues(fullLogbook, {
        catalogues: {
          ...snapshot,
          payingAgency: [{ code: 7 }],
          crop: [{ code: "001" }, { code: "2" }, { code: "10" }],
        },
      }),
    ).toEqual([]);
  });

  it("reports a code missing from a supplied catalogue", () => {
    expect(
      issues(fullLogbook, { catalogues: { ...snapshot, weed: [], payingAgency: [] } }),
    ).toEqual([
      "UNKNOWN_CODE at holding.payingAgency",
      "UNKNOWN_CODE at treatments.0.targets.weeds.0",
    ]);
  });

  it("reports a code retired on or before the record's date", () => {
    const catalogues = {
      ...snapshot,
      pest: [{ code: 12, retiredOn: "2027-03-04" }],
      disease: [{ code: 11, retiredOn: "2027-03-05" }],
      crop: [
        { code: 1, retiredOn: "2026-10-01" },
        { code: 2, retiredOn: "2026-09-16" },
        { code: 10 },
      ],
    };
    expect(issues(fullLogbook, { catalogues })).toEqual([
      "RETIRED_CODE at cropDelimitations.0.crop",
      "RETIRED_CODE at treatments.0.targets.pests.0",
    ]);
  });

  it("reports a catalogue problem at the code's own index", () => {
    const input = copy(fullLogbook) as unknown as { treatments: Array<Record<string, unknown>> };
    input.treatments[0]!["justifications"] = ["bad", 2];
    expect(issues(input, { catalogues: { justification: [{ code: 1 }] } })).toEqual([
      "INVALID_TYPE at treatments.0.justifications.0",
      "UNKNOWN_CODE at treatments.0.justifications.1",
    ]);
  });

  it("reads the snapshot once", () => {
    let reads = 0;
    const options = {
      get catalogues() {
        reads += 1;
        return reads === 1 ? { weed: [{ code: 13 }] } : undefined;
      },
    };
    expect(issues(fullLogbook, options)).toEqual([]);
    expect(reads).toBe(1);
  });

  it("checks only the catalogues supplied", () => {
    expect(issues(fullLogbook, { catalogues: { weed: [{ code: 13 }] } })).toEqual([]);
  });

  it("validates the snapshot first, as untrusted input", () => {
    expect(
      issues(fullLogbook, {
        catalogues: {
          weed: [{ code: -1 }, {}, { code: "x\n" }, { code: 13, retiredOn: "soon" }, "x"],
          colours: [],
        },
      }),
    ).toEqual([
      "UNKNOWN_FIELD at options.catalogues.colours",
      "INVALID_TYPE at options.catalogues.weed.0.code",
      "REQUIRED at options.catalogues.weed.1.code",
      "INVALID_CHARACTER at options.catalogues.weed.2.code",
      "INVALID_DATE at options.catalogues.weed.3.retiredOn",
      "INVALID_TYPE at options.catalogues.weed.4",
    ]);
    expect(issues(fullLogbook, { catalogues: [] })).toEqual(["INVALID_TYPE at options.catalogues"]);
  });
});
