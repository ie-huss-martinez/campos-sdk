/**
 * The logbook model ([ADR 0002](../docs/adr/0002-scope-and-architecture.md)):
 * the library's own description of a holding's logbook, independent of any
 * version of the CUE document. Every value is plain data. Dates are local
 * calendar days, `YYYY-MM-DD`, and times are local times of day, `HH:MM:SS`.
 *
 * Codes from an official catalogue are numbers, as the catalogues define
 * them. Identifiers that can be longer than a JavaScript number holds
 * exactly, such as a crop delimitation's code, are decimal digits in text.
 *
 * Each field's documentation names the official field it corresponds to in
 * the CUE document and, for codes, the catalogue it comes from, as Anexo VI's
 * descriptor names it.
 */

declare const validated: unique symbol;

/**
 * A logbook that {@link validateLogbook} accepted. Only validation produces
 * one, so a renderer never sees unchecked data.
 */
export type ValidLogbook = Logbook & { readonly [validated]: true };

/** A holding's logbook: the holding, and what was done on its land. */
export interface Logbook {
  readonly holding: Holding;
  /** Crop delimitations the holding declares itself (`AltaDGC`). */
  readonly cropDelimitations?: readonly CropDelimitation[];
  /** Plant-protection treatments (`TratamFito`). */
  readonly treatments?: readonly Treatment[];
  /** Fertiliser applications (`Fertilizacion`). */
  readonly fertilisations?: readonly Fertilisation[];
  /** Fertilisation plans (`PlanAbonado`). */
  readonly fertilisationPlans?: readonly FertilisationPlan[];
  /** Irrigations (`Riego`). */
  readonly irrigations?: readonly Irrigation[];
}

/** The holding the logbook belongs to. */
export interface Holding {
  /** The holding's code in its region's register (`CodigoRea`): `ES` and 12 digits. */
  readonly reaCode: string;
  /** The holding's SIEX code (`CodigoSIEX`): `ES` and 12 digits. */
  readonly siexCode?: string;
  /** The holder's NIF (`IdTitular`). */
  readonly holderNif: string;
  /** The NIF of the managing unit (`UnidadGestora`); the holder's own NIF when the holder keeps the logbook. */
  readonly managingUnitNif: string;
  /** The paying agency where the holding is registered (`CAExplotacion`), two characters. Catalogue `payingAgency`. */
  readonly payingAgency: string;
  /** The administration's identifier of the logbook (`IdCuaderno`), up to 8 digits. */
  readonly notebookId?: number;
  /** The holding's name: RD 1311/2012, Annex III, Part I, A.1.a. Up to 150 characters. Not part of the CUE document. */
  readonly name?: string;
  /** The holding's address: Annex III, Part I, A.1.a. Up to 250 characters. Not part of the CUE document. */
  readonly address?: string;
  /** The holder's name and surnames: Annex III, Part I, A.1.b. Up to 150 characters. Not part of the CUE document. */
  readonly holderName?: string;
}

/** A SIGPAC enclosure reference. Province and municipality use SIGPAC's codes, not INE's. */
export interface SigpacReference {
  /** `Provincia`: two digits. */
  readonly province: string;
  /** `Municipio`: three digits. */
  readonly municipality: string;
  /** `Agregado`, up to 999. */
  readonly aggregate: number;
  /** `Zona`, up to 999. */
  readonly zone: number;
  /** `Poligono`, up to 999. */
  readonly polygon: number;
  /** `Parcela`, up to 99999. */
  readonly parcel: number;
  /** `Recinto`, up to 99999. */
  readonly enclosure: number;
}

/** A crop delimitation the holding declares, because the register doesn't know it (`AltaDGC`). */
export interface CropDelimitation {
  /** The holding's own code for it (`CodigoDGCAjena`), up to 16 digits. Allocated by the application's server, never reused. */
  readonly code: string;
  /** Asks the administration to delete it (`Borrar`). */
  readonly deleted?: boolean;
  /** The parcel's cadastral reference (`ReferenciaCatastral`), up to 20 characters. */
  readonly cadastralReference?: string;
  readonly sigpac: SigpacReference;
  /** `Orden`, up to 99. */
  readonly order?: number;
  /** Sown area in hectares (`Superficie`), two decimals. */
  readonly area?: number;
  /** `FechaAltaSuperficie`. */
  readonly areaFrom?: string;
  /** `FechaBajaSuperficie`. */
  readonly areaTo?: string;
  /** `FechaInicio`. */
  readonly from: string;
  /** `FechaFin`. */
  readonly to?: string;
  /** `Cultivo`. Catalogue `crop`. */
  readonly crop: number;
  /** `Variedad`. Catalogue `variety`. */
  readonly variety: number;
  /** Irrigated (`SistemaExplotacion` `R`) or dryland (`S`). */
  readonly irrigated: boolean;
  /** `SistCultivo`. Catalogue `croppingSystem`. */
  readonly croppingSystem: number;
}

