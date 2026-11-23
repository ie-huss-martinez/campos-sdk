import { type CatalogueName, type Catalogues, checkCode } from "../catalogues.ts";
import type {
  CropDelimitation,
  DgcReference,
  DgcWithArea,
  Equipment,
  Fertigation,
  Fertilisation,
  FertilisationPlan,
  FertiliserApplication,
  FertiliserEquipment,
  FertiliserMaterial,
  Holding,
  Irrigation,
  Logbook,
  NutrientShare,
  OtherProtectionMeasure,
  SigpacReference,
  Treatment,
  TreatmentAdviser,
  TreatmentApplicator,
  TreatmentDgc,
  TreatmentEquipment,
  TreatmentProduct,
  TreatmentTargets,
} from "../model.ts";
import { type Context, readList, readObject } from "./context.ts";
import { dateOrder } from "./fields.ts";
import {
  bool,
  build,
  countGiven,
  date,
  decimalOf,
  digitsOf,
  type Fields,
  intListOf,
  intOf,
  nif,
  optional,
  type Path,
  required,
  textOf,
  time,
} from "./read.ts";

/** At most this many records of each kind in one logbook. */
export const MAX_RECORDS = 10_000;
/** At most this many crop delimitations in one activity. */
export const MAX_DGCS = 1_000;
/** At most this many items in other lists, such as products or codes. */
export const MAX_ITEMS = 100;

/** The largest activity identifier: `number(10)`. */
const MAX_ID = 9_999_999_999;

/** `ES` and 12 digits: REA and SIEX codes. */
const HOLDING_CODE = /^ES\d{12}$/;

/**
 * A cadastral reference, urban or rural, as Anexo VI's descriptor (3.11.4,
 * "Patrones texto") gives it.
 */
const CADASTRAL_REFERENCE = /^(\d{7}[A-Z]{2}\d{4}[A-Z]\d{4}[A-Z]{2}|\d{5}[A-Z]\d{12}[A-Z]{2})$/;

/** Checks a code against a catalogue, on the date of the record it belongs to. */
type Check = (name: CatalogueName, code: number | string | undefined, path: Path) => void;

const checker =
  (ctx: Context, catalogues: Catalogues, onDate: string | undefined): Check =>
  (name, code, path) =>
    checkCode(ctx, catalogues, name, code, path, onDate);

/** Checks each code of a list against a catalogue. */
const checkAll = (
  check: Check,
  name: CatalogueName,
  codes: readonly number[] | undefined,
  path: Path,
): void => {
  codes?.forEach((code, index) => {
    check(name, code, [...path, index]);
  });
};

/** Reads an object's fields, or returns undefined when it isn't one. */
const fieldsOf = (
  ctx: Context,
  value: unknown,
  path: Path,
  names: readonly string[],
): Fields | undefined => {
  const values = readObject(ctx, value, path, names);
  return values === undefined ? undefined : { ctx, path, values };
};

function holding(
  ctx: Context,
  catalogues: Catalogues,
  value: unknown,
  path: Path,
): Holding | undefined {
  const f = fieldsOf(ctx, value, path, [
    "reaCode",
    "siexCode",
    "holderNif",
    "managingUnitNif",
    "payingAgency",
    "notebookId",
  ]);
  if (f === undefined) {
    return undefined;
  }
  const payingAgency = required(f, "payingAgency", textOf(2, /^[0-9A-Z]{2}$/));
  checkCode(ctx, catalogues, "payingAgency", payingAgency, [...path, "payingAgency"], undefined);
  return build<Holding>({
    reaCode: required(f, "reaCode", textOf(14, HOLDING_CODE)),
    siexCode: optional(f, "siexCode", textOf(14, HOLDING_CODE)),
    holderNif: required(f, "holderNif", nif),
    managingUnitNif: required(f, "managingUnitNif", nif),
    payingAgency,
    notebookId: optional(f, "notebookId", intOf(99_999_999)),
  });
}

