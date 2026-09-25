# ADR 002: Public Api

- **Date:** 2026-09-24
- **Status:** Accepted for the current implementation; evidence gaps are tracked in the research log.

## Context

The public SEC client must expose useful financial data while respecting the endpoint behavior recorded in [research](../research/endpoint-inventory.md).

## Decision

Expose a default factory and named `createEdgarClient` with `companies`, `filings`, `xbrl`, `financials`, and `raw` namespaces. Statements can carry a separate industry profile, optional validation, and input audit metadata. A `SecSnapshot` can record and replay the raw responses that support a statement.

## Alternatives considered

Flat functions; SEC-shaped responses everywhere.

## Rationale

Task-based discovery keeps stable consumer fields separate from SEC wire formats.

## Consequences

Every new field needs a documented compatibility decision. Revisit this record when new fixtures contradict its assumptions.

## Evidence

[Research finding](../research/endpoint-inventory.md); [financial semantics](../research/financial-semantics.md); [source register](../research/sources.md).
