# ADR 014: Distribution

- **Date:** 2026-09-24
- **Status:** Accepted; revised 2026-09-26 for the user-authorized public v1.0.0 release.

## Context

The public SEC client must expose useful financial data while respecting the endpoint behavior recorded in [research](../research/ecosystem-review.md).

## Decision

Use MIT for the core and keep SEC retrieval direct and free. Publish the v1.0.0 ESM package publicly under the publisher-owned `@rayterion/sec-edgar` scope; keep the documentation source in this repository.

## Alternatives considered

Proprietary client; hosted required service.

## Rationale

Supports local research use and a separate specialist-services path.

## Consequences

The authenticated npm user `rayterion` owns the chosen scope. Public consumers can install the package without credentials. The package is unofficial, and unsupported data coverage remains documented. Revisit this record when new evidence changes distribution needs.

## Evidence

[Ecosystem review](../research/ecosystem-review.md); [npm release research](../research/research-log.md#2026-09-26-npm-v1-distribution); [source register](../research/sources.md).
