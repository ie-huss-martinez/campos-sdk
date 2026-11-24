# 0005. The logbook model, validation and the CUE renderer's API

- **Status:** Accepted
- **Date:** 2026-11-24

## Context

[ADR 0002](0002-scope-and-architecture.md) sets the layers: a version-neutral model, validation as the only way in, and one pure renderer per target and per document version. This record fixes the public API of the first three pieces: the model, validation and the CUE renderer for document version 3.11.4.

What the official files say, read in the maintainer's copy of Anexo VI 4.10.0 ([ADR 0004](0004-official-fega-files.md)):

- **The schema and the descriptor disagree in places.** The descriptor lists fields the schema doesn't declare, such as `DeclaraBuenasPracticas`, `AlbaranFactura` and `NifAplicador` in `Fertilizacion`, and `Asesor` and `FechaAsesoramiento` in `PlanAbonado`.
- **Crop delimitation codes are `number(16)`.** Up to 9,999,999,999,999,999, past the largest integer a JavaScript number holds exactly, 9,007,199,254,740,991. Activity identifiers are `number(10)`, which fits.
- **Many fields hold codes from catalogues** that FEGA publishes and changes on its own schedule. The descriptor names the catalogue of each.
- **Each catalogue's codes are retired, never deleted.** A retired code has a date of retirement (*fecha de baja*).

## Decision

### Scope of this version

- **The model covers what the law requires a logbook to hold:** the holding, the crop delimitations it declares (`AltaDGC`), plant-protection treatments (`TratamFito`), fertiliser applications (`Fertilizacion`), fertilisation plans (`PlanAbonado`) and irrigations (`Riego`).
- **The other eleven activity blocks of the CUE document, and `CambioCultivoDGC` and `MedidaPreventivaCultural`, wait** for a need. They're added to the model, validation and renderer together.

### The model

- **English names, with the official field in each one's documentation,** and the catalogue for each code.
- **Codes are numbers, except where the catalogue's codes are text.** Crop delimitation codes are text made of decimal digits, with no leading zero, so no code loses precision.
- **Text that is part of the record is model data,** such as a product's trade name (RD 1311/2012, Annex III, Part I, B, g), which the CUE document has no field for.
- **Text holds no control, formatting or default-ignorable character** in Unicode's terms, line breaks included. A logbook entry is one line, and every renderer can write it without escaping surprises.
- **A list of codes holds each code once** (`DUPLICATE_ITEM`). A repeat means nothing, and the CUE schema forbids it in several lists, such as a treatment's justifications.
- **A deletion is the whole record with `deleted: true`,** because the schema still requires every field of a record that carries `Borrar`.

### Validation

- **`validateLogbook(input, { catalogues })` returns a result.** On success, `value` is a `ValidLogbook`: a frozen copy that shares nothing with the input. On failure, `issues` lists every problem, up to 1,000.
- **An issue has a stable `code`, a `path`, the activity's `recordId` where it has a valid one, and an English `message`** for developers. Every issue inside an activity carries its `recordId`, unknown fields and duplicates included. Codes are part of the API.
- **An issue never contains the input,** not even the name of an unknown field, unless that name looks like an identifier of at most 64 characters (`[A-Za-z_][A-Za-z0-9_]*`); any other name is shown as `"?"`. A field name like `90000001N` or `Juan García` is data, and stays out of logs.
- **Input is read defensively:** only own data properties are read, accessors on objects and in lists are rejected without being called, the options are read once, objects with more than 64 fields and lists past their bounds are rejected before they are read, and text longer than twice its limit isn't measured.
- **Rules come from the law and the official documents.** Formats, lengths and precision follow the descriptor of document version 3.11.4, which today is the only one. Spanish NIFs are checked by their check character.
- **Catalogues are the application's.** It may pass snapshots of the catalogues it has, under the library's names in `CATALOGUE_NAMES`. For every catalogue given, each code must be in it and not retired on or before its record's date: an activity's start, a plan's generation date, a delimitation's start. Catalogues not given aren't checked. Snapshots are untrusted input and are validated first. The library bundles no catalogue and fetches nothing.

### Rendering

- **`renderCue(logbook, { version })` takes a `ValidLogbook` and a version that must be named,** and returns the document as compact JSON text, with the version it follows. The same logbook gives the same bytes.
- **The renderer writes its own JSON,** so a 16-digit code is written exactly, keys follow the schema's order, and absent optional values and empty lists are left out.
- **Only fields the schema declares are written.** Where the descriptor and the schema disagree, the schema wins, because it is what a document is checked against.
- **What the version requires and the model leaves optional is an issue** (`REQUIRED_BY_TARGET`), such as 3.11.4's required fertilisation good practices. **What the version can't hold is an issue too** (`NOT_REPRESENTABLE`), such as fertiliser equipment identified only by REGFER, which the schema's `oneOf` rejects because of a defect.
- **`cueVersionForInterface(version)`** maps a version of the interface, such as the one a community's `version` method reports, to the document version it carries. A version the library hasn't read is `UNSUPPORTED_VERSION`.

### Tests

- **Every document the fixtures render is validated against FEGA's schema,** and every key it writes must be one the schema declares, because the schema itself lets unknown keys through.
- **Fixtures are fictional,** with NIFs that pass their check but come from ranges that aren't issued.

## Alternatives considered

- **Crop delimitation codes as numbers:** simpler for most applications, whose codes are small. A code past 2^53 would be silently changed, and the administration would apply the record to another delimitation. Text costs one conversion.
- **Codes as `bigint`:** exact, but `bigint` doesn't survive `JSON.stringify` or `structuredClone` in every runtime, and ADR 0002 wants plain data.
- **Rendering with `JSON.stringify`:** no writer to maintain. It can't write a 16-digit integer exactly.
- **Writing the descriptor's extra fields:** they may be what some community expects. The schema is what documents are validated against, and a field it doesn't declare can't be tested here. If a community needs one, a later version adds it with a source.
- **Bundling catalogues, or fetching them:** see ADR 0002. A snapshot the application already keeps is enough to check codes, and keeps the library small and offline.
- **Naming unknown fields always, or never:** always would let a name written as a key reach logs; never would leave a developer guessing which field is misspelt.
- **Allowing line breaks in notes:** some users would like them. The CUE's descriptor doesn't say how they are treated, and a printed or tabular logbook would need a rule for them. Disallowed until a need and a source say otherwise.

## Consequences

- **An application maps its records to the model once,** and gets validation with paths it can show next to its own fields.
- **Applications with large crop delimitation codes are safe;** all of them pay a string where a number would do.
- **New activity blocks add types, readers, renderer functions and fixtures,** and their fields join the schema checks.
- **UNVERIFIED, to settle when a source says:** the paying agency codes' format (two characters, digits or capitals, is accepted); the codes of the catalogue entries that make a field compulsory, such as the plant-protection product type that requires a registration number, or the good practice of green manure that makes `material` and `application` optional; and the 1,000-record limit per submission one vendor reports, which isn't enforced.
