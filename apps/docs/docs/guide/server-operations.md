# Shared SEC traffic control

The SEC currently limits one user's **aggregate** requests across machines to ten per second; see the [research log](../research/research-log.md#2026-09-25-pr-0608-server-operation-and-nightly-bulk). The client defaults to five requests per second, two concurrent requests, a 64-waiter queue, and a process-wide start spacing of eight per second. A full queue raises `QUEUE_FULL`. Repeated HTTP 403/429/5xx responses open a circuit; `CIRCUIT_OPEN` avoids another upstream request until its reset period. Queue, rate, and retry waits honor `AbortSignal`.

`FileRateLimiter` coordinates Node processes pointing at one file on a filesystem with reliable atomic directory creation. Create its parent directory before starting workers. Machines without a shared filesystem should supply their own `SharedRateLimiter` adapter with `acquire(signal): Promise<void>` backed by a common coordinator. Every process in one organization must use the same budget. Neither adapter bypasses the client's SEC host allowlist.

```js
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createEdgarClient, FileRateLimiter } from "@sec-edgar/research-client";

const directory = await mkdtemp(join(tmpdir(), "edgar-guide-"));
try {
  const edgar = createEdgarClient({
    userAgent: "Example Research contact@example.com",
    sharedLimiter: new FileRateLimiter({
      path: join(directory, "organization.json"),
      requestsPerSecond: 8,
    }),
    maxQueue: 64,
    circuitBreaker: { failureThreshold: 3, resetMs: 30_000 },
  });
  console.log(edgar.metrics().queueDepth);
} finally {
  await rm(directory, { recursive: true, force: true });
}
```

`client.metrics()` returns cumulative request, success, failure, retry, cache-hit, circuit-open, and overload counts plus current queue depth and total queue/rate/retry wait and latency milliseconds. Use deltas between samples for service-level dashboards. A custom shared limiter can itself fail; `SHARED_LIMITER` preserves that failure rather than making a request without a token. See [ADR 018](../decisions/018-shared-traffic.md) and [monitoring](monitoring.md).
