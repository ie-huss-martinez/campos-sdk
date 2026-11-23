# Contributing

Thank you for helping. Farms will use this library to keep a legal record, so changes are reviewed for correctness against official sources as much as for code quality.

By taking part, you agree to follow the [code of conduct](CODE_OF_CONDUCT.md). To report a vulnerability, follow the [security policy](SECURITY.md) instead of opening an issue.

## Before you start

- **Open an issue first** for anything bigger than a small fix, so we can agree on the approach before you spend time on it.
- **Read the [decision records](docs/adr).** They are binding. [Scope and architecture](docs/adr/0002-scope-and-architecture.md) says what the library does and what it leaves to the application.
- **Coding agents** also start with [`AGENTS.md`](AGENTS.md).

## Set up

You need Node 24 (see [`.node-version`](.node-version)) and pnpm, through Corepack. pnpm switches to the version pinned in `package.json` automatically.

```sh
corepack enable
pnpm install       # also installs the git hooks
pnpm verify:fast   # the subset the pre-push hook runs
pnpm verify        # everything CI runs
```

| Command | What it does |
|---|---|
| `pnpm lint` | Biome's linter and formatter, and the hidden-character check |
| `pnpm typecheck` | TypeScript, for the library and, separately, for tests and scripts |
| `pnpm test` | Vitest |
| `pnpm test:coverage` | Vitest, failing below the coverage thresholds |
| `pnpm build` | The ES module and CommonJS builds, with declarations, into `dist/` |
| `pnpm check:package` | publint and Are the Types Wrong, on the packed package |
| `pnpm check:independence` | Fails on any dependency on another `@hussmartinez` package ([ADR 0001](docs/adr/0001-independence-from-the-sdk-family.md)) |

The git hooks run on their own: the hidden-character check and Biome on staged files on commit, a Conventional Commits check of each message, and `pnpm verify:fast` on push. Don't bypass them with `--no-verify`. If a hook is wrong or too slow, fix it in its own pull request.

## Make a change

