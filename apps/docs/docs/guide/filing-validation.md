# Inspect Inline facts and validate a balance sheet

`filings.xbrlFacts` prefers a filing's `_htm.xml` instance. When none exists, it discovers the primary Inline HTML document from submissions metadata and the archive index. You can pass `name` to select a specific XML or HTML document. Extracted facts retain their taxonomy, context, dates, unit, dimensions, source URL, and exact decimal value. An unsupported numeric transform has `status: 'unsupported'`, `exactValue: null`, and a reason. Nil facts have `status: 'nil'`.

Custom or dimensioned filing facts are available for inspection; normalized statements do not assign them a canonical meaning automatically. The supported Inline parser handles plain and dot/comma decimal transforms, fixed zero, scale, sign, and nil. It does not claim full Inline XBRL conformance. See [archive parsing decision](../decisions/011-archive-parsing.md).

Optional validation compares selected instant assets with liabilities plus total equity. It runs only when all three facts share a filing accession, unit, and end date. A mismatch reports the exact difference and source URLs; the SEC values are unchanged.

```js
import { createEdgarClient } from "@rayterion/sec-edgar";

const edgar = createEdgarClient({
  userAgent: "Example Research contact@example.com",
});
const balance = await edgar.financials.balanceSheet({
  ticker: "AAPL",
  fiscalYear: 2025,
  fiscalQuarter: 2,
  revision: "asFiled",
  validate: true,
});
console.log(
  balance.validation?.status,
  balance.validation?.checks[0]?.difference,
);
console.log(balance.validation?.checks[0]?.sourceUrls);
```

`pass` means this arithmetic identity matched. `fail` reports a discrepancy. `unavailable` means the operands were missing or incompatible. None is a financial statement audit; `coverage.complete` still describes canonical-field availability only. See [ADR 017](../decisions/017-balance-validation.md).
