import { readFile } from "node:fs/promises";
import secEdgar from "../packages/sec-edgar/dist/index.js";
const fixtures = {
  "https://www.sec.gov/files/company_tickers_exchange.json":
    "apple-ticker-lookup.json",
  "https://data.sec.gov/submissions/CIK0000320193.json":
    "apple-submissions-fy2025.json",
  "https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json":
    "apple-companyfacts-fy2025.json",
};
const fixture = async (file) =>
  JSON.parse(
    await readFile(
      new URL(`../test/fixtures/${file}`, import.meta.url),
      "utf8",
    ),
  );
const edgar = secEdgar({
  userAgent: "Recorded Demo demo@example.com",
  retries: 0,
  http: {
    async fetch(url) {
      const file = fixtures[url];
      if (!file) return new Response("not found", { status: 404 });
      const data = await fixture(file);
      if (file === "apple-companyfacts-fy2025.json") {
        const entries =
          data.facts["us-gaap"]
            .RevenueFromContractWithCustomerExcludingAssessedTax.units.USD;
        data.facts[
          "us-gaap"
        ].RevenueFromContractWithCustomerExcludingAssessedTax.units.USD =
          entries.filter(
            (x) => !(x.start === "2024-12-29" && x.end === "2025-03-29"),
          );
      }
      return new Response(JSON.stringify(data), {
        headers: { "content-type": "application/json" },
      });
    },
  },
});
for (const [label, method, query, field] of [
  [
    "annual income",
    "incomeStatement",
    { ticker: "AAPL", fiscalYear: 2025 },
    "revenue",
  ],
  [
    "derived Q2 income",
    "incomeStatement",
    { ticker: "AAPL", fiscalYear: 2025, fiscalQuarter: 2 },
    "revenue",
  ],
  [
    "Q2 balance",
    "balanceSheet",
    { ticker: "AAPL", fiscalYear: 2025, fiscalQuarter: 2 },
    "totalAssets",
  ],
]) {
  const result = await edgar.financials[method](query);
  const detail = result.details[field];
  console.log(
    JSON.stringify({
      label,
      period: result.period,
      field,
      value: result.values[field],
      status: detail.status,
      source: detail.source,
      operands: detail.operands ?? null,
    }),
  );
}
