---
"@hussmartinez/campos-sdk": minor
---

First release. Builds Spain's Cuaderno Digital de Explotación Agrícola from typed records of a holding:

- `validateLogbook` checks untrusted records and returns a frozen logbook, or every issue with a stable code and a path, never the rejected value. It checks NIFs, dates, formats and limits, and optionally codes against your SIEX catalogue snapshots.
- `renderCue` writes the CUE document, version 3.11.4 of FEGA's Anexo VI, for an IUWS `crear` call: treatments, fertilisation, fertilisation plans, irrigation, soil analyses and declared crop delimitations. `cueVersionForInterface` maps a community's interface version to it.
- `renderLogbookHtml` prints the whole of RD 1311/2012, Annex III, Part I as one self-contained HTML document, in Spanish.
- `renderLogbookCsv` exports the same tables as CSV files for spreadsheets set up for Spain, with formulas neutralised.
