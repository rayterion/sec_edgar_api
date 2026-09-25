import assert from "node:assert/strict";

export async function verifyLiveContracts(edgar) {
  const checks = [];
  const company = await edgar.companies.resolve({ ticker: "AAPL" });
  assert.equal(company.cik, "0000320193", "company CIK changed");
  checks.push("company");
  const filings = await edgar.filings.list({ cik: company.cik, limit: 1 });
  assert.match(
    filings[0]?.accessionNumber ?? "",
    /^\d{10}-\d{2}-\d{6}$/,
    "latest filing accession missing",
  );
  checks.push("filing");
  const facts = await edgar.xbrl.companyFacts({ cik: company.cik });
  assert.ok(facts.facts?.["us-gaap"]?.Assets, "Apple assets concept missing");
  checks.push("facts");
  const annual = await edgar.financials.incomeStatement({
    ticker: "AAPL",
    fiscalYear: 2025,
  });
  assert.ok(Number(annual.values.revenue) > 0, "Apple annual revenue missing");
  assert.match(
    annual.details.revenue?.source?.url ?? "",
    /^https:\/\/www\.sec\.gov\/Archives\//,
    "annual income source missing",
  );
  checks.push("annual-income");
  const balance = await edgar.financials.balanceSheet({
    ticker: "AAPL",
    fiscalYear: 2025,
    fiscalQuarter: 2,
  });
  assert.ok(
    Number(balance.values.totalAssets) > 0,
    "Apple quarter balance assets missing",
  );
  assert.match(
    balance.details.totalAssets?.source?.url ?? "",
    /^https:\/\/www\.sec\.gov\/Archives\//,
    "balance source missing",
  );
  checks.push("quarter-balance");
  const foreign = await edgar.financials.incomeStatement({
    ticker: "SAP",
    fiscalYear: 2025,
  });
  assert.equal(foreign.currency, "EUR", "IFRS reporting currency changed");
  assert.equal(
    foreign.details.revenue?.taxonomy,
    "ifrs-full",
    "IFRS revenue taxonomy changed",
  );
  checks.push("ifrs-income");
  const bank = await edgar.financials.incomeStatement({
    ticker: "JPM",
    fiscalYear: 2025,
  });
  assert.equal(bank.industry?.profile, "bank", "bank industry profile missing");
  assert.ok(
    Number(bank.industry?.values.netInterestIncome) > 0,
    "bank net interest income missing",
  );
  checks.push("bank-income");
  return {
    checkedAt: new Date().toISOString(),
    checks,
    statements: [annual, balance, foreign, bank],
  };
}
