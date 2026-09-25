# ADR 004: Rate Limiting

- **Date:** 2026-09-24
- **Status:** Accepted for the current implementation; evidence gaps are tracked in the research log.

## Context

The public SEC client must expose useful financial data while respecting the endpoint behavior recorded in [research](../research/sources.md).

## Decision

Require contact User-Agent and default to five requests per second with bounded concurrency, deduplication, retries, and cancellation.

## Alternatives considered

Use SEC maximum; no limiter.

## Rationale

Leaves headroom below SEC ten-per-second aggregate guidance.

## Consequences

A shared file limiter and pluggable organization-wide limiter are described in [ADR 018](018-shared-traffic.md). Separate machines still need a common coordinator. Revisit this record when new fixtures contradict its assumptions.

## Evidence

[Research finding](../research/sources.md); [source register](../research/sources.md).
