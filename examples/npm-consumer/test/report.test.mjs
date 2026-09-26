import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { getStatements, parseQuery } from "../src/report.mjs";

test("parses a ticker and fiscal quarter from CLI arguments", () => {
  assert.deepEqual(parseQuery(["aapl", "2025", "2"]), {
    ticker: "AAPL",
    fiscalYear: 2025,
    fiscalQuarter: 2,
  });
});

test("rejects missing and invalid fiscal arguments before SEC requests", () => {
  for (const args of [
    [],
    ["AAPL", "2025"],
    ["AAPL", "2025", "5"],
    ["AAPL", "2025.5", "2"],
  ]) {
    assert.throws(
      () => parseQuery(args),
      /Usage: npm start -- TICKER YEAR QUARTER/,
    );
  }
});

test("returns full income and balance results with exact lineage and missing values", async () => {
  const calls = [];
  const income = {
    values: { revenue: null },
    details: { revenue: null },
    coverage: { status: "partial", missingFields: ["revenue"] },
  };
  const balance = {
    values: { totalAssets: 331233000000 },
    details: {
      totalAssets: {
        exactValue: "331233000000",
        source: { url: "https://www.sec.gov/Archives/example" },
      },
    },
    coverage: { status: "complete", missingFields: [] },
  };
  const client = {
    financials: {
      incomeStatement: async (query) => {
        calls.push(["income", query]);
        return income;
      },
      balanceSheet: async (query) => {
        calls.push(["balance", query]);
        return balance;
      },
    },
  };
  const query = parseQuery(["AAPL", "2025", "2"]);
  const report = await getStatements(client, query);
  assert.deepEqual(calls, [
    ["income", query],
    ["balance", query],
  ]);
  assert.deepEqual(report, { income, balance });
  assert.equal(report.income.values.revenue, null);
  assert.equal(report.balance.details.totalAssets.exactValue, "331233000000");
});

test("propagates SEC client failures instead of presenting a plausible result", async () => {
  const failure = new Error("SEC unavailable");
  const client = {
    financials: {
      incomeStatement: async () => {
        throw failure;
      },
      balanceSheet: async () => ({}),
    },
  };
  await assert.rejects(
    getStatements(client, parseQuery(["AAPL", "2025", "2"])),
    failure,
  );
});

test("the standalone app installs the GitHub release tag and imports its package name", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );
  const entry = await readFile(
    new URL("../src/index.mjs", import.meta.url),
    "utf8",
  );
  assert.equal(manifest.private, true);
  assert.equal(
    manifest.dependencies["@rayterion/sec-edgar"],
    "github:rayterion/sec_edgar_api#v1.0.0",
  );
  assert.match(entry, /from "@rayterion\/sec-edgar"/);
});

test("the lockfile pins v1.0.0 to the verified GitHub release commit", async () => {
  const lockfile = JSON.parse(
    await readFile(new URL("../package-lock.json", import.meta.url), "utf8"),
  );
  assert.equal(
    lockfile.packages["node_modules/@rayterion/sec-edgar"].resolved,
    "git+ssh://git@github.com/rayterion/sec_edgar_api.git#e0d3bddd67ca3bbbd5a56d1acc753a005fdbd242",
  );
});
