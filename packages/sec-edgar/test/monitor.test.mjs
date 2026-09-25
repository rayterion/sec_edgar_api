import test from "node:test";
import assert from "node:assert/strict";
import { assessHealth } from "../dist/index.js";

const metrics = (overrides = {}) => ({
  requests: 10,
  successes: 10,
  failures: 0,
  retries: 0,
  cacheHits: 0,
  queueDepth: 0,
  queueWaitMs: 0,
  rateLimitWaitMs: 0,
  retryWaitMs: 0,
  latencyMs: 1000,
  circuitOpen: 0,
  overloads: 0,
  ...overrides,
});

test("health assessment flags schema drift, coverage loss, stale provenance and repeated SEC failures", () => {
  const now = new Date("2026-09-25T00:00:00Z");
  const alerts = assessHealth(
    {
      metrics: metrics({
        requests: 10,
        failures: 4,
        successes: 6,
        queueDepth: 9,
      }),
      errors: [{ code: "SCHEMA" }],
      statements: [
        {
          values: { revenue: 1, netIncome: null },
          coverage: { missingFields: ["netIncome"] },
          audit: {
            complete: false,
            inputs: [{ retrievedAt: "2026-09-20T00:00:00Z" }],
          },
        },
      ],
      now,
    },
    { maxQueueDepth: 5, minCoverage: 0.75, maxAgeMs: 86_400_000 },
  );
  const codes = new Set(alerts.map((alert) => alert.code));
  for (const code of [
    "SCHEMA_DRIFT",
    "COVERAGE_DROP",
    "STALE_DATA",
    "SEC_ACCESS_FAILURES",
    "QUEUE_PRESSURE",
    "PROVENANCE_GAP",
  ])
    assert.ok(codes.has(code), code);
});

test("health assessment stays quiet for fresh complete statements and low failure rates", () => {
  const alerts = assessHealth({
    metrics: metrics(),
    errors: [],
    statements: [
      {
        values: { revenue: 1, netIncome: 2 },
        coverage: { missingFields: [] },
        audit: {
          complete: true,
          inputs: [{ retrievedAt: "2026-09-25T00:00:00Z" }],
        },
      },
    ],
    now: new Date("2026-09-25T01:00:00Z"),
  });
  assert.deepEqual(alerts, []);
});