function sigpac(ctx: Context, value: unknown, path: Path): SigpacReference | undefined {
  const f = fieldsOf(ctx, value, path, [
    "province",
    "municipality",
    "aggregate",
    "zone",
    "polygon",
    "parcel",
    "enclosure",
  ]);
  if (f === undefined) {
    return undefined;
  }
  return build<SigpacReference>({
    province: required(f, "province", textOf(2, /^\d{2}$/)),
    municipality: required(f, "municipality", textOf(3, /^\d{3}$/)),
    aggregate: required(f, "aggregate", intOf(999)),
    zone: required(f, "zone", intOf(999)),
    polygon: required(f, "polygon", intOf(999)),
    parcel: required(f, "parcel", intOf(99_999)),
    enclosure: required(f, "enclosure", intOf(99_999)),
  });
}

function cropDelimitation(
  ctx: Context,
  catalogues: Catalogues,
  value: unknown,
  path: Path,
): CropDelimitation | undefined {
  const f = fieldsOf(ctx, value, path, [
    "code",
    "deleted",
    "cadastralReference",
    "sigpac",
    "order",
    "area",
    "areaFrom",
    "areaTo",
    "from",
    "to",
    "crop",
    "variety",
    "irrigated",
    "croppingSystem",
  ]);
  if (f === undefined) {
    return undefined;
  }
  const from = required(f, "from", date);
  const to = optional(f, "to", date);
  dateOrder(ctx, from, to, [...path, "to"]);
  const areaFrom = optional(f, "areaFrom", date);
  const areaTo = optional(f, "areaTo", date);
  dateOrder(ctx, areaFrom, areaTo, [...path, "areaTo"]);
  const check = checker(ctx, catalogues, from);
  const crop = required(f, "crop", intOf(9999));
  check("crop", crop, [...path, "crop"]);
  const variety = required(f, "variety", intOf(9999));
  check("variety", variety, [...path, "variety"]);
  const croppingSystem = required(f, "croppingSystem", intOf(99));
  check("croppingSystem", croppingSystem, [...path, "croppingSystem"]);
  return build<CropDelimitation>({
    code: required(f, "code", digitsOf(16)),
    deleted: optional(f, "deleted", bool),
    cadastralReference: optional(f, "cadastralReference", textOf(20, CADASTRAL_REFERENCE)),
    sigpac: required(f, "sigpac", sigpac),
    order: optional(f, "order", intOf(99)),
    area: optional(f, "area", decimalOf(6, 2)),
    areaFrom,
    areaTo,
    from,
    to,
    crop,
    variety,
    irrigated: required(f, "irrigated", bool),
    croppingSystem,
  });
}

const DGC_REFERENCE_FIELDS = ["dgc", "cropRecord", "declaredDgc"] as const;

/** Reads the fields that say which crop delimitation an activity applies to. */
function dgcReferenceFields(f: Fields): Record<string, unknown> {
  if (countGiven(f, ["dgc", "declaredDgc"]) !== 1) {
    f.ctx.report("EXACTLY_ONE", f.path, "Give either dgc or declaredDgc.");
  } else if (f.values.has("declaredDgc") && f.values.has("cropRecord")) {
    f.ctx.report("CONFLICT", [...f.path, "cropRecord"], "cropRecord goes with dgc only.");
  }
  return {
    dgc: optional(f, "dgc", digitsOf(16)),
    cropRecord: optional(f, "cropRecord", digitsOf(16)),
    declaredDgc: optional(f, "declaredDgc", digitsOf(16)),
  };
}

const dgcReference = (ctx: Context, value: unknown, path: Path): DgcReference | undefined => {
  const f = fieldsOf(ctx, value, path, DGC_REFERENCE_FIELDS);
  return f === undefined ? undefined : build<DgcReference>(dgcReferenceFields(f));
};

const dgcWithArea = (ctx: Context, value: unknown, path: Path): DgcWithArea | undefined => {
  const f = fieldsOf(ctx, value, path, [...DGC_REFERENCE_FIELDS, "area"]);
  return f === undefined
    ? undefined
    : build<DgcWithArea>({ ...dgcReferenceFields(f), area: optional(f, "area", decimalOf(6, 2)) });
};

