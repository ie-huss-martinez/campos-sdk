/**
 * The CUE document, version 3.11.4, of Anexo VI "Interfaz Único Común"
 * (FEGA). Keys are written in the order of the official schema, which
 * `vendor/fega/cue-3.11.4/` holds, and only keys the schema declares.
 */
import type { Issue, PathSegment } from "../issues.ts";
import { type JsonValue, rawInteger, writeJson } from "../json.ts";
import type {
  CropDelimitation,
  DgcReference,
  DgcWithArea,
  Fertigation,
  Fertilisation,
  FertilisationPlan,
  FertiliserEquipment,
  Irrigation,
  Logbook,
  NutrientShare,
  Treatment,
  TreatmentDgc,
  TreatmentEquipment,
} from "../model.ts";

type JsonObject = { readonly [key: string]: JsonValue };

/** Builds an object in the given key order, leaving out absent values and empty lists. */
const object = (entries: ReadonlyArray<readonly [string, JsonValue | undefined]>): JsonObject => {
  const out: Record<string, JsonValue> = {};
  for (const [key, value] of entries) {
    if (value !== undefined && !(Array.isArray(value) && value.length === 0)) {
      out[key] = value;
    }
  }
  return out;
};

/** `2027-01-15` becomes `15/01/2027`. */
const cueDate = (iso: string | undefined): string | undefined =>
  iso === undefined ? undefined : `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

const raw = (digits: string | undefined): JsonValue | undefined =>
  digits === undefined ? undefined : rawInteger(digits);

const codes = (key: string, list: readonly number[] | undefined): JsonValue[] | undefined =>
  list?.map((code) => ({ [key]: code }));

/** `CodigoDGC`, `CodigoDGCAjena` and `CodigoCultivo`. */
const dgcKeys = (dgc: DgcReference): ReadonlyArray<readonly [string, JsonValue | undefined]> =>
  "dgc" in dgc
    ? [
        ["CodigoDGC", raw(dgc.dgc)],
        ["CodigoCultivo", raw(dgc.cropRecord)],
      ]
    : [["CodigoDGCAjena", raw(dgc.declaredDgc)]];

const dgcWithArea = (dgc: DgcWithArea): JsonObject =>
  object([...dgcKeys(dgc), ["Superficie", dgc.area]]);

const cropDelimitation = (d: CropDelimitation): JsonObject =>
  object([
    ["CodigoDGCAjena", rawInteger(d.code)],
    ["Borrar", d.deleted],
    ["ReferenciaCatastral", d.cadastralReference],
    ["Provincia", d.sigpac.province],
    ["Municipio", d.sigpac.municipality],
    ["Agregado", d.sigpac.aggregate],
    ["Zona", d.sigpac.zone],
    ["Poligono", d.sigpac.polygon],
    ["Parcela", d.sigpac.parcel],
    ["Recinto", d.sigpac.enclosure],
    ["Orden", d.order],
    ["Superficie", d.area],
    ["FechaAltaSuperficie", cueDate(d.areaFrom)],
    ["FechaBajaSuperficie", cueDate(d.areaTo)],
    ["FechaInicio", cueDate(d.from)],
    ["FechaFin", cueDate(d.to)],
    ["Cultivo", d.crop],
    ["Variedad", d.variety],
    ["SistemaExplotacion", d.irrigated ? "R" : "S"],
    ["SistCultivo", d.croppingSystem],
  ]);

const treatmentDgc = (dgc: TreatmentDgc): JsonObject =>
  object([
    ...dgcKeys(dgc),
    ["Superficie", dgc.area],
    ["EstadoFenologico", dgc.phenologicalStage],
    ["HuertaVivero", codes("Producto", dgc.nurseryProducts)],
    ["Cubiertas", codes("TipoCobertura", dgc.covers)],
  ]);

const listObject = (key: string, list: readonly number[] | undefined): JsonObject | undefined =>
  list === undefined || list.length === 0 ? undefined : { [key]: list };

const treatmentEquipment = (e: TreatmentEquipment): JsonObject =>
  object([
    ["NumROMA", e.roma],
    ["NumREGANIP", e.reganip],
    ["EquipoPropio", e.own],
    ["IdEquipoAplicador", e.unregisteredId],
    ["PotenciaMaquinaria", e.power],
    ["UnidadesMedida", e.powerUnit],
    ["AplicacionManual", e.manual],
    ["TipoMaquinariaUNE", e.machineryTypeUne],
    ["TipoEnergia", e.energyType],
    ["NumRepeticiones", e.repetitions],
    ["Duracion", e.duration],
  ]);

const treatment = (t: Treatment): JsonObject =>
  object([
    ["IdAjenaTratamFito", t.id],
    ["Borrar", t.deleted],
    ["FechaInicio", cueDate(t.start)],
    ["FechaFin", cueDate(t.end)],
    ["HoraTratamiento", t.time],
    ["FechaSeca", cueDate(t.dryingDate)],
    [
      "Actividad",
      t.coverActivity === undefined ? undefined : t.coverActivity === "maintenance" ? 0 : 1,
    ],
    ["DGCs", t.dgcs.map(treatmentDgc)],
    [
      "ProblematicaFito",
      object([
        ["Enfermedades", listObject("TipoEnfermedad", t.targets.diseases)],
        ["ArtropodosGasteropodos", listObject("TipoPlaga", t.targets.pests)],
        ["MalasHierbas", listObject("TipoMalaHierba", t.targets.weeds)],
        ["ReguladoresOtros", listObject("TipoRegulador", t.targets.regulators)],
      ]),
    ],
    ["Justificaciones", codes("JustAct", t.justifications)],
    [
      "OtrasActuacionesFito",
      t.otherMeasure === undefined
        ? undefined
        : object([
            ["TipoMedida", t.otherMeasure.type],
            ["Cantidad", t.otherMeasure.quantity],
            ["Unidad", t.otherMeasure.unit],
            ["NumRegistroMDF", t.otherMeasure.mdfRegistration],
            ["BuenasPracticas", t.otherMeasure.goodPractice],
          ]),
    ],
    [
      "ProductosFito",
      t.products?.map((p) =>
        object([
          ["TipoProducto", p.type],
          ["NumRegistro", p.registrationNumber],
          ["MateriaActiva", p.activeSubstance],
          ["Dosis", p.dose],
          ["Cantidad", p.quantity],
          ["Unidad", p.unit],
        ]),
      ),
    ],
    [
      "IdentificadorAplicador",
      t.applicators.map((a) =>
        object([
          ["AplicadorEmpresa", { NumROPO: a.ropo }],
          ["EquipoAplicador", treatmentEquipment(a.equipment)],
        ]),
      ),
    ],
    [
      "AsesorValidacion",
      t.adviser === undefined
        ? undefined
        : object([
            ["NumROPO", t.adviser.ropo],
            ["Confirmacion", t.adviser.confirmed],
            ["Fecha", cueDate(t.adviser.date)],
            ["Validacion", t.adviser.validated],
            ["Observaciones", t.adviser.notes],
            ["Contrato", t.adviser.contract],
          ]),
    ],
    ["Eficacia", t.efficacy],
    ["Observaciones", t.notes],
  ]);

const shares = (key: string, list: readonly NutrientShare[] | undefined): JsonValue[] | undefined =>
  list?.map((share) =>
    object([
      [key, share.type],
      ["Porcentaje", share.percent],
    ]),
  );

const fertiliserEquipment = (e: FertiliserEquipment): JsonObject =>
  object([
    ["NumROMA", e.roma],
    ["NumREGFER", e.regfer],
    ["EquipoPropio", e.own],
    ["IdEquipoAplicador", e.unregisteredId],
    ["PotenciaMaquinaria", e.power],
    ["UnidadesMedida", e.powerUnit],
    ["TipoMaquinariaUNE", e.machineryTypeUne],
    ["TipoEnergia", e.energyType],
    ["NumRepeticiones", e.repetitions],
    ["Duracion", e.duration],
  ]);

const fertigation = (f: Fertigation): JsonObject =>
  object([
    ["SistemaRiego", f.irrigationSystem],
    ["Cantidad", f.quantity],
    ["Unidad", f.unit],
    ["Dosis", f.dose],
    ["OrigenAgua", codes("IdOrigenAgua", f.waterOrigins)],
    ["NumContador", f.meter],
    ["DosisN", f.nitrogenDose],
    ["UnidadDosisN", f.nitrogenUnit],
    ["DosisP", f.phosphorusDose],
    ["UnidadDosisP", f.phosphorusUnit],
    ["TipoEnergia", f.energyType],
  ]);

const fertilisation = (f: Fertilisation): JsonObject =>
  object([
    ["IdAjenaFerti", f.id],
    ["Borrar", f.deleted],
    ["FechaInicio", cueDate(f.start)],
    ["FechaFin", cueDate(f.end)],
    ["GestionSostInsu", f.sustainableInputManagement],
    ["BuenasPracticas", codes("TipoBPF", f.goodPractices)],
    [
      "MaterialFertilizante",
      f.material === undefined
        ? undefined
        : object([
            ["Material", f.material.type],
            ["DetalleMaterial", f.material.detail],
            ["EmpresaSuministradora", f.material.supplierName],
            ["NifEmpresa", f.material.supplierNif],
            ["REGA", f.material.rega],
            ["NIMA", f.material.nima],
            ["TratamientoEstiercoles", f.material.manureTreatment],
            ["Macronutrientes", shares("TipoMacroN", f.material.macronutrients)],
            ["MetalesPesados", shares("TipoMetalP", f.material.heavyMetals)],
            ["Micronutrientes", shares("TipoMicroN", f.material.micronutrients)],
            ["Densidad", f.material.density],
            ["UnidadesMedida", f.material.densityUnit],
          ]),
    ],
    [
      "AplicacionMaterialFertilizante",
      f.application === undefined
        ? undefined
        : object([
            ["NombreProducto", f.application.productName],
            ["AplicacionLodos", f.application.sewageSludge],
            ["TipoFertilizacion", f.application.type],
            ["MetodoFertilizacion", f.application.method],
            ["Dosis", f.application.dose],
            ["Unidad", f.application.unit],
            ["EmpresaServicios", f.application.serviceCompany],
          ]),
    ],
    ["EquipoAplicador", f.equipment === undefined ? undefined : fertiliserEquipment(f.equipment)],
    ["BuenasPracticasRiego", codes("TipoBPR", f.irrigationGoodPractices)],
    ["Fertirrigacion", f.fertigation === undefined ? undefined : fertigation(f.fertigation)],
    ["DGCs", f.dgcs.map(dgcWithArea)],
  ]);

const fertilisationPlan = (p: FertilisationPlan): JsonObject =>
  object([
    ["IdAjenaPlan", p.id],
    ["Borrar", p.deleted],
    ["NecesidadUFN", p.nitrogenNeed],
    ["NecesidadUFP2O5", p.phosphorusNeed],
    ["NecesidadUFK2O", p.potassiumNeed],
    ["ObjetivoProduccion", p.yieldTarget],
    ["CultivoPrecedente", p.previousCrop],
    ["Herramienta", p.toolUsed],
    ["FechaGeneracion", cueDate(p.generatedOn)],
    ["DGCs", p.dgcs.map((dgc) => object(dgcKeys(dgc)))],
  ]);

const irrigation = (r: Irrigation): JsonObject =>
  object([
    ["IdAjenaRiego", r.id],
    ["Borrar", r.deleted],
    ["FechaInicio", cueDate(r.start)],
    ["FechaFin", cueDate(r.end)],
    ["SistemaRiego", r.system],
    ["Cantidad", r.quantity],
    ["UnidadMedida", r.unit],
    ["OrigenAgua", codes("IdOrigenAgua", r.waterOrigins)],
    ["TipoEnergia", r.energyType],
    ["NumContador", r.meter],
    ["BuenasPracticasRiego", codes("TipoBPR", r.goodPractices)],
    ["DGCs", r.dgcs.map(dgcWithArea)],
  ]);

/** What version 3.11.4 requires, or can't hold, beyond the model's own rules. */
function targetIssues(logbook: Logbook): Issue[] {
  const issues: Issue[] = [];
  const report = (
    code: Issue["code"],
    path: readonly PathSegment[],
    recordId: number,
    message: string,
  ): void => {
    issues.push(Object.freeze({ code, path: Object.freeze([...path]), recordId, message }));
  };
  logbook.fertilisations?.forEach((f, index) => {
    const path = ["fertilisations", index];
    if (f.goodPractices === undefined || f.goodPractices.length === 0) {
      report(
        "REQUIRED_BY_TARGET",
        [...path, "goodPractices"],
        f.id,
        "CUE 3.11.4 requires at least one fertilisation good practice (BuenasPracticas).",
      );
    }
    if (f.equipment?.regfer !== undefined) {
      // The schema's oneOf for this block names NumREGANIP, which the block
      // doesn't define, so equipment identified only by REGFER fails it
      // (vendor/fega/cue-3.11.4/SOURCE.md).
      report(
        "NOT_REPRESENTABLE",
        [...path, "equipment", "regfer"],
        f.id,
        "CUE 3.11.4's schema can't accept fertiliser equipment identified by its REGFER registration; identify it by ROMA or by unregisteredId.",
      );
    }
  });
  return issues;
}

/** Renders a validated logbook as a CUE 3.11.4 document, or returns what stops it. */
export function renderCue3114(logbook: Logbook): {
  readonly json: string;
  readonly issues: readonly Issue[];
} {
  const issues = targetIssues(logbook);
  if (issues.length > 0) {
    return { json: "", issues };
  }
  const h = logbook.holding;
  const declared = logbook.cropDelimitations?.map(cropDelimitation) ?? [];
  const activities = object([
    ["TratamFito", logbook.treatments?.map(treatment)],
    ["Fertilizacion", logbook.fertilisations?.map(fertilisation)],
    ["PlanAbonado", logbook.fertilisationPlans?.map(fertilisationPlan)],
    ["Riego", logbook.irrigations?.map(irrigation)],
  ]);
  const notebook = object([
    ["CodigoSIEX", h.siexCode],
    ["CAExplotacion", h.payingAgency],
    ["IdTitular", h.holderNif],
    ["IdCuaderno", h.notebookId],
    ["UnidadGestora", h.managingUnitNif],
    ["CodigoRea", h.reaCode],
    ["DatosExplotacion", declared.length === 0 ? undefined : { AltaDGC: declared }],
    ["ActividadesExplotacion", Object.keys(activities).length === 0 ? undefined : activities],
  ]);
  return { json: writeJson({ CUADERNO: [notebook] }), issues };
}
