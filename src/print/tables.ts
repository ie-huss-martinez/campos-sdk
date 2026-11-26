/**
 * The logbook as tables ([ADR 0006](../../docs/adr/0006-printable-logbook-as-html.md),
 * [ADR 0007](../../docs/adr/0007-csv-export.md)): which columns each kind of
 * record has, what each cell says and in what order the records come. The
 * HTML and CSV renderers only format these tables. Text is unescaped here;
 * each renderer escapes it for its own format.
 */
import { type CatalogueName, type Catalogues, codeKey, readCatalogues } from "../catalogues.ts";
import type { Result } from "../issues.ts";
import type {
  CropDelimitation,
  DgcReference,
  DgcWithArea,
  Equipment,
  Fertilisation,
  FertilisationPlan,
  Irrigation,
  Logbook,
  NutrientShare,
  OwnEquipment,
  Parcel,
  SoilAnalysis,
  StaffMember,
  Treatment,
  WaterSource,
} from "../model.ts";
import { Context } from "../validate/context.ts";
import { type DgcLabels, readDgcLabels } from "./labels.ts";

/** One cell: its lines of text, unescaped. */
export type Cell = readonly string[];

/** One table of the logbook. */
export interface Table {
  /** A file name for the table, without extension, such as `tratamientos`. */
  readonly file: string;
  readonly title: string;
  readonly headers: readonly string[];
  readonly rows: readonly (readonly Cell[])[];
}

/** The whole logbook, as tables. */
export interface Tabulated {
  readonly title: string;
  readonly holdingTitle: string;
  /** The holding's fields, as name and value. */
  readonly holding: ReadonlyArray<readonly [string, string]>;
  readonly tables: readonly Table[];
}

/** Labels for printed and exported documents. Both are untrusted, and validated first. */
export interface LabelOptions {
  /**
   * Catalogue snapshots whose entries have a `label`, the same shape
   * {@link validateLogbook} takes. A code is printed with its label when the
   * snapshot gives one, and as the bare code otherwise.
   */
  readonly catalogues?: unknown;
  /** Descriptions of crop delimitations, such as `{ dgc: "5", label: "Pol. 5, par. 120: trigo blando" }`. */
  readonly dgcs?: unknown;
}

/** `2027-01-15` becomes `15/01/2027`. */
const date = (iso: string): string => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

/** A period, or a single day when it starts and ends on the same day. */
const period = (start: string, end: string): string =>
  start === end ? date(start) : `${date(start)} – ${date(end)}`;

/** A number with a decimal comma, as Spanish documents write it, and no grouping. */
const number = (value: number): string => String(value).replace(".", ",");

const yesNo = (value: boolean): string => (value ? "Sí" : "No");

/** The lines of one cell, leaving out what is absent. */
const lines = (items: ReadonlyArray<string | undefined>): Cell =>
  Object.freeze(items.filter((item): item is string => item !== undefined && item !== ""));

/** Prints catalogue codes with their labels, when the snapshot gives them. */
export class Labeller {
  readonly catalogues: Catalogues;
  readonly dgcLabels: DgcLabels;
  readonly declared: ReadonlyMap<string, CropDelimitation>;

  constructor(
    catalogues: Catalogues,
    dgcLabels: DgcLabels,
    declared: ReadonlyMap<string, CropDelimitation>,
  ) {
    this.catalogues = catalogues;
    this.dgcLabels = dgcLabels;
    this.declared = declared;
  }

  /** `label (code)`, or the code alone. Unescaped. */
  label(catalogue: CatalogueName, code: number | string): string {
    const label = this.catalogues.get(catalogue)?.get(codeKey(code))?.label;
    return label === undefined ? String(code) : `${label} (${code})`;
  }

  /** `label (code)`, or the code after a word that names it, for a code that is text. */
  named(catalogue: CatalogueName, code: string, word: string): string {
    const label = this.catalogues.get(catalogue)?.get(codeKey(code))?.label;
    return label === undefined ? `${word} ${code}` : `${label} (${code})`;
  }

