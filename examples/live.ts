import { createEdgarClient, type Statement } from "@rayterion/sec-edgar";
const edgar = createEdgarClient({
  userAgent:
    process.env.SEC_USER_AGENT ?? "Example Research contact@example.com",
});
const annual: Statement = await edgar.financials.incomeStatement({
  ticker: "AAPL",
  fiscalYear: 2025,
});
console.log(annual.values.revenue, annual.details.revenue?.source.url);
