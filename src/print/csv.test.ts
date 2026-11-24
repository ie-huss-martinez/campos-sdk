import { describe, expect, it } from "vitest";
import { copy, fullLogbook, minimalLogbook } from "../../test/fixtures.ts";
import type { ValidLogbook } from "../model.ts";
import { validateLogbook } from "../validate.ts";
import { csvField, type RenderCsvOptions, renderLogbookCsv } from "./csv.ts";

const BOM = "\uFEFF";

const valid = (input: unknown): ValidLogbook => {
  const result = validateLogbook(input);
  if (!result.ok) {
    throw new Error(JSON.stringify(result.issues));
  }
  return result.value;
};

/** The files of an export, by name. */
const files = (input: unknown, options?: RenderCsvOptions): Record<string, string> => {
  const result = renderLogbookCsv(valid(input), options);
  if (!result.ok) {
    throw new Error(JSON.stringify(result.issues));
  }
  return Object.fromEntries(result.value.files.map((file) => [file.name, file.csv]));
};

describe("renderLogbookCsv", () => {
  it("writes one file for the holding and one per table", () => {
    expect(Object.keys(files(fullLogbook))).toEqual([
      "explotacion.csv",
      "parcelas-declaradas.csv",
      "tratamientos.csv",
      "fertilizacion.csv",
      "riego.csv",
      "plan-de-abonado.csv",
    ]);
    expect(Object.keys(files(minimalLogbook))).not.toContain("parcelas-declaradas.csv");
  });

  it("writes UTF-8 with a byte order mark, semicolons, quotes and CRLF", () => {
    const holding = files(minimalLogbook)["explotacion.csv"];
    expect(holding).toBe(
      `${BOM}"Campo";"Valor"\r\n"Código REA";"ES000000000003"\r\n"NIF del titular";"X9000001D"\r\n"NIF de la unidad gestora";"X9000001D"\r\n"Organismo pagador";"Código 13"\r\n`,
    );
  });

  it("writes the same cells as the printed logbook, lines joined with a bar", () => {
    const treatments = files(fullLogbook, {
      catalogues: { disease: [{ code: 11, label: "Mildiu" }] },
    })["tratamientos.csv"];
    const [header, row] = (treatments ?? "").slice(1).split("\r\n");
    expect(header?.split(";")[0]).toBe('"a. Fecha"');
    expect(row).toContain('"04/03/2027 | 08:30:00"');
    expect(row).toContain('"Mildiu (11) | 12 | 13 | 14"');
    expect(row).toContain('"Dosis: 0,75 7 | Cantidad: 1,5 8 | 10 5"');
  });

  it("writes only the header of a table with no records", () => {
    expect(files(minimalLogbook)["riego.csv"]).toBe(
      `${BOM}"Fecha";"Parcela y superficie";"Sistema de riego";"Agua aplicada";"Origen del agua";"Contador y energía";"Buenas prácticas"\r\n`,
    );
  });

  it("keeps text a spreadsheet would run as a formula as text", () => {
    const input = copy(fullLogbook) as unknown as {
      holding: Record<string, unknown>;
      treatments: Array<Record<string, unknown> & { products: Array<Record<string, unknown>> }>;
    };
    input.holding["name"] = '=HYPERLINK("http://x","clic")';
    input.holding["address"] = "@SUM(1)";
    input.treatments[0]!.products[0]!["tradeName"] = "-Fungicida";
    const output = files(input);
    expect(output["explotacion.csv"]).toContain(`"'=HYPERLINK(""http://x"",""clic"")"`);
    expect(output["explotacion.csv"]).toContain(`"'@SUM(1)"`);
    expect(output["tratamientos.csv"]).toContain(`"'-Fungicida (nº de registro ES-00001) | `);
  });

  it("never writes an identifier a spreadsheet would read as a number", () => {
    const fields = (csv: string): string[] =>
      [...csv.matchAll(/"((?:[^"]|"")*)"/g)].map((match) => (match[1] ?? "").replaceAll('""', '"'));
    for (const [name, csv] of Object.entries(files(fullLogbook))) {
      for (const field of fields(csv)) {
        expect([name, field]).not.toEqual([name, expect.stringMatching(/^(0\d+|\d{16,})$/)]);
      }
    }
    const output = files(fullLogbook);
    expect(output["parcelas-declaradas.csv"]).toContain('"DGC propia 9007199254740993"');
    expect(output["explotacion.csv"]).toContain('"Organismo pagador";"Código 07"');
    expect(output["riego.csv"]).toContain('"Contador CONT-0002 | 3"');
    expect(
      files(fullLogbook, {
        catalogues: { payingAgency: [{ code: "07", label: "Castilla y León" }] },
      })["explotacion.csv"],
    ).toContain('"Castilla y León (07)"');
  });

  it("gives the same bytes for the same input", () => {
    expect(files(fullLogbook)).toEqual(files(copy(fullLogbook)));
  });

  it("validates the labels, as untrusted input", () => {
    const result = renderLogbookCsv(valid(fullLogbook), { dgcs: "x" });
    expect(result.issues.map((issue) => `${issue.code} at ${issue.path.join(".")}`)).toEqual([
      "INVALID_TYPE at options.dgcs",
    ]);
  });
});

describe("csvField", () => {
  it.each([
    ["plain", '"plain"'],
    ['say "hi"; bye', '"say ""hi""; bye"'],
    ["=1+1", `"'=1+1"`],
    ["+34 600", `"'+34 600"`],
    ["-1", `"'-1"`],
    ["@cmd", `"'@cmd"`],
    ["  =1", `"'  =1"`],
    ["\uFF1D1", `"'\uFF1D1"`],
    ["\uFF201", `"'\uFF201"`],
    ["a=1", '"a=1"'],
    ["Pol. 5 - par. 1", '"Pol. 5 - par. 1"'],
  ])("writes %j as %s", (value, expected) => {
    expect(csvField(value)).toBe(expected);
  });
});
