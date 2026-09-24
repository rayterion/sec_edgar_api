# ADR 006: Precision

- **Date:** 2026-09-24
- **Status:** Accepted for the current implementation; evidence gaps are tracked in the research log.

## Context

The public SEC client must expose useful financial data while respecting the endpoint behavior recorded in [research](../research/financial-semantics.md).

## Decision

Parse unsafe JSON numeric tokens as exact decimal strings; expose exactValue and optional string values.

## Alternatives considered

Always coerce to Number; use a decimal dependency.

## Rationale

Never silently round an unsafe fact; BigInt decimal subtraction is enough for additive derivation.

## Consequences

Numeric values may be null with a warning. Revisit this record when new fixtures contradict its assumptions.

## Evidence

[Research finding](../research/financial-semantics.md); [source register](../research/sources.md).
