# Five-minute quick start

Requires Node.js 24 or newer. The package name is provisional while an owned npm scope is chosen. From this workspace, run `npm install` and `npm run build` before the examples. A consumer can install the packed artifact with `npm pack -w packages/sec-edgar` and `npm install /path/to/tarball`.

## JavaScript

```js
import secEdgar from "@sec-edgar/research-client";

const edgar = secEdgar({ userAgent: "Example Research contact@example.com" });
const income = await edgar.financials.incomeStatement({
  ticker: "AAPL",
  fiscalYear: 2025,
  fiscalQuarter: 2,
});
console.log(income.values.revenue);
console.log(income.details.revenue?.source.url);
console.log(income.coverage);
```

## TypeScript

```ts
import { createEdgarClient, type Statement } from "@sec-edgar/research-client";

const edgar = createEdgarClient({
  userAgent: "Example Research contact@example.com",
});
const balance: Statement = await edgar.financials.balanceSheet({
  ticker: "AAPL",
  fiscalYear: 2025,
  fiscalQuarter: 2,
});
console.log(balance.values.totalAssets);
```

An identifying contact email is required. The SEC can block unidentified scripts. `values` can contain `null`; inspect `details`, `coverage`, and `warnings` before using a number. Read [fiscal selection and lineage](lineage.md) for the exact meaning of each value.
