# 0007. CSV export: the printed logbook's tables, safe to open in a spreadsheet

- **Status:** Accepted
- **Date:** 2026-11-24

## Context

[ADR 0002](0002-scope-and-architecture.md) lists CSV export third, after the CUE document and the printable logbook, and asks that values a spreadsheet would run as a formula be neutralised. People ask for CSV to work in a spreadsheet: to filter treatments by product, add up doses, or hand records to an adviser or a certifier.

What shapes the format:

- **The spreadsheets these files open in are mostly set up for Spain.** They use a decimal comma, and so a semicolon to separate fields. Several of them read a CSV file as a legacy encoding unless it starts with a byte order mark.
- **A field that starts with `=`, `+`, `-` or `@` is a formula** to most spreadsheets, and a formula can fetch URLs or run commands (CSV injection, CWE-1236). Some spreadsheets also accept the full-width forms of those characters.
- **The printed logbook ([ADR 0006](0006-printable-logbook-as-html.md)) already decides what each table holds:** its columns, the text of each cell, the labels, and the order of the records. Deciding it twice would let the two drift apart.

## Decision

- **`renderLogbookCsv(logbook, { catalogues, dgcs })` returns one CSV file per table of the printed logbook,** plus one for the holding. The files are `explotacion.csv` (field and value), `parcelas-declaradas.csv` (only when the holding declares any), `tratamientos.csv`, `fertilizacion.csv`, `riego.csv` and `plan-de-abonado.csv`. A table with no records is a header row alone.
- **The printed logbook and the CSV come from one tabulation,** `src/print/tables.ts`. It decides the columns, cells, labels, order and the deletion requests left out, and each renderer only formats it. A cell's lines are joined with ` | ` in CSV and with line breaks in HTML.
- **Format:** UTF-8 with a byte order mark; fields separated by `;`; records ending in CRLF, the last one included; every field quoted, with quotes doubled. Numbers keep the printed logbook's decimal comma and dates its `dd/mm/yyyy`.
- **Formula neutralisation:** a field whose first character, after any spaces, is `=`, `+`, `-` or `@`, or the full-width `＝`, `＋`, `－` or `＠`, is prefixed with an apostrophe, which spreadsheets show as text. Control characters can't start a field, because validation rejects them in every value and label.
- **Same safety as the rest of the library:** labels are validated as untrusted input, and the same input gives the same bytes.

## Alternatives considered

- **One file with every record kind:** one download. The kinds have different columns, so the file would be a sparse union of all of them, which is hard to filter and sum.
- **One row per crop delimitation or per product:** each row would hold a single value, easier to sum. A treatment on three delimitations with two products would become six rows, which looks like six treatments to anyone counting rows. It could come later as a separate, explicitly flat export.
- **Raw codes and ISO numbers, for machines:** easier to re-import. Machines already have the CUE JSON and the model itself, and these files are for people. That is also why the files follow Spanish conventions, as the printed logbook does.
- **Comma separators and no byte order mark, plain RFC 4180:** the most portable. In a spreadsheet set up for Spain, a comma-separated file with decimal commas opens as one column, and accents can break.
- **Stripping the dangerous character instead of prefixing:** it would change the record's text. The apostrophe keeps the text whole and shows it as typed.

## Consequences

- **The printed logbook and the CSV always agree,** because they are the same tables. A new column or label appears in both.
- **A refactor moved the printed logbook's logic into the shared tabulation,** and the committed HTML snapshot stayed byte for byte the same.
- **A spreadsheet in another locale may need its import settings changed** to read the semicolons and decimal commas.
- **A prefixed field shows its apostrophe** in some programs that don't treat it as a text marker. That is the accepted cost of never running a formula.
