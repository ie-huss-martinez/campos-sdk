# campos-sdk

A TypeScript library that builds Spain's *Cuaderno Digital de Explotación
Agrícola* (CUE), the farm logbook the Spanish administration requires, from
plain typed records.

> **Status:** early development. Nothing is published yet, and the API will
> change.

## What it will do

- **One document model** for a holding's logbook: the holding (REA code, holder
  NIF, autonomous community), parcels by SIGPAC reference, plant-protection
  treatments, fertilisation and irrigation, with SIEX catalogue codes.
- **CUE JSON** that follows FEGA's common interface (Anexo VI of the SIEX
  technical documentation), ready for a regional IUWS endpoint.
- **A printable logbook** with the fields of RD 1311/2012, Annex III, Part I.
- **Validation** that says which record and field breaks which rule.

It is pure and dependency-light: no network calls, no storage and no
framework. Sending the document to an administration is left to the
application.

## Why

From 1 January 2027, plant-protection records in Spain must be electronic and
machine-readable (RD 1039/2025, Commission Implementing Regulation (EU)
2023/564). Fertilisation records have been required since 1 January 2026
(RD 1051/2022). Every farm-management application has to produce the same
document; this library aims to do it once, openly and correctly.

## Disclaimer

This project is not affiliated with or endorsed by MAPA, FEGA or any
autonomous community. Check the output against the official documentation
before relying on it.

## Licence

[Apache-2.0](LICENSE).
