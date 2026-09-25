import test from "node:test";
import { Buffer } from "node:buffer";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import yazl from "yazl";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  SecTransport,
  FileRateLimiter,
  FileCache,
  MemoryCache,
  importBulkZip,
  DEFAULT_BULK_LIMITS,
} from "../dist/index.js";

const url = (cik) =>
  `https://data.sec.gov/submissions/CIK${String(cik).padStart(10, "0")}.json`;
const response = () =>
  new Response('{"ok":true}', {
    headers: { "content-type": "application/json" },
  });
const options = (fetch, overrides = {}) => ({
  userAgent: "Operations Test ops@example.com",
  http: { fetch },
  requestsPerSecond: 9,
  retries: 0,
  ...overrides,
});

test("a bounded request queue rejects overload without starting another fetch", async () => {
  let releaseFirst;
  let calls = 0;
  const transport = new SecTransport(
    options(
      async () => {
        calls++;
        if (calls === 1)
          await new Promise((resolve) => {
            releaseFirst = resolve;
          });
        return response();
      },
      { concurrency: 1, maxQueue: 1 },
    ),
  );
  const first = transport.json(url(1));
  while (!releaseFirst) await new Promise((resolve) => setTimeout(resolve, 1));
  const second = transport.json(url(2));
  await assert.rejects(transport.json(url(3)), { code: "QUEUE_FULL" });
  releaseFirst();
  await Promise.all([first, second]);
  assert.equal(calls, 2);
});

test("an aborted queued caller leaves promptly and frees queue capacity", async () => {
  let releaseFirst;
  const transport = new SecTransport(
    options(
      async () => {
        if (!releaseFirst)
          await new Promise((resolve) => {
            releaseFirst = resolve;
          });
        return response();
      },
      { concurrency: 1, maxQueue: 1 },
    ),
  );
  const first = transport.json(url(1));
  while (!releaseFirst) await new Promise((resolve) => setTimeout(resolve, 1));
  const abort = new AbortController();
  const queued = transport.json(url(2), { signal: abort.signal });
  const started = performance.now();
  abort.abort();
  await assert.rejects(queued, { code: "ABORTED" });
  assert.ok(performance.now() - started < 100);
  releaseFirst();
  await first;
  await transport.json(url(3));
});

test("retry-after wait is abortable and sustained rate limits open a circuit", async () => {
  let calls = 0;
  const fetch = async () => {
    calls++;
    return new Response("limited", {
      status: 429,
      headers: { "retry-after": "10" },
    });
  };
  const retrying = new SecTransport(options(fetch, { retries: 1 }));
  const abort = new AbortController();
  const pending = retrying.json(url(1), { signal: abort.signal });
  await new Promise((resolve) => setTimeout(resolve, 25));
  const started = performance.now();
  abort.abort();
  await assert.rejects(pending, { code: "ABORTED" });
  assert.ok(performance.now() - started < 100);
  const guarded = new SecTransport(
    options(fetch, { circuitBreaker: { failureThreshold: 2, resetMs: 1000 } }),
  );
  await assert.rejects(guarded.json(url(2)), { code: "HTTP_429" });
  await assert.rejects(guarded.json(url(3)), { code: "HTTP_429" });
  const before = calls;
  await assert.rejects(guarded.json(url(4)), { code: "CIRCUIT_OPEN" });
  assert.equal(calls, before);
  const metrics = guarded.metrics();
  assert.equal(metrics.failures, 2);
  assert.equal(metrics.circuitOpen, 1);
  assert.ok(metrics.latencyMs >= 0);
});

