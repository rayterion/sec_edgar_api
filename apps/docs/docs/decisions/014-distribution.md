# ADR 014: Distribution

- **Date:** 2026-09-24
- **Status:** Accepted for the current implementation; evidence gaps are tracked in the research log.

## Context

The public SEC client must expose useful financial data while respecting the endpoint behavior recorded in [research](../research/ecosystem-review.md).

## Decision

Use MIT for the core and keep SEC retrieval direct and free; do not publish during build.

## Alternatives considered

Proprietary client; hosted required service.

## Rationale

Supports local research use and a separate specialist-services path.

## Consequences

The provisional npm scope must be replaced with an owned scope before publishing. Revisit this record when new fixtures contradict its assumptions.

## Evidence

[Research finding](../research/ecosystem-review.md); [source register](../research/sources.md).
