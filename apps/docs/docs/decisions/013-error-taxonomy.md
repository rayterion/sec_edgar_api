# ADR 013: Error Taxonomy

- **Date:** 2026-09-24
- **Status:** Accepted for the current implementation; evidence gaps are tracked in the research log.

## Context

The public SEC client must expose useful financial data while respecting the endpoint behavior recorded in [research](../research/data-anomalies.md).

## Decision

Use EdgarError with stable code (including DNS, TLS, connection, decompression, redirect, and malformed XML), retryability, URL, HTTP status, and cause.

## Alternatives considered

Raw fetch errors; catch-and-return-null.

## Rationale

Operational and parser failures must not become plausible financial numbers.

## Consequences

The catalog must expand with observed upstream failures. Revisit this record when new fixtures contradict its assumptions.

## Evidence

[Research finding](../research/data-anomalies.md); [source register](../research/sources.md).
