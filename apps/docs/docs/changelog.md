# Changelog and compatibility

## 1.0.0 prepared — 2026-09-26

Prepared public npm release as `@rayterion/sec-edgar`; registry upload awaits account 2FA. The tested API includes direct SEC JSON and archive adapters, normalized statements with exact-value lineage and partial-result status, fiscal-period selection, response snapshots, and optional server operations adapters. The public canonical fields and error codes now follow semantic versioning. See the [compatibility matrix](guide/compatibility-matrix.md), [release report](release-report.md), and [known limitations](guide/limitations.md).

## 0.1.0 preview — 2026-09-24

Initial ESM API, SEC JSON adapters, archive document discovery, income, balance, and additive cash-flow normalization, exact-value provenance, limited fiscal-quarter derivation, and dated research fixtures. This preview is not a v1 guarantee; see [limitations](guide/limitations.md).

P1 server work added shared traffic coordination, bounded queues and circuits, persistent cache/refresh, local bounded SEC ZIP import, metrics, health alerts, and a separate scheduled live contract check. See the [compatibility matrix](guide/compatibility-matrix.md) and [release report](release-report.md).

P0 reliability work added conservative reporting-currency inference, distinct industry fields, response snapshots and audit metadata, supported Inline XBRL numeric extraction, and optional exact balance reconciliation. The [release report](release-report.md) records verified scope and remaining limitations.

Public canonical field names and error codes follow semantic versioning from v1. Behavior changes require updated tests, research notes, an architecture decision record, and docs. Docusaurus versioning begins only when separate public API versions need distinct docs.
