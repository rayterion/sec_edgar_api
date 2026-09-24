# Task guide

All snippets use a client created by `createEdgarClient({ userAgent: 'Example Research contact@example.com' })`.

## Get yearly income

```js
const annual = await edgar.financials.incomeStatement({
  ticker: "AAPL",
  fiscalYear: 2025,
});
console.log(annual.period.start, annual.period.end, annual.values.revenue);
```

## Get quarterly income

```js
const quarter = await edgar.financials.incomeStatement({
  ticker: "AAPL",
  fiscalYear: 2025,
  fiscalQuarter: 2,
  trace: true,
});
console.log(quarter.details.revenue?.status, quarter.details.revenue?.operands);
```

`status` is `reported` for a direct fact or `derived` for approved YTD subtraction.

## Get a balance sheet

```js
const balance = await edgar.financials.balanceSheet({
  ticker: "AAPL",
  fiscalYear: 2025,
  fiscalQuarter: 2,
});
console.log(balance.values.totalAssets);
```

Balance values are instant facts at the fiscal quarter end.

## Inspect the source filing

```js
const detail = balance.details.totalAssets;
if (detail) {
  console.log(
    detail.source.url,
    detail.source.accessionNumber,
    detail.tag,
    detail.unit,
  );
  const docs = await edgar.filings.documents({
    cik: balance.company.cik,
    accessionNumber: detail.source.accessionNumber,
  });
  console.log(docs.map((doc) => doc.name));
}
```

## Handle missing data

```js
if (balance.coverage.status === "partial") {
  console.log(balance.coverage.missingFields);
  console.log(balance.warnings);
}
const exact = balance.details.totalAssets?.exactValue ?? null;
```

Do not replace missing values with zero. Use `precision: 'string'` when exact decimal strings are needed in `values`.

## Get a cash-flow statement

```js
const cashFlow = await edgar.financials.cashFlowStatement({
  ticker: "AAPL",
  fiscalYear: 2025,
  fiscalQuarter: 2,
});
console.log(
  cashFlow.values.netCashFromOperations,
  cashFlow.details.netCashFromOperations?.operands,
);
```

Cash-flow quarter values may be derived from compatible fiscal-year-to-date operands; inspect `status` and `operands`.
