# ADR 003: Cache

- **Date:** 2026-09-24
- **Status:** Accepted for the current implementation; evidence gaps are tracked in the research log.

## Context

The public SEC client must expose useful financial data while respecting the endpoint behavior recorded in [research](../research/endpoint-inventory.md).

## Decision

Use replaceable cache interface; default entry- and byte-bounded in-memory cache with endpoint-specific TTL. Optional atomic `FileCache` adds persistent freshness/provenance metadata and explicit refresh/invalidation; see [ADR 019](019-persistent-cache-bulk.md). For exact input replay, use the separate [snapshot record](016-response-snapshots.md); a TTL cache alone is not an audit artifact.

## Alternatives considered

No cache; persistent default.

## Rationale

Avoid repeated large facts downloads without requiring disk or database.

## Consequences

Multi-process users must provide shared cache if desired; upstream corrections can outlive TTL. Revisit this record when new fixtures contradict its assumptions.

## Evidence

[Research finding](../research/endpoint-inventory.md); [source register](../research/sources.md).
