# Monitor SEC contract and data quality

The weekly live contract workflow (`.github/workflows/live-contract.yml`) runs separately from pull-request CI. It uses one request per second and checks Apple company, filing, facts, annual income, quarter balance, SAP IFRS currency, JPMorgan bank fields, and source URLs. A failed check makes the scheduled workflow fail.

To activate it for `rayterion/sec_edgar_api`:

1. Choose a real, monitored contact email and an organization or project name. The SEC asks scripted clients to identify themselves in the `User-Agent` header. For example, use `Example Research contact@example.com` only after replacing both placeholders with your own details.
2. Open GitHub repository **Settings → Secrets and variables → Actions → New repository secret**.
3. Enter the exact name `SEC_USER_AGENT`. Enter your identifying string as the secret value, then select **Add secret**. Do not commit the contact string to the repository or paste it into an issue.
4. Push the workflow to the default branch. Open **Actions → SEC live contract → Run workflow**, select `main`, and start the run. Confirm that **Rate-limited SEC contracts** passes. The scheduled run then executes weekly.

For a local check, provide the same value as an environment variable and run `npm run live:smoke`. The value is a contact identifier, not an SEC API key; no SEC API key is required. See [GitHub's repository secret instructions](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets) and the [SEC developer guidance](https://www.sec.gov/about/developer-resources).

`assessHealth` is a pure local evaluator. Pass transport metrics for a measurement window, recent errors, and normalized statements. It reports schema drift, canonical coverage drops, stale retrievals, provenance gaps, repeated SEC access failures, and queue pressure. Your service chooses thresholds and sends alerts through its own monitoring system. A statement's canonical coverage is not a filing audit.

```js
import { assessHealth } from "@rayterion/sec-edgar";

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
