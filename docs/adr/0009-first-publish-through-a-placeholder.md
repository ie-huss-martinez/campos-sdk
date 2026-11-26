# 0009. The first publish goes through a placeholder, not a token

- **Status:** Accepted
- **Date:** 2026-11-26
- **Amends:** [ADR 0003](0003-tooling-build-and-release.md), whose first version was to be published with a short-lived `NPM_TOKEN`

## Context

npm's trusted publishing lets the release workflow publish with an OIDC token and provenance, and no npm token anywhere. npm can only set a trusted publisher on a package that already exists, so something else has to create it.

[ADR 0003](0003-tooling-build-and-release.md) chose a granular npm token, valid for a day, stored in the `npm` environment for the first publish and deleted afterwards. Since then:

- **npm is retiring direct publishing with tokens that bypass two-factor authentication,** from around January 2027 (GitHub changelog, 2026-07-08, as the SDK family's release playbook records). Such a token would only stage a publish for a human to approve.
- **The maintainer already bootstraps packages differently:** from their own npm login, with two-factor authentication, they publish a placeholder version that holds nothing, set the trusted publisher, and deprecate the placeholder.

## Decision

- **The maintainer creates the package with a placeholder:** version `0.0.0-stage`, a `package.json` and nothing else. It is published from their own npm login, with the dist-tag `stage`, then deprecated as "Placeholder for setting up trusted publishing. Not a release."
- **They then set the trusted publisher on npmjs.com:** organisation `ie-huss-martinez`, repository `campos-sdk`, workflow `release.yml`, environment `npm`. Publishing access requires two-factor authentication and disallows tokens.
- **The first real version publishes through the workflow,** by trusted publishing with provenance, like every version after it. No npm token is ever stored for this repository; the workflow's token step is removed.
- **If the version pull request is merged before the package exists,** the publish job stops with an error, and its summary lists these steps. It no longer fails with a bare `ENEEDAUTH`. Re-running the failed job once the steps are done publishes the version.
- **`private` is removed from `package.json`** in the pull request that prepares the first release, with that release's changeset.

## Alternatives considered

- **The one-day token of ADR 0003:** no manual publish. It puts a publishing credential in CI, even briefly, and the kind of token it needs is being retired.
- **Publishing the first real version from the maintainer's machine:** creates the package with real content. That version would have no provenance, and would be a build nobody can tie to a workflow run; the placeholder has nothing in it to trust.
- **The maintainer publishing the tarball the workflow verified:** keeps the build in CI. It still has no provenance, needs the artifact downloaded and its checksum compared by hand, and the placeholder is simpler.

## Consequences

- **Every published version of campos-sdk has npm provenance** and a complete GitHub Release, the first included.
- **The registry keeps a deprecated `0.0.0-stage`.** `SECURITY.md` says what it is.
- **The first release needs the maintainer** at their npm login, once, before the version pull request is merged.