const treatmentDgc =
  (check: Check) =>
  (ctx: Context, value: unknown, path: Path): TreatmentDgc | undefined => {
    const f = fieldsOf(ctx, value, path, [
      ...DGC_REFERENCE_FIELDS,
      "area",
      "phenologicalStage",
      "nurseryProducts",
      "covers",
    ]);
    if (f === undefined) {
      return undefined;
    }
    const phenologicalStage = optional(f, "phenologicalStage", intOf(99));
    check("phenologicalStage", phenologicalStage, [...path, "phenologicalStage"]);
    const nurseryProducts = optional(f, "nurseryProducts", intListOf(9999, MAX_ITEMS));
    checkAll(check, "crop", nurseryProducts, [...path, "nurseryProducts"]);
    const covers = optional(f, "covers", intListOf(99, MAX_ITEMS));
    checkAll(check, "coverType", covers, [...path, "covers"]);
    return build<TreatmentDgc>({
      ...dgcReferenceFields(f),
      area: optional(f, "area", decimalOf(6, 2)),
      phenologicalStage,
      nurseryProducts,
      covers,
    });
  };

/** Reads the list of crop delimitations an activity applies to. */
const dgcList = <T>(
  f: Fields,
  read: (ctx: Context, value: unknown, path: Path) => T | undefined,
): readonly T[] | undefined =>
  required(f, "dgcs", (ctx, value, path) => {
    const items = readList(ctx, value, path, 1, MAX_DGCS, (item, itemPath) =>
      read(ctx, item, itemPath),
    );
    return items === undefined ? undefined : Object.freeze(items);
  });

const EQUIPMENT_FIELDS = [
  "roma",
  "own",
  "unregisteredId",
  "power",
  "powerUnit",
  "machineryTypeUne",
  "energyType",
  "repetitions",
  "duration",
] as const;

/** Reads the fields every kind of equipment has. */
function equipmentFields(f: Fields, check: Check, registrations: readonly string[]): Equipment {
  if (countGiven(f, registrations) !== 1) {
    f.ctx.report(
      "EXACTLY_ONE",
      f.path,
      `Identify the equipment by exactly one of ${registrations.join(", ")}.`,
    );
  }
  const powerUnit = optional(f, "powerUnit", intOf(99));
  check("unit", powerUnit, [...f.path, "powerUnit"]);
  const machineryTypeUne = optional(f, "machineryTypeUne", textOf(12));
  check("machineryTypeUne", machineryTypeUne, [...f.path, "machineryTypeUne"]);
  const energyType = optional(f, "energyType", intOf(99));
  check("energyType", energyType, [...f.path, "energyType"]);
  return {
    roma: optional(f, "roma", textOf(12)),
    own: optional(f, "own", bool),
    unregisteredId: optional(f, "unregisteredId", textOf(50)),
    power: optional(f, "power", decimalOf(6, 2)),
    powerUnit,
    machineryTypeUne,
    energyType,
    repetitions: optional(f, "repetitions", intOf(999)),
    duration: optional(f, "duration", decimalOf(6, 2)),
  } as Equipment;
}

const treatmentEquipment =
  (check: Check) =>
  (ctx: Context, value: unknown, path: Path): TreatmentEquipment | undefined => {
    const f = fieldsOf(ctx, value, path, [...EQUIPMENT_FIELDS, "reganip", "manual"]);
    if (f === undefined) {
      return undefined;
    }
    return build<TreatmentEquipment>({
      ...equipmentFields(f, check, ["roma", "reganip", "unregisteredId"]),
      reganip: optional(f, "reganip", textOf(12)),
      manual: required(f, "manual", bool),
    });
  };

const fertiliserEquipment =
  (check: Check) =>
  (ctx: Context, value: unknown, path: Path): FertiliserEquipment | undefined => {
    const f = fieldsOf(ctx, value, path, [...EQUIPMENT_FIELDS, "regfer"]);
    if (f === undefined) {
      return undefined;
    }
    return build<FertiliserEquipment>({
      ...equipmentFields(f, check, ["roma", "regfer", "unregisteredId"]),
      regfer: optional(f, "regfer", textOf(50)),
    });
  };

