# ADR 001: Package Format

- **Date:** 2026-09-24
- **Status:** Accepted for the current implementation; evidence gaps are tracked in the research log.

## Context

The public SEC client must expose useful financial data while respecting the endpoint behavior recorded in [research](../research/sources.md).

## Decision

Use TypeScript source and ESM JavaScript with declarations; require Node 24 LTS.

## Alternatives considered

CommonJS dual output; Node 22.

## Rationale

One module format avoids conditional-export divergence and Node 24 is LTS.

## Consequences

Consumers on older Node versions need another package version. Revisit this record when new fixtures contradict its assumptions.

## Evidence

[Research finding](../research/sources.md); [source register](../research/sources.md).
