# Source of `BdcSix-DS-DisenoCUE_3.11.4.json`

This file is the JSON Schema (draft-07) of the CUE document, version 3.11.4, published by the **Fondo Español de Garantía Agraria (FEGA)**. It is reproduced here without any change ([ADR 0004](../../../docs/adr/0004-official-fega-files.md)).

| | |
|---|---|
| Publisher | Fondo Español de Garantía Agraria (FEGA), Ministerio de Agricultura, Pesca y Alimentación |
| Document | *Documentación Técnica Agrícola SIEX*, Anexo VI "Interfaz Único Común", version 4.10.0, of 27 October 2026 |
| Page | <https://www.fega.gob.es/es/siex/documentacion-tecnica-agricola-siex> |
| Annex file | `20261027-ANEXO_VI_Interfaz_Unico_Comun_V4_10_0.docx`, SHA-256 `370ef0daa8e51c0584f53a76c6301cc4661ad7362f4710a225206d3daef13899` |
| Downloaded | 2026-11-23, by the maintainer |
| Where in the annex | The object embedded as `word/embeddings/oleObject1.bin`, whose native data is a file named `BdcSix-DS-DiseñoCUE_3.11.4.json` of 243,206 bytes |
| This file | The same 243,206 bytes, with CRLF line endings and no final newline. SHA-256 `f7be0ec1b58271936806a27a3eeb592d3e5804e218927f0f9a15d7dac9555e5f` |
| Changes | None. Only the file name differs: `Diseño` is written `Diseno`, to keep paths ASCII |

The annex's change log states that version 4.10.0 changed only the transport, and that 3.11.4, of 19 November 2025, last changed the CUE document.

## Terms

FEGA's legal notice, under "Propiedad intelectual", authorises reproduction of its content "siempre que se cite su origen y se difunda sin alterar su contenido". This page cites the origin, and the file is unaltered. FEGA's logos, marks and symbols may not be used, and none are.

The file is not part of the npm package. It is used only by this repository's tests, as the oracle for the documents the library renders.

## Known defects

The schema is reproduced with its defects, which the library's tests work around in memory only:

- one `$id` is malformed: `##root/CUADERNO/items/ActividadesExplotacion/SiembraPlantacion/items/Maquinaria/items`;
- no object sets `additionalProperties`, so a misspelt property passes;
- in `Fertilizacion`, `EquipoAplicador`'s `oneOf` requires `NumREGANIP`, a property that block doesn't define (it defines `NumREGFER`).
