# Monitor SEC contract and data quality

The weekly live contract workflow (`.github/workflows/live-contract.yml`) runs separately from pull-request CI. Configure a repository secret `SEC_USER_AGENT` containing an organization and contact email. It uses one request per second and checks Apple company, filing, facts, annual income, quarter balance, SAP IFRS currency, JPMorgan bank fields, and source URLs. A failed check makes the scheduled workflow fail. The checkout has not yet produced a scheduled run; use `SEC_USER_AGENT='Organization contact@example.com' npm run live:smoke` to run it manually at the same low rate.

`assessHealth` is a pure local evaluator. Pass transport metrics for a measurement window, recent errors, and normalized statements. It reports schema drift, canonical coverage drops, stale retrievals, provenance gaps, repeated SEC access failures, and queue pressure. Your service chooses thresholds and sends alerts through its own monitoring system. A statement's canonical coverage is not a filing audit.

```js
import { assessHealth } from "@sec-edgar/research-client";

const alerts = assessHealth({
  metrics: {
    requests: 10,
    successes: 10,
    failures: 0,
    retries: 0,
    cacheHits: 0,
    queueDepth: 0,
    queueWaitMs: 0,
    rateLimitWaitMs: 0,
    retryWaitMs: 0,
    latencyMs: 500,
    circuitOpen: 0,
    overloads: 0,
  },
  errors: [],
  statements: [],
});
console.log(alerts); // []
```

Deterministic release gates include the [compatibility matrix](compatibility-matrix.md), the 18-request mocked load budget, the 100-entry local bulk budget, packed-package import, dependency audit, executable docs examples, and Docusaurus build. See [ADR 020](../decisions/020-operational-monitoring.md) and the [release report](../release-report.md).
