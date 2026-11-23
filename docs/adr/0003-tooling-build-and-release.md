# 0003. Tooling, build and release

- **Status:** Accepted
- **Date:** 2026-11-23

## Context

[ADR 0001](0001-independence-from-the-sdk-family.md) gives this library its own tooling, and [ADR 0002](0002-scope-and-architecture.md) sets what the tooling has to protect:

- **The library uses the language only.** No platform API, no I/O, no clock and no randomness, so the same model gives the same bytes anywhere it runs.
- **It has no runtime dependencies.** What it installs on a user's server is its own code.
- **Its output is a legal record.** A regression that changes a document silently is worse than one that fails loudly.

Its users are farm-management applications: servers in Node, often still in CommonJS, browsers and workers through a bundler, and edge runtimes. Its maintainers are one person and coding agents, who need checks that catch mistakes before a reviewer does, and a release that nobody runs by hand.

## Decision

### Runtimes

- **The library supports Node 22 and later,** and any runtime with ES2022. CI runs its tests on Node 22 and 26, the oldest and newest majors it supports.
- **Development uses Node 24,** written in `.node-version`, and pnpm, pinned in `package.json`'s `packageManager`.

### The package

- **One entry point, built twice:** an ES module and a CommonJS build, each with its own declarations, with `types` first in each `exports` condition. A CommonJS application on any supported Node, and test runners that load CommonJS, can `require` it without a bundler.
- **The dual-package hazard doesn't apply.** It arises when two copies of a module hold state or classes whose identity matters. The library keeps no module state and its results are plain data, which [ADR 0002](0002-scope-and-architecture.md) requires anyway. If that ever changes, this decision has to be revisited.
- **The build is [tsdown](https://tsdown.dev),** on Rolldown: one configuration for both formats and their declarations. Nothing is minified and no source maps are shipped, because the output is short and meant to be read when audited.
- **`"sideEffects": false`** and only `dist/` in the tarball.

### Checks

| Check | Tool | What it protects |
|---|---|---|
| Types | TypeScript 7, strict, with `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess` and `isolatedDeclarations` | Correctness, and explicit types on every export |
| No platform API in `src/` | `tsconfig.json` with `lib: ["es2022"]` and no `types`; tests and scripts use `tsconfig.tooling.json` | ADR 0002: `fetch`, `process`, `console` and timers are type errors in library code |
| Determinism in `src/` | Biome, with a GritQL rule that rejects `Date` and any reference to `Math.random`, aliases and destructuring included, and a rule that rejects `node:` imports | ADR 0002: no clock, no randomness, no platform module |
| Lint and format | Biome | One tool, no plugins from npm |
| Tests | Vitest, with V8 coverage of `src/`: 100% of lines, statements and functions, 95% of branches | Every line of a legal record's builder is exercised; a line left out says why |
| Packaging | publint `--strict` and Are the Types Wrong, on the packed tarball | `exports`, declarations and both formats resolve for every kind of consumer |
| Independence | `scripts/check-independence.ts` | ADR 0001: no `@hussmartinez` package in `package.json` or the lockfile |
| Hidden characters | `scripts/check-hidden-unicode.ts` | No bidirectional or invisible character a reviewer can't see, in any tracked file |

`pnpm verify` runs all of them. `pnpm verify:fast`, the independence check, types and tests, runs before every push.

### Git hooks

Husky runs three hooks: on commit, the hidden-character check and Biome on staged files; on each message, commitlint, for Conventional Commits with a lowercase subject and at most 65 characters; on push, `pnpm verify:fast`. Secrets are caught by GitHub's secret scanning with push protection, which is on for the repository, rather than by a scanner installed from npm.

### Supply chain

- **Development tools are pinned to exact versions,** with a committed lockfile.
- **pnpm refuses** versions published less than a day ago, a version whose provenance is weaker than an earlier one's, transitive dependencies from git or tarball URLs, and any install script that isn't approved in `pnpm-workspace.yaml`. None is approved. Agent skills that a package offers are denied there too, such as tsdown's.
- **Dependabot** proposes updates weekly, seven days after their release, minor and patch updates grouped, each major on its own.

### CI

- **`pr-title`** checks that the title is a Conventional Commit of at most 65 characters, with the same types as commitlint.
- **`verify`** runs the tests on Node 22 and 26, then the full `pnpm verify` on Node 24, on every pull request, every push to `main`, weekly, and by hand.
- **`changeset`** checks that a pull request changing what the package publishes has a changeset. A change to `package.json` only in `devDependencies`, `scripts`, `packageManager` or `devEngines` doesn't count, so Dependabot's updates pass.
- **Every action is pinned to a commit SHA,** each workflow declares least-privilege permissions, and checkouts keep no credentials.

### Releases

- **Changesets** writes versions and the changelog. On `main`, the release workflow opens or updates a `chore: version packages` pull request with the organisation's GitHub App, whose pull requests run the required checks.
- **When the version in `package.json` isn't on npm yet, the workflow publishes it in two jobs:**
  - **a pack job, with read-only permissions,** installs from the lockfile without a cache, runs `pnpm verify`, packs the tarball and records its SHA-256;
  - **a publish job, in the `npm` environment,** never installs or builds. It checks the tarball's SHA-256, publishes exactly that file with npm provenance through trusted publishing, attests it, and creates the tag `v<version>` and a GitHub Release with the changelog entry, the tarball and `SHA256SUMS`. No dependency's code runs where the OIDC token is.
- **An interrupted release is finished by re-running its failed jobs.** The publish job asks npm again: it publishes only if npm doesn't have the version, and otherwise carries on only if npm's integrity for it matches the tarball the pack job built. It then attests that tarball and creates the release on the run's own commit. It never attests a tarball it didn't build, and never infers which commit one came from.
- **An incomplete release can't go unnoticed.** Every Release run checks the current version: if npm has it and its GitHub Release is missing or a draft, the run fails with instructions.
- **The first version needs a token,** because npm can't trust a publisher for a package that doesn't exist. The workflow uses `NPM_TOKEN` from the `npm` environment only if it is set, and warns when it does. The maintainer creates it for the first publish and deletes it once the trusted publisher is configured, as CONTRIBUTING.md describes.
- **Until then, `package.json` says `"private": true`.** Nothing is published, and Changesets ignores the package. The pull request that removes it prepares the first release.

## Alternatives considered

- **ES modules only:** one build, and Node 22.12 and later can `require` an ES module. Test runners that load CommonJS, and the CommonJS servers that are still common in this market, would need workarounds. The second build costs one line of configuration.
- **`tsc` alone:** no bundler at all. Two outputs would need two compilations and hand-written `.cjs` and `.d.cts` handling, which is the part most often got wrong; tsdown and Are the Types Wrong cover it.
- **The SDK family's presets from `sdk-config`:** less configuration here. Ruled out by [ADR 0001](0001-independence-from-the-sdk-family.md); the Biome settings, hook rules and hidden-character list are copied in.
- **ESLint, or Prettier:** more rules and plugins, many more packages to install and update. Biome covers what this library needs, and its GritQL rules cover the rest.
- **A secret scanner in the pre-commit hook:** it catches a secret before the commit rather than at the push. GitHub's push protection already rejects the push, and a scanner adds its dependency tree.
- **A release that waits for the Verify run on the same commit,** as the SDK family's does: it doesn't run the tests twice. For one small package, running `pnpm verify` in the pack job takes a minute and keeps the workflow short, with nothing to wait for.
- **Coverage thresholds below 100%:** easier to meet. A threshold under 100% lets the lines that matter least be the ones nobody tested, and nobody chooses which.

## Consequences

- **Every check runs locally with one command,** and CI runs the same command.
- **A platform API, the clock or randomness can't enter `src/` by accident;** the type check or the linter names the rule.
- **Every line of library code needs a test,** which makes some changes slower to write.
- **TypeScript 7 has no JavaScript compiler API.** Tools that need one, such as API Extractor, can't be used until it has one or they stop needing it. The packaging checks and `isolatedDeclarations` cover the declarations meanwhile.
- **The first release needs the maintainer** for the token and the trusted publisher.
- **The required checks** (`pr-title`, `verify` and `changeset`) are set on `main`'s protection by the organisation's repository script, once the workflows are on `main`.
