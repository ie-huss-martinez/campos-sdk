<!--
The title must be a Conventional Commit with a lowercase subject, of at most
65 characters, such as "feat: validate treatment records". It becomes the
commit title on main. See CONTRIBUTING.md for how pull requests are merged.
-->

## What

<!-- What changed, in a few bullet points. -->

## Why

<!-- The problem this solves, with links to issues, ADRs and official sources. -->

## How it was tested

<!-- What you ran locally, what you left to CI, and anything you checked by hand. -->

## Checklist

- [ ] The git hooks ran (no `--no-verify`), and CI is green on the current head.
- [ ] Every review thread is fixed or answered, and resolved.
- [ ] Tests cover the change, next to the code.
- [ ] Fields, codes and limits come from an official source, or are marked UNVERIFIED with where they came from.
- [ ] Fixtures are invented; nothing is real farm or personal data.
- [ ] Exported APIs are typed and have TSDoc.
- [ ] No new runtime dependency, or an ADR justifies it.
- [ ] A changeset describes the change for users, if it changes what the package publishes.
- [ ] Significant decisions are recorded as an ADR in `docs/adr`.
