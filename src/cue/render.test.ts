import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { Ajv } from "ajv";
import { describe, expect, it } from "vitest";
import { copy, fullLogbook, minimalLogbook, sparseLogbook } from "../fixtures/logbook.ts";
import type { ValidLogbook } from "../model.ts";
import { validateLogbook } from "../validate.ts";
import { renderCue } from "./render.ts";
import { CUE_VERSIONS, cueVersionForInterface, INTERFACE_VERSIONS } from "./versions.ts";

const SCHEMA_DIR = new URL("../../vendor/fega/cue-3.11.4/", import.meta.url);
const schemaBytes = readFileSync(new URL("BdcSix-DS-DisenoCUE_3.11.4.json", SCHEMA_DIR));

type SchemaNode = {
  $id?: string;
  properties?: Record<string, SchemaNode>;
  items?: SchemaNode;
  [key: string]: unknown;
};

/** FEGA's schema, with its nested `$id`s removed in memory: one of them is malformed. */
const schema = (() => {
  const parsed = JSON.parse(schemaBytes.toString("utf8")) as SchemaNode;
  const strip = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(strip);
    } else if (typeof node === "object" && node !== null) {
      delete (node as SchemaNode).$id;
      Object.values(node).forEach(strip);
    }
  };
  Object.values(parsed).forEach(strip);
  return parsed;
})();

const validateSchema = new Ajv({ allErrors: true, strict: false }).compile(schema);

const valid = (input: unknown): ValidLogbook => {
  const result = validateLogbook(input);
  if (!result.ok) {
    throw new Error(JSON.stringify(result.issues));
  }
  return result.value;
};

const render = (input: unknown): string => {
  const result = renderCue(valid(input), { version: "3.11.4" });
  if (!result.ok) {
    throw new Error(JSON.stringify(result.issues));
  }
  return result.value.json;
};

/** Every key path in `value` that `node` doesn't declare. */
const undeclared = (value: unknown, node: SchemaNode | undefined, path = "$"): string[] => {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => undeclared(item, node?.items, `${path}[${index}]`));
  }
  if (typeof value !== "object" || value === null) {
    return [];
  }
  return Object.entries(value).flatMap(([key, member]) =>
    node?.properties?.[key] === undefined
      ? [`${path}.${key}`]
      : undeclared(member, node.properties[key], `${path}.${key}`),
  );
};

describe("the vendored schema", () => {
  it("is byte for byte the file SOURCE.md describes", () => {
    const source = readFileSync(new URL("SOURCE.md", SCHEMA_DIR), "utf8");
    const digest = createHash("sha256").update(schemaBytes).digest("hex");
    expect(source).toContain(`SHA-256 \`${digest}\``);
    expect(schemaBytes.length).toBe(243_206);
  });

  it("rejects a document missing what it requires, so the checks below mean something", () => {
    expect(validateSchema({ CUADERNO: [{ CodigoRea: "ES000000000001" }] })).toBe(false);
  });
});

