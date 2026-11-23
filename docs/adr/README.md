# Architecture decision records

Each record captures one significant decision: the context that forced it, what we chose, the alternatives we rejected and the consequences we accept. A decision is significant when it affects the public API, the output formats, security or dependencies, or is hard to reverse.

Records are numbered and immutable. To change a decision, write a new record that supersedes the old one and link the two.

Use [`template.md`](template.md) for new records. Name files `NNNN-short-title.md`, taking the next free number.

| # | Decision | Status |
|---|---|---|
| [0001](0001-independence-from-the-sdk-family.md) | Independence from the `@hussmartinez` SDK family | Accepted |
| [0002](0002-scope-and-architecture.md) | Scope and architecture: one model, validated at the boundary, rendered per target | Accepted |
| [0003](0003-tooling-build-and-release.md) | Tooling, build and release | Accepted |
