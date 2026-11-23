# Security policy

`@hussmartinez/campos-sdk` builds legal records from data that applications receive from people, files and devices. It handles tax identifiers and personal names, and its output may be printed, opened in a spreadsheet or sent to the administration. Vulnerabilities that let crafted input change that output, leak personal data or compromise the published package are the most important reports this project can receive. Thank you for reporting one privately.

## Reporting a vulnerability

**Please don't open a public issue, pull request or discussion.**

Report it through GitHub's private vulnerability reporting: open the repository's **Security** tab and choose **Report a vulnerability**, or go directly to [the advisory form](https://github.com/ie-huss-martinez/campos-sdk/security/advisories/new). Only the maintainer can see the report.

Please include:

- the affected version, or the commit;
- what an attacker can do, and under which conditions;
- steps to reproduce it, or a proof of concept, with **invented records only**. Never send real farm or personal data.

## What to expect

- **Acknowledgement** within 7 days.
- **Updates** at least every 14 days until the issue is resolved.
- **A fix and an advisory.** Once a fix is released, a GitHub Security Advisory describes the issue, with a CVE where it applies. You're credited in the advisory unless you'd rather not be.
- **Coordinated disclosure.** Please keep the issue private until the advisory is published, or for 90 days after your report, whichever comes first. If a fix needs longer, we'll agree on a date with you.

## Supported versions

The package is pre-1.0, so security fixes go into the latest release only. Upgrade to it to receive them; earlier `0.x` versions get no backports.

Every version is published from this repository's release workflow, with npm provenance. Each version's GitHub Release attaches the tarball, `SHA256SUMS` and an artifact attestation.

- **To check where a tarball was built,** run `gh attestation verify <tarball> --repo ie-huss-martinez/campos-sdk`. It fails unless the attestation names this repository.
- **`npm audit signatures`** checks that installed packages match the registry's signatures and that their provenance attestations are valid. It doesn't check which repository built them; the provenance shown on the package's npm page, or the command above, does.

## Scope

In scope is everything in this repository: the published package, and the workflows that verify and release it. Examples:

- input that validation accepts but that breaks a rule the library says it enforces, or that makes validation hang or run out of memory;
- input that changes the structure of an output: markup in the printable logbook, a formula in CSV, or keys or values smuggled into the CUE document;
- personal data, such as a tax identifier or a name, appearing in a validation issue or an error ([ADR 0002](docs/adr/0002-scope-and-architecture.md));
- any network request, file access or other I/O made by the library;
- weaknesses in the build, release or publishing workflows, such as unpinned actions or excessive permissions ([ADR 0003](docs/adr/0003-tooling-build-and-release.md)).

Out of scope:

- whether a document is accepted by an autonomous community's services. Report a wrong document as a bug;
- vulnerabilities in a development tool that are already public. Report those upstream, but do tell us if the way we use the tool makes it exploitable;
- issues that need an already compromised device, runtime or build environment.