describe("renderCue, version 3.11.4", () => {
  it.each([
    ["the full fixture", fullLogbook],
    ["the minimal fixture", minimalLogbook],
    ["the sparse fixture", sparseLogbook],
  ])("writes %s as a document FEGA's schema accepts", (_name, fixture) => {
    const document = JSON.parse(render(fixture));
    const ok = validateSchema(document);
    expect(validateSchema.errors ?? []).toEqual([]);
    expect(ok).toBe(true);
    expect(undeclared(document, schema)).toEqual([]);
  });

  it("writes a deletion, a removal of a cover and a dryland delimitation", () => {
    const input = copy(fullLogbook) as unknown as {
      treatments: Array<Record<string, unknown>>;
      cropDelimitations: Array<Record<string, unknown>>;
    };
    input.treatments[0]!["deleted"] = true;
    input.treatments[0]!["coverActivity"] = "removal";
    input.cropDelimitations[0]!["irrigated"] = false;
    const document = JSON.parse(render(input));
    expect(validateSchema(document)).toBe(true);
    const notebook = document.CUADERNO[0];
    expect(notebook.ActividadesExplotacion.TratamFito[0]).toMatchObject({
      Borrar: true,
      Actividad: 1,
    });
    expect(notebook.DatosExplotacion.AltaDGC[0].SistemaExplotacion).toBe("S");
  });

  it("writes the holding, dates and codes as the CUE expects", () => {
    const json = render(fullLogbook);
    const notebook = JSON.parse(json).CUADERNO[0];
    expect(Object.keys(notebook)).toEqual([
      "CodigoSIEX",
      "CAExplotacion",
      "IdTitular",
      "IdCuaderno",
      "UnidadGestora",
      "CodigoRea",
      "DatosExplotacion",
      "ActividadesExplotacion",
    ]);
    const treatment = notebook.ActividadesExplotacion.TratamFito[0];
    expect(treatment).toMatchObject({
      IdAjenaTratamFito: 1,
      FechaInicio: "04/03/2027",
      HoraTratamiento: "08:30:00",
      Actividad: 0,
      Justificaciones: [{ JustAct: 1 }],
      ProblematicaFito: { Enfermedades: { TipoEnfermedad: [11] } },
    });
    expect(Object.keys(notebook.ActividadesExplotacion)).toEqual([
      "TratamFito",
      "Fertilizacion",
      "PlanAbonado",
      "Riego",
    ]);
  });

  it("writes 16-digit codes exactly", () => {
    const json = render(fullLogbook);
    expect(json).toContain('"CodigoDGCAjena":9007199254740993');
    expect(json).toContain('"CodigoDGC":1234567890123456');
  });

  it("leaves out the trade name, which the CUE has no field for", () => {
    expect(render(fullLogbook)).not.toContain("Fungicida Ejemplo");
  });

  it("gives the same bytes for the same logbook, whatever the input's key order", () => {
    const reordered = Object.fromEntries(Object.entries(copy(fullLogbook)).reverse());
    expect(render(reordered)).toBe(render(fullLogbook));
  });

  it("leaves out empty optional lists and blocks", () => {
    const json = render(minimalLogbook);
    expect(json).toBe(
      '{"CUADERNO":[{"CAExplotacion":"13","IdTitular":"X9000001D","UnidadGestora":"X9000001D","CodigoRea":"ES000000000003"}]}',
    );
    const input = copy(fullLogbook) as unknown as { treatments: Array<Record<string, unknown>> };
    input.treatments[0]!["targets"] = { pests: [12], diseases: [] };
    const treatment = JSON.parse(render(input)).CUADERNO[0].ActividadesExplotacion.TratamFito[0];
    expect(treatment.ProblematicaFito).toEqual({ ArtropodosGasteropodos: { TipoPlaga: [12] } });
  });

  it("reports what the version requires that the model leaves optional", () => {
    const input = copy(fullLogbook) as unknown as {
      fertilisations: Array<Record<string, unknown>>;
    };
    delete input.fertilisations[0]!["goodPractices"];
    const result = renderCue(valid(input), { version: "3.11.4" });
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: "REQUIRED_BY_TARGET",
        path: ["fertilisations", 0, "goodPractices"],
        recordId: 2,
      }),
    ]);
  });

  it("reports fertiliser equipment the schema can't accept", () => {
    const input = copy(fullLogbook) as unknown as {
      fertilisations: Array<Record<string, unknown>>;
    };
    input.fertilisations[0]!["equipment"] = { regfer: "REGFER-0002" };
    const result = renderCue(valid(input), { version: "3.11.4" });
    expect(result.issues.map((issue) => [issue.code, issue.path.join(".")])).toEqual([
      ["NOT_REPRESENTABLE", "fertilisations.0.equipment.regfer"],
    ]);
  });

  it("refuses a version it can't render", () => {
    const result = renderCue(valid(minimalLogbook), { version: "9.9.9" as "3.11.4" });
    expect(result.issues.map((issue) => issue.code)).toEqual(["UNSUPPORTED_VERSION"]);
  });
});

describe("cueVersionForInterface", () => {
  it("maps each interface version read to the document it carries", () => {
    expect(cueVersionForInterface("4.10.0")).toEqual({ ok: true, value: "3.11.4", issues: [] });
    expect(cueVersionForInterface("3.11.4")).toEqual({ ok: true, value: "3.11.4", issues: [] });
    for (const version of Object.values(INTERFACE_VERSIONS)) {
      expect(CUE_VERSIONS).toContain(version);
    }
  });

  it("never guesses an interface version it hasn't read", () => {
    for (const version of ["4.11.0", "5.9.0", "3.11.3", "toString", "__proto__", ""]) {
      const result = cueVersionForInterface(version);
      expect(result.ok).toBe(false);
      expect(result.issues.map((issue) => issue.code)).toEqual(["UNSUPPORTED_VERSION"]);
    }
  });
});