const targets =
  (check: Check) =>
  (ctx: Context, value: unknown, path: Path): TreatmentTargets | undefined => {
    const f = fieldsOf(ctx, value, path, ["diseases", "pests", "weeds", "regulators"]);
    if (f === undefined) {
      return undefined;
    }
    const diseases = optional(f, "diseases", intListOf(999, MAX_ITEMS));
    checkAll(check, "disease", diseases, [...path, "diseases"]);
    const pests = optional(f, "pests", intListOf(999, MAX_ITEMS));
    checkAll(check, "pest", pests, [...path, "pests"]);
    const weeds = optional(f, "weeds", intListOf(999, MAX_ITEMS));
    checkAll(check, "weed", weeds, [...path, "weeds"]);
    const regulators = optional(f, "regulators", intListOf(999, MAX_ITEMS));
    checkAll(check, "growthRegulator", regulators, [...path, "regulators"]);
    const total = [diseases, pests, weeds, regulators].reduce(
      (sum, list) => sum + (list?.length ?? 0),
      0,
    );
    if (total === 0) {
      ctx.report("AT_LEAST_ONE", path, "Name at least one disease, pest, weed or regulator.");
    }
    return build<TreatmentTargets>({ diseases, pests, weeds, regulators });
  };

const otherMeasure =
  (check: Check) =>
  (ctx: Context, value: unknown, path: Path): OtherProtectionMeasure | undefined => {
    const f = fieldsOf(ctx, value, path, [
      "type",
      "quantity",
      "unit",
      "mdfRegistration",
      "goodPractice",
    ]);
    if (f === undefined) {
      return undefined;
    }
    const type = required(f, "type", intOf(99));
    check("protectionMeasure", type, [...path, "type"]);
    const unit = optional(f, "unit", intOf(99));
    check("unit", unit, [...path, "unit"]);
    const goodPractice = optional(f, "goodPractice", intOf(99));
    check("protectionGoodPractice", goodPractice, [...path, "goodPractice"]);
    return build<OtherProtectionMeasure>({
      type,
      quantity: optional(f, "quantity", decimalOf(6, 2)),
      unit,
      mdfRegistration: optional(f, "mdfRegistration", textOf(10)),
      goodPractice,
    });
  };

const product =
  (check: Check) =>
  (ctx: Context, value: unknown, path: Path): TreatmentProduct | undefined => {
    const f = fieldsOf(ctx, value, path, [
      "type",
      "tradeName",
      "registrationNumber",
      "activeSubstance",
      "dose",
      "quantity",
      "unit",
    ]);
    if (f === undefined) {
      return undefined;
    }
    if (countGiven(f, ["dose", "quantity"]) !== 1) {
      ctx.report("EXACTLY_ONE", path, "Give either a dose or a quantity.");
    }
    const type = required(f, "type", intOf(9));
    check("productType", type, [...path, "type"]);
    const activeSubstance = optional(f, "activeSubstance", intOf(99_999));
    check("exceptionalAuthorisation", activeSubstance, [...path, "activeSubstance"]);
    const unit = required(f, "unit", intOf(99));
    check("unit", unit, [...path, "unit"]);
    return build<TreatmentProduct>({
      type,
      tradeName: required(f, "tradeName", textOf(250)),
      registrationNumber: optional(f, "registrationNumber", textOf(10)),
      activeSubstance,
      dose: optional(f, "dose", decimalOf(5, 3)),
      quantity: optional(f, "quantity", decimalOf(6, 2)),
      unit,
    });
  };

const applicator =
  (check: Check) =>
  (ctx: Context, value: unknown, path: Path): TreatmentApplicator | undefined => {
    const f = fieldsOf(ctx, value, path, ["ropo", "equipment"]);
    if (f === undefined) {
      return undefined;
    }
    return build<TreatmentApplicator>({
      ropo: required(f, "ropo", textOf(14)),
      equipment: required(f, "equipment", treatmentEquipment(check)),
    });
  };

