# ADR 010: Quarter Derivation

- **Date:** 2026-09-24
- **Status:** Accepted for the current implementation; evidence gaps are tracked in the research log.

## Context

The public SEC client must expose useful financial data while respecting the endpoint behavior recorded in [research](../research/financial-semantics.md).

## Decision

Subtract compatible year-to-date facts only for approved additive income and cash-flow duration fields; retain operands.

## Alternatives considered

Never derive; derive every numeric duration.

## Rationale

Provides quarter data where direct fact is absent without subtracting EPS or instants.

## Consequences

Some quarters remain missing when contexts are incompatible. Revisit this record when new fixtures contradict its assumptions.

## Evidence

[Research finding](../research/financial-semantics.md); [source register](../research/sources.md).