  /** Like {@link Labeller.label}, for an optional code. */
  code(catalogue: CatalogueName, code: number | string | undefined): string | undefined {
    return code === undefined ? undefined : this.label(catalogue, code);
  }

  codes(catalogue: CatalogueName, codes: readonly number[] | undefined): string[] {
    return (codes ?? []).map((code) => this.label(catalogue, code));
  }

  /** A crop delimitation, described by the application or, if declared here, by its SIGPAC reference. */
  dgc(reference: DgcReference): string {
    if ("dgc" in reference) {
      const base = this.dgcLabels.dgc.get(reference.dgc) ?? `DGC ${reference.dgc}`;
      return reference.cropRecord === undefined
        ? base
        : `${base} (cultivo del registro ${reference.cropRecord})`;
    }
    const label = this.dgcLabels.declaredDgc.get(reference.declaredDgc);
    if (label !== undefined) {
      return label;
    }
    const declared = this.declared.get(reference.declaredDgc);
    return declared === undefined
      ? `DGC propia ${reference.declaredDgc}`
      : `${sigpac(declared)}: ${this.code("crop", declared.crop)}`;
  }

  /** A crop delimitation with the area concerned. */
  dgcWithArea(reference: DgcWithArea): string {
    const area = reference.area === undefined ? "" : `, ${number(reference.area)} ha`;
    return `${this.dgc(reference)}${area}`;
  }
}

const sigpacText = (s: CropDelimitation["sigpac"]): string =>
  `SIGPAC ${s.province}:${s.municipality}:${s.aggregate}:${s.zone}:${s.polygon}:${s.parcel}:${s.enclosure}`;

const sigpac = (d: CropDelimitation): string => {
  const s = d.sigpac;
  return `SIGPAC ${s.province}:${s.municipality}:${s.aggregate}:${s.zone}:${s.polygon}:${s.parcel}:${s.enclosure}`;
};

/** Records in date order, then by identifier, leaving out deletion requests. */
const ordered = <T extends { readonly id: number; readonly deleted?: boolean }>(
  records: readonly T[] | undefined,
  dateOf: (record: T) => string,
): T[] =>
  (records ?? [])
    .filter((record) => record.deleted !== true)
    .sort((a, b) => (dateOf(a) < dateOf(b) ? -1 : dateOf(a) > dateOf(b) ? 1 : a.id - b.id));

const equipment = (
  e: Equipment & { readonly reganip?: string; readonly regfer?: string },
): string =>
  e.roma !== undefined
    ? `ROMA ${e.roma}`
    : e.reganip !== undefined
      ? `REGANIP ${e.reganip}`
      : e.regfer !== undefined
        ? `REGFER ${e.regfer}`
        : `${e.unregisteredId}`;

const PROTECTED_AREA = { none: "No", partial: "Parcialmente", whole: "Totalmente" } as const;
const LAND_USE = { crop: "Cultivo", pasture: "Pastos", forestry: "Forestal" } as const;

function staffRow(m: StaffMember): Cell[] {
  return [
    lines([m.name]),
    lines([m.nif]),
    lines([m.ropo === undefined ? undefined : `ROPO ${m.ropo}`]),
    lines([m.qualification === "adviser" ? "Asesor" : "Usuario profesional"]),
  ];
}

const waterRow = (kind: string, w: WaterSource): Cell[] => [
  lines([kind]),
  lines([w.name]),
  lines([w.distance === undefined ? undefined : number(w.distance)]),
];

function ownEquipmentRow(e: OwnEquipment): Cell[] {
  return [
    lines([e.name]),
    lines([
      e.roma === undefined ? undefined : `ROMA ${e.roma}`,
      e.censusReference === undefined ? undefined : `Censo ${e.censusReference}`,
    ]),
    lines([e.acquiredOn === undefined ? undefined : date(e.acquiredOn)]),
    lines([e.lastInspectedOn === undefined ? undefined : date(e.lastInspectedOn)]),
  ];
}