const adviser = (ctx: Context, value: unknown, path: Path): TreatmentAdviser | undefined => {
  const f = fieldsOf(ctx, value, path, [
    "ropo",
    "date",
    "validated",
    "confirmed",
    "contract",
    "notes",
  ]);
  if (f === undefined) {
    return undefined;
  }
  return build<TreatmentAdviser>({
    ropo: required(f, "ropo", textOf(14)),
    date: optional(f, "date", date),
    validated: optional(f, "validated", bool),
    confirmed: optional(f, "confirmed", bool),
    contract: optional(f, "contract", bool),
    notes: optional(f, "notes", textOf(200)),
  });
};

/** Reads a list field of records, each read with `read`. */
const listOf =
  <T>(
    read: (ctx: Context, value: unknown, path: Path) => T | undefined,
    min: number,
    max: number,
  ) =>
  (ctx: Context, value: unknown, path: Path): readonly T[] | undefined => {
    const items = readList(ctx, value, path, min, max, (item, itemPath) =>
      read(ctx, item, itemPath),
    );
    return items === undefined ? undefined : Object.freeze(items);
  };

/** Reads an activity's identifier, its dates and its deletion flag. */
function activityHeader(
  f: Fields,
  idField = "id",
): {
  id: number | undefined;
  deleted: boolean | undefined;
} {
  return { id: required(f, idField, intOf(MAX_ID)), deleted: optional(f, "deleted", bool) };
}

function activityDates(f: Fields): { start: string | undefined; end: string | undefined } {
  const start = required(f, "start", date);
  const end = required(f, "end", date);
  dateOrder(f.ctx, start, end, [...f.path, "end"]);
  return { start, end };
}

function treatment(
  ctx: Context,
  catalogues: Catalogues,
  value: unknown,
  path: Path,
): Treatment | undefined {
  const f = fieldsOf(ctx, value, path, [
    "id",
    "deleted",
    "start",
    "end",
    "time",
    "dryingDate",
    "coverActivity",
    "dgcs",
    "targets",
    "justifications",
    "otherMeasure",
    "products",
    "applicators",
    "adviser",
    "efficacy",
    "notes",
  ]);
  if (f === undefined) {
    return undefined;
  }
  const { id, deleted } = activityHeader(f);
  return ctx.withRecord(id, () => {
    const { start, end } = activityDates(f);
    const check = checker(ctx, catalogues, start);
    const justifications = required(f, "justifications", intListOf(9, MAX_ITEMS, 1));
    checkAll(check, "justification", justifications, [...path, "justifications"]);
    const efficacy = required(f, "efficacy", intOf(9));
    check("efficacy", efficacy, [...path, "efficacy"]);
    const products = optional(f, "products", listOf(product(check), 0, MAX_ITEMS));
    const measure = optional(f, "otherMeasure", otherMeasure(check));
    // A products list that failed validation has been reported already.
    const noProducts = !f.values.has("products") || products?.length === 0;
    if (!f.values.has("otherMeasure") && noProducts) {
      ctx.report("AT_LEAST_ONE", path, "Give at least one product or another protection measure.");
    }
    return build<Treatment>({
      id,
      deleted,
      start,
      end,
      time: optional(f, "time", time),
      dryingDate: optional(f, "dryingDate", date),
      coverActivity: optional(f, "coverActivity", (c, v, p) => {
        if (v === "maintenance" || v === "removal") {
          return v;
        }
        c.report("INVALID_FORMAT", p, 'Expected "maintenance" or "removal".');
        return undefined;
      }),
      dgcs: dgcList(f, treatmentDgc(check)),
      targets: required(f, "targets", targets(check)),
      justifications,
      otherMeasure: measure,
      products,
      applicators: required(f, "applicators", listOf(applicator(check), 1, MAX_ITEMS)),
      adviser: optional(f, "adviser", adviser),
      efficacy,
      notes: optional(f, "notes", textOf(150)),
    });
  });
}

