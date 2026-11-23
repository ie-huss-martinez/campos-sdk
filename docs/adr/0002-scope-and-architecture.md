# 0002. Scope and architecture: one model, validated at the boundary, rendered per target

- **Status:** Accepted
- **Date:** 2026-11-23

## Context

### The obligation

A Spanish agricultural holding must keep a logbook, the *cuaderno de explotación*:

- **Plant-protection treatments,** with the fields of Annex III, Part I of [RD 1311/2012](https://www.boe.es/buscar/act.php?id=BOE-A-2012-11605) (art. 16). Paper is allowed until 31 December 2026. From 1 January 2027 the record must be electronic ([RD 1039/2025](https://www.boe.es/eli/es/rd/2025/11/19/1039), final provision 1) and machine-readable ([Implementing Regulation (EU) 2023/564](https://eur-lex.europa.eu/eli/reg_impl/2023/564/oj), art. 2).
- **Fertilisation and irrigation,** recorded within a month of each application since 1 January 2026 ([RD 1051/2022](https://www.boe.es/buscar/act.php?id=BOE-A-2022-23052), arts. 4 and 5), in the same logbook (Annex III, Part I, C).

[RD 1054/2022](https://www.boe.es/buscar/act.php?id=BOE-A-2022-23054) names the electronic form of that logbook the *Cuaderno Digital de Explotación Agrícola* (CUE). Its consolidated text, as amended by RD 34/2025 with effect from 1 July 2023, separates what is compulsory from what is not:

- **The logbook is compulsory; the CUE is one way to keep it.** A holder must have a logbook when sectoral rules say so, and "podrán optar" to keep it as a CUE. Keeping it electronically is voluntary unless a sectoral rule requires an electronic record, as RD 1311/2012 does for treatments; otherwise it may be kept on paper (art. 9.1).
- **The CUE as a whole becomes compulsory later,** "para el siguiente periodo de programación de la PAC", and only for holdings with more than 30 ha of permanent crops and arable land, more than 5 ha irrigated, or more than 0.1 ha of greenhouse (final provision 8.2). The text gives no date.
- **Sharing it is the holder's decision.** Holders "decidirán de forma voluntaria poner a disposición de la administración, a través de los REA correspondientes, la información que hayan cumplimentado en el CUE" (art. 10.2).
- **A holder may use any software** that meets the technical requirements and has the minimum content of Annex II, and the authorities develop the interfaces that connect it to SIEX (art. 10.3).

**Whether the 2027 rule also means sending is not settled (UNVERIFIED).** RD 1311/2012 says the treatment record "deberá registrarse de manera electrónica en la aplicación que se habilite al efecto por la autoridad competente", within a month of the treatment (art. 16.1), and that the data "deberán ser proporcionados, al menos, con carácter mensual" (art. 16.5). Read beside art. 10.2 above, the texts don't say whether a record kept in other software must also reach the administration's system every month. This record doesn't resolve it, and the design doesn't depend on the answer.

### The format

- **There is one contract and many endpoints.** FEGA publishes the *Documentación Técnica Agrícola SIEX*. Its Anexo VI, "Interfaz Único Común", defines the web services (IUWS) and the CUE document; its Anexo V defines the variables. Each autonomous community runs the services on its own host, and software sends a holding's CUE to the community where the holding is registered.
- **The document has a schema.** Anexo VI embeds a JSON Schema (draft-07) for the CUE document, and a descriptor spreadsheet, `BdcSix-DS-DiseñoCUE.xlsx`, that defines each field.
- **Two things are versioned, and they move apart.** Anexo VI is at 4.10.0, of 27 October 2026. Its change log says that 4.10.0 changed only the transport: a new `IUWS-Consumer` header and more accepted certificate types. The last version that changed the CUE document was 3.11.4, of 19 November 2025. The schema file carries no version of its own.
- **It changes.** The technical document must be updated at least once a year ([Resolución of 25 May 2023](https://www.boe.es/diario_boe/txt.php?id=BOE-A-2023-13035) of the Secretaría General de Agricultura y Alimentación). The three versions before 4.10.0, in under two months of 2025, each changed which fields are compulsory. A larger change, SIEX 5.9.0 with a new set of documents, is reported for about September 2027 (UNVERIFIED; the annex itself only says the new header becomes compulsory "a partir de la versión 5.9 del interfaz").
- **Communities move at their own pace.** Nothing says that all of them accept a new version on the same day. The interface has a `version` method that reports which one a community's service is working with.

### What forces a design

- **An application must be able to produce two things from the same records:** the CUE document, for when the holder sends the logbook to the administration, and a logbook a person can read, print and show at an inspection.
- **The records are untrusted.** They are typed by people in a field, imported from files, and synchronised from devices that were offline.
- **They contain personal data:** tax identifiers, names, and the registration numbers of applicators and advisers.
- **Applications differ in everything else:** where they run, how they store data, how they authenticate to a community's services, and under whose certificate.

### The state of our sources

What this record says about the interface was checked against the maintainer's download, of 23 November 2026, of FEGA's Anexo VI 4.10.0 and the schema embedded in it. Legal statements cite the consolidated texts in the BOE. What could not be checked there is marked UNVERIFIED.

FEGA's site can't be reached from where this library is developed, so nothing in the library or its tests may depend on fetching from it.

## Decision

### Scope

The library turns typed records of a holding into the documents the administration asks for. In order of delivery:

1. **The CUE document** of Anexo VI, as JSON, ready for an application to send.
2. **The printable logbook,** with the fields of RD 1311/2012, Annex III, Part I (A the holding, B treatments, C fertilisation) and irrigation.
3. **CSV export** of the same records.

Everything else belongs to the application:

| Out of scope | Why |
|---|---|
| Network calls and the IUWS transport | They need a community's endpoint, a registration with that community and a retry policy. A library that makes no requests can run anywhere and be audited quickly. |
| Certificates and message signing | The private key belongs in the application's secret store, on a server. |
| Storage and synchronisation | Each application has its own. |
| Allocating the activity identifiers | See [Activity identifiers](#activity-identifiers). |
| Catalogue data | The administration updates its catalogues on its own schedule, not this library's. The model carries codes; the application owns its catalogue snapshot, and passes the labels a printed document needs. |
| Reading a holding's export from a community's register | It may come later, with its own record. |
| A user interface | The library returns data and documents. |
| Legal advice | The library applies rules it can cite. It doesn't decide whether a holding is exempt or a deadline is met. |

### One direction, three layers

```text
records from the application        (untrusted)
        │  validate
        ▼
     logbook model                  (validated, immutable, version-neutral)
        │  render, one module per target
        ├──► CUE JSON, for one named document version
        ├──► printable logbook   ◄── labels for catalogue codes (validated)
        └──► CSV
```

- **The model** is the library's own description of a holding's logbook: the holding, its parcels, and what was done on them. Every fact in a document comes from it.
- **Validation** is the only way to obtain a model from outside data.
- **Renderers** are pure functions to a document, from a model and, where a target prints the names of catalogue codes, from a table of labels. A renderer takes no other input, never reads raw data, and doesn't depend on another renderer.

Dependencies between the layers point one way: renderers import the model, validation imports the model, and the model imports nothing.

### The model

- **Plain data.** Objects, arrays, strings, numbers and booleans that survive `JSON.stringify`, with no classes and no `Date`. An application can store it, send it to a worker or put it in a queue unchanged.
- **Version-neutral.** It is not a copy of any version of the CUE schema. It covers what the law asks a logbook to hold, which is more than one version of the interface carries and will outlive it.
- **ISO dates and times.** A date is a local calendar day, `2027-01-15`; a time is a local time of day. There is no time zone: the record is of the day at the farm. Each renderer converts to its target's format.
- **Codes for what a catalogue or a register defines.** Crops, pests, units and the like are the codes of their official catalogue; registered products, people and machines are their registration numbers. The model doesn't carry a catalogue's label for a code.
- **Text that is part of the record is model data.** The trade name of a product as it was applied, which RD 1311/2012 asks for beside its registration number (Annex III, Part I, B, g), and the names of people and companies. It is a fact of the day: it must not change when a register later renames a product. It is validated, bounded and escaped like any other value. The CUE document has such fields too: 3.11.4 carries a product name in a fertiliser application (`NombreProducto`).
- **Official names where there are official names.** Identifiers are English, except terms that the law or FEGA's annexes define, which keep their Spanish name.

### Validation

- **Everything from outside is `unknown`** until validated. There is no way to build a document from unvalidated data.
- **It returns a result and doesn't throw.** Invalid data is an expected outcome, not an exception. An exception means a bug in the library.
- **It reports every problem, not the first.** A logbook with three hundred records and five mistakes gets five issues.
- **An issue says where and what.** It carries a stable code, the path to the record and the field, the record's own identifier where it has one, and a message in English for the developer. The application maps codes to its own text for users. Codes are part of the public API.
- **An issue never contains the rejected value,** so an application that logs issues doesn't log tax identifiers or names.
- **Unknown fields are rejected.** A misspelt optional field would otherwise drop data from a legal record without a word. Keys are read by name; nothing is copied from a key such as `__proto__`.
- **It bounds its own work.** Lengths and counts are checked before anything costlier, so a hostile document can't make validation slow.
- **Two kinds of rule, kept apart:**
  - rules of the model, which hold for every target: types, formats, checksums, and references between records;
  - rules of a target, which belong to its renderer: what version 3.11.4 of the CUE document requires differs from what the printed logbook requires, and from what the next version will. A renderer returns either its document or the issues that stop it.
- **Nothing is guessed.** A value a target requires and the model lacks is an issue, never a default.

### Renderers

- **Pure and deterministic.** No network, file system, clock, randomness or locale taken from the environment. The same model gives the same bytes, so an application can hash, compare and replay what it sent.
- **Every value is escaped for where it lands.** Printable output escapes all text. CSV neutralises values that a spreadsheet would run as a formula. No renderer builds output by pasting strings from the model.
- **Labels are a second, explicit input.** The name of a catalogue code, such as a crop's, is not part of the record. A renderer that prints such names takes a table of labels from the application's catalogue snapshot: plain data, from a catalogue and a code to a text.
  - The table is untrusted. It is validated under the same rules as the model, and its text is escaped like any other.
  - It is data, never a function. A lookup callback could do anything, and the same model with the same labels must give the same bytes.
  - A code with no label is never dropped: at the least, the code itself is printed. Whether that is also an issue is decided in the printable logbook's record.
- **The printable logbook's format,** HTML for printing or PDF, is decided in its own record. The constraint from here is that it adds no heavy dependency.

### Schema versions

- **The library versions the CUE document, not the annex.** A document version is named after the version of Anexo VI that last changed the descriptor or the schema, which the annex's change log states. Today that is 3.11.4, although the annex is at 4.10.0. A release of the annex that changes only the transport, as 4.10.0 did, adds nothing here: transport is out of scope.
- **A document version is pinned to one schema file,** identified by its SHA-256, because the file has no version inside it. The record of each version says which annex it was taken from and when.
- **A CUE renderer targets exactly one document version,** and its module is named for it. The first is 3.11.4.
- **The application names the version it wants.** There is no "latest" default: a library upgrade must never change what an application sends to a community that hasn't moved yet.
- **The library records which document version each version of the interface carries.** A community's `version` method reports "la versión actual con la que está trabajando el interfaz" (Anexo VI, 3.1.7). That is not a document version: a community on 4.10.0 takes document 3.11.4. The mapping comes from reading each annex's change log, which is done here, so the library ships it as data: every version of the interface it has read, with the document version it carries. The application passes what its community reported and gets the document version to name. A version of the interface the library hasn't read is an issue, never a guess. UNVERIFIED: the format of the method's response, and that the version it reports is numbered like the annex.
- **A rendered CUE document comes with the version it was built for,** so the application can store the two together.
- **A new document version is a new module beside the old one.** Adding it is not a breaking change. Removing an old one is, and happens only after the administration stops accepting it.
- **The official JSON Schema is the test oracle, not a runtime dependency.** The library's tests validate every document its fixtures produce against FEGA's schema for that version. At run time, the library's own rules do the work.
- **The schema is necessary, not sufficient.** It doesn't forbid unknown properties, so a misspelt optional field passes it. It also has defects, such as a malformed `$id`. The tests therefore also check that every property a renderer writes is one the schema declares, and the descriptor and Anexo V decide what is compulsory where the schema is silent.
- **A new version starts from a field-by-field comparison** of the new descriptor, schema and Anexo V with the old. If the law's logbook grows, the model grows with it, additively where it can.

### Activity identifiers

Each activity in a CUE document carries an integer "generado por la herramienta que envía los datos" (Anexo VI, 3.1.5), such as `IdAjenaTratamFito`. The administration uses it to report which activity failed, treats a document that repeats a known identifier as an edit of that activity, and deletes the activity when the identifier comes with `Borrar`. A crop delimitation (DGC) declared by the sender carries one too, `CodigoDGCAjena`. The schema types them as integers with no bounds; their range, and whether they must be unique per holding or more widely, are UNVERIFIED.

The library takes these integers from the application and checks them; it does not create them.

- **They must be stable and never reused.** The same activity must carry the same integer every time it is sent, and no other activity may ever take it, even after a deletion.
- **So one authority has to allocate them: the application's server.** Two devices working offline can't each pick the next free integer without colliding, and the administration reads a repeated identifier as an edit: one record would overwrite the other.
- **The library can't derive them either.** A hash of the application's own identifier into the integer's range can collide, with the same result, and a counter needs storage the library doesn't have.

### Sources and provenance

- **The CUE format comes from FEGA's official files only:** Anexo VI for the interface and its schema, Anexo V for the variables. Legal fields come from the consolidated texts in the BOE.
- **Nothing is copied from another project,** whether code, notes or a copy of the schema. Copies of the schema circulate in repositories under licences, such as AGPL-3.0, that this Apache-2.0 library can't take from.
- **Unconfirmed is labelled.** A field, code or limit that hasn't been checked against an official file is marked UNVERIFIED in the code and the documentation, with where it came from, until it is.
- **Official files stay out of the repository** until a record states their reuse terms: FEGA's legal notice and Ley 37/2007 on the reuse of public-sector information. A file committed after that is byte-identical to FEGA's, with its source, date and SHA-256 beside it. FEGA's logos and marks are never used.
- **Fixtures are fictional:** invented holdings and people, with tax identifiers that pass the checksum and belong to nobody.

### Runtime

- **No platform APIs.** The library uses the language and nothing from Node or the browser, so it runs on a server, in a browser, in a worker and at the edge.
- **No runtime dependencies by default.** Adding one needs a record that says why it can't be a few lines here.

## Alternatives considered

- **The CUE schema as the public model,** with types generated from it: the shortest path to the first document. Every yearly version would then break every caller, the printed logbook's fields that the interface lacks would have nowhere to live, and the schema's formats and defects would become the library's API.
- **Validating at run time with the official schema and a JSON Schema validator:** the rules would be FEGA's by construction. It needs a runtime dependency that compiles schemas to code, which a strict content security policy forbids in a browser; it reports problems as paths in the output, not in the caller's records; and the schema lets unknown properties through. The schema is kept as the oracle in tests, where the first two don't matter and the third is covered.
- **A validation library as a runtime dependency:** less code to write. The issues, codes and paths have to be ours anyway, and a package installed on every server that builds a legal record should bring as little with it as possible. If hand-written validation proves too costly, a record can revisit this.
- **Throwing on invalid input:** familiar, and it reports one problem per attempt. A person fixing an import needs the whole list.
- **Including the IUWS client:** an application would get submission in one package. The library would then need private keys, community endpoints and network access, could no longer run in a browser safely, and would carry the parts of the interface that are least documented and differ most between communities.
- **A default, "latest" document version:** one argument fewer. An upgrade of the library would silently change the wire format.
- **Creating the activity identifiers in the library:** see above.
- **Bundling the SIEX catalogues:** the library could check that a code exists. It would also ship megabytes that go stale between releases, and a code retired last week would pass. Checking membership against the application's own snapshot can be added without changing this design.

## Consequences

- **An application maps its records to the model once,** and gets every document from it. New targets and new document versions need no change to that mapping unless the law's logbook itself grew.
- **A yearly change to Anexo VI costs one new renderer module,** reviewed against the official comparison, with the old one still working.
- **Validation is hand-written,** which is more code to maintain and test. It is also the part of the library with the most value, and it stays free of dependencies.
- **The application carries real work:** allocating identifiers on a server, keeping catalogues and passing their labels to the printed logbook, transport, signing and storage. The documentation must say so plainly, with the reason for the identifiers.
- **The library can't promise acceptance.** A document that passes the official schema can still be refused by a community for reasons outside it, such as a code retired from a catalogue or a parcel the register doesn't know. The README keeps its disclaimer.
- **Every yearly release of the annex has to be read,** even when, like 4.10.0, it turns out to change nothing the library produces. The change log is where that is decided, and the decision is written down: the release is added to the library's table of interface versions.
- **Follow-up records:** the reuse terms of FEGA's files; the printable logbook's format; any runtime dependency; and the public API of the model and of validation, when they are written.