/** A crop delimitation an activity applies to: one the register knows, or one the holding declared. */
export type DgcReference =
  | {
      /** The register's code (`CodigoDGC`), up to 16 digits. */
      readonly dgc: string;
      /** The register's code of the crop on it (`CodigoCultivo`), up to 16 digits. */
      readonly cropRecord?: string;
    }
  | {
      /** The code of a crop delimitation the holding declared (`CodigoDGCAjena`). */
      readonly declaredDgc: string;
    };

/** A crop delimitation an activity applies to, with the area concerned. */
export type DgcWithArea = DgcReference & {
  /** Hectares treated, fertilised or irrigated (`Superficie`), two decimals; the whole delimitation when absent. */
  readonly area?: number;
};

/** A crop delimitation a treatment applies to. */
export type TreatmentDgc = DgcWithArea & {
  /** `EstadoFenologico`. Catalogue `phenologicalStage`. */
  readonly phenologicalStage?: number;
  /** Vegetable-garden and nursery products (`HuertaVivero.Producto`). Catalogue `crop`. */
  readonly nurseryProducts?: readonly number[];
  /** Soil covers (`Cubiertas.TipoCobertura`). Catalogue `coverType`. */
  readonly covers?: readonly number[];
};

/** A machine or piece of equipment, identified by exactly one of its registrations or the holding's own name for it. */
export interface Equipment {
  /** ROMA registration (`NumROMA`), up to 12 characters. */
  readonly roma?: string;
  /** Owned by the holding (`EquipoPropio`). */
  readonly own?: boolean;
  /** Name of equipment that can't be registered (`IdEquipoAplicador`), up to 50 characters. */
  readonly unregisteredId?: string;
  /** `PotenciaMaquinaria`, two decimals. */
  readonly power?: number;
  /** `UnidadesMedida` of the power. Catalogue `unit`. */
  readonly powerUnit?: number;
  /** `TipoMaquinariaUNE`, up to 12 characters. Catalogue `machineryTypeUne`. */
  readonly machineryTypeUne?: string;
  /** `TipoEnergia`. Catalogue `energyType`. */
  readonly energyType?: number;
  /** `NumRepeticiones`, up to 999. */
  readonly repetitions?: number;
  /** `Duracion`, two decimals. */
  readonly duration?: number;
}

/** Equipment that applied a plant-protection treatment. */
export interface TreatmentEquipment extends Equipment {
  /** REGANIP registration (`NumREGANIP`), up to 12 characters. */
  readonly reganip?: string;
  /** Applied by hand (`AplicacionManual`). */
  readonly manual: boolean;
}

/** Equipment that applied a fertiliser. */
export interface FertiliserEquipment extends Equipment {
  /** REGFER registration (`NumREGFER`), up to 50 characters. */
  readonly regfer?: string;
}

/** A plant-protection product applied in a treatment (`ProductosFito`). */
export interface TreatmentProduct {
  /** `TipoProducto`. Catalogue `productType`. */
  readonly type: number;
  /** The trade name as applied: RD 1311/2012, Annex III, Part I, B, g. Up to 250 characters. Not part of the CUE document. */
  readonly tradeName: string;
  /** Registration number in the official register (`NumRegistro`), up to 10 characters. */
  readonly registrationNumber?: string;
  /** Active substance, for an exceptional authorisation (`MateriaActiva`), up to 99999. Catalogue `exceptionalAuthorisation`. */
  readonly activeSubstance?: number;
  /** Dose (`Dosis`), three decimals. Give a dose or a quantity, not both. */
  readonly dose?: number;
  /** Quantity (`Cantidad`), two decimals. Give a dose or a quantity, not both. */
  readonly quantity?: number;
  /** `Unidad`. Catalogue `unit`. */
  readonly unit: number;
}

/** A non-chemical means of plant protection (`OtrasActuacionesFito`). */
export interface OtherProtectionMeasure {
  /** `TipoMedida`. Catalogue `protectionMeasure`. */
  readonly type: number;
  /** `Cantidad`, two decimals. */
  readonly quantity?: number;
  /** `Unidad`. Catalogue `unit`. */
  readonly unit?: number;
  /** MDF registration of the means (`NumRegistroMDF`), up to 10 characters. */
  readonly mdfRegistration?: string;
  /** `BuenasPracticas`. Catalogue `protectionGoodPractice`. */
  readonly goodPractice?: number;
}