const nutrientShares =
  (check: Check, catalogue: CatalogueName) =>
  (ctx: Context, value: unknown, path: Path): readonly NutrientShare[] | undefined =>
    listOf(
      (c: Context, item: unknown, itemPath: Path): NutrientShare | undefined => {
        const f = fieldsOf(c, item, itemPath, ["type", "percent"]);
        if (f === undefined) {
          return undefined;
        }
        const type = required(f, "type", intOf(99));
        check(catalogue, type, [...itemPath, "type"]);
        return build<NutrientShare>({ type, percent: optional(f, "percent", decimalOf(3, 3)) });
      },
      0,
      MAX_ITEMS,
    )(ctx, value, path);

const material =
  (check: Check) =>
  (ctx: Context, value: unknown, path: Path): FertiliserMaterial | undefined => {
    const f = fieldsOf(ctx, value, path, [
      "type",
      "detail",
      "supplierName",
      "supplierNif",
      "rega",
      "nima",
      "manureTreatment",
      "macronutrients",
      "heavyMetals",
      "micronutrients",
      "density",
      "densityUnit",
    ]);
    if (f === undefined) {
      return undefined;
    }
    if (countGiven(f, ["supplierNif", "rega", "nima"]) > 1) {
      ctx.report("CONFLICT", path, "Give at most one of supplierNif, rega and nima.");
    }
    const type = required(f, "type", intOf(99));
    check("fertiliserMaterial", type, [...path, "type"]);
    const detail = optional(f, "detail", intOf(99_999));
    check("fertiliserMaterialDetail", detail, [...path, "detail"]);
    const manureTreatment = optional(f, "manureTreatment", intOf(99));
    check("manureTreatment", manureTreatment, [...path, "manureTreatment"]);
    const densityUnit = optional(f, "densityUnit", intOf(99));
    check("unit", densityUnit, [...path, "densityUnit"]);
    return build<FertiliserMaterial>({
      type,
      detail,
      supplierName: optional(f, "supplierName", textOf(150)),
      supplierNif: optional(f, "supplierNif", nif),
      rega: optional(f, "rega", textOf(14)),
      nima: optional(f, "nima", textOf(50)),
      manureTreatment,
      macronutrients: optional(f, "macronutrients", nutrientShares(check, "macronutrient")),
      heavyMetals: optional(f, "heavyMetals", nutrientShares(check, "heavyMetal")),
      micronutrients: optional(f, "micronutrients", nutrientShares(check, "micronutrient")),
      density: optional(f, "density", decimalOf(6, 2)),
      densityUnit,
    });
  };

const application =
  (check: Check) =>
  (ctx: Context, value: unknown, path: Path): FertiliserApplication | undefined => {
    const f = fieldsOf(ctx, value, path, [
      "productName",
      "sewageSludge",
      "type",
      "method",
      "dose",
      "unit",
      "serviceCompany",
    ]);
    if (f === undefined) {
      return undefined;
    }
    const type = required(f, "type", intOf(9));
    check("fertilisationType", type, [...path, "type"]);
    const method = required(f, "method", intOf(99));
    check("fertiliserApplicationMethod", method, [...path, "method"]);
    const unit = required(f, "unit", intOf(99));
    check("unit", unit, [...path, "unit"]);
    return build<FertiliserApplication>({
      productName: optional(f, "productName", textOf(250)),
      sewageSludge: required(f, "sewageSludge", bool),
      type,
      method,
      dose: required(f, "dose", decimalOf(8, 2)),
      unit,
      serviceCompany: optional(f, "serviceCompany", textOf(50)),
    });
  };