function parcelRow(p: Parcel, l: Labeller): Cell[] {
  return [
    lines([`Parcela ${p.number}`]),
    lines([sigpacText(p.sigpac)]),
    lines([number(p.area)]),
    lines([
      l.label("sigpacUse", p.sigpacUse),
      LAND_USE[p.landUse],
      l.code("crop", p.crop),
      l.code("variety", p.variety),
    ]),
    lines([
      p.irrigated ? "Regadío" : "Secano",
      l.code("irrigationSystem", p.irrigationSystem),
      p.protectedCultivation ? "Protegido" : "Al aire libre",
      p.protectionType,
    ]),
    lines([p.certification]),
  ];
}

const METALS = [
  ["Cd", "cadmium"],
  ["Cu", "copper"],
  ["Ni", "nickel"],
  ["Pb", "lead"],
  ["Zn", "zinc"],
  ["Hg", "mercury"],
  ["Cr", "chromium"],
] as const;

function soilRow(a: SoilAnalysis, l: Labeller): Cell[] {
  const metal = (symbol: string, value: number | undefined): string | undefined =>
    value === undefined ? undefined : `${symbol}: ${number(value)}`;
  const percent = (name: string, value: number | undefined): string | undefined =>
    value === undefined ? undefined : `${name}: ${number(value)} %`;
  return [
    lines([date(a.date)]),
    lines(
      a.source === "map"
        ? ["Mapas o registros provinciales"]
        : [
            "Análisis",
            l.code("analysedMaterial", a.material),
            a.laboratory,
            a.laboratoryNif === undefined ? undefined : `NIF ${a.laboratoryNif}`,
            a.reportNumber === undefined ? undefined : `Boletín ${a.reportNumber}`,
          ],
    ),
    lines((a.dgcs ?? []).map((dgc) => l.dgc(dgc))),
    lines([a.ph === undefined ? undefined : number(a.ph)]),
    lines([a.organicMatter === undefined ? undefined : number(a.organicMatter)]),
    lines([a.phosphorus === undefined ? undefined : number(a.phosphorus)]),
    lines([a.potassium === undefined ? undefined : number(a.potassium)]),
    lines([
      percent("N total", a.nitrogen),
      percent("Arena", a.sand),
      percent("Limo", a.silt),
      percent("Arcilla", a.clay),
      a.conductivity === undefined ? undefined : `Conductividad: ${number(a.conductivity)} dS/m`,
      ...l.codes("analysisType", a.analysisTypes),
      ...l.codes("analysedSubstance", a.substances),
    ]),
    lines(METALS.map(([symbol, name]) => metal(symbol, a.heavyMetals?.[name]))),
  ];
}

function holdingRows(h: Logbook["holding"], l: Labeller): ReadonlyArray<readonly [string, string]> {
  const rows: Array<readonly [string, string | undefined]> = [
    ["Nombre de la explotación", h.name],
    ["Dirección", h.address],
    ["Código REA", h.reaCode],
    ["Código SIEX", h.siexCode],
    ["Titular", h.holderName],
    ["NIF del titular", h.holderNif],
    ["NIF de la unidad gestora", h.managingUnitNif],
    // Identifiers are written with a word that names them, so a spreadsheet
    // never reads one as a number (ADR 0007).
    ["Organismo pagador", l.named("payingAgency", h.payingAgency, "Código")],
    [
      "Entidad de asesoramiento",
      h.advisoryEntity === undefined
        ? undefined
        : [h.advisoryEntity.name, h.advisoryEntity.registration].filter(Boolean).join(", "),
    ],
    [
      "En zonas protegidas (art. 35)",
      h.protectedArea === undefined ? undefined : PROTECTED_AREA[h.protectedArea],
    ],
  ];
  return rows.filter((row): row is readonly [string, string] => row[1] !== undefined);
}

function delimitationsTable(records: readonly CropDelimitation[], l: Labeller): Table {
  return {
    file: "parcelas-declaradas",
    title: "Parcelas declaradas por la explotación",
    headers: [
      "Código",
      "Referencia SIGPAC",
      "Referencia catastral",
      "Superficie (ha)",
      "Cultivo y variedad",
      "Sistema de cultivo",
      "Vigencia",
    ],
    rows: records
      .filter((d) => d.deleted !== true)
      .map((d) => [
        lines([`DGC propia ${d.code}`]),
        lines([sigpac(d)]),
        lines([d.cadastralReference]),
        lines([d.area === undefined ? undefined : number(d.area)]),
        lines([l.code("crop", d.crop), l.code("variety", d.variety)]),
        lines([d.irrigated ? "Regadío" : "Secano", l.code("croppingSystem", d.croppingSystem)]),
        lines([d.to === undefined ? `Desde ${date(d.from)}` : period(d.from, d.to)]),
      ]),
  };
}

