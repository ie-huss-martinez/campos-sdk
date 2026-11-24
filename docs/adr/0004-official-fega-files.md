# 0004. Official FEGA files: what is committed, and on what terms

- **Status:** Accepted
- **Date:** 2026-11-24

## Context

[ADR 0002](0002-scope-and-architecture.md) makes FEGA's JSON Schema the oracle for every CUE document the library renders, and keeps official files out of the repository until a record states their reuse terms. The maintainer downloaded the current documentation on 2026-11-23 from FEGA's page for the *Documentación Técnica Agrícola SIEX*:

- **Anexo VI "Interfaz Único Común", 4.10.0,** of 27 October 2026. It embeds the schema of the CUE document, version 3.11.4, and two descriptor spreadsheets.
- **Anexo V 3.11,** the definition of the variables, with their obligation flags.
- **The technical document 3.11, and Anexos III, VIII, IX and X.**

FEGA's site isn't reachable from where the library is developed, so the tests can't fetch the schema, and they mustn't depend on the network anyway.

FEGA's legal notice says, under "Propiedad intelectual", that its content may be reproduced "siempre que se cite su origen y se difunda sin alterar su contenido", and that its logos, marks and symbols may not be used. That is the general rule of Ley 37/2007 on the reuse of public-sector information, which allows reuse that keeps the content unaltered and cites its source. The wording is the maintainer's reading of the notice on 2026-11-23; FEGA's site couldn't be read from here to check it again.

## Decision

- **The schema of each CUE document version the library supports is committed,** under `vendor/fega/cue-<version>/`, byte for byte as FEGA published it. The first is `vendor/fega/cue-3.11.4/BdcSix-DS-DisenoCUE_3.11.4.json`.
- **Nothing in a vendored file is changed:** not its line endings, its final newline or its defects. `.gitattributes`, `.editorconfig` and Biome leave `vendor/fega/` alone. Only the file name may change, to keep paths ASCII.
- **Each vendored file has a `SOURCE.md` beside it** with the publisher, the document and its version, the page, the annex's SHA-256, the date of the download, where in the annex the file was found, its own SHA-256, and the reuse terms.
- **A test checks the vendored file's SHA-256** against the one in `SOURCE.md`, so a change to it fails.
- **Defects are worked around in the tests, in memory,** and listed in `SOURCE.md`. A fixed copy is never committed.
- **Vendored files are not published.** They are test oracles; the package ships only `dist/`.
- **FEGA's logos, marks and symbols are never used,** in the repository, the documentation or the package.
- **The other official files stay in the maintainer's local copy,** `.local/official/`, which git ignores. Anexo V, the descriptor spreadsheets and the annex's text are read there when a version is added, and cited by version and section in code and documentation.

## Alternatives considered

- **Committing nothing, and reading the schema from the local copy:** no question of terms. Tests would then pass or fail depending on what a contributor has downloaded, and CI couldn't check the renderer at all.
- **Committing every official file:** everything in one place. The annexes are large binaries, most of them are read once per version, and each would need the same care. The schema is the one file a test needs.
- **A cleaned-up copy of the schema, with its defects fixed:** simpler tests. It would no longer be FEGA's content unaltered, which the terms require, and a reader couldn't tell FEGA's rules from ours.
- **Taking the schema from another project's repository:** it was available before FEGA's site could be reached. Its licence, AGPL-3.0, can't be combined with this one, and a copy is only as trustworthy as whoever made it.

## Consequences

- **CI checks every rendered document against FEGA's own schema,** with no network.
- **A new version of the CUE document adds a folder,** with its schema and its `SOURCE.md`, and keeps the old one while the library supports it.
- **The repository carries a file it may not change.** Its defects stay visible, and the tests must cope with them.
- **If FEGA's terms change,** this record and the vendored files are reviewed.