const fertigation =
  (check: Check) =>
  (ctx: Context, value: unknown, path: Path): Fertigation | undefined => {
    const f = fieldsOf(ctx, value, path, [
      "irrigationSystem",
      "quantity",
      "dose",
      "unit",
      "waterOrigins",
      "meter",
      "nitrogenDose",
      "nitrogenUnit",
      "phosphorusDose",
      "phosphorusUnit",
      "energyType",
    ]);
    if (f === undefined) {
      return undefined;
    }
    if (countGiven(f, ["quantity", "dose"]) === 0) {
      ctx.report("AT_LEAST_ONE", path, "Give the water's quantity or dose.");
    }
    const irrigationSystem = required(f, "irrigationSystem", intOf(9));
    check("irrigationSystem", irrigationSystem, [...path, "irrigationSystem"]);
    const units = ["unit", "nitrogenUnit", "phosphorusUnit"].map((name) => {
      const unit = required(f, name, intOf(99));
      check("unit", unit, [...path, name]);
      return unit;
    });
    const waterOrigins = optional(f, "waterOrigins", intListOf(9, MAX_ITEMS));
    checkAll(check, "waterOrigin", waterOrigins, [...path, "waterOrigins"]);
    const energyType = optional(f, "energyType", intOf(99));
    check("energyType", energyType, [...path, "energyType"]);
    return build<Fertigation>({
      irrigationSystem,
      quantity: optional(f, "quantity", decimalOf(8, 2)),
      dose: optional(f, "dose", decimalOf(8, 2)),
      unit: units[0],
      waterOrigins,
      meter: optional(f, "meter", textOf(14)),
      nitrogenDose: required(f, "nitrogenDose", decimalOf(3, 2)),
      nitrogenUnit: units[1],
      phosphorusDose: required(f, "phosphorusDose", decimalOf(3, 2)),
      phosphorusUnit: units[2],
      energyType,
    });
  };

function fertilisation(
  ctx: Context,
  catalogues: Catalogues,
  value: unknown,
  path: Path,
): Fertilisation | undefined {
  const f = fieldsOf(ctx, value, path, [
    "id",
    "deleted",
    "start",
    "end",
    "sustainableInputManagement",
    "goodPractices",
    "material",
    "application",
    "equipment",
    "irrigationGoodPractices",
    "fertigation",
    "dgcs",
  ]);
  if (f === undefined) {
    return undefined;
  }
  const { id, deleted } = activityHeader(f);
  return ctx.withRecord(id, () => {
    const { start, end } = activityDates(f);
    const check = checker(ctx, catalogues, start);
    const goodPractices = optional(f, "goodPractices", intListOf(99, MAX_ITEMS));
    checkAll(check, "fertiliserGoodPractice", goodPractices, [...path, "goodPractices"]);
    const irrigationGoodPractices = optional(f, "irrigationGoodPractices", intListOf(9, MAX_ITEMS));
    checkAll(check, "irrigationGoodPractice", irrigationGoodPractices, [
      ...path,
      "irrigationGoodPractices",
    ]);
    return build<Fertilisation>({
      id,
      deleted,
      start,
      end,
      sustainableInputManagement: optional(f, "sustainableInputManagement", bool),
      goodPractices,
      material: optional(f, "material", material(check)),
      application: optional(f, "application", application(check)),
      equipment: optional(f, "equipment", fertiliserEquipment(check)),
      irrigationGoodPractices,
      fertigation: optional(f, "fertigation", fertigation(check)),
      dgcs: dgcList(f, dgcWithArea),
    });
  });
}

function fertilisationPlan(
  ctx: Context,
  catalogues: Catalogues,
  value: unknown,
  path: Path,
): FertilisationPlan | undefined {
  const f = fieldsOf(ctx, value, path, [
    "id",
    "deleted",
    "nitrogenNeed",
    "phosphorusNeed",
    "potassiumNeed",
    "yieldTarget",
    "previousCrop",
    "toolUsed",
    "generatedOn",
    "dgcs",
  ]);
  if (f === undefined) {
    return undefined;
  }
  const { id, deleted } = activityHeader(f);
  return ctx.withRecord(id, () => {
    const generatedOn = required(f, "generatedOn", date);
    const previousCrop = required(f, "previousCrop", intOf(9999));
    checker(ctx, catalogues, generatedOn)("crop", previousCrop, [...path, "previousCrop"]);
    return build<FertilisationPlan>({
      id,
      deleted,
      nitrogenNeed: required(f, "nitrogenNeed", decimalOf(8, 2)),
      phosphorusNeed: required(f, "phosphorusNeed", decimalOf(8, 2)),
      potassiumNeed: required(f, "potassiumNeed", decimalOf(8, 2)),
      yieldTarget: required(f, "yieldTarget", decimalOf(8, 2)),
      previousCrop,
      toolUsed: required(f, "toolUsed", bool),
      generatedOn,
      dgcs: dgcList(f, dgcReference),
    });
  });
}

