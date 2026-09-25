import test from "node:test";
import assert from "node:assert/strict";
import { verifyLiveContracts } from "./live-contract.mjs";

function fakeClient(overrides = {}) {
  return {
    companies: { resolve: async () => ({ cik: "0000320193", ticker: "AAPL" }) },
    filings: {
      list: async () => [{ accessionNumber: "0000320193-25-000079" }],
    },
    xbrl: {
      companyFacts: async () => ({ facts: { "us-gaap": { Assets: {} } } }),
    },
    financials: {
      incomeStatement: async ({ ticker }) =>
        ticker === "SAP"
          ? {
              currency: "EUR",
              values: { revenue: 1 },
              details: {
                revenue: {
                  taxonomy: "ifrs-full",
                  source: { url: "https://www.sec.gov/Archives/example" },
                },
              },
            }
          : ticker === "JPM"
            ? {
                currency: "USD",
                industry: { profile: "bank", values: { netInterestIncome: 1 } },
              }
            : {
                currency: "USD",
                values: { revenue: 1 },
                details: {
                  revenue: {
                    source: { url: "https://www.sec.gov/Archives/example" },
                  },
                },
              },
      balanceSheet: async () => ({
        values: { totalAssets: 1 },
        details: {
          totalAssets: {
            source: { url: "https://www.sec.gov/Archives/example" },
          },
        },
      }),
    },
    ...overrides,
  };
}

test("live contracts cover domestic, IFRS, industry, filing and source lineage", async () => {
  const result = await verifyLiveContracts(fakeClient());
  assert.deepEqual(result.checks, [
    "company",
    "filing",
    "facts",
    "annual-income",
    "quarter-balance",
    "ifrs-income",
    "bank-income",
  ]);
});

test("live contract fails loudly on a missing source lineage", async () => {
  const client = fakeClient();
  client.financials.balanceSheet = async () => ({
    values: { totalAssets: 1 },
    details: { totalAssets: { source: {} } },
  });
  await assert.rejects(verifyLiveContracts(client), /balance.*source/i);
});
