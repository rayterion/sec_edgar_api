# ADR 019: Persistent cache and bounded local bulk import

- **Date:** 2026-09-25
- **Status:** Accepted for the preview; whole official ZIP imports remain unverified.

## Context

Large servers need cache entries shared between processes, provenance/freshness information, and explicit correction handling. The [SEC nightly ZIPs](../research/research-log.md#2026-09-25-pr-0608-server-operation-and-nightly-bulk) are much larger than ordinary company JSON requests; they require a separate bounded workflow.

## Decision

Keep the replaceable `Cache` interface and add `getEntry` metadata, byte-bounded `MemoryCache`, and optional `FileCache` with atomic writes, expiry, integrity checks, and size/entry eviction. `refresh: true` bypasses cached financial inputs; observed HTTP 404/410 invalidates an old entry. A separate `importBulkZip` reads an already downloaded official ZIP from a local path, validates CIK entry names and JSON shapes, enforces compressed/uncompressed/per-entry/count bounds, and optionally retains only specified CIKs. Its report records source URL, archive SHA-256, counts, and completion time. Bulk-imported cache entries do not claim individual SEC response hashes.

## Alternatives considered

Implicitly download bulk ZIPs during single-company queries; use an unbounded ZIP extraction tool; require a database; store all bulk data by default.

## Rationale

Single-company use stays efficient. The local importer streams one entry at a time, avoids extracting paths to disk, and can target the desired CIKs from the large nightly archives. `yauzl` was chosen for lazy ZIP iteration and entry-size validation; `yazl` is test-only ZIP fixture tooling.

## Consequences

A full archive is not downloaded automatically. Operators must acquire it under SEC fair-access rules and size the cache for their subset. `FileCache` eviction scans stored files on writes; it is suitable for a bounded shared cache, not a million-entry database. For all-company imports use a custom bulk sink/cache with suitable storage economics. If an import fails after valid entries have been cached, those entries remain and the operation fails explicitly; the report is issued only after success. Real full-ZIP throughput remains unverified. See the [cache and bulk guide](../guide/cache-and-bulk.md).

## Evidence

[SEC bulk size and entry-count observations](../research/research-log.md#2026-09-25-pr-0608-server-operation-and-nightly-bulk), [endpoint inventory](../research/endpoint-inventory.md), [source register](../research/sources.md), and deterministic cache, correction, unsafe-archive, CIK-filter, and 100-entry performance tests in `packages/sec-edgar/test/operations.test.mjs`.
