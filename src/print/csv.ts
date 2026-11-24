/**
 * The logbook as CSV ([ADR 0007](../../docs/adr/0007-csv-export.md)): one
 * file for the holding and one per table of the printed logbook, for
 * spreadsheets set up for Spain.
 */
import type { Result } from "../issues.ts";
import type { ValidLogbook } from "../model.ts";
import { type Cell, type LabelOptions, readLabeller, tabulate } from "./tables.ts";

/** One CSV file. */
export interface CsvFile {
  /** The file's name, such as `tratamientos.csv`. */
  readonly name: string;
  /** Its content: UTF-8 text with a byte order mark, `;`-separated, CRLF line endings. */
  readonly csv: string;
}

/** The exported logbook. */
export interface LogbookCsv {
  readonly files: readonly CsvFile[];
}

/** Options for {@link renderLogbookCsv}: the labels to write codes with. */
export type RenderCsvOptions = LabelOptions;

/** Lets spreadsheets that default to another encoding read the file as UTF-8. */
const BYTE_ORDER_MARK = "\uFEFF";

/** How a cell's lines are joined in one field. */
const LINE_JOIN = " | ";

/**
 * Characters that make a spreadsheet read a field as a formula when they
 * come first, including their full-width forms, which some spreadsheets
 * also accept.
 */
const FORMULA_START = /^\s*[=+\-@\uFF1D\uFF0B\uFF0D\uFF20]/u;

/**
 * Quotes one field. A field that a spreadsheet would read as a formula is
 * prefixed with an apostrophe, so it stays text; quotes are doubled.
 */
export const csvField = (value: string): string => {
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
};

const record = (fields: readonly string[]): string => `${fields.map(csvField).join(";")}\r\n`;

const csv = (header: readonly string[], rows: readonly (readonly string[])[]): string =>
  BYTE_ORDER_MARK + record(header) + rows.map(record).join("");

const joined = (cell: Cell): string => cell.join(LINE_JOIN);

/**
 * Exports a validated logbook as CSV files, with the same content as the
 * printed logbook: one file for the holding and one per table. Every field
 * is quoted, and any field a spreadsheet would run as a formula is kept as
 * text. Records that only ask the administration to delete something are
 * left out.
 */
export function renderLogbookCsv(
  logbook: ValidLogbook,
  options: RenderCsvOptions = {},
): Result<LogbookCsv> {
  const labeller = readLabeller(logbook, options);
  if (!labeller.ok) {
    return labeller;
  }
  const t = tabulate(logbook, labeller.value);
  const files: CsvFile[] = [
    { name: "explotacion.csv", csv: csv(["Campo", "Valor"], t.holding) },
    ...t.tables.map((table) => ({
      name: `${table.file}.csv`,
      csv: csv(
        table.headers,
        table.rows.map((row) => row.map(joined)),
      ),
    })),
  ];
  return {
    ok: true,
    value: Object.freeze({ files: Object.freeze(files.map((f) => Object.freeze(f))) }),
    issues: [],
  };
}
