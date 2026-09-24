# SEC EDGAR Client

Unofficial, public, read-only SEC EDGAR library for Node.js 24+. No API key, hosted service, or database is required. Package name `@sec-edgar/research-client` is **provisional**; the scope must be replaced by one the publisher owns before release.

```bash
npm install
npm run check
node examples/recorded-demo.mjs
```

The package exports a default factory and `createEdgarClient`, with `companies`, `filings`, `xbrl`, `financials`, and `raw` namespaces. See the [quick start](apps/docs/docs/guide/quick-start.md), [API reference](apps/docs/docs/api/reference.md), [research](apps/docs/docs/research/research-log.md), [coverage matrix](apps/docs/docs/research/endpoint-inventory.md), and [limitations](apps/docs/docs/guide/limitations.md).

`npm run live:smoke` requires a descriptive `SEC_USER_AGENT` and is separate from deterministic CI. The MIT core is in `packages/sec-edgar`. No package or docs site has been published.