/** The pests and problems a treatment targets (`ProblematicaFito`). At least one code in all. */
export interface TreatmentTargets {
  /** `Enfermedades.TipoEnfermedad`. Catalogue `disease`. */
  readonly diseases?: readonly number[];
  /** `ArtropodosGasteropodos.TipoPlaga`. Catalogue `pest`. */
  readonly pests?: readonly number[];
  /** `MalasHierbas.TipoMalaHierba`. Catalogue `weed`. */
  readonly weeds?: readonly number[];
  /** `ReguladoresOtros.TipoRegulador`. Catalogue `growthRegulator`. */
  readonly regulators?: readonly number[];
}

/** Who applied a treatment, and with what (`IdentificadorAplicador`). */
export interface TreatmentApplicator {
  /** The applicator's ROPO registration (`AplicadorEmpresa.NumROPO`), up to 14 characters. */
  readonly ropo: string;
  readonly equipment: TreatmentEquipment;
}

/** The adviser who validated a treatment (`AsesorValidacion`). */
export interface TreatmentAdviser {
  /** `NumROPO`, up to 14 characters. */
  readonly ropo: string;
  /** `Fecha`. */
  readonly date?: string;
  /** `Validacion`. */
  readonly validated?: boolean;
  /** `Confirmacion`. */
  readonly confirmed?: boolean;
  /** An advisory contract exists (`Contrato`). */
  readonly contract?: boolean;
  /** `Observaciones`, up to 200 characters. */
  readonly notes?: string;
}

/** A plant-protection treatment (`TratamFito`). */
export interface Treatment {
  /** The application's identifier (`IdAjenaTratamFito`), up to 10 digits. Allocated by the application's server, never reused. */
  readonly id: number;
  /** Asks the administration to delete it (`Borrar`). */
  readonly deleted?: boolean;
  /** `FechaInicio`. */
  readonly start: string;
  /** `FechaFin`. */
  readonly end: string;
  /** `HoraTratamiento`. */
  readonly time?: string;
  /** `FechaSeca`, for a herbicide or a treatment on rice. */
  readonly dryingDate?: string;
  /** Treatment on a soil cover (`Actividad`): its maintenance or its removal. */
  readonly coverActivity?: "maintenance" | "removal";
  /** `DGCs`, at least one. */
  readonly dgcs: readonly TreatmentDgc[];
  readonly targets: TreatmentTargets;
  /** Why the treatment was applied (`Justificaciones.JustAct`), at least one. Catalogue `justification`. */
  readonly justifications: readonly number[];
  /** A non-chemical means. A treatment has at least this or one product. */
  readonly otherMeasure?: OtherProtectionMeasure;
  /** Products applied. */
  readonly products?: readonly TreatmentProduct[];
  /** At least one. */
  readonly applicators: readonly TreatmentApplicator[];
  readonly adviser?: TreatmentAdviser;
  /** `Eficacia`. Catalogue `efficacy`. */
  readonly efficacy: number;
  /** `Observaciones`, up to 150 characters. */
  readonly notes?: string;
}

/** A nutrient's share of a fertiliser material. */
export interface NutrientShare {
  /** The nutrient or metal. Catalogue `macronutrient`, `micronutrient` or `heavyMetal`. */
  readonly type: number;
  /** `Porcentaje`, three decimals. */
  readonly percent?: number;
}

/** The fertiliser material applied (`MaterialFertilizante`). */
export interface FertiliserMaterial {
  /** `Material`. Catalogue `fertiliserMaterial`. */
  readonly type: number;
  /** `DetalleMaterial`. Catalogue `fertiliserMaterialDetail`. */
  readonly detail?: number;
  /** `EmpresaSuministradora`, up to 150 characters. */
  readonly supplierName?: string;
  /** The supplier's NIF, for a manure-management centre (`NifEmpresa`). Give at most one of this, `rega` and `nima`. */
  readonly supplierNif?: string;
  /** The livestock farm's REGA code (`REGA`), up to 14 characters. */
  readonly rega?: string;
  /** The waste manager's NIMA code (`NIMA`), up to 50 characters. */
  readonly nima?: string;
  /** `TratamientoEstiercoles`. Catalogue `manureTreatment`. */
  readonly manureTreatment?: number;
  readonly macronutrients?: readonly NutrientShare[];
  readonly heavyMetals?: readonly NutrientShare[];
  readonly micronutrients?: readonly NutrientShare[];
  /** `Densidad`, for a liquid, two decimals. */
  readonly density?: number;
  /** `UnidadesMedida` of the density. Catalogue `unit`. */
  readonly densityUnit?: number;
}

/** How a fertiliser material was applied (`AplicacionMaterialFertilizante`). */
export interface FertiliserApplication {
  /** `NombreProducto`, up to 250 characters. */
  readonly productName?: string;
  /** A sewage-sludge application document was used (`AplicacionLodos`). */
  readonly sewageSludge: boolean;
  /** `TipoFertilizacion`. Catalogue `fertilisationType`. */
  readonly type: number;
  /** `MetodoFertilizacion`. Catalogue `fertiliserApplicationMethod`. */
  readonly method: number;
  /** `Dosis`, two decimals. */
  readonly dose: number;
  /** `Unidad`. Catalogue `unit`. */
  readonly unit: number;
  /** REGFER code of the company that applied it (`EmpresaServicios`), up to 50 characters. */
  readonly serviceCompany?: string;
}