- **One focused change per pull request,** on a branch from an up-to-date `main`.
- **Commits** follow [Conventional Commits](https://www.conventionalcommits.org/), with a lowercase subject and a header of at most 65 characters:
  - **types:** `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `build`, `ci`, `chore` and `revert`;
  - **breaking changes** take a `!`, as in `feat!: …`, and explain the migration in the body.
- **Signed commits** are preferred.
- **Sources:** a field, code or limit comes from an official source: FEGA's annexes or the consolidated text in the BOE. Cite it. If you can't confirm it, mark it UNVERIFIED where you write it, with where it came from. Never copy from another project.
- **Fixtures** are invented: holdings, people and codes that don't exist, with tax identifiers that pass the checksum and belong to nobody.
- **Tests** sit next to the code as `*.test.ts`. Coverage must stay at 100% of lines and functions; a line left out says why.
- **Library code** in `src/` uses the language only: no platform API, no clock, no randomness ([ADR 0002](docs/adr/0002-scope-and-architecture.md)). The type check and the linter enforce it.
- **Public API:** fully typed, with TSDoc on every export.
- **Dependencies:** none at run time without an ADR. A development tool is pinned to an exact version and justified in the pull request.
- **Decisions:** anything that affects the public API, the output formats, security or dependencies, or that is hard to reverse, gets an ADR in `docs/adr` in the same pull request.

## Open a pull request

- **Title:** a Conventional Commit of at most 65 characters, because it becomes the commit title on `main` followed by ` (#NNN)`. The `pr-title` check enforces it.
- **Description:** fill in the template: what changed, why, and how you tested it, including what you ran locally and what you left to CI.
- **Changeset:** add one if the pull request changes what the package publishes. See [Changesets](#changesets).
- **Checks:** `verify`, `changeset` and `pr-title` must pass on the current head, and the branch must be up to date with `main`.
- **Automated review:** CodeRabbit reviews every pull request, and again after each push. Fix or answer each thread it opens, then resolve it.

A check that fails only in CI is a real failure: find its cause, and don't loosen the test or rerun until it passes.

## How pull requests are reviewed

**The author of a pull request never merges it.** A separate reviewer does, after reading the full diff against the decision records and the official sources it cites. CI must be green on the pull request's current head, no review thread may be open, and nothing "almost right" is merged.

**Coding agents** open one pull request at a time, stop and report once its checks are green and its threads are resolved, and start the next change only after it's merged. An agent never reviews or merges a pull request it wrote.

## How pull requests are merged

Pull requests are squash-merged into a linear `main`, and the reviewer writes the squash commit message:

- **Title:** the pull request title, followed by the pull request number, such as `feat: validate treatment records (#12)`.
- **Body:** 2–6 lines of plain prose, wrapped at 72 characters, saying what changed and why. No Markdown headings, checklists or test logs; those belong in the pull request.

## Changesets

Versions and release notes come from changesets, not from commit messages. A changeset is a small Markdown file in `.changeset/` with the version bump and a note for the people who use the package.

```sh
pnpm changeset
```

- **When you need one:** whenever a pull request changes what the package publishes: `src/` outside tests and fixtures, the README, the licence files, or `package.json`. The `changeset` check fails without one.
- **Dev-only `package.json` changes don't count:** a change to `devDependencies`, `scripts`, `packageManager` or `devEngines` alone needs no changeset, so Dependabot's updates pass. If a tool update changes what the build ships, add one anyway.
- **When you don't:** tests, fixtures, documentation outside the README, CI and tooling.
- **The bump:** `patch` for fixes; `minor` for new capabilities, and during `0.x` for breaking changes too; `major` only after `1.0`.
- **Write the note for users:** what changed for them, the API they'll see, and how to migrate if it breaks.

While `package.json` says `"private": true`, which it does until the first release, Changesets ignores the package, and the check passes without one.

## How releases happen

Nobody publishes by hand ([ADR 0003](docs/adr/0003-tooling-build-and-release.md)).

1. **The version pull request.** When changesets reach `main`, the release workflow opens or updates a **`chore: version packages`** pull request, which bumps the version, writes `CHANGELOG.md` and deletes the changeset files.
2. **Merging it.** It's reviewed and merged like any other pull request.
3. **Publishing.** Once it's merged, the same workflow:
   - runs the full verify and packs the tarball, in a job with read-only permissions;
   - publishes exactly that tarball to npm, with provenance;
   - creates the tag, such as `v0.2.0`, and a GitHub Release with the changelog entry, the tarball, `SHA256SUMS` and an artifact attestation.

**If a release fails part-way,** fix the cause, then **re-run the failed jobs of that same Release run,** within 7 days, while its tarball is kept. Don't merge anything else first.

- The publish job asks npm again. If npm doesn't have the version, it publishes; if npm has it, it carries on only if npm serves exactly the tarball that run built, and doesn't publish again.
- It attests that tarball and creates the GitHub Release on that run's commit, replacing a draft an interrupted run left behind.
- Until the release is complete, every later Release run fails with an error that says so. A version on npm whose tarball this repository didn't build is never attested or released by the workflow.

**After the 7 days,** the run's tarball is gone. What to do depends on whether npm has the version, which `npm view @hussmartinez/campos-sdk@<version> version` answers:

- **npm doesn't have it:** nothing was published, so nothing needs recovering. Re-run all the jobs of that Release run, or push to `main` again: the plan job asks npm again, and the pack job builds and verifies a new tarball, which the publish job then publishes.
- **npm has it:** the workflow can't finish the release, because it can't rebuild the tarball npm holds. The maintainer finishes it by hand, without an attestation, because nothing can attest a build after the fact:
  1. Open the version's page on npmjs.com and read its **Provenance** section. It must name this repository, the `release.yml` workflow and a commit. If it doesn't, stop: this repository didn't publish that version, so treat it as a security incident. (`npm view … dist.attestations` gives only the attestation's URL, not these details.)
  2. Download the tarball with `npm pack @hussmartinez/campos-sdk@<version>`, which checks it against the registry's integrity, and write its `SHA256SUMS`.
  3. Create the release on that commit: `gh release create v<version> <tarball> SHA256SUMS --target <commit> --title v<version>`, with the version's `CHANGELOG.md` entry as notes, followed by a line saying the release has no artifact attestation and that npm's provenance is the record of its build.

Either way, the next Release run finds the version complete and carries on.

## Setting up releases

One-time steps for the maintainer.

- **The release App.** The organisation's GitHub App opens the version pull request, so that its checks run. Its client ID and private key are the organisation-level `RELEASE_APP_CLIENT_ID` variable and `RELEASE_APP_PRIVATE_KEY` secret, which must give this repository access.
- **The `release` and `npm` environments,** limited to `main`, exist already.
- **The first publish.** npm can't trust a publisher for a package that doesn't exist yet, so the first version needs a token:
  1. Create a granular npm access token, limited to publishing, that expires within a day, and store it as `NPM_TOKEN` in the `npm` environment.
  2. Merge a pull request that removes `"private": true` from `package.json`, with a changeset for the first version, then merge the version pull request. The workflow publishes with the token and warns that it was used.
  3. On npmjs.com, under the package's Settings → Trusted Publisher → GitHub Actions, set organisation `ie-huss-martinez`, repository `campos-sdk`, workflow `release.yml` and environment `npm`. Under Publishing access, require two-factor authentication and disallow tokens.
  4. Delete `NPM_TOKEN` from the environment, and revoke the token on npmjs.com. Every later version publishes through the trusted publisher, with no token.
- **If the repository moves or is renamed,** update the trusted publisher before the next release.

## Licence

By contributing, you agree that your contributions are licensed under the [Apache License 2.0](LICENSE), the project's licence.
