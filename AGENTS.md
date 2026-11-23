# Working in this repository

`@hussmartinez/campos-sdk` is a public, Apache-2.0 TypeScript library that builds Spain's *Cuaderno Digital de Explotación Agrícola* (CUE) from typed records. Farms will rely on its output to meet a legal obligation, so treat correctness and provenance as the product. Code, commits and pull requests should read as professional work.

## Before changing anything

- Read the decision records in [`docs/adr`](docs/adr). They are binding. To change a decision, write a new record that supersedes the old one, in the same pull request as the change.
- [ADR 0002](docs/adr/0002-scope-and-architecture.md) says what the library does and what it leaves to the application. Check a new feature against it first.

## Rules that never bend

- **No `@hussmartinez/*` dependency** ([ADR 0001](docs/adr/0001-independence-from-the-sdk-family.md)). Not `sdk-core`, not `sdk-config`, not as a dev dependency, and no shared preset. Copying a configuration file's content is fine; importing it is not.
- **Runtime dependencies need a decision record.** The default is none. Development tools are pinned.
- **Official sources only.** The CUE format comes from FEGA's *Documentación Técnica Agrícola SIEX*: Anexo VI (the common interface and its JSON Schema) and Anexo V (the variables). Legal fields come from the consolidated texts in the BOE.
  - Never copy from another project's code, notes or copy of the schema. In particular, nothing comes from `clozanoruiz/terrazgo`, which is AGPL-3.0.
  - A maintainer's download of the official files lives in `.local/official/`, which git ignores. Don't commit an official file until a decision record states its reuse terms.
  - Anything not yet confirmed against an official file is marked `UNVERIFIED` where it is written, in code comments and in documentation, with the source it came from. Don't guess a field, a code or a limit.
- **Fixtures are fictional.** Invented holdings, REA codes and people, with NIFs that pass the checksum but belong to nobody. No real farm or personal data, anywhere in the repository.
- **Input is untrusted.** Validate at the boundary and report every problem with the record and the field it is in. Escape every value written to printable or tabular output.
- **No I/O.** No network, file system, clock or randomness in library code. Transport, certificates, signing and storage belong to the application.
- **Language.** English for code, comments, commits and documentation. Spanish terms are used as identifiers where they are the official names in the law or in FEGA's annexes, such as REA, DGC and SIGPAC.

## Making changes

- **Pull requests:** work on a branch and open one focused pull request per change. Never push to `main`.
- **One pull request at a time:** after opening one, wait until its checks are green on the current head and every review thread is resolved, then stop and report its link, its head commit and a short summary. Start the next change only once it is merged, from an up-to-date `main`.
- **Never merge your own pull request.** A separate reviewer reads the full diff and squash-merges it. Author and reviewer are always different sessions.
- **Titles:** Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `build:`, `ci:`, `chore:`), a lowercase subject, and 65 characters or fewer, for pull request titles and for every commit on a branch. The pull request title becomes the commit on `main`.
- **Changesets:** a pull request that changes what the package publishes adds one with `pnpm changeset`, written for users. See [CONTRIBUTING.md](CONTRIBUTING.md#changesets).
- **Descriptions:** what changed, why, and how it was tested, including what was not run.
- **Signing:** commits are signed. Don't disable signing.
- **No attribution:** no AI or tool attribution in commits or pull requests.
- **Decision records:** add one for anything that affects the public API, the output formats, security or dependencies, or that is hard to reverse.

## Verifying changes

[ADR 0003](docs/adr/0003-tooling-build-and-release.md) describes the tooling, and [CONTRIBUTING.md](CONTRIBUTING.md#set-up) lists the commands.

- **Hooks are the local bar.** They run on their own: the hidden-character check and Biome on commit, commitlint on each message, and `pnpm verify:fast` on push. Never use `--no-verify`.
- **`pnpm verify` is what CI runs:** lint, the independence check, types, tests with coverage, the build and the package checks. Run it before opening a pull request; it takes under a minute.
- **Library code in `src/` uses the language only.** If the type check reports a missing `fetch`, `process` or `console`, or the linter reports `Date`, `Math.random()` or a `node:` import, the fix is in the design, not in the configuration.
- **Coverage stays at 100% of lines and functions.** Leave a line out only with `/* v8 ignore next -- <reason> */`.
- **In the description,** say what you ran and what you left to CI.

- **Never weaken a check to make it pass.** Fix the cause, or propose the change to the rule in its own pull request.
- **A failure that only shows in CI is real.** Find its cause. Don't rerun until it passes.

## Keeping state

- **Task state** lives in `.local/HANDOFF.md`, which git ignores. Update it after every step: the goal and decisions, what is done with pull requests and commits, the exact next step, and open questions. Another agent with no other context must be able to continue from it.
- **Durable memory**, such as a rule from the maintainer, goes in the maintainer's knowledge base, in this project's agent memory. Never in a tool's private memory, and never in the repository.
- **No secrets** in either place.
