import secEdgar from "@rayterion/sec-edgar";
const edgar = secEdgar({
  userAgent:
    process.env.SEC_USER_AGENT ?? "Example Research contact@example.com",
});
const income = await edgar.financials.incomeStatement({
  ticker: "AAPL",
  fiscalYear: 2025,
  fiscalQuarter: 2,
});
const balance = await edgar.financials.balanceSheet({
  ticker: "AAPL",
  fiscalYear: 2025,
  fiscalQuarter: 2,
});
console.log({
  revenue: income.values.revenue,
  netIncome: income.values.netIncome,
  revenueSource: income.details.revenue?.source.url,
  totalAssets: balance.values.totalAssets,
});
