# SEC EDGAR client

Unofficial public SEC EDGAR ESM client for Node.js 24+.

Install from GitHub with `npm install "@rayterion/sec-edgar@github:rayterion/sec_edgar_api#v1.0.0"`. Supply an identifying User-Agent with a contact email.

```js
import secEdgar from "@rayterion/sec-edgar";
const edgar = secEdgar({ userAgent: "Example Research contact@example.com" });
const annual = await edgar.financials.incomeStatement({
  ticker: "AAPL",
  fiscalYear: 2025,
});
console.log(annual.values.revenue, annual.details.revenue?.source.url);
```

Read the [documentation](https://rayterion.github.io/sec_edgar_api/) for API behavior, research, and limitations. SEC content can be corrected or removed. This is not an official SEC product.
