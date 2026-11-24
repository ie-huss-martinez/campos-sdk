/**
 * The printable logbook ([ADR 0006](../../docs/adr/0006-printable-logbook-as-html.md)):
 * one self-contained HTML document with the fields of RD 1311/2012, Annex
 * III, Part I, for a person to read, print or save as PDF. Its text is in
 * Spanish, the language of the regulation and of the inspectors who read it.
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
  Treatment,
  ValidLogbook,
} from "../model.ts";
import { Context } from "../validate/context.ts";
import { type DgcLabels, readDgcLabels } from "./labels.ts";

/** The printed logbook. */
export interface LogbookHtml {
  /** A complete HTML document. The same logbook and labels always give the same text. */
  readonly html: string;
}

/** Options for {@link renderLogbookHtml}. Both are untrusted, and validated first. */
export interface RenderHtmlOptions {
  /**
   * Catalogue snapshots whose entries have a `label`, the same shape
   * {@link validateLogbook} takes. A code is printed with its label when the
   * snapshot gives one, and as the bare code otherwise.
   */
  readonly catalogues?: unknown;
  /** Descriptions of crop delimitations, such as `{ dgc: "5", label: "Pol. 5, par. 120: trigo blando" }`. */
  readonly dgcs?: unknown;
}

/** The document's stylesheet. Its hash is in the document's content security policy. */
export const STYLE: string = [
  "@page{size:A4 landscape;margin:12mm}",
  "body{font:9pt/1.35 system-ui,sans-serif;color:#000;background:#fff;margin:0}",
  "h1{font-size:14pt;margin:0 0 4mm}",
  "h2{font-size:11pt;margin:6mm 0 2mm;break-after:avoid}",
  "table{width:100%;border-collapse:collapse}",
  "th,td{border:0.5pt solid #000;padding:1mm 1.5mm;text-align:left;vertical-align:top}",
  "thead th,tbody th{background:#eee}",
  "thead{display:table-header-group}",
  "tr{break-inside:avoid}",
  ".holding th{width:30%}",
].join("");

/** The SHA-256 of {@link STYLE}, base64. A test checks that it matches. */
export const STYLE_HASH = "sha256-EDIKwQ5iElZvFkSAw11uonVmgW853tKC/QRnnpKzgcs=";

/** No script, no request, no form: only the stylesheet above. */
const CSP = `default-src 'none'; style-src '${STYLE_HASH}'; base-uri 'none'; form-action 'none'`;

/** Escapes text for HTML content and attribute values. */
export const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

/** `2027-01-15` becomes `15/01/2027`. */
const date = (iso: string): string => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

/** A period, or a single day when it starts and ends on the same day. */
const period = (start: string, end: string): string =>
  start === end ? date(start) : `${date(start)} – ${date(end)}`;

/** A number with a decimal comma, as Spanish documents write it, and no grouping. */
const number = (value: number): string => String(value).replace(".", ",");

const yesNo = (value: boolean): string => (value ? "Sí" : "No");

/** Escaped lines in one cell. */
const lines = (items: ReadonlyArray<string | undefined>): string =>
  items
    .filter((item): item is string => item !== undefined && item !== "")
    .map(escapeHtml)
    .join("<br>");

