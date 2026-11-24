/**
 * The printable logbook ([ADR 0006](../../docs/adr/0006-printable-logbook-as-html.md)):
 * one self-contained HTML document with the fields of RD 1311/2012, Annex
 * III, Part I, for a person to read, print or save as PDF. Its text is in
 * Spanish, the language of the regulation and of the inspectors who read it.
 */
import type { Result } from "../issues.ts";
import type { ValidLogbook } from "../model.ts";
import { type Cell, type LabelOptions, readLabeller, type Table, tabulate } from "./tables.ts";

/** The printed logbook. */
export interface LogbookHtml {
  /** A complete HTML document. The same logbook and labels always give the same text. */
  readonly html: string;
}

/** Options for {@link renderLogbookHtml}: the labels to print codes with. */
export type RenderHtmlOptions = LabelOptions;

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

/**
 * No script, no resource and no form submission: only the stylesheet above. It
 * doesn't stop navigation; escaping is what keeps input from becoming markup.
 */
const CSP = `default-src 'none'; style-src '${STYLE_HASH}'; base-uri 'none'; form-action 'none'`;

/** Escapes text for HTML content and attribute values. */
export const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

/** A cell's lines, escaped, one per line of the printed cell. */
const cell = (lines: Cell): string => lines.map(escapeHtml).join("<br>");

const section = (title: string, content: string): string =>
  `<section><h2>${escapeHtml(title)}</h2>${content}</section>`;

/** A table with a heading row, or a row that says it has no records. */
const table = (t: Table): string => {
  const head = `<thead><tr>${t.headers.map((h) => `<th scope="col">${escapeHtml(h)}</th>`).join("")}</tr></thead>`;
  const body =
    t.rows.length === 0
      ? `<tr><td colspan="${t.headers.length}">Sin registros.</td></tr>`
      : t.rows.map((row) => `<tr>${row.map((c) => `<td>${cell(c)}</td>`).join("")}</tr>`).join("");
  return section(t.title, `<table>${head}<tbody>${body}</tbody></table>`);
};

/**
 * Renders a validated logbook as a printable HTML document, with the fields
 * of RD 1311/2012, Annex III, Part I. Every value is escaped, and the
 * document has no script and loads nothing. Records that only ask the
 * administration to delete something are left out.
 */
export function renderLogbookHtml(
  logbook: ValidLogbook,
  options: RenderHtmlOptions = {},
): Result<LogbookHtml> {
  const labeller = readLabeller(logbook, options);
  if (!labeller.ok) {
    return labeller;
  }
  const t = tabulate(logbook, labeller.value);
  const holding = t.holding
    .map(
      ([name, value]) =>
        `<tr><th scope="row">${escapeHtml(name)}</th><td>${escapeHtml(value)}</td></tr>`,
    )
    .join("");
  const html = [
    "<!doctype html>",
    '<html lang="es">',
    "<head>",
    '<meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="${escapeHtml(CSP)}">`,
    `<title>${escapeHtml(t.title)}</title>`,
    `<style>${STYLE}</style>`,
    "</head>",
    "<body>",
    `<h1>${escapeHtml(t.title)}</h1>`,
    section(t.holdingTitle, `<table class="holding"><tbody>${holding}</tbody></table>`),
    ...t.tables.map(table),
    "</body>",
    "</html>",
    "",
  ].join("\n");
  return { ok: true, value: Object.freeze({ html }), issues: [] };
}
