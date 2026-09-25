# ADR 012: Partial Results

- **Date:** 2026-09-24
- **Status:** Accepted for the current implementation; evidence gaps are tracked in the research log.

## Context

The public SEC client must expose useful financial data while respecting the endpoint behavior recorded in [research](../research/data-anomalies.md).

## Decision

Return all canonical fields with null for missing facts, coverage status, field-specific missing reasons, and warnings. Optional arithmetic validation has a separate status and never changes coverage or source values.

## Alternatives considered

Throw on any missing field; silently use zero.

## Rationale

Users can inspect usable facts without mistaking absence for zero.

## Consequences

A complete status only means mapped fields found, not audited correctness. Revisit this record when new fixtures contradict its assumptions.

## Evidence

[Research finding](../research/data-anomalies.md); [source register](../research/sources.md).