test("a shared file limiter enforces a rolling organizational window across instances", async () => {
  const directory = await mkdtemp(join(tmpdir(), "edgar-limiter-"));
  try {
    const path = join(directory, "organization.json");
    const left = new FileRateLimiter({ path, requestsPerSecond: 2 });
    const right = new FileRateLimiter({ path, requestsPerSecond: 2 });
    const times = await Promise.all([
      left.acquire().then(() => performance.now()),
      right.acquire().then(() => performance.now()),
      left.acquire().then(() => performance.now()),
    ]);
    times.sort((a, b) => a - b);
    assert.ok(times[2] - times[0] >= 900);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("separate Node processes obey one shared SEC request budget", async () => {
  const directory = await mkdtemp(join(tmpdir(), "edgar-process-limiter-"));
  try {
    const path = join(directory, "organization.json");
    const moduleUrl = new URL("../dist/index.js", import.meta.url).href;
    const script = `import {FileRateLimiter} from ${JSON.stringify(moduleUrl)}; const limiter = new FileRateLimiter({path: process.argv[1], requestsPerSecond: 3}); for(let i=0;i<3;i++){await limiter.acquire(); console.log(Date.now());}`;
    const run = () =>
      promisify(execFile)(process.execPath, [
        "--input-type=module",
        "-e",
        script,
        path,
      ]);
    const outputs = await Promise.all([run(), run()]);
    const times = outputs
      .flatMap(({ stdout }) => stdout.trim().split("\n").map(Number))
      .sort((a, b) => a - b);
    assert.equal(times.length, 6);
    for (let index = 0; index < times.length; index++)
      assert.ok(
        times.filter(
          (time) => time >= times[index] && time < times[index] + 950,
        ).length <= 3,
      );
    assert.ok(times[3] - times[0] >= 900);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("memory cache bounds bytes, expires entries, and isolates returned objects", async () => {
  const cache = new MemoryCache(4, 70);
  cache.set("first", { number: 1 }, 1000);
  const first = cache.get("first");
  first.number = 9;
  assert.deepEqual(cache.get("first"), { number: 1 });
  cache.set("second", { data: "x".repeat(55) }, 1000);
  assert.equal(cache.get("first"), undefined);
  assert.throws(() => cache.set("huge", { data: "x".repeat(100) }, 1000), {
    code: "OVERSIZED",
  });
  cache.set("short", { ok: true }, 1);
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(cache.get("short"), undefined);
});

test("file cache persists provenance, expires, and invalidates atomically", async () => {
  const directory = await mkdtemp(join(tmpdir(), "edgar-cache-"));
  try {
    const source = {
      url: url(1),
      retrievedAt: new Date().toISOString(),
      status: 200,
      sha256: "a".repeat(64),
      bodyCaptured: true,
    };
    const cache = new FileCache({ directory, maxEntries: 2, maxBytes: 1000 });
    await cache.set(url(1), { version: 1 }, 1000, { source });
    const replica = new FileCache({ directory, maxEntries: 2, maxBytes: 1000 });
    const entry = await replica.getEntry(url(1));
    assert.deepEqual(entry?.value, { version: 1 });
    assert.deepEqual(entry?.source, source);
    entry.value.version = 8;
    assert.deepEqual(await replica.get(url(1)), { version: 1 });
    await replica.delete(url(1));
    assert.equal(await cache.get(url(1)), undefined);
    await cache.set(url(1), { version: 2 }, 1);
    await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(await replica.get(url(1)), undefined);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("refresh bypasses cache, deduplicates concurrent refreshes, and removes stale 404s", async () => {
  let calls = 0;
  let removed = false;
  const cache = new MemoryCache();
  const transport = new SecTransport(
    options(
      async () => {
        calls++;
        if (removed) return new Response("gone", { status: 404 });
        await new Promise((resolve) => setTimeout(resolve, 10));
        return new Response(JSON.stringify({ version: calls }), {
          headers: { "content-type": "application/json" },
        });
      },
      { cache },
    ),
  );
  assert.deepEqual(await transport.json(url(1)), { version: 1 });
  assert.deepEqual(await transport.json(url(1)), { version: 1 });
  assert.equal(calls, 1);
  const [a, b] = await Promise.all([
    transport.json(url(1), { refresh: true }),
    transport.json(url(1), { refresh: true }),
  ]);
  assert.deepEqual(a, { version: 2 });
  assert.deepEqual(b, { version: 2 });
  assert.equal(calls, 2);
  removed = true;
  await assert.rejects(transport.json(url(1), { refresh: true }), {
    code: "HTTP_404",
  });
  assert.equal(cache.get(url(1)), undefined);
});

async function makeZip(path, entries) {
  const zip = new yazl.ZipFile();
  for (const [name, body] of entries) zip.addBuffer(Buffer.from(body), name);
  zip.end();
  await pipeline(zip.outputStream, createWriteStream(path));
}

test("bounded bulk import maps recorded SEC company facts into a persistent cache", async () => {
  const directory = await mkdtemp(join(tmpdir(), "edgar-bulk-"));
  try {
    const archive = join(directory, "companyfacts.zip");
    const original = await readFile(
      new URL(
        "../../../test/fixtures/apple-companyfacts-fy2025.json",
        import.meta.url,
      ),
      "utf8",
    );
    await makeZip(archive, [["CIK0000320193.json", original]]);
    const cache = new FileCache({
      directory: join(directory, "cache"),
      maxBytes: 2_000_000,
    });
    const report = await importBulkZip({
      path: archive,
      kind: "companyfacts",
      cache,
      maxCompressedBytes: 2_000_000,
      maxUncompressedBytes: 2_000_000,
      maxEntries: 2,
    });
    assert.equal(report.imported, 1);
    assert.match(report.sha256, /^[a-f0-9]{64}$/);
    const transport = new SecTransport(
      options(
        () => {
          throw new Error("bulk cache used network");
        },
        { cache },
      ),
    );
    const facts = await transport.json(
      "https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json",
    );
    assert.equal(facts.cik, 320193);
    assert.equal(transport.metrics().cacheHits, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("bulk import refuses unsafe names, invalid SEC shapes, and decompression budgets", async () => {
  const directory = await mkdtemp(join(tmpdir(), "edgar-bulk-bad-"));
  try {
    const archive = join(directory, "bad.zip");
    const cache = new MemoryCache();
    await makeZip(archive, [["unrelated.json", "{}"]]);
    await assert.rejects(
      importBulkZip({ path: archive, kind: "companyfacts", cache }),
      { code: "UNSAFE_ARCHIVE" },
    );
    await makeZip(archive, [["CIK0000320193.json", "{}"]]);
    await assert.rejects(
      importBulkZip({ path: archive, kind: "companyfacts", cache }),
      { code: "SCHEMA" },
    );
    await assert.rejects(
      importBulkZip({
        path: archive,
        kind: "companyfacts",
        cache,
        maxUncompressedBytes: 1,
      }),
      { code: "OVERSIZED" },
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("bulk submissions preserve a real SEC response shape and meet the local throughput budget", async () => {
  const directory = await mkdtemp(join(tmpdir(), "edgar-bulk-speed-"));
  try {
    const archive = join(directory, "submissions.zip");
    const original = JSON.parse(
      await readFile(
        new URL(
          "../../../test/fixtures/apple-submissions-fy2025.json",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const entries = Array.from({ length: 100 }, (_, index) => {
      const cik = String(index + 1).padStart(10, "0");
      return [
        `CIK${cik}.json`,
        JSON.stringify({ ...original, cik: Number(cik) }),
      ];
    });
    await makeZip(archive, entries);
    const cache = new MemoryCache(128, 10_000_000);
    const started = performance.now();
    const report = await importBulkZip({
      path: archive,
      kind: "submissions",
      cache,
      maxEntries: 100,
      maxUncompressedBytes: 10_000_000,
    });
    const elapsed = performance.now() - started;
    assert.equal(report.imported, 100);
    assert.ok(elapsed < 2000, `100-entry local import took ${elapsed}ms`);
    assert.ok(
      (await cache.get("https://data.sec.gov/submissions/CIK0000000001.json"))
        .filings.recent,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("file cache replicas observe corrections and reject corrupt stored values", async () => {
  const directory = await mkdtemp(join(tmpdir(), "edgar-cache-integrity-"));
  try {
    const first = new FileCache({ directory, maxEntries: 1, maxBytes: 1000 });
    const second = new FileCache({ directory, maxEntries: 1, maxBytes: 1000 });
    await first.set(url(1), { version: 1 }, 1000);
    await second.set(url(1), { version: 2 }, 1000);
    assert.deepEqual(await first.get(url(1)), { version: 2 });
    const { readdir, writeFile } = await import("node:fs/promises");
    const name = (await readdir(directory)).find((value) =>
      value.endsWith(".json"),
    );
    const path = join(directory, name);
    const body = JSON.parse(await readFile(path, "utf8"));
    body.value.version = 3;
    await writeFile(path, JSON.stringify(body));
    await assert.rejects(first.get(url(1)), { code: "CACHE_CORRUPT" });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("bounded 18-request load respects a sub-SEC rate and a ten-second budget", async () => {
  const starts = [];
  const transport = new SecTransport(
    options(
      async () => {
        starts.push(Date.now());
        await new Promise((resolve) => setTimeout(resolve, 10));
        return response();
      },
      { maxQueue: 24, concurrency: 2 },
    ),
  );
  const start = performance.now();
  await Promise.all(
    Array.from({ length: 18 }, (_, index) => transport.json(url(index + 100))),
  );
  const elapsed = performance.now() - start;
  assert.equal(starts.length, 18);
  assert.ok(elapsed < 10_000, `mocked 18-request load took ${elapsed}ms`);
  for (const at of starts)
    assert.ok(
      starts.filter((time) => time >= at && time < at + 1000).length <= 9,
    );
  assert.ok(transport.metrics().queueWaitMs > 0);
});

test("default compressed bulk limit accommodates the verified SEC nightly archives", () => {
  assert.ok(DEFAULT_BULK_LIMITS.maxCompressedBytes >= 1_565_294_470);
  assert.ok(DEFAULT_BULK_LIMITS.maxEntries >= 991_556);
});

test("bulk CIK filter skips unrelated entries without retaining their data", async () => {
  const directory = await mkdtemp(join(tmpdir(), "edgar-bulk-filter-"));
  try {
    const archive = join(directory, "companyfacts.zip");
    const base = JSON.parse(
      await readFile(
        new URL(
          "../../../test/fixtures/apple-companyfacts-fy2025.json",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await makeZip(archive, [
      ["CIK0000320193.json", JSON.stringify(base)],
      ["CIK0000320194.json", JSON.stringify({ ...base, cik: 320194 })],
    ]);
    const cache = new MemoryCache();
    const report = await importBulkZip({
      path: archive,
      kind: "companyfacts",
      cache,
      includeCiks: ["320193"],
    });
    assert.equal(report.imported, 1);
    assert.equal(report.skipped, 1);
    assert.equal(
      cache.get(
        "https://data.sec.gov/api/xbrl/companyfacts/CIK0000320194.json",
      ),
      undefined,
    );
    await assert.rejects(
      importBulkZip({
        path: archive,
        kind: "companyfacts",
        cache,
        includeCiks: ["invalid"],
      }),
      { code: "INVALID_INPUT" },
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("persistent cache preserves SEC response evidence across client instances", async () => {
  const directory = await mkdtemp(join(tmpdir(), "edgar-provenance-cache-"));
  try {
    const first = new SecTransport(
      options(async () => response(), {
        cache: new FileCache({ directory }),
      }),
    );
    await first.json(url(1));
    const evidence = first.observedResponses();
    const second = new SecTransport(
      options(
        () => {
          throw new Error("unexpected network");
        },
        {
          cache: new FileCache({ directory }),
        },
      ),
    );
    await second.json(url(1));
    assert.deepEqual(second.observedResponses(), evidence);
    assert.equal(second.metrics().cacheHits, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("file cache integrity covers response provenance metadata", async () => {
  const directory = await mkdtemp(join(tmpdir(), "edgar-cache-source-"));
  try {
    const cache = new FileCache({ directory });
    const source = {
      url: url(1),
      retrievedAt: new Date().toISOString(),
      status: 200,
      sha256: "a".repeat(64),
      bodyCaptured: true,
    };
    await cache.set(url(1), { version: 1 }, 1000, { source });
    const { readdir, writeFile } = await import("node:fs/promises");
    const name = (await readdir(directory)).find((value) =>
      value.endsWith(".json"),
    );
    const path = join(directory, name);
    const stored = JSON.parse(await readFile(path, "utf8"));
    stored.source.sha256 = "b".repeat(64);
    await writeFile(path, JSON.stringify(stored));
    await assert.rejects(cache.get(url(1)), { code: "CACHE_CORRUPT" });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("abort-aware delay catches an abort between its initial check and listener registration", async () => {
  const { waitWithSignal } = await import("../dist/transport/wait.js");
  let reads = 0;
  const signal = {
    get aborted() {
      return ++reads > 1;
    },
    addEventListener() {},
    removeEventListener() {},
  };
  await assert.rejects(waitWithSignal(20, signal), { code: "ABORTED" });
});