function irrigation(
  ctx: Context,
  catalogues: Catalogues,
  value: unknown,
  path: Path,
): Irrigation | undefined {
  const f = fieldsOf(ctx, value, path, [
    "id",
    "deleted",
    "start",
    "end",
    "system",
    "quantity",
    "unit",
    "waterOrigins",
    "energyType",
    "meter",
    "goodPractices",
    "dgcs",
  ]);
  if (f === undefined) {
    return undefined;
  }
  const { id, deleted } = activityHeader(f);
  return ctx.withRecord(id, () => {
    const { start, end } = activityDates(f);
    const check = checker(ctx, catalogues, start);
    const system = required(f, "system", intOf(99));
    check("irrigationSystem", system, [...path, "system"]);
    const unit = required(f, "unit", intOf(99));
    check("unit", unit, [...path, "unit"]);
    const waterOrigins = optional(f, "waterOrigins", intListOf(9, MAX_ITEMS));
    checkAll(check, "waterOrigin", waterOrigins, [...path, "waterOrigins"]);
    const energyType = optional(f, "energyType", intOf(99));
    check("energyType", energyType, [...path, "energyType"]);
    const goodPractices = optional(f, "goodPractices", intListOf(9, MAX_ITEMS));
    checkAll(check, "irrigationGoodPractice", goodPractices, [...path, "goodPractices"]);
    return build<Irrigation>({
      id,
      deleted,
      start,
      end,
      system,
      quantity: required(f, "quantity", decimalOf(6, 2)),
      unit,
      waterOrigins,
      energyType,
      meter: optional(f, "meter", textOf(14)),
      goodPractices,
      dgcs: dgcList(f, dgcWithArea),
    });
  });
}

/** Reads a whole logbook. */
export function readLogbook(
  ctx: Context,
  catalogues: Catalogues,
  value: unknown,
  path: Path,
): Logbook | undefined {
  const f = fieldsOf(ctx, value, path, [
    "holding",
    "cropDelimitations",
    "treatments",
    "fertilisations",
    "fertilisationPlans",
    "irrigations",
  ]);
  if (f === undefined) {
    return undefined;
  }
  // Reads one kind of record, reporting each identifier used twice.
  const records = <T>(
    name: string,
    read: (c: Context, cat: Catalogues, v: unknown, p: Path) => T | undefined,
    idField: "id" | "code",
  ): readonly T[] | undefined => {
    const seen = new Set<unknown>();
    return optional(
      f,
      name,
      listOf(
        (c, v, p) => {
          const record = read(c, catalogues, v, p);
          const id =
            record === undefined ? undefined : (record as Record<string, unknown>)[idField];
          if (id !== undefined && seen.has(id)) {
            c.report(
              "DUPLICATE_ID",
              [...p, idField],
              "Another record of this kind has the same identifier.",
            );
          }
          seen.add(id);
          return record;
        },
        0,
        MAX_RECORDS,
      ),
    );
  };
  return build<Logbook>({
    holding: required(f, "holding", (c, v, p) => holding(c, catalogues, v, p)),
    cropDelimitations: records("cropDelimitations", cropDelimitation, "code"),
    treatments: records("treatments", treatment, "id"),
    fertilisations: records("fertilisations", fertilisation, "id"),
    fertilisationPlans: records("fertilisationPlans", fertilisationPlan, "id"),
    irrigations: records("irrigations", irrigation, "id"),
  });
}
