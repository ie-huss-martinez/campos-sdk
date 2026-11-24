# 0006. The printable logbook is one self-contained HTML document

- **Status:** Accepted
- **Date:** 2026-11-24

## Context

[ADR 0002](0002-scope-and-architecture.md) asks for a printable logbook with the fields of RD 1311/2012, Annex III, Part I: A, the holding; B, plant-protection treatments; C, fertilisation and irrigation. It leaves the format, HTML or PDF, to its own record, with one constraint: no heavy dependency.

What the document is for:

- **A person reads it.** The holder checks it, an adviser signs it off, an inspector asks for it. The law asks that the logbook be shown within a month of a request (RD 1051/2022, art. 5.1), not that it be a particular file.
- **It is printed or kept as a file,** often as PDF.
- **It is Spanish.** The regulation, its field names and the inspectors are.

What the library knows:

- **The model holds codes; people read names.** [ADR 0002](0002-scope-and-architecture.md) gives labels their own input: a table the application supplies from its catalogue snapshot.
- **The model doesn't yet hold all of Part I.** It has the holding's identity (A.1.a and b), the crop delimitations the holding declares, and sections B and C. It has nothing yet for A.1.c to h (staff with professional-user cards, advisory entity, protected areas, water bodies and abstraction points, own equipment) or A.3 (soil).

## Decision

**`renderLogbookHtml(logbook, { catalogues, dgcs })` returns one HTML document,** complete and self-contained, ready to print or to save as PDF from any browser.

### Content

- **Sections follow Part I,** and columns carry the regulation's letters: A, the holding; the crop delimitations the holding declares; B, treatments (a to k); C, fertilisation (a to l) and irrigation; and the fertilisation plan.
- **Headings and fixed text are Spanish.** Code and documentation stay English.
- **Codes print with their label when the application gives one,** as `Trigo blando (1)`, and as the bare code otherwise. Labels come from the same catalogue snapshot that `validateLogbook` takes, whose entries may carry a `label`. Crop delimitations take their description from a second table, `dgcs`. A delimitation the holding declared is described by its SIGPAC reference and crop when the table has no entry for it.
- **Records that only ask the administration to delete something are left out.** They aren't entries of the logbook.
- **Records are in date order, then by identifier,** whatever their order in the input.
- **Dates are `dd/mm/yyyy`, and decimals use a comma, with no grouping,** written by the library itself, not by `Intl`, so the document is the same on every host.

### Safety

- **Every value is escaped,** labels included, for both text and attributes. No value from the input becomes markup, an attribute name or a URL.
- **The document has no script, and loads nothing.** Its content security policy is `default-src 'none'`, with `base-uri` and `form-action` also `'none'`. It allows only its own stylesheet, by the SHA-256 of its text, which a test recomputes. The policy is a second line of defence, not the first: it stops scripts, and the loading of any resource, but not navigation, so a link that escaped escaping could still be followed. Escaping is what keeps input from becoming markup.
- **Labels are untrusted input,** validated like the model: bounded, with no control or invisible characters.
- **The same logbook and labels give the same bytes.**

### Layout

- **A4 landscape, plain tables, black on white,** with the header row repeated on each printed page and rows kept whole. The system's sans-serif font: no font is embedded or fetched.

## Alternatives considered

- **PDF from the library:** the format people end up with. Writing PDF needs a layout engine and embedded fonts for Spanish text, either as a large dependency or as a great deal of code here, for output any browser already makes from HTML.
- **An HTML fragment and a separate stylesheet:** easier to embed in an application's page. A fragment can't carry its own content security policy, and the logbook is a document, not a widget. An application that wants to embed it can show the document in a sandboxed frame.
- **A data structure for the application to lay out:** maximum freedom. Every application would rebuild the same tables and the same labels, which is the work this library exists to do once.
- **English headings, or headings by locale:** the document's readers and the regulation are Spanish. Translations can come later as an option, if someone needs them.

## Consequences

- **An application gets a document an inspector can read** from the same validated model it sends as CUE.
- **The document is only as readable as the labels the application supplies.** Without them, codes print bare.
- **Sections A.1.c to h and A.3 aren't printed yet,** because the model doesn't hold them. Until it does, the application keeps them alongside the document. Adding them means new model fields, validation and columns, in a pull request of their own.
- **A change to the stylesheet changes its hash,** and the test that recomputes it says so.
