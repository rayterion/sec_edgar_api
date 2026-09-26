# Five-minute quick start

Requires Node.js 24 or newer. Install the library from the v1.0.0 GitHub tag with `npm install "@rayterion/sec-edgar@github:rayterion/sec_edgar_api#v1.0.0"` in your application. The dependency key stays `@rayterion/sec-edgar`; the package itself comes from GitHub. Runtime dependencies still resolve through npm. Source contributors can run `npm install` and `npm run build` in this workspace.

## JavaScript

```js
import secEdgar from "@rayterion/sec-edgar";

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
import { createEdgarClient, type Statement } from "@rayterion/sec-edgar";

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
