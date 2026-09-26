# SEC EDGAR Client

Unofficial, public, read-only SEC EDGAR library for Node.js 24+. No API key, hosted service, or database is required. Package name `@sec-edgar/research-client` is **provisional**; the scope must be replaced by one the publisher owns before release.

```bash
npm install
npm run check
node examples/recorded-demo.mjs
```

The package exports a default factory and `createEdgarClient`, with `companies`, `filings`, `xbrl`, `financials`, and `raw` namespaces. See the [quick start](apps/docs/docs/guide/quick-start.md), [API reference](apps/docs/docs/api/reference.md), [research](apps/docs/docs/research/research-log.md), [coverage matrix](apps/docs/docs/research/endpoint-inventory.md), [limitations](apps/docs/docs/guide/limitations.md), the [currency and industry guide](apps/docs/docs/guide/industry-and-currency.md), [snapshots](apps/docs/docs/guide/snapshots.md), [filing validation](apps/docs/docs/guide/filing-validation.md), the [server operations guide](apps/docs/docs/guide/server-operations.md), [cache and bulk guide](apps/docs/docs/guide/cache-and-bulk.md), [compatibility matrix](apps/docs/docs/guide/compatibility-matrix.md), and the [production-readiness backlog](apps/docs/docs/backlog/production-readiness.md).

`npm run live:smoke` requires a descriptive `SEC_USER_AGENT` and is separate from deterministic CI. The MIT core is in `packages/sec-edgar`. The package has not been published.

Run the documentation locally with `npm run docs:start` at `http://localhost:3000/sec_edgar_api/`. See the [website guide](apps/docs/docs/guide/website.md) for the production build and GitHub Pages deployment.