function treatmentRow(t: Treatment, l: Labeller): Cell[] {
  const targets = [
    ...l.codes("disease", t.targets.diseases),
    ...l.codes("pest", t.targets.pests),
    ...l.codes("weed", t.targets.weeds),
    ...l.codes("growthRegulator", t.targets.regulators),
  ];
  const people = [
    ...t.applicators.map((a) => `Aplicador: ROPO ${a.ropo}`),
    t.adviser === undefined
      ? undefined
      : `Asesor: ROPO ${t.adviser.ropo}${t.adviser.date === undefined ? "" : `, ${date(t.adviser.date)}`}`,
  ];
  const products = [
    ...(t.products ?? []).map((p) =>
      p.registrationNumber !== undefined
        ? `${p.tradeName} (nº de registro ${p.registrationNumber})`
        : p.activeSubstance !== undefined
          ? `${p.tradeName} (${l.code("exceptionalAuthorisation", p.activeSubstance)})`
          : p.tradeName,
    ),
    t.otherMeasure === undefined
      ? undefined
      : `Otra medida: ${l.code("protectionMeasure", t.otherMeasure.type)}`,
  ];
  const amounts = [
    // Validation guarantees each product has a dose or a quantity, not both.
    ...(t.products ?? []).map((p) =>
      p.dose === undefined
        ? `Cantidad: ${number(p.quantity as number)} ${l.label("unit", p.unit)}`
        : `Dosis: ${number(p.dose)} ${l.label("unit", p.unit)}`,
    ),
    t.otherMeasure?.quantity === undefined
      ? undefined
      : [number(t.otherMeasure.quantity), l.code("unit", t.otherMeasure.unit)]
          .filter(Boolean)
          .join(" "),
  ];
  const equipmentLines = t.applicators.map(
    (a) => `${equipment(a.equipment)}${a.equipment.manual ? ", aplicación manual" : ""}`,
  );
  const notes = [
    ...l.codes("justification", t.justifications).map((j) => `Justificación: ${j}`),
    t.dryingDate === undefined ? undefined : `Fecha seca: ${date(t.dryingDate)}`,
    t.notes,
  ];
  return [
    lines([period(t.start, t.end), t.time]),
    lines(t.dgcs.map((dgc) => l.dgc(dgc))),
    lines(targets),
    lines(people),
    lines(t.dgcs.map((dgc) => (dgc.area === undefined ? "Toda la DGC" : `${number(dgc.area)} ha`))),
    lines(products),
    lines(equipmentLines),
    lines(amounts),
    lines([l.code("efficacy", t.efficacy)]),
    lines(notes),
  ];
}

const shares = (
  l: Labeller,
  catalogue: CatalogueName,
  list: readonly NutrientShare[] | undefined,
): string[] =>
  (list ?? []).map((share) =>
    share.percent === undefined
      ? `${l.code(catalogue, share.type)}`
      : `${l.code(catalogue, share.type)}: ${number(share.percent)} %`,
  );

