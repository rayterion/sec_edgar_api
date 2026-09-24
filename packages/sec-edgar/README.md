# SEC EDGAR client

Unofficial public SEC EDGAR ESM client for Node.js 24+. This package name is provisional and must be changed to an owned scope before publishing.

```js
import secEdgar from '@sec-edgar/research-client';
const edgar = secEdgar({ userAgent: 'Example Research contact@example.com' });
const annual = await edgar.financials.incomeStatement({ ticker: 'AAPL', fiscalYear: 2025 });
console.log(annual.values.revenue, annual.details.revenue?.source.url);
```

Read the workspace [documentation](../../apps/docs/docs/intro.md) for API behavior, research, and limitations. SEC content can be corrected or removed. This is not an official SEC product.
