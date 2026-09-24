# ADR 007: Mapping

- **Date:** 2026-09-24
- **Status:** Accepted for the current implementation; evidence gaps are tracked in the research log.

## Context

The public SEC client must expose useful financial data while respecting the endpoint behavior recorded in [research](../research/financial-semantics.md).

## Decision

Version canonical income, balance, and approved additive cash-flow field names and give explicit ordered standard-tag candidates, checking direct facts across aliases before derivation.

## Alternatives considered

Infer field names from labels; force custom tags into US GAAP meanings.

## Rationale

Labels vary and custom taxonomy cannot be assumed comparable.

## Consequences

Unsupported fields remain null; broader IFRS and industry mapping needs evidence. Revisit this record when new fixtures contradict its assumptions.

## Evidence

[Research finding](../research/financial-semantics.md); [source register](../research/sources.md).
