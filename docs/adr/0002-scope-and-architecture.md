# 0002. Scope and architecture: one model, validated at the boundary, rendered per target

- **Status:** Accepted
- **Date:** 2026-11-23

## Context

### The obligation

A Spanish agricultural holding must keep a logbook, the *cuaderno de explotación*:

- **Plant-protection treatments,** with the fields of Annex III, Part I of [RD 1311/2012](https://www.boe.es/buscar/act.php?id=BOE-A-2012-11605) (art. 16). Paper is allowed until 31 December 2026. From 1 January 2027 the record must be electronic (RD 1039/2025, final provision 1) and machine-readable ([Implementing Regulation (EU) 2023/564](https://eur-lex.europa.eu/eli/reg_impl/2023/564/oj), art. 2).
- **Fertilisation and irrigation,** recorded within a month of each application since 1 January 2026 ([RD 1051/2022](https://www.boe.es/buscar/act.php?id=BOE-A-2022-23052), arts. 4 and 5), in the same logbook (Annex III, Part I, C).

[RD 1054/2022](https://www.boe.es/buscar/act.php?id=BOE-A-2022-23054) names the electronic form of that logbook the *Cuaderno Digital de Explotación Agrícola* (CUE). Art. 10.3 lets a holder use any software that meets the technical requirements and connects through the interfaces the administration publishes.

### The format

- **There is one contract and many endpoints.** FEGA publishes the *Documentación Técnica Agrícola SIEX*. Its Anexo VI, "Interfaz Único Común", defines the web services (IUWS) and the CUE document; its Anexo V defines the variables. Each autonomous community runs the services on its own host, and software sends a holding's CUE to the community where the holding is registered.
- **The document has a schema.** Anexo VI is reported to embed a JSON Schema (draft-07) for the CUE document (UNVERIFIED).
- **The version this library targets first is 3.11.4,** of November 2025, the latest we know of on the date of this record.
- **It changes.** The technical document must be updated at least once a year (Resolución of 25 May 2023 of the Secretaría General de Agricultura y Alimentación). A larger change, SIEX 5.9.0 with a new set of documents, is reported for about September 2027 (UNVERIFIED).
- **Communities move at their own pace.** Nothing says that all of them accept a new version on the same day.

### What forces a design

- **Every farm-management application has to produce the same two things:** the CUE document for the administration, and a logbook a person can read, print and show at an inspection. Both come from the same records.
- **The records are untrusted.** They are typed by people in a field, imported from files, and synchronised from devices that were offline.
- **They contain personal data:** tax identifiers, names, and the registration numbers of applicators and advisers.
- **Applications differ in everything else:** where they run, how they store data, how they authenticate to a community's services, and under whose certificate.

### The state of our sources

FEGA's site can't be reached from where this library is first developed. Until the official Anexo V and Anexo VI are in hand, what this record says about the content of the CUE document comes from the law, from the communities' official pages, and from secondary reports. Statements about the document's content are marked UNVERIFIED below. The architecture doesn't depend on them.

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
| Catalogue data | SIEX catalogues are many, large, and updated one by one with no common version. The model carries codes; the application owns its catalogue snapshot. |
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
        ├──► CUE JSON, for one named schema version
        ├──► printable logbook
        └──► CSV
```

- **The model** is the library's own description of a holding's logbook: the holding, its parcels, and what was done on them. It is the only input a renderer accepts.
- **Validation** is the only way to obtain a model from outside data.
- **Renderers** are pure functions from a model to a document. A renderer never reads raw input, and no renderer depends on another.

Dependencies between the layers point one way: renderers import the model, validation imports the model, and the model imports nothing.

### The model

- **Plain data.** Objects, arrays, strings, numbers and booleans that survive `JSON.stringify`, with no classes and no `Date`. An application can store it, send it to a worker or put it in a queue unchanged.
- **Version-neutral.** It is not a copy of any version of the CUE schema. It covers what the law asks a logbook to hold, which is more than one version of the interface carries and will outlive it.
- **ISO dates and times.** A date is a local calendar day, `2027-01-15`; a time is a local time of day. There is no time zone: the record is of the day at the farm. Each renderer converts to its target's format.
- **Codes, not labels.** Crops, pests, products, units and the like are the codes of their official catalogue or register. Names for people to read are supplied by the application when a document needs them.
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
- **The printable logbook's format,** HTML for printing or PDF, is decided in its own record. The constraint from here is that it adds no heavy dependency.

### Schema versions

- **A CUE renderer targets exactly one version of Anexo VI,** and its module is named for it. The first is 3.11.4.
- **The application names the version it wants.** There is no "latest" default: a library upgrade must never change what an application sends to a community that hasn't moved yet.
- **A rendered CUE document comes with the version it was built for,** so the application can store the two together.
- **A new version of the annex is a new module beside the old one.** Adding it is not a breaking change. Removing an old one is, and happens only after the administration stops accepting it.
- **The official JSON Schema is the test oracle, not a runtime dependency.** The library's tests validate every document its fixtures produce against FEGA's schema for that version. At run time, the library's own rules do the work.
- **A new version starts from a field-by-field comparison** of the new Anexo V and Anexo VI with the old. If the law's logbook grows, the model grows with it, additively where it can.

### Activity identifiers

Each activity in a CUE document carries an integer chosen by the sender, and a later correction or deletion refers to it (UNVERIFIED: the type, the range and the exact rules are in Anexo VI). The library takes these integers from the application and checks them; it does not create them.

- **They must be stable and never reused.** The same activity must carry the same integer every time it is sent, and no other activity of that holding may ever take it, even after a deletion.
- **So one authority has to allocate them: the application's server.** Two devices working offline can't each pick the next free integer without colliding, and a collision makes one farmer's record overwrite another at the administration.
- **The library can't derive them either.** A hash of the application's own identifier into the integer's range can collide, with the same result, and a counter needs storage the library doesn't have.

### Sources and provenance

- **The CUE format comes from FEGA's official files only:** Anexo VI for the interface and its schema, Anexo V for the variables. Legal fields come from the consolidated texts in the BOE.
- **Nothing is copied from another project,** whether code, notes or a copy of the schema. Copies of the schema circulate in repositories under licences, such as AGPL-3.0, that this Apache-2.0 library can't take from.
- **Unconfirmed is labelled.** A field, code or limit that hasn't been checked against an official file is marked UNVERIFIED in the code and the documentation, with where it came from, until it is.
- **Official files stay out of the repository** until a record states their reuse terms under Ley 37/2007 on the reuse of public-sector information. Until then, tests that need them read a local copy.
- **Fixtures are fictional:** invented holdings and people, with tax identifiers that pass the checksum and belong to nobody.

### Runtime

- **No platform APIs.** The library uses the language and nothing from Node or the browser, so it runs on a server, in a browser, in a worker and at the edge.
- **No runtime dependencies by default.** Adding one needs a record that says why it can't be a few lines here.

## Alternatives considered

- **The CUE schema as the public model,** with types generated from it: the shortest path to the first document. Every yearly version would then break every caller, the printed logbook's fields that the interface lacks would have nowhere to live, and the schema's formats and defects would become the library's API.
- **Validating at run time with the official schema and a JSON Schema validator:** the rules would be FEGA's by construction. It needs a runtime dependency that compiles schemas to code, which a strict content security policy forbids in a browser; it reports problems as paths in the output, not in the caller's records; and it would ship a file whose reuse terms aren't settled. The schema is kept as the oracle in tests, where none of that matters.
- **A validation library as a runtime dependency:** less code to write. The issues, codes and paths have to be ours anyway, and a package installed on every server that builds a legal record should bring as little with it as possible. If hand-written validation proves too costly, a record can revisit this.
- **Throwing on invalid input:** familiar, and it reports one problem per attempt. A person fixing an import needs the whole list.
- **Including the IUWS client:** an application would get submission in one package. The library would then need private keys, community endpoints and network access, could no longer run in a browser safely, and would carry the parts of the interface that are least documented and differ most between communities.
- **A default, "latest" schema version:** one argument fewer. An upgrade of the library would silently change the wire format.
- **Creating the activity identifiers in the library:** see above.
- **Bundling the SIEX catalogues:** the library could check that a code exists. It would also ship megabytes that go stale between releases, and a code retired last week would pass. Checking membership against the application's own snapshot can be added without changing this design.

## Consequences

- **An application maps its records to the model once,** and gets every document from it. New targets and new schema versions need no change to that mapping unless the law's logbook itself grew.
- **A yearly change to Anexo VI costs one new renderer module,** reviewed against the official comparison, with the old one still working.
- **Validation is hand-written,** which is more code to maintain and test. It is also the part of the library with the most value, and it stays free of dependencies.
- **The application carries real work:** allocating identifiers on a server, keeping catalogues, transport, signing, storage, and names for the printed logbook. The documentation must say so plainly, with the reason for the identifiers.
- **The library can't promise acceptance.** A document that passes the official schema can still be refused by a community for reasons outside it, such as a code retired from a catalogue or a parcel the register doesn't know. The README keeps its disclaimer.
- **Until the official annexes are read, the CUE renderer can't be finished.** Work that doesn't depend on them comes first.
- **Follow-up records:** the reuse terms of FEGA's files; the printable logbook's format; any runtime dependency; and the public API of the model and of validation, when they are written.
