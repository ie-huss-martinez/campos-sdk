import type { PathSegment } from "./issues.ts";
import { type Context, readList, readObject } from "./validate/context.ts";
import { isoDate, text } from "./validate/fields.ts";

/**
 * The catalogues the model's codes come from, under the library's own names.
 * Each comment gives the catalogue as Anexo VI's descriptor (3.11.4) names it.
 * The application maps its snapshot of FEGA's catalogues to these names.
 */
export const CATALOGUE_NAMES = [
  /** "Organismo pagador": `Holding.payingAgency`. */
  "payingAgency",
  /** "Producto": crops, previous crops, nursery products. */
  "crop",
  /** "Variedad / Especie / Tipo". */
  "variety",
  /** "LV-170 Sistema de Cultivo". */
  "croppingSystem",
  /** "Estado fenológico". */
  "phenologicalStage",
  /** "Tipo de cobertura". */
  "coverType",
  /** "Enfermedades". */
  "disease",
  /** "Plagas". */
  "pest",
  /** "Malas Hierbas". */
  "weed",
  /** "Reguladores del crecimiento y otros". */
  "growthRegulator",
  /** "Justificación de la Actuación". */
  "justification",
  /** "Tipo de Medida Fitosanitaria". */
  "protectionMeasure",
  /** "Buenas prácticas", of a non-chemical measure. */
  "protectionGoodPractice",
  /** "Tipos de producto". */
  "productType",
  /** "Autorizaciones excepcionales": active substances. */
  "exceptionalAuthorisation",
  /** "Unidades de Medida". */
  "unit",
  /** "Eficacia del tratamiento". */
  "efficacy",
  /** "Tipo de maquinaria UNE". Its codes are text. */
  "machineryTypeUne",
  /** "Tipo de energía". */
  "energyType",
  /** "Buenas prácticas fertilizantes". */
  "fertiliserGoodPractice",
  /** "Tipo material fertilizante". */
  "fertiliserMaterial",
  /** "Detalle de material fertilizante". */
  "fertiliserMaterialDetail",
  /** "Tratamiento de estiércoles". */
  "manureTreatment",
  /** "CAT-870 Macronutrientes". */
  "macronutrient",
  /** "CAT-880 Micronutrientes". */
  "micronutrient",
  /** "CAT-890 Metales pesados". */
  "heavyMetal",
  /** "Tipo Fertilización". */
  "fertilisationType",
  /** "Método de aplicación de fertilizante". */
  "fertiliserApplicationMethod",
  /** "Buenas prácticas de riego". */
  "irrigationGoodPractice",
  /** "Sistema de Riego". */
  "irrigationSystem",
  /** "Origen del agua de riego". */
  "waterOrigin",
] as const;

/** The name of a catalogue the model's codes come from. */
export type CatalogueName = (typeof CATALOGUE_NAMES)[number];

/** One code of a catalogue, as the application's snapshot holds it. */
export interface CatalogueEntry {
  /** The code: a number, or text for catalogues whose codes are text. */
  readonly code: number | string;
  /** The date the code was retired (`Fecha de baja`), `YYYY-MM-DD`. Retired codes stay in the catalogue. */
  readonly retiredOn?: string;
  /** The code's name, as the catalogue gives it, for printed documents. Up to 250 characters. */
  readonly label?: string;
}

/**
 * The catalogues the application has, by name. Validation checks every code
 * of a catalogue given here; a catalogue left out isn't checked.
 */
export type CatalogueSnapshot = Partial<Record<CatalogueName, readonly CatalogueEntry[]>>;

/** At most this many codes per catalogue. */
export const MAX_CATALOGUE_ENTRIES = 200_000;

/** A code's key: numbers and digit text compare by value, so 5 matches "05". */
export const codeKey = (code: number | string): string =>
  typeof code === "number" ? String(code) : /^\d{1,16}$/.test(code) ? String(Number(code)) : code;

export interface CatalogueCode {
  /** The retirement date, or null when the code is current. */
  readonly retiredOn: string | null;
  /** The code's name, when the snapshot gives one. */
  readonly label: string | undefined;
}

/** A validated snapshot: for each catalogue, each code's details by its key. */
export type Catalogues = ReadonlyMap<CatalogueName, ReadonlyMap<string, CatalogueCode>>;

/** Validates a snapshot the application supplied. It is untrusted input too. */
export function readCatalogues(
  ctx: Context,
  value: unknown,
  path: readonly PathSegment[],
): Catalogues {
  const out = new Map<CatalogueName, Map<string, CatalogueCode>>();
  const fields = readObject(ctx, value, path, CATALOGUE_NAMES);
  for (const name of CATALOGUE_NAMES) {
    const entries = fields?.get(name);
    if (entries === undefined) {
      continue;
    }
    const codes = new Map<string, CatalogueCode>();
    readList(ctx, entries, [...path, name], 0, MAX_CATALOGUE_ENTRIES, (entry, entryPath) => {
      const entryFields = readObject(ctx, entry, entryPath, ["code", "retiredOn", "label"]);
      const code = entryFields?.get("code");
      if (entryFields === undefined) {
        return undefined;
      }
      let entryKey: string | undefined;
      if (typeof code === "number" && Number.isSafeInteger(code) && code >= 0) {
        entryKey = codeKey(code);
      } else if (code === undefined) {
        ctx.report("REQUIRED", [...entryPath, "code"], "A catalogue entry needs a code.");
      } else {
        const textCode = text(ctx, code, [...entryPath, "code"], { max: 32 });
        entryKey = textCode === undefined ? undefined : codeKey(textCode);
      }
      const retired = entryFields.get("retiredOn");
      const retiredOn =
        retired === undefined ? null : (isoDate(ctx, retired, [...entryPath, "retiredOn"]) ?? null);
      const label = entryFields.has("label")
        ? text(ctx, entryFields.get("label"), [...entryPath, "label"], { max: 250 })
        : undefined;
      if (entryKey !== undefined) {
        codes.set(entryKey, Object.freeze({ retiredOn, label }));
      }
      return entryKey;
    });
    out.set(name, codes);
  }
  return out;
}

/**
 * Checks a code against its catalogue, when the application supplied it. A
 * code retired on or before `onDate`, the record's date, is reported.
 */
export function checkCode(
  ctx: Context,
  catalogues: Catalogues,
  name: CatalogueName,
  code: number | string | undefined,
  path: readonly PathSegment[],
  onDate: string | undefined,
): void {
  const codes = catalogues.get(name);
  if (codes === undefined || code === undefined) {
    return;
  }
  const retiredOn = codes.get(codeKey(code))?.retiredOn;
  if (retiredOn === undefined) {
    ctx.report("UNKNOWN_CODE", path, `The code isn't in the "${name}" catalogue supplied.`);
  } else if (retiredOn !== null && onDate !== undefined && retiredOn <= onDate) {
    ctx.report(
      "RETIRED_CODE",
      path,
      `The code was retired from the "${name}" catalogue on or before the record's date.`,
    );
  }
}
