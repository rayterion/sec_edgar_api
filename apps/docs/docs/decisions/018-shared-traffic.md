# ADR 018: Shared traffic control and bounded resilience

- **Date:** 2026-09-25
- **Status:** Accepted for the preview; multi-host adapter deployment is not tested here.

## Context

[SEC guidance](../research/research-log.md#2026-09-25-pr-0608-server-operation-and-nightly-bulk) limits aggregate traffic across machines, while the original limiter coordinated only one Node process. Unbounded waits and retries could consume server capacity during SEC failures.

## Decision

Keep a conservative eight-per-second process reservation and five-per-second default client rate. Bound each client's queue to 64 waiters, make queue/rate/retry waits abortable, and reject overload with `QUEUE_FULL`. Expose `SharedRateLimiter`; provide `FileRateLimiter` for processes on one reliable shared filesystem. Open a configurable circuit after repeated HTTP 403/429/5xx. Expose transport counters and wait/latency totals through `client.metrics()`.

## Alternatives considered

Rely on each process independently; require a hosted Redis service; use the published ten-per-second ceiling as the default.

## Rationale

The library remains local and service-free while organizations can supply their own cross-host limiter. Bounded waits and an open circuit make sustained failures observable and limit queued work.

## Consequences

An organization with several hosts must implement a `SharedRateLimiter` backed by a common coordinator. The file adapter requires an existing shared directory and reliable atomic directory creation. Retry waits still occupy a concurrency slot; this deliberately bounds active retry work. Metrics accumulate since client construction; callers should evaluate deltas or rotate clients for monitoring windows. See the [server guide](../guide/server-operations.md).

## Evidence

[SEC access and load findings](../research/research-log.md#2026-09-25-pr-0608-server-operation-and-nightly-bulk); [source register](../research/sources.md); deterministic queue, abort, circuit, cross-process, and 18-request rolling-window tests in `packages/sec-edgar/test/operations.test.mjs`.
