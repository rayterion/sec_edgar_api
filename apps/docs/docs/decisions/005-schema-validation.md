# ADR 005: Schema Validation

- **Date:** 2026-09-24
- **Status:** Accepted for the current implementation; evidence gaps are tracked in the research log.

## Context

The public SEC client must expose useful financial data while respecting the endpoint behavior recorded in [research](../research/data-anomalies.md).

## Decision

Validate required SEC structure and dates while retaining unknown fields on raw results.

## Alternatives considered

Trust every JSON body; reject every unknown field.

## Rationale

Upstream additions remain usable but broken required shapes cannot produce plausible values.

## Consequences

More parser contract fixtures are needed as shapes evolve. Revisit this record when new fixtures contradict its assumptions.

## Evidence

[Research finding](../research/data-anomalies.md); [source register](../research/sources.md).