function fertilisationRow(f: Fertilisation, l: Labeller): Cell[] {
  const m = f.material;
  const a = f.application;
  const g = f.fertigation;
  const supplier = [
    m?.supplierName,
    m?.rega === undefined ? undefined : `REGA ${m.rega}`,
    m?.supplierNif === undefined ? undefined : `NIF ${m.supplierNif}`,
    m?.nima === undefined ? undefined : `NIMA ${m.nima}`,
  ];
  const water =
    g === undefined
      ? []
      : [
          g.quantity === undefined
            ? undefined
            : `Agua: ${number(g.quantity)} ${l.code("unit", g.unit)}`,
          g.dose === undefined
            ? undefined
            : `Dosis de riego: ${number(g.dose)} ${l.code("unit", g.unit)}`,
          `N nítrico: ${number(g.nitrogenDose)} ${l.code("unit", g.nitrogenUnit)}`,
          `P₂O₅: ${number(g.phosphorusDose)} ${l.code("unit", g.phosphorusUnit)}`,
        ];
  return [
    lines([period(f.start, f.end)]),
    lines(f.dgcs.map((dgc) => l.dgcWithArea(dgc))),
    lines([l.code("fertilisationType", a?.type)]),
    lines([
      l.code("fertiliserMaterial", m?.type),
      l.code("fertiliserMaterialDetail", m?.detail),
      a?.productName,
    ]),
    lines(supplier),
    lines([
      l.code("fertiliserApplicationMethod", a?.method),
      g === undefined
        ? undefined
        : `Fertirrigación: ${l.code("irrigationSystem", g.irrigationSystem)}`,
    ]),
    lines([f.equipment === undefined ? undefined : equipment(f.equipment)]),
    lines([
      ...shares(l, "macronutrient", m?.macronutrients),
      ...shares(l, "micronutrient", m?.micronutrients),
    ]),
    lines([
      a?.sewageSludge === true ? "Lodos de depuración" : undefined,
      ...shares(l, "heavyMetal", m?.heavyMetals),
    ]),
    lines([a === undefined ? undefined : `${number(a.dose)} ${l.code("unit", a.unit)}`]),
    lines([a?.serviceCompany === undefined ? undefined : `REGFER ${a.serviceCompany}`]),
    lines(water),
  ];
}

function irrigationRow(r: Irrigation, l: Labeller): Cell[] {
  return [
    lines([period(r.start, r.end)]),
    lines(r.dgcs.map((dgc) => l.dgcWithArea(dgc))),
    lines([l.code("irrigationSystem", r.system)]),
    lines([`${number(r.quantity)} ${l.code("unit", r.unit)}`]),
    lines(l.codes("waterOrigin", r.waterOrigins)),
    lines([
      r.meter === undefined ? undefined : `Contador ${r.meter}`,
      l.code("energyType", r.energyType),
    ]),
    lines(l.codes("irrigationGoodPractice", r.goodPractices)),
  ];
}

function planRow(p: FertilisationPlan, l: Labeller): Cell[] {
  return [
    lines([date(p.generatedOn)]),
    lines(p.dgcs.map((dgc) => l.dgc(dgc))),
    lines([l.code("crop", p.previousCrop)]),
    lines([number(p.yieldTarget)]),
    lines([number(p.nitrogenNeed)]),
    lines([number(p.phosphorusNeed)]),
    lines([number(p.potassiumNeed)]),
    lines([yesNo(p.toolUsed)]),
  ];
}

