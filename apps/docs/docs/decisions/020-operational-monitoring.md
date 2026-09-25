# ADR 020: Contract and health monitoring

- **Date:** 2026-09-25
- **Status:** Accepted for the preview; first scheduled live run is pending repository configuration.

## Context

SEC schemas, access responses, and financial coverage can change after a deterministic CI run. Live checks should detect drift without making ordinary pull requests depend on SEC availability.

## Decision

Keep deterministic fixture tests, packed import, audit, and docs build in the release gate. Add a separate weekly and manual GitHub Actions workflow using a declared `SEC_USER_AGENT` secret and one request per second. It checks recorded domestic, IFRS, and bank contract classes, selected source lineage, and health signals. Expose pure `assessHealth` alerts for schema errors, canonical coverage drop, stale retrievals, provenance gaps, repeated SEC failures, and queue pressure. Declare and test a 100-entry local bulk import under two seconds and an 18-request mocked load under ten seconds.

## Alternatives considered

Call live SEC endpoints in every pull request; rely solely on snapshots; send alerts from inside the library.

## Rationale

Fixture tests stay reproducible and fast. A scheduled check can report upstream drift at a low request rate. Callers own alert routing and thresholds, so the library has no hosted dependency.

## Consequences

The scheduled workflow fails until the repository has a valid contact `SEC_USER_AGENT` secret. It has not yet run in this checkout. The live suite is small and does not prove support for every filing class. Time budgets are local CI budgets, not a guarantee under every host. See the [monitoring guide](../guide/monitoring.md) and [compatibility matrix](../guide/compatibility-matrix.md).

## Evidence

[SEC timing and access research](../research/research-log.md#2026-09-25-pr-0608-server-operation-and-nightly-bulk), [source register](../research/sources.md), `test/live-contract.test.mjs`, `packages/sec-edgar/test/monitor.test.mjs`, and `packages/sec-edgar/test/operations.test.mjs`.
