import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { copy, fullLogbook, minimalLogbook, sparseLogbook } from "../../test/fixtures.ts";
import type { ValidLogbook } from "../model.ts";
import { validateLogbook } from "../validate.ts";
import {
  escapeHtml,
  type RenderHtmlOptions,
  renderLogbookHtml,
  STYLE,
  STYLE_HASH,
} from "./html.ts";

const valid = (input: unknown): ValidLogbook => {
  const result = validateLogbook(input);
  if (!result.ok) {
    throw new Error(JSON.stringify(result.issues));
  }
  return result.value;
};

const html = (input: unknown, options?: RenderHtmlOptions): string => {
  const result = renderLogbookHtml(valid(input), options);
  if (!result.ok) {
    throw new Error(JSON.stringify(result.issues));
  }
  return result.value.html;
};

/** Labels for some of the full fixture's codes, as an application's snapshot would give them. */
const catalogues = {
  payingAgency: [{ code: "07", label: "Castilla y León" }],
  crop: [
    { code: 1, label: "Trigo blando" },
    { code: 2, label: "Cebada" },
  ],
  variety: [{ code: 101, label: "Variedad Ejemplo" }],
  disease: [{ code: 11, label: "Mildiu" }],
  unit: [{ code: 7, label: "l/ha" }],
  efficacy: [{ code: 2, label: "Buena" }],
  justification: [{ code: 1, label: "Umbral superado" }],
};

const dgcs = [{ dgc: "1234567890123456", label: "Pol. 5, par. 120, rec. 3: trigo blando" }];