/** Prints catalogue codes with their labels, when the snapshot gives them. */
class Labeller {
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
      return this.dgcLabels.dgc.get(reference.dgc) ?? `DGC ${reference.dgc}`;
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

const sigpac = (d: CropDelimitation): string => {
  const s = d.sigpac;
  return `SIGPAC ${s.province}:${s.municipality}:${s.aggregate}:${s.zone}:${s.polygon}:${s.parcel}:${s.enclosure}`;
};

/** A table with a heading row. Cells are already HTML; headers are escaped here. */
const table = (headers: readonly string[], rows: readonly (readonly string[])[]): string => {
  const head = `<thead><tr>${headers.map((h) => `<th scope="col">${escapeHtml(h)}</th>`).join("")}</tr></thead>`;
  const body =
    rows.length === 0
      ? `<tr><td colspan="${headers.length}">Sin registros.</td></tr>`
      : rows
          .map((cells) => `<tr>${cells.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
          .join("");
  return `<table>${head}<tbody>${body}</tbody></table>`;
};

const section = (title: string, content: string): string =>
  `<section><h2>${escapeHtml(title)}</h2>${content}</section>`;

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

function holdingSection(h: Logbook["holding"], l: Labeller): string {
  const rows: Array<[string, string | undefined]> = [
    ["Nombre de la explotación", h.name],
    ["Dirección", h.address],
    ["Código REA", h.reaCode],
    ["Código SIEX", h.siexCode],
    ["Titular", h.holderName],
    ["NIF del titular", h.holderNif],
    ["NIF de la unidad gestora", h.managingUnitNif],
    ["Organismo pagador", l.code("payingAgency", h.payingAgency)],
  ];
  const body = rows
    .filter((row): row is [string, string] => row[1] !== undefined)
    .map(
      ([name, value]) =>
        `<tr><th scope="row">${escapeHtml(name)}</th><td>${escapeHtml(value)}</td></tr>`,
    )
    .join("");
  return section(
    "A. Datos generales de la explotación",
    `<table class="holding"><tbody>${body}</tbody></table>`,
  );
}

function delimitationsSection(records: readonly CropDelimitation[], l: Labeller): string {
  const rows = records
    .filter((d) => d.deleted !== true)
    .map((d) => [
      lines([d.code]),
      lines([sigpac(d)]),
      lines([d.cadastralReference]),
      lines([d.area === undefined ? undefined : number(d.area)]),
      lines([l.code("crop", d.crop), l.code("variety", d.variety)]),
      lines([d.irrigated ? "Regadío" : "Secano", l.code("croppingSystem", d.croppingSystem)]),
      lines([d.to === undefined ? `Desde ${date(d.from)}` : period(d.from, d.to)]),
    ]);
  return section(
    "Parcelas declaradas por la explotación",
    table(
      [
        "Código",
        "Referencia SIGPAC",
        "Referencia catastral",
        "Superficie (ha)",
        "Cultivo y variedad",
        "Sistema de cultivo",
        "Vigencia",
      ],
      rows,
    ),
  );
}

function treatmentRow(t: Treatment, l: Labeller): string[] {
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

function fertilisationRow(f: Fertilisation, l: Labeller): string[] {
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

function irrigationRow(r: Irrigation, l: Labeller): string[] {
  return [
    lines([period(r.start, r.end)]),
    lines(r.dgcs.map((dgc) => l.dgcWithArea(dgc))),
    lines([l.code("irrigationSystem", r.system)]),
    lines([`${number(r.quantity)} ${l.code("unit", r.unit)}`]),
    lines(l.codes("waterOrigin", r.waterOrigins)),
    lines([r.meter, l.code("energyType", r.energyType)]),
    lines(l.codes("irrigationGoodPractice", r.goodPractices)),
  ];
}

function planRow(p: FertilisationPlan, l: Labeller): string[] {
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

function document(logbook: Logbook, l: Labeller): string {
  const h = logbook.holding;
  const sections = [
    holdingSection(h, l),
    logbook.cropDelimitations === undefined || logbook.cropDelimitations.length === 0
      ? ""
      : delimitationsSection(logbook.cropDelimitations, l),
    section(
      "B. Tratamientos fitosanitarios",
      table(
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
    ),
    section(
      "C. Fertilización",
      table(
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
    ),
    section(
      "C. Riego",
      table(
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
    ),
    section(
      "Plan de abonado",
      table(
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
    ),
  ];
  return [
    "<!doctype html>",
    '<html lang="es">',
    "<head>",
    '<meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="${escapeHtml(CSP)}">`,
    `<title>Cuaderno de explotación ${escapeHtml(h.reaCode)}</title>`,
    `<style>${STYLE}</style>`,
    "</head>",
    "<body>",
    `<h1>Cuaderno de explotación ${escapeHtml(h.reaCode)}</h1>`,
    ...sections.filter((s) => s !== ""),
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

/**
 * Renders a validated logbook as a printable HTML document, with the fields
 * of RD 1311/2012, Annex III, Part I. Every value is escaped; the document
 * has no script and loads nothing. Records that only ask the administration
 * to delete something are left out.
 */
export function renderLogbookHtml(
  logbook: ValidLogbook,
  options: RenderHtmlOptions = {},
): Result<LogbookHtml> {
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
  const html = document(logbook, new Labeller(catalogues, dgcLabels, declared));
  return { ok: true, value: Object.freeze({ html }), issues: [] };
}
