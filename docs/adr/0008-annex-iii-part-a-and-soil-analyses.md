# 0008. Annex III, Part I, section A in the model, and soil analyses

- **Status:** Accepted
- **Date:** 2026-11-26
- **Amends:** [ADR 0006](0006-printable-logbook-as-html.md), whose consequences said sections A.1.c to h and A.3 weren't printed yet

## Context

Section A of RD 1311/2012, Annex III, Part I is the logbook's general part. It was read in the consolidated text in the BOE on 2026-11-23.

- **A.1, holding data:** (a) name, address and registration number; (b) the holder's name and NIF; (c) own staff with a professional user's card, or who can show they are advisers; (d) the recognised advisory group or entity the holding belongs to; (e) whether the holding lies wholly or partly in the protected areas of article 35; (f) water bodies used to abstract drinking water (art. 33.a), and (g) abstraction points (art. 33.b), each with its distance when outside the parcel; (h) for each piece of the holding's own application equipment, its purchase date or last inspection date and, where it has one, its ROMA number or other census reference.
- **A.2, parcels:** (a) the holding's own sequential number; (b) SIGPAC reference; (c) area in hectares; (d) SIGPAC use and land use, with species and variety for woody crops; (e) dryland or irrigated, with the irrigation system, and open air or protected, with the protection type; (f) any certification scheme and pest-management framework (art. 10).
- **A.3, soil:** (i) pH, and assimilable P₂O₅, K₂O and organic matter in the top 30 cm, from provincial maps or registers or else from analyses; (ii) heavy metals (Cd, Cu, Ni, Pb, Zn, Hg, total Cr) in the top 25 cm, where the law requires them.

Before this record the model held A.1.a and b, the crop delimitations the holding declares, and sections B and C ([ADR 0005](0005-logbook-model-validation-and-cue-api.md), [ADR 0006](0006-printable-logbook-as-html.md)).

The CUE document 3.11.4 has no block for A.1.c to h or for A.2. It has one for A.3: `Analitica` records an analysis, with the sampling date, laboratory, report number, analysis and substance types, the analysed material, and soil parameters. Those parameters are organic matter, sand, silt and clay as percentages, pH, assimilable phosphorus and potassium in ppm, total nitrogen, and conductivity in dS/m. It has no field for heavy metals.

## Decision

### Model

- **A.1.c to h are fields of the holding:** `staff`, `advisoryEntity`, `protectedArea` (`none`, `partial` or `whole`), `waterBodies`, `abstractionPoints` and `ownEquipment`.
  - A distance is in whole metres, given only when the source lies outside the parcel.
  - A piece of equipment needs its purchase date, its last inspection date, or both.
- **A.2 is a `parcels` list,** separate from crop delimitations. A parcel is the holding's own numbering of a SIGPAC enclosure, which A.2 asks for. A crop delimitation (DGC) is SIEX's unit of a crop on land, which activities refer to.
  - Numbers are unique.
  - The area has four decimals, as SIGPAC gives it.
  - The SIGPAC use is a two-letter code from the `sigpacUse` catalogue.
  - An irrigation system goes only with an irrigated parcel, and a protection type only with protected cultivation.
- **A.3 is a `soilAnalyses` list of activities,** each with an identifier as other activities have.
  - `source` says where the data comes from: `laboratory` for an analysis, or `map` for provincial maps or registers.
  - Its parameters are the CUE's, in the CUE's units.
  - Heavy metals are in mg/kg. They are model data, printed but not part of the CUE document, as a product's trade name is.
- **A list of crop delimitations refers to each one once,** in every activity. The CUE schema forbids repeats in `Analitica`, and a repeat means nothing anywhere. This extends [ADR 0005](0005-logbook-model-validation-and-cue-api.md)'s rule for lists of codes.
- **New catalogues:** `sigpacUse`, `analysedMaterial`, `analysisType` and `analysedSubstance`.

### CUE document

- **Laboratory analyses are written as `Analitica`,** with their parameters as `ParametrosSuelo`. 3.11.4 requires the analysed material, so a laboratory analysis without it is `REQUIRED_BY_TARGET`.
- **Data from maps or registers isn't written.** It isn't an analysis anyone carried out, and the block is for "análisis realizados".

### Printed logbook and CSV

- **Section A gains:**
  - two holding rows, for the advisory entity and protected areas;
  - a table for each of staff (A.1.c), drinking water (A.1.f and g) and own equipment (A.1.h);
  - a table of parcels (A.2);
  - a table of soil data (A.3).

  The tables come in the annex's order, before sections B and C. The CSV export gains the same tables as files, since both come from one tabulation ([ADR 0007](0007-csv-export.md)).
- **A section with no data says so,** as the others do.
- **Identifiers carry a word naming them,** as ADR 0007 requires: `Parcela 1`, `ROPO …`, `Censo …`.

### UNVERIFIED

- **Phosphorus and potassium:** whether the CUE's assimilable phosphorus and potassium in ppm are P and K or P₂O₅ and K₂O. The descriptor says "ppm de fósforo asimilable", and Annex III asks for P₂O₅ and K₂O. The model and the printed headings say phosphorus and potassium, and take the value as given.
- **Heavy metal units:** mg/kg is this library's unit for them; the annex names no unit.
- **The catalogue codes** of the analysed material, the analysis types and the substances aren't known here. The application supplies them.

## Alternatives considered

- **A.2 as more fields on crop delimitations:** one list instead of two. A delimitation is the administration's and changes with each crop, while A.2 is the holding's own list of parcels. Merging them would tie the holding's numbering to SIEX's codes.
- **Soil data on the parcels:** simpler for data from maps. An analysis has its own date, laboratory and report, can cover several parcels, and is a CUE activity with an identifier. One list of activities serves both sources.
- **Sending data from maps as `Analitica`:** more data reaches the administration. It would present a map reading as an analysis carried out on a date, which it isn't.
- **Leaving section A to the application:** less model. Then the printed logbook couldn't be the complete logbook the regulation describes, which is the point of printing it.

## Consequences

- **The printed logbook covers all of Annex III, Part I:** sections A, B and C.
- **ADR 0006's statement that A.1.c to h and A.3 aren't printed no longer holds.**
- **Laboratory soil analyses reach the administration through the CUE document;** heavy metals and data from maps stay in the printed and exported logbook.
- **An application that already sends repeated crop delimitations in one activity now gets `DUPLICATE_ITEM`.** Nothing is published yet, so no user is affected.
