# Persistent cache and bounded bulk imports

`MemoryCache` is bounded by entries and bytes. `FileCache` is optional, persists JSON entries with expiration and response provenance, validates stored content, and uses atomic replacement so another process sees a complete version. Its default 256 entries/100 MB is a bounded shared cache, not an all-company database. The cache directory is created on first write. A new client with the same directory can reuse valid entries. A financial query with `refresh: true` bypasses cached SEC inputs; an observed refreshed HTTP 404/410 removes the old entry. File cache hits preserve the recorded source response evidence. Bulk-imported rows do not claim individual response hashes, so statement audit completeness may be false.

```js
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileCache } from "@sec-edgar/research-client";

const directory = await mkdtemp(join(tmpdir(), "edgar-cache-guide-"));
try {
  const cache = new FileCache({
    directory,
    maxEntries: 256,
    maxBytes: 100_000_000,
  });
  await cache.set(
    "https://data.sec.gov/submissions/CIK0000320193.json",
    { cik: 320193 },
    60_000,
  );
  console.log(
    (
      await cache.getEntry(
        "https://data.sec.gov/submissions/CIK0000320193.json",
      )
    )?.expiresAt,
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}
```

The [SEC publishes nightly company-facts and submissions ZIPs](https://www.sec.gov/search-filings/edgar-application-programming-interfaces). Obtain one under SEC fair-access guidance, then call `importBulkZip({ path, kind: 'companyfacts' | 'submissions', cache, includeCiks? })` on that local file. The importer never downloads the archive during ordinary requests. It validates ZIP names, CIK/payload agreement, and payload shape; streams one entry at a time with configurable compressed, decompressed, per-entry, and entry-count limits. `includeCiks` skips unrelated payloads before decompression. Its report contains the official source URL, archive SHA-256, imported/skipped counts, and completion time. The SHA-256 describes the local archive bytes, not SEC authenticity. A failed import may leave previously validated cache entries; no success report is returned.

On 2026-09-25 the official company-facts ZIP was about 1.31 GiB with 20,396 entries, and submissions was about 1.46 GiB with 991,556 entries. Only headers and 64 KiB ZIP footers were inspected; full imports remain unverified. Defaults allow up to 2 GB compressed, 20 GB decompressed, 50 MB per entry, and 1.2 million entries. For a full all-company backfill, supply storage sized for the result; a bounded `FileCache` evicts older entries and is not an all-company warehouse. The deterministic 100-entry local import finished under the declared two-second budget. See [ADR 019](../decisions/019-persistent-cache-bulk.md), [endpoint inventory](../research/endpoint-inventory.md), and [fixture provenance](../research/data-anomalies.md).
