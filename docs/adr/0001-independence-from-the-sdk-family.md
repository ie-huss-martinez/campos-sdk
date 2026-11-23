# 0001. Independence from the `@hussmartinez` SDK family

- **Status:** Accepted
- **Date:** 2026-11-23

## Context

This library shares a GitHub organisation and an npm scope with the `@hussmartinez` SDK family: client-side editors for PDF, image, audio and video files, built on a shared runtime (`sdk-core`), a design system (`ui`) and shared tooling presets (`sdk-config`). On 2026-11-22 the family moved into one repository and one pnpm workspace, so that a shared change lands in a single pull request ([ADR 0064 in sdk-core](https://github.com/ie-huss-martinez/sdk-core/blob/main/docs/adr/0064-one-repository-for-the-family.md)).

`campos-sdk` is a different kind of package:

- **It is a domain library, not an editor.** It turns records of a Spanish agricultural holding into the documents the administration asks for. It has no interface, no workers and no media engine, and it runs on a server as readily as in a browser.
- **Its users are different.** A farm-management application that needs a CUE has no use for the family's runtime, namespace or design system, and should not have to learn them or install them.
- **Its clock is different.** It changes when FEGA publishes a new version of its annexes or when the law changes, not when the family's tooling does.
- **It shares no code with the family.** The family's standards are about editors: the `hm-` namespace, entry points for React and custom elements, CSS layers, worker messaging, browser test images. None of it applies here.

The maintainer decided on 2026-11-23 that this library is independent of the family.

## Decision

**`campos-sdk` lives in its own repository and depends on no `@hussmartinez/*` package.**

- **No dependency of any kind:** not in `dependencies`, `devDependencies`, `peerDependencies` or `optionalDependencies`, and not through a configuration that extends one of the family's presets. This includes `sdk-core` and `sdk-config`.
- **Its own tooling.** The compiler, linter, test and release configuration are files in this repository. Copying the content of a configuration file from the family is fine; importing it is not.
- **Its own rules.** The decision records in this repository and [`AGENTS.md`](../../AGENTS.md) are what a change is reviewed against. The family's `STANDARDS.md` does not apply.
- **It is not a member of the family's workspace.** It has its own lockfile, CI, versions and releases.
- **A check enforces it.** Once the repository has tooling, its verification fails if `package.json` or the lockfile names a package in the `@hussmartinez` scope other than this one.

What it keeps in common with the family is process, not code: Conventional Commits, squash merges onto a linear `main`, signed commits, decision records in `docs/adr`, review by someone other than the author, the Apache-2.0 licence, and the organisation and npm scope it is published under.

## Alternatives considered

- **A package in the family's workspace:** one place for everything, and the tooling would come for free. The reasons for that workspace don't hold here: there is no shared code to change together. The costs would: every change to the family's shared packages would verify this one, its releases would wait on a workflow built for nine packages with browser suites, and its contributors would clone a repository of editors to fix a date format.
- **A dev dependency on `sdk-config` for its presets:** it would save a handful of configuration files. It would also tie this library's tool upgrades to the family's release cadence, install presets for stylelint, Playwright and dependency rules that mean nothing here, and add a package to the supply chain of a library whose selling point is that it has almost none.
- **A runtime dependency on `sdk-core` for its error class and helpers:** the library needs a result type and a list of issues, which is a few lines. A dependency for that would be installed by every server that builds a logbook.
- **Another organisation or an unscoped package name:** the choice has no technical effect. The scope is the maintainer's identity on npm, and the organisation already has the release set-up.

## Consequences

- **Some configuration is duplicated,** and it may drift from the family's. That is accepted: the two have different needs, and a few files are cheap to keep.
- **Improvements to the family's tooling don't arrive on their own.** They are copied in when they are worth having.
- **The repository sets up its own CI, releases and trusted publisher** on npm.
- **A reviewer checks a pull request against this repository's records,** not against the family's standards.
- **The library can be read, installed and audited alone,** which matters for a package that handles tax identifiers and produces a legal record.
