# campos-sdk

A TypeScript library that builds Spain's *Cuaderno Digital de Explotación
Agrícola* (CUE), the farm logbook the Spanish administration requires, from
plain typed records.

> **Status:** 0.x. The API may still change between minor versions, and the
> changelog says how to migrate.

```sh
npm install @hussmartinez/campos-sdk
```

## What it does

- **One document model** for a holding's logbook, covering RD 1311/2012,
  Annex III, Part I: the holding, its parcels and soil, plant-protection
  treatments, fertilisation, fertilisation plans and irrigation, with SIEX
  catalogue codes.
- **Validation** that says which record and field breaks which rule, without
  ever repeating the value.
- **CUE JSON** that follows FEGA's common interface (Anexo VI of the SIEX
  technical documentation, document version 3.11.4), ready for a regional IUWS
  endpoint.
- **A printable logbook** and **CSV files** with the fields of Annex III, Part I.

It is pure and has no runtime dependencies: no network calls, no storage and no
framework. Sending the document to an administration is left to the
application.

## Usage

```ts
import {
  cueVersionForInterface,
  renderCue,
  renderLogbookHtml,
  validateLogbook,
} from "@hussmartinez/campos-sdk";

// Records from your application: untrusted until validated.
const result = validateLogbook(records, { catalogues: mySiexSnapshot });
if (!result.ok) {
  // Each issue has a stable code and a path, such as
  // { code: "INVALID_CHECKSUM", path: ["holding", "holderNif"] }, and never the value.
  return showIssues(result.issues);
}

// Name the document version the community accepts; there is no default.
const version = cueVersionForInterface("4.10.0"); // the community's interface version
if (version.ok) {
  const cue = renderCue(result.value, { version: version.value });
  if (cue.ok) {
    send(cue.value.json); // the body of an IUWS `crear` call, version "3.11.4"
  }
}
```

For people, `renderLogbookHtml` prints the same logbook with the fields of
RD 1311/2012, Annex III, Part I: one self-contained HTML document, in Spanish,
with no script, ready to print or save as PDF. Give it your snapshot's labels so
codes print with their names:

```ts
const printed = renderLogbookHtml(result.value, {
  catalogues: { crop: [{ code: 1, label: "Trigo blando" }] },
  dgcs: [{ dgc: "5", label: "Pol. 5, par. 120, rec. 3" }],
});
if (printed.ok) {
  save(printed.value.html);
}
```

`renderLogbookCsv` exports the same tables as CSV files, one per table, for
spreadsheets set up for Spain: UTF-8 with a byte order mark, `;`-separated, every
field quoted, and any field a spreadsheet would run as a formula kept as text.

The model covers all of RD 1311/2012, Annex III, Part I: the holding with its
staff, advisers, water sources and equipment, its parcels and soil data, the crop
delimitations it declares, plant-protection treatments, fertiliser
applications, fertilisation plans and irrigations. Its
fields are documented in [`src/model.ts`](src/model.ts), each with the official
CUE field it maps to. Catalogue snapshots are optional; the library checks the
codes of every catalogue you pass and bundles none.

Your server must allocate each record's `id`, and each declared crop
delimitation's `code`: stable, never reused. The administration reads a repeated
identifier as an edit of the earlier record, so two devices picking numbers on
their own would overwrite each other's records.

## Why

From 1 January 2027, plant-protection records in Spain must be electronic and
machine-readable (RD 1039/2025, Commission Implementing Regulation (EU)
2023/564). Fertilisation records have been required since 1 January 2026
(RD 1051/2022). Every farm-management application has to keep the same
records, and to build the same document when a holder shares them with the
administration; this library aims to do it once, openly and correctly.

## Design

The decisions behind the library are recorded in [`docs/adr`](docs/adr). Start
with [scope and architecture](docs/adr/0002-scope-and-architecture.md), which
says what the library does and what it leaves to the application.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Report vulnerabilities privately, as
[SECURITY.md](SECURITY.md) describes.

## Disclaimer

This project is not affiliated with or endorsed by MAPA, FEGA or any
autonomous community. Check the output against the official documentation
before relying on it.

## Licence

[Apache-2.0](LICENSE).