/** The logbook as tables: the holding, then one table per kind of record. */
export function tabulate(logbook: Logbook, l: Labeller): Tabulated {
  const table = (
    file: string,
    title: string,
    headers: readonly string[],
    rows: readonly (readonly Cell[])[],
  ): Table => ({ file, title, headers, rows });
  const tables: Table[] = [
    table(
      "tratamientos",
      "B. Tratamientos fitosanitarios",
      [
        "a. Fecha",
        "b. Parcela y cultivo (e)",
        "c. Plaga o problema",
        "d. Aplicador y asesor",
        "f. Superficie tratada",
        "g. Producto o medida",
        "h. Equipo",
        "i. Cantidad",
        "j. Eficacia",
        "k. Observaciones",
      ],
      ordered(logbook.treatments, (t) => t.start).map((t) => treatmentRow(t, l)),
    ),
    table(
      "fertilizacion",
      "C. Fertilización",
      [
        "a. Fecha",
        "b. Superficie",
        "c. Tipo de tratamiento",
        "d. Material",
        "e. Suministrador",
        "f. Forma de aplicación",
        "g. Máquina",
        "h. Valor agronómico",
        "i. Metales pesados",
        "j. Dosis",
        "k. Empresa de servicios",
        "l. Agua de riego",
      ],
      ordered(logbook.fertilisations, (f) => f.start).map((f) => fertilisationRow(f, l)),
    ),
    table(
      "riego",
      "C. Riego",
      [
        "Fecha",
        "Parcela y superficie",
        "Sistema de riego",
        "Agua aplicada",
        "Origen del agua",
        "Contador y energía",
        "Buenas prácticas",
      ],
      ordered(logbook.irrigations, (r) => r.start).map((r) => irrigationRow(r, l)),
    ),
    table(
      "plan-de-abonado",
      "Plan de abonado",
      [
        "Fecha",
        "Parcela",
        "Cultivo precedente",
        "Objetivo de producción (kg/ha)",
        "N (UF/ha)",
        "P₂O₅ (UF/ha)",
        "K₂O (UF/ha)",
        "Herramienta",
      ],
      ordered(logbook.fertilisationPlans, (p) => p.generatedOn).map((p) => planRow(p, l)),
    ),
  ];
  const h = logbook.holding;
  const delimitations = logbook.cropDelimitations ?? [];
  const partA: Table[] = [
    table(
      "personal",
      "A.1.c. Personal propio con carné de usuario profesional o asesor",
      ["Nombre", "NIF", "ROPO", "Condición"],
      (h.staff ?? []).map(staffRow),
    ),
    table(
      "agua-consumo-humano",
      "A.1.f y g. Agua para consumo humano",
      ["Tipo", "Nombre", "Distancia, fuera de la parcela (m)"],
      [
        ...(h.waterBodies ?? []).map((w) => waterRow("Masa de agua (art. 33.a)", w)),
        ...(h.abstractionPoints ?? []).map((w) => waterRow("Punto de captación (art. 33.b)", w)),
      ],
    ),
    table(
      "equipos-propios",
      "A.1.h. Equipos de aplicación propios",
      ["Equipo", "Registro o censo", "Fecha de adquisición", "Última inspección"],
      (h.ownEquipment ?? []).map(ownEquipmentRow),
    ),
    table(
      "parcelas",
      "A.2. Parcelas",
      [
        "a. Número",
        "b. Referencia SIGPAC",
        "c. Superficie (ha)",
        "d. Uso SIGPAC, aprovechamiento y cultivo",
        "e. Sistema de cultivo",
        "f. Certificación",
      ],
      [...(logbook.parcels ?? [])].sort((a, b) => a.number - b.number).map((p) => parcelRow(p, l)),
    ),
    ...(delimitations.length > 0 ? [delimitationsTable(delimitations, l)] : []),
    table(
      "suelo",
      "A.3. Características del suelo",
      [
        "Fecha",
        "Origen",
        "Parcela",
        "pH",
        "Materia orgánica (%)",
        "Fósforo asimilable (ppm)",
        "Potasio asimilable (ppm)",
        "Otros parámetros",
        "Metales pesados (mg/kg)",
      ],
      ordered(logbook.soilAnalyses, (a) => a.date).map((a) => soilRow(a, l)),
    ),
  ];
  tables.unshift(...partA);
  return {
    title: `Cuaderno de explotación ${logbook.holding.reaCode}`,
    holdingTitle: "A. Datos generales de la explotación",
    holding: holdingRows(logbook.holding, l),
    tables,
  };
}

/** Validates the label options and builds the labeller for a logbook. */
export function readLabeller(logbook: Logbook, options: LabelOptions): Result<Labeller> {
  const ctx = new Context();
  const snapshot = options.catalogues;
  const dgcs = options.dgcs;
  const catalogues =
    snapshot === undefined ? new Map() : readCatalogues(ctx, snapshot, ["options", "catalogues"]);
  const dgcLabels =
    dgcs === undefined
      ? { dgc: new Map(), declaredDgc: new Map() }
      : readDgcLabels(ctx, dgcs, ["options", "dgcs"]);
  if (ctx.issues.length > 0) {
    return { ok: false, issues: Object.freeze([...ctx.issues]) };
  }
  const declared = new Map((logbook.cropDelimitations ?? []).map((d) => [d.code, d] as const));
  return { ok: true, value: new Labeller(catalogues, dgcLabels, declared), issues: [] };
}