describe("renderLogbookHtml", () => {
  it("renders the full fixture as the committed document", async () => {
    await expect(html(fullLogbook, { catalogues, dgcs })).toMatchFileSnapshot(
      "./__snapshots__/full-logbook.html",
    );
  });

  it("pins its stylesheet in the content security policy, and loads nothing", () => {
    const digest = `sha256-${createHash("sha256").update(STYLE, "utf8").digest("base64")}`;
    expect(STYLE_HASH).toBe(digest);
    const output = html(fullLogbook, { catalogues, dgcs });
    expect(output).toContain(
      `content="default-src 'none'; style-src '${digest}'; base-uri 'none'; form-action 'none'"`.replaceAll(
        "'",
        "&#39;",
      ),
    );
    expect(output).not.toMatch(/<script|<link|<img|<iframe|src=|href=|url\(|@import/i);
  });

  it("escapes every value, labels included", () => {
    const input = copy(fullLogbook) as unknown as {
      holding: Record<string, unknown>;
      treatments: Array<Record<string, unknown>>;
    };
    input.holding["name"] = `<script>alert("x")</script> & 'Finca'`;
    input.treatments[0]!["notes"] = "<img src=x onerror=alert(1)>";
    const output = html(input, {
      catalogues: { efficacy: [{ code: 2, label: "<b>Buena</b>" }] },
      dgcs: [{ dgc: "1234567890123456", label: '"><svg onload=alert(1)>' }],
    });
    expect(output).toContain(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;Finca&#39;",
    );
    expect(output).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(output).toContain("&lt;b&gt;Buena&lt;/b&gt; (2)");
    expect(output).toContain("&quot;&gt;&lt;svg onload=alert(1)&gt;");
    expect(output).not.toMatch(/<script|<img|<svg|<b>/);
  });

  it("prints a code with its label, or alone when the snapshot has none", () => {
    const output = html(fullLogbook, { catalogues });
    expect(output).toContain("Mildiu (11)");
    expect(output).toContain("Castilla y León (07)");
    expect(output).toContain("<td>Mildiu (11)<br>12<br>13<br>14</td>");
    expect(html(fullLogbook)).toContain("Organismo pagador</th><td>Código 07</td>");
  });

  it("describes declared crop delimitations by their SIGPAC reference, and others by their code", () => {
    const output = html(fullLogbook, { catalogues });
    expect(output).toContain("SIGPAC 47:186:0:0:5:120:3: Trigo blando (1)");
    expect(output).toContain("DGC 1234567890123456 (cultivo del registro 77)");
    expect(output).toContain("<td>DGC 1234567890123456, 12,5 ha</td>");
    expect(html(fullLogbook, { dgcs })).toContain("Pol. 5, par. 120, rec. 3: trigo blando");
    expect(
      html(fullLogbook, { dgcs: [{ declaredDgc: "9007199254740993", label: "Recinto propio" }] }),
    ).toContain("<td>Recinto propio</td>");
    const input = copy(fullLogbook) as unknown as { cropDelimitations?: unknown };
    delete input.cropDelimitations;
    const output2 = html(input);
    expect(output2).toContain("DGC propia 9007199254740993");
    expect(output2).not.toContain("Parcelas declaradas");
  });

  it("leaves out deletion requests, and orders records by date, then identifier", () => {
    const input = copy(sparseLogbook) as unknown as {
      treatments: Array<Record<string, unknown>>;
      cropDelimitations: Array<Record<string, unknown>>;
    };
    input.treatments.push({ ...input.treatments[0]!, id: 9, start: "2027-04-01" });
    input.treatments.push({ ...input.treatments[0]!, id: 8, start: "2027-03-01", deleted: true });
    input.cropDelimitations[0]!["deleted"] = true;
    const output = html(input);
    const order = [
      ...output.matchAll(/<td>(\d{2}\/\d{2}\/\d{4})(?: – (\d{2}\/\d{2}\/\d{4}))?<\/td>/g),
    ].map((match) => match[0]);
    expect(output).not.toContain("01/03/2027");
    expect(output).toContain("<td>Sin registros.</td>".replace("<td>", '<td colspan="7">'));
    expect(order.slice(0, 3)).toEqual([
      "<td>01/04/2027 – 02/04/2027</td>",
      "<td>01/04/2027 – 02/04/2027</td>",
      "<td>03/04/2027</td>",
    ]);
    expect(output.indexOf("Herbicida Ejemplo")).toBeLessThan(output.indexOf("Trampas"));
  });

  it("prints the sparse fixture, with what its records leave out", () => {
    const output = html(sparseLogbook);
    expect(output).toContain(
      "<td>DGC propia 1</td><td>SIGPAC 08:019:0:0:1:1:1</td><td></td><td></td>",
    );
    expect(output).toContain("<td>Secano<br>1</td><td>Desde 01/11/2026</td>");
    expect(output).toContain("Otra medida: 5");
    expect(output).toContain("<td>Toda la DGC</td>");
  });

  it("prints every variant of a record", () => {
    const input = copy(fullLogbook) as unknown as {
      treatments: Array<Record<string, unknown> & { adviser: Record<string, unknown> }>;
      fertilisations: Array<Record<string, unknown> & { material: Record<string, unknown> }>;
      irrigations: Array<Record<string, unknown>>;
      fertilisationPlans: Array<Record<string, unknown>>;
    };
    delete input.treatments[0]!.adviser["date"];
    const first = input.fertilisations[0]!;
    delete first.material["rega"];
    first.material["supplierNif"] = "B90000001";
    const second = copy(first) as typeof first;
    second["id"] = 20;
    second["start"] = "2027-01-01";
    second["end"] = "2027-01-01";
    delete second.material["supplierNif"];
    second.material["nima"] = "NIMA-0001";
    second["equipment"] = { regfer: "REGFER-0002" };
    second["application"] = { ...(first["application"] as object), sewageSludge: true };
    const fertigation: Record<string, unknown> = {
      ...(first["fertigation"] as Record<string, unknown>),
      dose: 2,
    };
    delete fertigation["quantity"];
    second["fertigation"] = fertigation;
    input.fertilisations.push(second);
    input.irrigations.push({
      ...input.irrigations[0]!,
      id: 21,
      start: "2027-05-01",
      end: "2027-05-01",
    });
    input.fertilisationPlans.push({
      ...input.fertilisationPlans[0]!,
      id: 22,
      generatedOn: "2026-08-01",
    });
    const output = html(input);
    expect(output).toContain("Asesor: ROPO 0000000000004A</td>");
    expect(output).toContain("NIF B90000001");
    expect(output).toContain("NIMA NIMA-0001");
    expect(output).toContain("REGFER REGFER-0002");
    expect(output).toContain("Dosis de riego: 2 4");
    expect(output).toContain("Lodos de depuración");
    expect(output.indexOf("01/01/2027")).toBeLessThan(output.indexOf("10/02/2027"));
    expect(output.indexOf("01/05/2027")).toBeLessThan(output.indexOf("01/06/2027"));
    expect(output.indexOf("01/08/2026")).toBeLessThan(output.indexOf("15/09/2026"));
  });

  it("says so when a section has no records", () => {
    const output = html(minimalLogbook);
    expect(output.match(/Sin registros\./g)).toHaveLength(4);
  });

  it("writes numbers with a decimal comma, and times and periods", () => {
    const output = html(fullLogbook);
    expect(output).toContain("Dosis: 0,75 7");
    expect(output).toContain("04/03/2027<br>08:30:00");
    expect(output).toContain("10/02/2027 – 11/02/2027");
    expect(output).toContain("N nítrico: 12,3 5");
  });

  it("gives the same bytes for the same input", () => {
    const reordered = {
      ...catalogues,
      crop: [...catalogues.crop].reverse(),
    };
    expect(html(fullLogbook, { catalogues: reordered, dgcs })).toBe(
      html(fullLogbook, { catalogues, dgcs }),
    );
  });

  it("validates the labels, as untrusted input", () => {
    const result = renderLogbookHtml(valid(fullLogbook), {
      catalogues: { crop: [{ code: 1, label: "x\n" }] },
      dgcs: [
        { dgc: "1", declaredDgc: "2", label: "x" },
        { dgc: "01", label: "x" },
        { dgc: "3" },
        "x",
      ],
    });
    expect(result.issues.map((issue) => `${issue.code} at ${issue.path.join(".")}`)).toEqual([
      "INVALID_CHARACTER at options.catalogues.crop.0.label",
      "EXACTLY_ONE at options.dgcs.0",
      "INVALID_FORMAT at options.dgcs.1.dgc",
      "REQUIRED at options.dgcs.2.label",
      "INVALID_TYPE at options.dgcs.3",
    ]);
  });
});

describe("escapeHtml", () => {
  it("escapes the five characters that matter in content and attributes", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;",
    );
  });
});