/** Fertiliser applied through the irrigation water (`Fertirrigacion`). */
export interface Fertigation {
  /** `SistemaRiego`. Catalogue `irrigationSystem`. */
  readonly irrigationSystem: number;
  /** Water applied (`Cantidad`), two decimals. Give a quantity or a dose. */
  readonly quantity?: number;
  /** Irrigation dose (`Dosis`), two decimals. Give a quantity or a dose. */
  readonly dose?: number;
  /** `Unidad` of the quantity or dose. Catalogue `unit`. */
  readonly unit: number;
  /** `OrigenAgua.IdOrigenAgua`. Catalogue `waterOrigin`. */
  readonly waterOrigins?: readonly number[];
  /** `NumContador`, up to 14 characters. */
  readonly meter?: string;
  /** Nitric nitrogen applied (`DosisN`), two decimals. */
  readonly nitrogenDose: number;
  /** `UnidadDosisN`. Catalogue `unit`. */
  readonly nitrogenUnit: number;
  /** Phosphorus applied (`DosisP`), two decimals. */
  readonly phosphorusDose: number;
  /** `UnidadDosisP`. Catalogue `unit`. */
  readonly phosphorusUnit: number;
  /** `TipoEnergia`. Catalogue `energyType`. */
  readonly energyType?: number;
}

/** A fertiliser application (`Fertilizacion`). */
export interface Fertilisation {
  /** `IdAjenaFerti`, up to 10 digits. */
  readonly id: number;
  readonly deleted?: boolean;
  /** `FechaInicio`. */
  readonly start: string;
  /** `FechaFin`. */
  readonly end: string;
  /** `GestionSostInsu`. */
  readonly sustainableInputManagement?: boolean;
  /** `BuenasPracticas.TipoBPF`. Catalogue `fertiliserGoodPractice`. */
  readonly goodPractices?: readonly number[];
  readonly material?: FertiliserMaterial;
  readonly application?: FertiliserApplication;
  readonly equipment?: FertiliserEquipment;
  /** `BuenasPracticasRiego.TipoBPR`. Catalogue `irrigationGoodPractice`. */
  readonly irrigationGoodPractices?: readonly number[];
  readonly fertigation?: Fertigation;
  /** `DGCs`, at least one. */
  readonly dgcs: readonly DgcWithArea[];
}

/** A fertilisation plan (`PlanAbonado`). Needs are in fertiliser units per hectare. */
export interface FertilisationPlan {
  /** `IdAjenaPlan`, up to 10 digits. */
  readonly id: number;
  readonly deleted?: boolean;
  /** `NecesidadUFN`, kg/ha, two decimals. */
  readonly nitrogenNeed: number;
  /** `NecesidadUFP2O5`, kg/ha, two decimals. */
  readonly phosphorusNeed: number;
  /** `NecesidadUFK2O`, kg/ha, two decimals. */
  readonly potassiumNeed: number;
  /** `ObjetivoProduccion`, kg/ha, two decimals. */
  readonly yieldTarget: number;
  /** `CultivoPrecedente`. Catalogue `crop`. */
  readonly previousCrop: number;
  /** Generated with a fertilisation tool (`Herramienta`). */
  readonly toolUsed: boolean;
  /** `FechaGeneracion`. */
  readonly generatedOn: string;
  /** `DGCs`, at least one. */
  readonly dgcs: readonly DgcReference[];
}

/** An irrigation (`Riego`). */
export interface Irrigation {
  /** `IdAjenaRiego`, up to 10 digits. */
  readonly id: number;
  readonly deleted?: boolean;
  /** `FechaInicio`. */
  readonly start: string;
  /** `FechaFin`. */
  readonly end: string;
  /** `SistemaRiego`. Catalogue `irrigationSystem`. */
  readonly system: number;
  /** `Cantidad`, two decimals. */
  readonly quantity: number;
  /** `UnidadMedida`. Catalogue `unit`. */
  readonly unit: number;
  /** `OrigenAgua.IdOrigenAgua`. Catalogue `waterOrigin`. */
  readonly waterOrigins?: readonly number[];
  /** `TipoEnergia`. Catalogue `energyType`. */
  readonly energyType?: number;
  /** `NumContador`, up to 14 characters. */
  readonly meter?: string;
  /** `BuenasPracticasRiego.TipoBPR`. Catalogue `irrigationGoodPractice`. */
  readonly goodPractices?: readonly number[];
  /** `DGCs`, at least one. */
  readonly dgcs: readonly DgcWithArea[];
}
