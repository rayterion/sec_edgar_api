# ADR 008: Revision Policy

- **Date:** 2026-09-24
- **Status:** Accepted for the current implementation; evidence gaps are tracked in the research log.

## Context

The public SEC client must expose useful financial data while respecting the endpoint behavior recorded in [research](../research/financial-semantics.md).

## Decision

Default to latest eligible exact-period fact; asFiled prefers target-period accession; asOf cuts off fact filing dates while current metadata establishes fiscal boundaries. BayFirst 2025 10-K/A confirms changed annual values.

## Alternatives considered

First fact in array; unqualified latest frame.

## Rationale

Comparative and amendment facts require deterministic ranking.

## Consequences

Mixed filing sources are disclosed; later restatements may change historical output. Revisit this record when new fixtures contradict its assumptions.

## Evidence

[Research finding](../research/financial-semantics.md); [source register](../research/sources.md).
