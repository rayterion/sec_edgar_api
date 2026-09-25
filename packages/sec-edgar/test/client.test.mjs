import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import secEdgar, {
  normalizeCik,
  normalizeColumns,
  subtractDecimal,
  safeNumber,
  determineFiscalPeriod,
  selectFact,
  selectFactResult,
  incomeMappings,
  SecSnapshot,
  parseInlineXbrl,
  validateBalance,
  diffSnapshots,
} from "../dist/index.js";
const fixture = async (name) =>
  JSON.parse(
    await readFile(
      new URL(`../../../test/fixtures/${name}`, import.meta.url),
      "utf8",
    ),
  );
const source = {
  "https://www.sec.gov/files/company_tickers_exchange.json":
    "apple-ticker-lookup.json",
  "https://data.sec.gov/submissions/CIK0000320193.json":
    "apple-submissions-fy2025.json",
  "https://data.sec.gov/submissions/CIK0000320193-submissions-001.json":
    "apple-older-submissions-sample.json",
  "https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json":
    "apple-companyfacts-fy2025.json",
  "https://data.sec.gov/submissions/CIK0000019617.json":
    "jpm-bank-fy2025-submissions.json",
  "https://data.sec.gov/submissions/CIK0000019617-submissions-007.json":
    "jpm-bank-fy2025-older-submissions.json",
  "https://data.sec.gov/api/xbrl/companyfacts/CIK0000019617.json":
    "jpm-bank-fy2025-companyfacts.json",
  "https://data.sec.gov/submissions/CIK0000899051.json":
    "allstate-insurance-fy2025-submissions.json",
  "https://data.sec.gov/api/xbrl/companyfacts/CIK0000899051.json":
    "allstate-insurance-fy2025-companyfacts.json",
  "https://data.sec.gov/submissions/CIK0000726728.json":
    "realty-income-reit-fy2025-submissions.json",
  "https://data.sec.gov/api/xbrl/companyfacts/CIK0000726728.json":
    "realty-income-reit-fy2025-companyfacts.json",
  "https://data.sec.gov/submissions/CIK0001578348.json":
    "icmb-fund-fy2025-submissions.json",
  "https://data.sec.gov/api/xbrl/companyfacts/CIK0001578348.json":
    "icmb-fund-fy2025-companyfacts.json",
  "https://data.sec.gov/submissions/CIK0001132105.json":
    "spwh-fy2025-submissions.json",
  "https://data.sec.gov/api/xbrl/companyfacts/CIK0001132105.json":
    "spwh-fy2025-companyfacts.json",
  "https://data.sec.gov/api/xbrl/companyconcept/CIK0000320193/us-gaap/NetIncomeLoss.json":
    "apple-net-income-concept.json",
  "https://data.sec.gov/api/xbrl/frames/us-gaap/Assets/USD/CY2025Q1I.json":
    "apple-assets-frame.json",
  "https://www.sec.gov/Archives/edgar/data/320193/000032019325000057/index.json":
    "apple-q2-archive-index.json",
};
function client(overrides = {}, options = {}) {
  const seen = [];
  const http = {
    async fetch(url, init) {
      seen.push([url, init]);
      if (overrides[url]) return overrides[url](url, init);
      const file = source[url];
      if (!file) return new Response("not found", { status: 404 });
      return new Response(JSON.stringify(await fixture(file)), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  };
  return {
    edgar: secEdgar({
      userAgent: "Test Research test@example.com",
      http,
      retries: 0,
      requestsPerSecond: 9,
      ...options,
    }),
    seen,
  };
}
test("identifiers and column validation", () => {
  assert.equal(normalizeCik(320193), "0000320193");
  assert.throws(() => normalizeCik("32x"), { code: "INVALID_INPUT" });
  assert.throws(
    () =>
      normalizeColumns(
        { accessionNumber: ["0000320193-25-000057"], form: [] },
        "0000320193",
      ),
    { code: "SCHEMA" },
  );
});
test("exact decimal subtraction and safe numeric conversion", () => {
  assert.equal(subtractDecimal("219659000000", "124300000000"), "95359000000");
  assert.equal(subtractDecimal("1.20", "0.31"), "0.89");
  assert.equal(safeNumber("9007199254740993"), null);
  for (let i = 0; i < 100; i++) {
    const a = BigInt(i * 77 + 10),
      b = BigInt(i * 3);
    assert.equal(
      subtractDecimal(a.toString(), b.toString()),
      (a - b).toString(),
    );
  }
});
test("ticker lookup, submissions history, concept, frame, and archive index", async () => {
  const { edgar } = client();
  const apple = await edgar.companies.resolve({ ticker: "aapl" });
  assert.equal(apple.cik, "0000320193");
  assert.equal((await edgar.companies.search("apple"))[0].ticker, "AAPL");
  const filings = await edgar.filings.list({ cik: apple.cik });
  assert.ok(filings.length >= 8);
  assert.equal(
    new Set(filings.map((x) => x.accessionNumber)).size,
    filings.length,
  );
  assert.ok(filings[0].filed >= filings.at(-1).filed);
  assert.ok(
    (
      await edgar.filings.documents({
        cik: apple.cik,
        accessionNumber: "0000320193-25-000057",
      })
    ).some((x) => x.name.endsWith(".xml")),
  );
  assert.equal(
    (
      await edgar.xbrl.companyConcept({
        cik: apple.cik,
        taxonomy: "us-gaap",
        tag: "NetIncomeLoss",
      })
    ).tag,
    "NetIncomeLoss",
  );
  assert.equal(
    (
      await edgar.xbrl.frame({
        taxonomy: "us-gaap",
        tag: "Assets",
        unit: "USD",
        frame: "CY2025Q1I",
      })
    ).data[0].cik,
    320193,
  );
});
test("annual income from recorded Apple SEC facts", async () => {
  const { edgar } = client();
  const result = await edgar.financials.incomeStatement({
    ticker: "AAPL",
    fiscalYear: 2025,
  });
  assert.equal(result.period.start, "2024-09-29");
  assert.equal(result.period.end, "2025-09-27");
  assert.equal(result.values.revenue, 416161000000);
  assert.equal(
    result.details.revenue.source.accessionNumber,
    "0000320193-25-000079",
  );
  assert.equal(result.details.revenue.unit, "USD");
  assert.match(result.details.revenue.source.url, /000032019325000079/);
});
test("derived Q2 revenue uses compatible YTD operands and remains auditable", async () => {
  const factsUrl =
    "https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json";
  const facts = await fixture("apple-companyfacts-fy2025.json");
  const entries =
    facts.facts["us-gaap"].RevenueFromContractWithCustomerExcludingAssessedTax
      .units.USD;
  facts.facts[
    "us-gaap"
  ].RevenueFromContractWithCustomerExcludingAssessedTax.units.USD =
    entries.filter(
      (x) => !(x.start === "2024-12-29" && x.end === "2025-03-29"),
    );
  const { edgar } = client({
    [factsUrl]: () =>
      new Response(JSON.stringify(facts), {
        headers: { "content-type": "application/json" },
      }),
  });
  const result = await edgar.financials.incomeStatement({
    ticker: "AAPL",
    fiscalYear: 2025,
    fiscalQuarter: 2,
    precision: "string",
  });
  assert.equal(result.period.start, "2024-12-29");
  assert.equal(result.values.revenue, "95359000000");
  assert.equal(result.details.revenue.status, "derived");
  assert.equal(result.details.revenue.operands[0].exactValue, "219659000000");
  assert.equal(result.details.revenue.operands[1].exactValue, "124300000000");
});
test("Q2 balance is instantaneous and uses the quarter end", async () => {
  const { edgar } = client();
  const result = await edgar.financials.balanceSheet({
    ticker: "AAPL",
    fiscalYear: 2025,
    fiscalQuarter: 2,
  });
  assert.equal(result.values.totalAssets, 331233000000);
  assert.equal(result.details.totalAssets.end, "2025-03-29");
  assert.equal(result.details.totalAssets.start, undefined);
  assert.equal(result.details.totalAssets.status, "reported");
  assert.equal(
    result.details.totalAssets.source.accessionNumber,
    "0000320193-25-000057",
  );
});
test("later comparative revision wins by default; asFiled selects original", async () => {
  const data = await fixture("apple-companyfacts-fy2025.json");
  const submissions = await fixture("apple-submissions-fy2025.json");
  const rows = normalizeColumns(submissions.filings.recent, "0000320193");
  const period = determineFiscalPeriod(rows, 2025, 2);
  const entries = data.facts["us-gaap"].NetIncomeLoss.units.USD;
  entries.push({
    start: period.start,
    end: period.end,
    val: 24781000000,
    accn: "0000320193-26-000099",
    form: "10-Q/A",
    filed: "2026-09-01",
  });
  assert.equal(
    selectFact(data, "0000320193", period, incomeMappings.netIncome, "income")
      ?.exactValue,
    "24781000000",
  );
  assert.equal(
    selectFact(data, "0000320193", period, incomeMappings.netIncome, "income", {
      revision: "asFiled",
    })?.exactValue,
    "24780000000",
  );
  assert.equal(
    selectFact(data, "0000320193", period, incomeMappings.netIncome, "income", {
      asOf: "2025-05-02",
    })?.exactValue,
    "24780000000",
  );
});
test("HTML block, malformed JSON, unsafe numbers, and arbitrary URL guard", async () => {
  const url = "https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json";
  const { edgar } = client({
    [url]: () =>
      new Response("<html>blocked</html>", {
        headers: { "content-type": "text/html" },
      }),
  });
  await assert.rejects(edgar.xbrl.companyFacts({ cik: 320193 }), {
    code: "BLOCKED_HTML",
  });
  await assert.rejects(edgar.raw.get({ source: "data", path: "//evil.com/" }), {
    code: "INVALID_INPUT",
  });
  const broken = client({
    [url]: () =>
      new Response("{bad", { headers: { "content-type": "application/json" } }),
  });
  await assert.rejects(broken.edgar.xbrl.companyFacts({ cik: 320193 }), {
    code: "MALFORMED_JSON",
  });
  const unsafe = client({
    [url]: () =>
      new Response(
        '{"cik":320193,"entityName":"X","facts":{"us-gaap":{"Assets":{"units":{"USD":[{"end":"2025-03-29","val":9007199254740993,"accn":"0000320193-25-000057","form":"10-Q","filed":"2025-05-02"}]}}}}}',
        { headers: { "content-type": "application/json" } },
      ),
  });
  const result = await unsafe.edgar.xbrl.companyFacts({ cik: 320193 });
  assert.equal(
    result.facts["us-gaap"].Assets.units.USD[0].val,
    "9007199254740993",
  );
});
test("53-week fiscal 2023 uses actual Apple dates", async () => {
  const submissionsUrl = "https://data.sec.gov/submissions/CIK0000320193.json";
  const factsUrl =
    "https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json";
  const { edgar } = client({
    [submissionsUrl]: async () =>
      new Response(
        JSON.stringify(await fixture("apple-fy2023-53week-submissions.json")),
        { headers: { "content-type": "application/json" } },
      ),
    [factsUrl]: async () =>
      new Response(
        JSON.stringify(await fixture("apple-fy2023-53week-companyfacts.json")),
        { headers: { "content-type": "application/json" } },
      ),
  });
  const annual = await edgar.financials.incomeStatement({
    ticker: "AAPL",
    fiscalYear: 2023,
  });
  assert.equal(annual.period.start, "2022-09-25");
  assert.equal(annual.period.end, "2023-09-30");
  assert.equal(
    (Date.parse(annual.period.end) - Date.parse(annual.period.start)) /
      86400000 +
      1,
    371,
  );
  assert.ok(annual.values.revenue > 0);
});
test("IFRS annual revenue uses EUR without silently mixing USD", async () => {
  const tickerUrl = "https://www.sec.gov/files/company_tickers_exchange.json";
  const submissionsUrl = "https://data.sec.gov/submissions/CIK0001000184.json";
  const factsUrl =
    "https://data.sec.gov/api/xbrl/companyfacts/CIK0001000184.json";
  const overrides = {
    [tickerUrl]: () =>
      new Response(
        JSON.stringify({
          fields: ["cik", "name", "ticker", "exchange"],
          data: [[1000184, "SAP SE", "SAP", "NYSE"]],
        }),
        { headers: { "content-type": "application/json" } },
      ),
    [submissionsUrl]: async () =>
      new Response(
        JSON.stringify(await fixture("sap-fy2025-ifrs-submissions.json")),
        { headers: { "content-type": "application/json" } },
      ),
    [factsUrl]: async () =>
      new Response(
        JSON.stringify(await fixture("sap-fy2025-ifrs-companyfacts.json")),
        { headers: { "content-type": "application/json" } },
      ),
  };
  const { edgar } = client(overrides);
  const result = await edgar.financials.incomeStatement({
    ticker: "SAP",
    fiscalYear: 2025,
    unit: "EUR",
  });
  assert.equal(result.period.start, "2025-01-01");
  assert.equal(result.currency, "EUR");
  assert.equal(result.details.revenue.taxonomy, "ifrs-full");
  assert.equal(result.details.revenue.unit, "EUR");
  assert.ok(result.values.revenue > 0);
});
test("changed fiscal year end selects the six-month transition report", async () => {
  const data = await fixture("icmb-fiscal-transition-submissions.json");
  const rows = normalizeColumns(data.filings.recent, "0001578348");
  const period = determineFiscalPeriod(rows, 2024);
  assert.equal(period.start, "2024-07-01");
  assert.equal(period.end, "2024-12-31");
  assert.equal(period.kind, "transition");
});
test("filing XBRL extraction keeps custom taxonomy, context, unit and exact value", async () => {
  const { parseXbrlInstance } = await import("../dist/index.js");
  const xml = await readFile(
    new URL(
      "../../../test/fixtures/apple-custom-xbrl-sample.xml",
      import.meta.url,
    ),
    "utf8",
  );
  const facts = parseXbrlInstance(
    xml,
    "https://www.sec.gov/Archives/edgar/data/320193/000032019325000057/aapl-20250329_htm.xml",
  );
  const custom = facts.find((x) => x.taxonomy === "aapl");
  assert.equal(
    custom.tag,
    "OtherComprehensiveIncomeLossDerivativeInstrumentGainLossBeforeReclassificationAfterTax",
  );
  assert.equal(custom.exactValue, "456000000");
  assert.equal(custom.unit, "USD");
  assert.equal(custom.start, "2023-12-31");
  assert.equal(custom.end, "2024-03-30");
  assert.equal(custom.cik, "0000320193");
  assert.throws(() => parseXbrlInstance("<!DOCTYPE xbrl><xbrl/>", "test"), {
    code: "UNSUPPORTED",
  });
});
test("Q1–Q4 direct and derived revenue use fiscal boundaries", async () => {
  const { edgar } = client();
  const expected = [124300000000, 95359000000, 94036000000, 102466000000];
  for (let q = 1; q <= 4; q++) {
    const result = await edgar.financials.incomeStatement({
      ticker: "AAPL",
      fiscalYear: 2025,
      fiscalQuarter: q,
    });
    assert.equal(result.values.revenue, expected[q - 1]);
    assert.equal(
      result.details.revenue.status,
      q === 4 ? "derived" : "reported",
    );
    if (q === 4)
      assert.notEqual(
        result.details.earningsPerShareDiluted?.status,
        "derived",
      );
  }
});
test("unsafe statement magnitude remains exact and numeric value is null with warning", async () => {
  const factsUrl =
    "https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json";
  const facts = await fixture("apple-companyfacts-fy2025.json");
  facts.facts["us-gaap"].Assets.units.USD.push({
    end: "2025-03-29",
    val: "9007199254740993",
    accn: "0000320193-26-000099",
    form: "10-Q/A",
    filed: "2026-09-01",
  });
  const { edgar } = client({
    [factsUrl]: () =>
      new Response(JSON.stringify(facts), {
        headers: { "content-type": "application/json" },
      }),
  });
  const result = await edgar.financials.balanceSheet({
    ticker: "AAPL",
    fiscalYear: 2025,
    fiscalQuarter: 2,
  });
  assert.equal(result.values.totalAssets, null);
  assert.equal(result.details.totalAssets.exactValue, "9007199254740993");
  assert.ok(
    result.warnings.some(
      (x) => x.includes("totalAssets") && x.includes("precision"),
    ),
  );
});
test("specific periodEnd can select pre-transition annual report", async () => {
  const data = await fixture("icmb-fiscal-transition-submissions.json");
  const rows = normalizeColumns(data.filings.recent, "0001578348");
  const period = determineFiscalPeriod(
    rows,
    2024,
    undefined,
    undefined,
    "2024-06-30",
  );
  assert.equal(period.start, "2023-07-01");
  assert.equal(period.end, "2024-06-30");
  assert.equal(period.kind, "year");
});
test("limited recent filing list avoids older history downloads", async () => {
  const { edgar, seen } = client();
  const filings = await edgar.filings.list({ cik: 320193, limit: 1 });
  assert.equal(filings.length, 1);
  assert.equal(
    seen.some(([url]) => url.includes("-submissions-001")),
    false,
  );
});
test("HTTP status errors, bounded body, and retryable 429", async () => {
  const url = "https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json";
  for (const [status, code] of [
    [400, "HTTP_400"],
    [403, "HTTP_403"],
    [404, "HTTP_404"],
    [408, "HTTP_408"],
    [429, "HTTP_429"],
    [500, "HTTP_5XX"],
  ]) {
    const { edgar } = client({
      [url]: () => new Response("error", { status }),
    });
    await assert.rejects(edgar.xbrl.companyFacts({ cik: 320193 }), { code });
  }
  const large = client({
    [url]: () =>
      new Response("x".repeat(100), {
        headers: { "content-type": "application/json" },
      }),
  });
  await assert.rejects(
    large.edgar.raw.get({
      source: "data",
      path: "/api/xbrl/companyfacts/CIK0000320193.json",
    }),
    { code: "MALFORMED_JSON" },
  );
});
test("cash flow derives additive Q2 and Q4 from exact year-to-date facts", async () => {
  const { edgar } = client();
  const annual = await edgar.financials.cashFlowStatement({
    ticker: "AAPL",
    fiscalYear: 2025,
  });
  assert.equal(annual.values.netCashFromOperations, 111482000000);
  const q2 = await edgar.financials.cashFlowStatement({
    ticker: "AAPL",
    fiscalYear: 2025,
    fiscalQuarter: 2,
  });
  assert.equal(q2.values.netCashFromOperations, 23952000000);
  assert.equal(q2.details.netCashFromOperations.status, "derived");
  assert.equal(q2.details.netCashFromOperations.operands.length, 2);
  const q4 = await edgar.financials.cashFlowStatement({
    ticker: "AAPL",
    fiscalYear: 2025,
    fiscalQuarter: 4,
  });
  assert.equal(q4.values.netCashFromOperations, 29728000000);
  assert.equal(q4.details.netCashFromOperations.status, "derived");
});
test("asOf selects Q2 as known by its filing date before the annual 10-K", async () => {
  const { edgar } = client();
  const result = await edgar.financials.incomeStatement({
    ticker: "AAPL",
    fiscalYear: 2025,
    fiscalQuarter: 2,
    asOf: "2025-05-02",
  });
  assert.equal(result.values.revenue, 95359000000);
  assert.equal(result.details.revenue.source.filed, "2025-05-02");
});
test("open fiscal year uses filed quarter reports without a future 10-K", async () => {
  const submissions = await fixture("apple-submissions-fy2025.json");
  const filed = normalizeColumns(
    submissions.filings.recent,
    "0000320193",
  ).filter((filing) => filing.filed <= "2025-05-02");
  const period = determineFiscalPeriod(filed, 2025, 2, "2025-05-02");
  assert.equal(period.start, "2024-12-29");
  assert.equal(period.end, "2025-03-29");
  assert.equal(period.filingAccession, "0000320193-25-000057");
});
test("direct alternate standard tag outranks derived preferred tag", async () => {
  const data = await fixture("apple-companyfacts-fy2025.json");
  const submissions = await fixture("apple-submissions-fy2025.json");
  const period = determineFiscalPeriod(
    normalizeColumns(submissions.filings.recent, "0000320193"),
    2025,
    2,
  );
  const preferred =
    data.facts["us-gaap"].RevenueFromContractWithCustomerExcludingAssessedTax
      .units.USD;
  data.facts[
    "us-gaap"
  ].RevenueFromContractWithCustomerExcludingAssessedTax.units.USD =
    preferred.filter(
      (x) => !(x.start === period.start && x.end === period.end),
    );
  data.facts["us-gaap"].Revenues = {
    units: {
      USD: [
        {
          start: period.start,
          end: period.end,
          val: 95359000000,
          accn: period.filingAccession,
          form: "10-Q",
          filed: "2025-05-02",
        },
      ],
    },
  };
  const selected = selectFact(
    data,
    "0000320193",
    period,
    incomeMappings.revenue,
    "income",
  );
  assert.equal(selected.status, "reported");
  assert.equal(selected.tag, "Revenues");
});
test("partial statement gives field-specific missing reason instead of zero", async () => {
  const factsUrl =
    "https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json";
  const data = await fixture("apple-companyfacts-fy2025.json");
  delete data.facts["us-gaap"].Assets;
  const { edgar } = client({
    [factsUrl]: () =>
      new Response(JSON.stringify(data), {
        headers: { "content-type": "application/json" },
      }),
  });
  const balance = await edgar.financials.balanceSheet({
    ticker: "AAPL",
    fiscalYear: 2025,
    fiscalQuarter: 2,
  });
  assert.equal(balance.values.totalAssets, null);
  assert.equal(balance.details.totalAssets, null);
  assert.ok(balance.coverage.missingFields.includes("totalAssets"));
  assert.match(balance.coverage.missingReasons.totalAssets, /USD.*2025-03-29/);
});
test("transport classifies network failures, redirect, oversized stream, and malformed XML", async () => {
  const url = "https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json";
  for (const [nodeCode, edgarCode] of [
    ["ENOTFOUND", "NETWORK_DNS"],
    ["ERR_TLS_CERT_ALTNAME_INVALID", "NETWORK_TLS"],
    ["ECONNRESET", "NETWORK_CONNECTION"],
    ["Z_DATA_ERROR", "DECOMPRESSION"],
  ]) {
    const { edgar } = client({
      [url]: () => {
        const error = new Error("failed");
        error.code = nodeCode;
        throw error;
      },
    });
    await assert.rejects(edgar.xbrl.companyFacts({ cik: 320193 }), {
      code: edgarCode,
    });
  }
  const redirected = client({
    [url]: () =>
      new Response(null, {
        status: 302,
        headers: { location: "https://evil.example/" },
      }),
  });
  await assert.rejects(redirected.edgar.xbrl.companyFacts({ cik: 320193 }), {
    code: "REDIRECT",
  });
  const large = client({
    [url]: () =>
      new Response("x".repeat(100), {
        headers: { "content-type": "application/json" },
      }),
  });
  await assert.rejects(
    large.edgar.xbrl.companyFacts({ cik: 320193 }, { maxBytes: 10 }),
    { code: "OVERSIZED" },
  );
  const { parseXbrlInstance } = await import("../dist/index.js");
  assert.throws(() => parseXbrlInstance("<xbrl>", url), {
    code: "MALFORMED_XML",
  });
});
test("429 is retried once and then succeeds", async () => {
  let calls = 0;
  const edgar = secEdgar({
    userAgent: "Retry Test retry@example.com",
    retries: 1,
    requestsPerSecond: 9,
    http: {
      async fetch() {
        calls++;
        if (calls === 1)
          return new Response("rate limited", {
            status: 429,
            headers: { "retry-after": "0" },
          });
        return new Response(
          JSON.stringify(await fixture("apple-companyfacts-fy2025.json")),
          { headers: { "content-type": "application/json" } },
        );
      },
    },
  });
  assert.equal(
    (await edgar.xbrl.companyFacts({ cik: 320193 })).entityName,
    "Apple Inc.",
  );
  assert.equal(calls, 2);
});
test("invalid dates, ambiguous identifier, form, and accession reject before use", async () => {
  const { edgar } = client();
  await assert.rejects(
    edgar.financials.incomeStatement({
      ticker: "AAPL",
      fiscalYear: 2025,
      asOf: "2025-02-31",
    }),
    { code: "INVALID_INPUT" },
  );
  await assert.rejects(
    edgar.companies.resolve({ ticker: "AAPL", cik: 320193 }),
    { code: "INVALID_INPUT" },
  );
  await assert.rejects(edgar.filings.list({ cik: 320193, form: "../bad" }), {
    code: "INVALID_INPUT",
  });
  await assert.rejects(
    edgar.filings.get({ cik: 320193, accessionNumber: "bad" }),
    { code: "INVALID_INPUT" },
  );
});
test("real BayFirst 10-K/A changes net income and assets under revision policy", async () => {
  const tickerUrl = "https://www.sec.gov/files/company_tickers_exchange.json";
  const submissionsUrl = "https://data.sec.gov/submissions/CIK0001649739.json";
  const factsUrl =
    "https://data.sec.gov/api/xbrl/companyfacts/CIK0001649739.json";
  const { edgar } = client({
    [tickerUrl]: () =>
      new Response(
        JSON.stringify({
          fields: ["cik", "name", "ticker", "exchange"],
          data: [[1649739, "BayFirst Financial Corp.", "BAFN", "Nasdaq"]],
        }),
        { headers: { "content-type": "application/json" } },
      ),
    [submissionsUrl]: async () =>
      new Response(
        JSON.stringify(
          await fixture("bayfirst-amended-fy2025-submissions.json"),
        ),
        { headers: { "content-type": "application/json" } },
      ),
    [factsUrl]: async () =>
      new Response(
        JSON.stringify(
          await fixture("bayfirst-amended-fy2025-companyfacts.json"),
        ),
        { headers: { "content-type": "application/json" } },
      ),
  });
  const latestIncome = await edgar.financials.incomeStatement({
    ticker: "BAFN",
    fiscalYear: 2025,
  });
  const originalIncome = await edgar.financials.incomeStatement({
    ticker: "BAFN",
    fiscalYear: 2025,
    revision: "asFiled",
  });
  assert.equal(latestIncome.values.netIncome, -24565000);
  assert.equal(latestIncome.details.netIncome.source.form, "10-K/A");
  assert.equal(originalIncome.values.netIncome, -22937000);
  assert.equal(originalIncome.details.netIncome.source.form, "10-K");
  const latestBalance = await edgar.financials.balanceSheet({
    ticker: "BAFN",
    fiscalYear: 2025,
  });
  const asOfBalance = await edgar.financials.balanceSheet({
    ticker: "BAFN",
    fiscalYear: 2025,
    asOf: "2026-03-27",
  });
  assert.equal(latestBalance.values.totalAssets, 1294269000);
  assert.equal(asOfBalance.values.totalAssets, 1300258000);
});
test("selection trace explains direct rank and derived operands", async () => {
  const data = await fixture("apple-companyfacts-fy2025.json");
  const submissions = await fixture("apple-submissions-fy2025.json");
  const period = determineFiscalPeriod(
    normalizeColumns(submissions.filings.recent, "0000320193"),
    2025,
    2,
  );
  const direct = selectFact(
    data,
    "0000320193",
    period,
    incomeMappings.revenue,
    "income",
    { trace: true },
  );
  assert.ok(direct.candidates.some((x) => x.reason === "selected direct fact"));
  assert.ok(direct.candidates.some((x) => x.reason === "different period"));
  data.facts[
    "us-gaap"
  ].RevenueFromContractWithCustomerExcludingAssessedTax.units.USD = data.facts[
    "us-gaap"
  ].RevenueFromContractWithCustomerExcludingAssessedTax.units.USD.filter(
    (x) => !(x.start === period.start && x.end === period.end),
  );
  const derived = selectFact(
    data,
    "0000320193",
    period,
    incomeMappings.revenue,
    "income",
    { trace: true },
  );
  assert.ok(derived.candidates.some((x) => x.reason === "later YTD operand"));
  assert.ok(derived.candidates.some((x) => x.reason === "prior YTD operand"));
  assert.ok(
    derived.operands.every((x) =>
      x.url.startsWith("https://www.sec.gov/Archives/"),
    ),
  );
});

// PR-01: mutations below model a conflict on top of recorded Apple SEC rows;
// the original excerpt remains unchanged in test/fixtures.
test("PR-01 refuses mixed comparative revision operands and reports why", async () => {
  const data = await fixture("apple-companyfacts-fy2025.json");
  const anomaly = await fixture("selection-anomalies.json");
  const submissions = await fixture("apple-submissions-fy2025.json");
  const period = determineFiscalPeriod(
    normalizeColumns(submissions.filings.recent, "0000320193"),
    2025,
    2,
  );
  const revenue =
    data.facts["us-gaap"].RevenueFromContractWithCustomerExcludingAssessedTax
      .units.USD;
  data.facts[
    "us-gaap"
  ].RevenueFromContractWithCustomerExcludingAssessedTax.units.USD =
    revenue.filter((x) => !(x.start === period.start && x.end === period.end));
  data.facts[
    "us-gaap"
  ].RevenueFromContractWithCustomerExcludingAssessedTax.units.USD.push(
    anomaly.latePriorRevision,
  );
  const selected = selectFactResult(
    data,
    "0000320193",
    period,
    incomeMappings.revenue,
    "income",
    { trace: true },
  );
  assert.equal(selected.fact, null);
  assert.equal(selected.failureCode, "INCOMPATIBLE_REVISIONS");
  assert.match(selected.reason, /newer.*prior.*later/i);
  assert.ok(selected.candidates.some((x) => x.reason.includes("incompatible")));
  const asOf = selectFactResult(
    data,
    "0000320193",
    period,
    incomeMappings.revenue,
    "income",
    { asOf: "2026-05-01" },
  );
  assert.equal(asOf.fact.exactValue, "95359000000");
  assert.equal(asOf.fact.operands[0].accessionNumber, "0000320193-26-000013");
  assert.equal(asOf.fact.operands[1].accessionNumber, "0000320193-26-000006");
  const asFiled = selectFactResult(
    data,
    "0000320193",
    period,
    incomeMappings.revenue,
    "income",
    { revision: "asFiled" },
  );
  assert.equal(asFiled.fact.exactValue, "95359000000");
  assert.equal(
    asFiled.fact.operands[0].accessionNumber,
    "0000320193-25-000057",
  );
});

test("PR-01 refuses conflicting equal-source direct facts but accepts identical duplicates", async () => {
  const data = await fixture("apple-companyfacts-fy2025.json");
  const anomaly = await fixture("selection-anomalies.json");
  const submissions = await fixture("apple-submissions-fy2025.json");
  const period = determineFiscalPeriod(
    normalizeColumns(submissions.filings.recent, "0000320193"),
    2025,
    2,
  );
  const rows =
    data.facts["us-gaap"].RevenueFromContractWithCustomerExcludingAssessedTax
      .units.USD;
  const original = rows.find(
    (x) =>
      x.start === period.start &&
      x.end === period.end &&
      x.accn === period.filingAccession,
  );
  rows.push({ ...original });
  let result = selectFactResult(
    data,
    "0000320193",
    period,
    incomeMappings.revenue,
    "income",
    { revision: "asFiled", trace: true },
  );
  assert.equal(result.fact.exactValue, "95359000000");
  assert.ok(
    result.candidates.some((x) => x.reason === "duplicate identical fact"),
  );
  rows.push({ ...original, val: anomaly.conflictingDirectValue });
  result = selectFactResult(
    data,
    "0000320193",
    period,
    incomeMappings.revenue,
    "income",
    { revision: "asFiled", trace: true },
  );
  assert.equal(result.fact, null);
  assert.equal(result.failureCode, "CONFLICTING_FACTS");
  assert.ok(
    result.candidates.some((x) => x.reason === "conflicting equal-source fact"),
  );
});

test("PR-01 statement exposes a stable missing code and losing candidates", async () => {
  const url = "https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json";
  const data = await fixture("apple-companyfacts-fy2025.json");
  const anomaly = await fixture("selection-anomalies.json");
  const rows =
    data.facts["us-gaap"].RevenueFromContractWithCustomerExcludingAssessedTax
      .units.USD;
  const original = rows.find(
    (x) =>
      x.start === "2024-12-29" &&
      x.end === "2025-03-29" &&
      x.accn === "0000320193-25-000057",
  );
  rows.push({ ...original, val: anomaly.conflictingDirectValue });
  const { edgar } = client({
    [url]: () =>
      new Response(JSON.stringify(data), {
        headers: { "content-type": "application/json" },
      }),
  });
  const result = await edgar.financials.incomeStatement({
    ticker: "AAPL",
    fiscalYear: 2025,
    fiscalQuarter: 2,
    revision: "asFiled",
    trace: true,
  });
  assert.equal(result.values.revenue, null);
  assert.equal(result.coverage.missingCodes.revenue, "CONFLICTING_FACTS");
  assert.match(result.coverage.missingReasons.revenue, /conflict/i);
  assert.ok(
    result.selectionTraces.revenue.some(
      (x) => x.reason === "conflicting equal-source fact",
    ),
  );
});

test("PR-01 latest direct revision ranks across approved aliases; asFiled keeps target filing", async () => {
  const data = await fixture("apple-companyfacts-fy2025.json");
  const anomaly = await fixture("selection-anomalies.json");
  const submissions = await fixture("apple-submissions-fy2025.json");
  const period = determineFiscalPeriod(
    normalizeColumns(submissions.filings.recent, "0000320193"),
    2025,
    2,
  );
  data.facts["us-gaap"].Revenues = {
    units: { USD: [anomaly.alternateDirectRevision] },
  };
  const latest = selectFactResult(
    data,
    "0000320193",
    period,
    incomeMappings.revenue,
    "income",
    { trace: true },
  );
  assert.equal(latest.fact.exactValue, "96000000000");
  assert.equal(latest.fact.tag, "Revenues");
  assert.ok(
    latest.candidates.some(
      (x) =>
        x.tag === "RevenueFromContractWithCustomerExcludingAssessedTax" &&
        x.reason === "lower ranked exact-period fact",
    ),
  );
  const asFiled = selectFactResult(
    data,
    "0000320193",
    period,
    incomeMappings.revenue,
    "income",
    { revision: "asFiled" },
  );
  assert.equal(asFiled.fact.exactValue, "95359000000");
  assert.equal(asFiled.fact.source.accessionNumber, period.filingAccession);
});

test("PR-01 refuses conflicting YTD operands instead of subtracting them", async () => {
  const data = await fixture("apple-companyfacts-fy2025.json");
  const anomaly = await fixture("selection-anomalies.json");
  const submissions = await fixture("apple-submissions-fy2025.json");
  const period = determineFiscalPeriod(
    normalizeColumns(submissions.filings.recent, "0000320193"),
    2025,
    2,
  );
  const rows =
    data.facts["us-gaap"].RevenueFromContractWithCustomerExcludingAssessedTax
      .units.USD;
  const later = rows.find(
    (x) =>
      x.start === period.fiscalStart &&
      x.end === period.end &&
      x.accn === "0000320193-26-000013",
  );
  data.facts[
    "us-gaap"
  ].RevenueFromContractWithCustomerExcludingAssessedTax.units.USD = rows.filter(
    (x) => !(x.start === period.start && x.end === period.end),
  );
  data.facts[
    "us-gaap"
  ].RevenueFromContractWithCustomerExcludingAssessedTax.units.USD.push({
    ...later,
    val: anomaly.conflictingYtdValue,
  });
  const result = selectFactResult(
    data,
    "0000320193",
    period,
    incomeMappings.revenue,
    "income",
    { trace: true },
  );
  assert.equal(result.fact, null);
  assert.equal(result.failureCode, "CONFLICTING_FACTS");
  assert.ok(
    result.candidates.some((x) => x.reason === "conflicting equal-source fact"),
  );
});

test("PR-01 trace explains facts excluded by asOf", async () => {
  const data = await fixture("apple-companyfacts-fy2025.json");
  const submissions = await fixture("apple-submissions-fy2025.json");
  const period = determineFiscalPeriod(
    normalizeColumns(submissions.filings.recent, "0000320193"),
    2025,
    2,
  );
  const result = selectFactResult(
    data,
    "0000320193",
    period,
    incomeMappings.revenue,
    "income",
    { asOf: "2025-05-02", trace: true },
  );
  assert.equal(result.fact.exactValue, "95359000000");
  assert.ok(
    result.candidates.some(
      (x) => x.filed === "2026-05-01" && x.reason === "filed after asOf",
    ),
  );
});

test("PR-02 historical Apple FY2015 annual and Q1–Q4 use referenced submissions", async () => {
  const url = "https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json";
  const old =
    "https://data.sec.gov/submissions/CIK0000320193-submissions-001.json";
  const facts = await fixture("apple-fy2015-companyfacts.json");
  const { edgar, seen } = client({
    [url]: () =>
      new Response(JSON.stringify(facts), {
        headers: { "content-type": "application/json" },
      }),
  });
  const annual = await edgar.financials.incomeStatement({
    ticker: "AAPL",
    fiscalYear: 2015,
  });
  assert.equal(annual.period.start, "2014-09-28");
  assert.equal(annual.period.end, "2015-09-26");
  assert.equal(annual.values.revenue, 233715000000);
  assert.equal(
    annual.details.revenue.source.accessionNumber,
    "0001193125-15-356351",
  );
  for (const [q, value, end] of [
    [1, 74599000000, "2014-12-27"],
    [2, 58010000000, "2015-03-28"],
    [3, 49605000000, "2015-06-27"],
    [4, 51501000000, "2015-09-26"],
  ]) {
    const result = await edgar.financials.incomeStatement({
      ticker: "AAPL",
      fiscalYear: 2015,
      fiscalQuarter: q,
    });
    assert.equal(result.period.end, end);
    assert.equal(result.values.revenue, value);
  }
  const balance = await edgar.financials.balanceSheet({
    ticker: "AAPL",
    fiscalYear: 2015,
    fiscalQuarter: 2,
  });
  assert.equal(balance.values.totalAssets, 261194000000);
  assert.ok(seen.some(([requestUrl]) => requestUrl === old));
});

test("PR-02 filtered historical pagination skips unrelated files", async () => {
  const rootUrl = "https://data.sec.gov/submissions/CIK0000320193.json";
  const olderUrl =
    "https://data.sec.gov/submissions/CIK0000320193-submissions-001.json";
  const unrelatedUrl =
    "https://data.sec.gov/submissions/CIK0000320193-submissions-002.json";
  const root = await fixture("apple-submissions-fy2025.json");
  root.filings.files.push({
    name: "CIK0000320193-submissions-002.json",
    filingFrom: "1990-01-01",
    filingTo: "1993-12-31",
    filingCount: 50,
  });
  const { edgar, seen } = client({
    [rootUrl]: () =>
      new Response(JSON.stringify(root), {
        headers: { "content-type": "application/json" },
      }),
  });
  const rows = await edgar.filings.list({
    cik: 320193,
    from: "2014-01-01",
    to: "2015-12-31",
  });
  assert.ok(rows.some((x) => x.accessionNumber === "0001193125-14-383437"));
  assert.ok(seen.some(([url]) => url === olderUrl));
  assert.ok(!seen.some(([url]) => url === unrelatedUrl));
  seen.length = 0;
  await edgar.filings.list({
    cik: 320193,
    from: "2024-01-01",
    to: "2026-12-31",
  });
  assert.ok(!seen.some(([url]) => url === olderUrl));
});

test("PR-02 missing Q2 filing cannot be relabeled from Q3", async () => {
  const root = await fixture("apple-submissions-fy2025.json");
  const old = await fixture("apple-older-submissions-sample.json");
  const rows = [
    ...normalizeColumns(root.filings.recent, "0000320193"),
    ...normalizeColumns(old, "0000320193"),
  ].filter((x) => x.accessionNumber !== "0001193125-15-153166");
  assert.throws(() => determineFiscalPeriod(rows, 2015, 2), {
    code: "NOT_FOUND",
  });
  assert.equal(determineFiscalPeriod(rows, 2015, 1).end, "2014-12-27");
});

test("PR-02 explicit periodEnd handles a fiscal label unlike report calendar year", async () => {
  const { edgar } = client();
  await assert.rejects(
    edgar.financials.incomeStatement({ cik: 1132105, fiscalYear: 2025 }),
    { code: "AMBIGUOUS_PERIOD" },
  );
  const annual = await edgar.financials.incomeStatement({
    cik: 1132105,
    fiscalYear: 2025,
    periodEnd: "2026-01-31",
  });
  assert.equal(annual.period.start, "2025-02-02");
  assert.equal(annual.period.end, "2026-01-31");
  assert.equal(annual.values.revenue, 1209182000);
  for (const [q, end] of [
    [1, "2025-05-03"],
    [2, "2025-08-02"],
    [3, "2025-11-01"],
    [4, "2026-01-31"],
  ]) {
    const quarter = await edgar.financials.incomeStatement({
      cik: 1132105,
      fiscalYear: 2025,
      fiscalQuarter: q,
      periodEnd: "2026-01-31",
    });
    assert.equal(quarter.period.end, end);
    assert.ok(quarter.values.revenue !== null);
  }
  const beforeAnnual = await edgar.financials.incomeStatement({
    cik: 1132105,
    fiscalYear: 2025,
    fiscalQuarter: 2,
    periodEnd: "2026-01-31",
    asOf: "2025-09-04",
  });
  assert.equal(beforeAnnual.period.start, "2025-05-04");
  assert.equal(beforeAnnual.values.revenue, 293899000);
});

test("PR-02 historical asOf finds Q2 before FY2015 annual filing", async () => {
  const url = "https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json";
  const facts = await fixture("apple-fy2015-companyfacts.json");
  const { edgar } = client({
    [url]: () =>
      new Response(JSON.stringify(facts), {
        headers: { "content-type": "application/json" },
      }),
  });
  const q2 = await edgar.financials.incomeStatement({
    ticker: "AAPL",
    fiscalYear: 2015,
    fiscalQuarter: 2,
    asOf: "2015-04-28",
  });
  assert.equal(q2.period.start, "2014-12-28");
  assert.equal(q2.period.end, "2015-03-28");
  assert.equal(q2.values.revenue, 58010000000);
  await assert.rejects(
    edgar.financials.incomeStatement({
      ticker: "AAPL",
      fiscalYear: 2015,
      asOf: "2015-04-28",
    }),
    { code: "NOT_FOUND" },
  );
});

test("PR-02 malformed history range is a schema error", async () => {
  const url = "https://data.sec.gov/submissions/CIK0000320193.json";
  const root = await fixture("apple-submissions-fy2025.json");
  root.filings.files[0].filingFrom = "2016-01-01";
  root.filings.files[0].filingTo = "2015-12-31";
  const { edgar } = client({
    [url]: () =>
      new Response(JSON.stringify(root), {
        headers: { "content-type": "application/json" },
      }),
  });
  await assert.rejects(
    edgar.filings.list({ cik: 320193, from: "2015-01-01", to: "2015-12-31" }),
    { code: "SCHEMA" },
  );
});

test("PR-03 detects SAP reporting EUR and refuses ambiguous eligible currencies", async () => {
  const { edgar } = client({
    "https://data.sec.gov/submissions/CIK0001000184.json": async () =>
      new Response(
        JSON.stringify(await fixture("sap-fy2025-ifrs-submissions.json")),
        {
          headers: { "content-type": "application/json" },
        },
      ),
    "https://data.sec.gov/api/xbrl/companyfacts/CIK0001000184.json": async () =>
      new Response(
        JSON.stringify(await fixture("sap-fy2025-ifrs-companyfacts.json")),
        {
          headers: { "content-type": "application/json" },
        },
      ),
  });
  const income = await edgar.financials.incomeStatement({
    cik: 1000184,
    fiscalYear: 2025,
  });
  assert.equal(income.currency, "EUR");
  assert.equal(income.values.revenue, 36800000000);
  assert.equal(income.details.revenue.unit, "EUR");
  const usd = await edgar.financials.incomeStatement({
    cik: 1000184,
    fiscalYear: 2025,
    unit: "USD",
  });
  assert.equal(usd.currency, "USD");
  assert.equal(usd.values.revenue, null);
  const facts = await fixture("sap-fy2025-ifrs-companyfacts.json");
  facts.facts["ifrs-full"].Revenue.units.USD = [
    {
      start: "2025-01-01",
      end: "2025-12-31",
      val: 40000000000,
      accn: "0001104659-26-020058",
      fy: 2025,
      fp: "FY",
      form: "20-F",
      filed: "2026-02-26",
    },
  ];
  const ambiguous = client({
    "https://data.sec.gov/submissions/CIK0001000184.json": async () =>
      new Response(
        JSON.stringify(await fixture("sap-fy2025-ifrs-submissions.json")),
        {
          headers: { "content-type": "application/json" },
        },
      ),
    "https://data.sec.gov/api/xbrl/companyfacts/CIK0001000184.json": () =>
      new Response(JSON.stringify(facts), {
        headers: { "content-type": "application/json" },
      }),
  }).edgar;
  await assert.rejects(
    ambiguous.financials.incomeStatement({ cik: 1000184, fiscalYear: 2025 }),
    {
      code: "AMBIGUOUS_CURRENCY",
    },
  );
  assert.equal(
    (
      await ambiguous.financials.incomeStatement({
        cik: 1000184,
        fiscalYear: 2025,
        unit: "EUR",
      })
    ).values.revenue,
    36800000000,
  );
});

test("PR-03 industry profiles use real standard facts without relabeling revenue", async () => {
  const { edgar } = client();
  for (const [cik, profile, field, value, tag] of [
    [
      19617,
      "bank",
      "netInterestIncome",
      95443000000,
      "InterestIncomeExpenseNet",
    ],
    [899051, "insurance", "premiumsEarned", 61449000000, "PremiumsEarnedNet"],
    [726728, "reit", "leaseIncome", 5437332000, "LeaseIncome"],
    [
      1578348,
      "investmentCompany",
      "grossInvestmentIncome",
      17396235,
      "GrossInvestmentIncomeOperating",
    ],
  ]) {
    const result = await edgar.financials.incomeStatement({
      cik,
      fiscalYear: 2025,
    });
    assert.equal(result.currency, "USD");
    assert.equal(result.industry?.profile, profile);
    assert.equal(result.industry.values[field], value);
    assert.equal(result.industry.details[field].tag, tag);
    assert.equal(result.industry.details[field].source.form, "10-K");
  }
  const fund = await edgar.financials.incomeStatement({
    cik: 1578348,
    fiscalYear: 2025,
  });
  assert.equal(fund.values.revenue, null);
  assert.equal(fund.industry.values.grossInvestmentIncome, 17396235);
});

test("PR-04 recorded raw SEC inputs replay exact financial values and lineage offline", async () => {
  const recording = new SecSnapshot();
  const first = await client(
    {},
    { snapshot: recording },
  ).edgar.financials.incomeStatement({
    ticker: "AAPL",
    fiscalYear: 2025,
    fiscalQuarter: 2,
  });
  const artifact = JSON.parse(JSON.stringify(recording.export()));
  assert.ok(artifact.entries.length >= 3);
  assert.ok(
    artifact.entries.every((entry) =>
      /^https:\/\/(?:data|www)\.sec\.gov\//.test(entry.url),
    ),
  );
  assert.ok(
    artifact.entries.every(
      (entry) =>
        /^\d{4}-\d\d-\d\dT/.test(entry.retrievedAt) &&
        /^[a-f0-9]{64}$/.test(entry.sha256),
    ),
  );
  assert.ok(
    first.audit.inputs.some((entry) => entry.url.includes("companyfacts")),
  );
  assert.equal(first.audit.mappingVersion, "canonical-1");
  let networkCalls = 0;
  const offline = secEdgar({
    userAgent: "Replay Research replay@example.com",
    snapshot: SecSnapshot.replay(artifact),
    http: {
      fetch() {
        networkCalls++;
        throw new Error("offline replay used network");
      },
    },
    retries: 0,
  });
  const second = await offline.financials.incomeStatement({
    ticker: "AAPL",
    fiscalYear: 2025,
    fiscalQuarter: 2,
  });
  assert.deepEqual(second.values, first.values);
  assert.deepEqual(second.details, first.details);
  assert.deepEqual(second.audit.inputs, first.audit.inputs);
  assert.equal(networkCalls, 0);
  artifact.entries[0].body += " ";
  assert.throws(() => SecSnapshot.replay(artifact), {
    code: "SNAPSHOT_INTEGRITY",
  });
});

test("PR-04 consumer mutation cannot change replayed SEC input", async () => {
  const recording = new SecSnapshot();
  await client({}, { snapshot: recording }).edgar.financials.incomeStatement({
    ticker: "AAPL",
    fiscalYear: 2025,
  });
  const replay = client(
    {},
    { snapshot: SecSnapshot.replay(recording.export()) },
  ).edgar;
  const raw = await replay.xbrl.companyFacts({ cik: 320193 });
  delete raw.facts["us-gaap"];
  const result = await replay.financials.incomeStatement({
    ticker: "AAPL",
    fiscalYear: 2025,
  });
  assert.equal(result.values.revenue, 416161000000);
});

test("PR-04 changed and removed SEC responses are observable between captures", async () => {
  const factsUrl =
    "https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json";
  const a = new SecSnapshot(),
    b = new SecSnapshot(),
    removed = new SecSnapshot();
  await client({}, { snapshot: a }).edgar.financials.incomeStatement({
    ticker: "AAPL",
    fiscalYear: 2025,
  });
  const facts = await fixture("apple-companyfacts-fy2025.json");
  facts.facts["us-gaap"].Assets.units.USD.find(
    (x) => x.end === "2025-09-27",
  ).val = 42;
  await client(
    {
      [factsUrl]: () =>
        new Response(JSON.stringify(facts), {
          headers: { "content-type": "application/json" },
        }),
    },
    { snapshot: b },
  ).edgar.financials.incomeStatement({ ticker: "AAPL", fiscalYear: 2025 });
  assert.ok(
    diffSnapshots(a.export(), b.export()).some(
      (x) => x.url === factsUrl && x.kind === "changed",
    ),
  );
  await assert.rejects(
    client(
      {
        [factsUrl]: () => new Response("removed", { status: 404 }),
      },
      { snapshot: removed },
    ).edgar.financials.incomeStatement({ ticker: "AAPL", fiscalYear: 2025 }),
    { code: "HTTP_404" },
  );
  assert.ok(
    diffSnapshots(a.export(), removed.export()).some(
      (x) => x.url === factsUrl && x.kind === "removed",
    ),
  );
});

test("PR-05 real Inline XBRL preserves scale, sign, nil, dimensions and custom tags", async () => {
  const html = await readFile(
    new URL(
      "../../../test/fixtures/apple-q2-inline-excerpt.html",
      import.meta.url,
    ),
    "utf8",
  );
  const url =
    "https://www.sec.gov/Archives/edgar/data/320193/000032019325000057/aapl-20250329.htm";
  const facts = parseInlineXbrl(html, url);
  const assets = facts.find((fact) => fact.tag === "Assets");
  assert.equal(assets.exactValue, "331233000000");
  assert.equal(assets.unit, "USD");
  assert.equal(assets.end, "2025-03-29");
  assert.equal(
    facts.find((fact) => fact.tag === "NonoperatingIncomeExpense").exactValue,
    "-279000000",
  );
  const nil = facts.find((fact) => fact.tag === "CommitmentsAndContingencies");
  assert.equal(nil.exactValue, null);
  assert.equal(nil.status, "nil");
  const custom = facts.find((fact) => fact.taxonomy === "aapl");
  assert.equal(custom.exactValue, "456000000");
  const dimensioned = facts.find((fact) => fact.contextRef === "c-12");
  assert.equal(dimensioned.exactValue, "68714000000");
  assert.ok(dimensioned.dimensions.length > 0);
  const { edgar } = client({
    [url]: () =>
      new Response(html, { headers: { "content-type": "text/html" } }),
  });
  assert.equal(
    (
      await edgar.filings.xbrlFacts({
        cik: 320193,
        accessionNumber: "0000320193-25-000057",
        name: "aapl-20250329.htm",
      })
    ).find((fact) => fact.tag === "Assets").exactValue,
    "331233000000",
  );
});

test("PR-05 unsupported Inline transform stays unavailable and broken context fails", async () => {
  const html = await readFile(
    new URL(
      "../../../test/fixtures/apple-q2-inline-excerpt.html",
      import.meta.url,
    ),
    "utf8",
  );
  const source =
    "https://www.sec.gov/Archives/edgar/data/320193/000032019325000057/aapl-20250329.htm";
  const unknown = html.replace(
    'format="ixt:num-dot-decimal" scale="6" id="f-192"',
    'format="ixt:unsupported" scale="6" id="f-192"',
  );
  const fact = parseInlineXbrl(unknown, source).find((x) => x.tag === "Assets");
  assert.equal(fact.status, "unsupported");
  assert.equal(fact.exactValue, null);
  assert.equal(fact.sourceUrl, source);
  assert.throws(
    () =>
      parseInlineXbrl(
        html.replace('contextRef="c-23"', 'contextRef="missing"'),
        source,
      ),
    { code: "SCHEMA" },
  );
  assert.throws(
    () => parseInlineXbrl("<html><body>No tagged facts</body></html>", source),
    { code: "UNSUPPORTED" },
  );
});

test("PR-05 unsupported archive format identifies its source index", async () => {
  const { edgar } = client();
  await assert.rejects(
    () =>
      edgar.filings.xbrlFacts({
        cik: 320193,
        accessionNumber: "0000320193-25-000057",
        name: "unsupported.txt",
      }),
    {
      code: "UNSUPPORTED",
      url: "https://www.sec.gov/Archives/edgar/data/320193/000032019325000057/index.json",
    },
  );
});

test("PR-05 optional balance validation reconciles comparable exact facts", async () => {
  const { edgar } = client();
  const apple = await edgar.financials.balanceSheet({
    ticker: "AAPL",
    fiscalYear: 2025,
    fiscalQuarter: 2,
    validate: true,
    revision: "asFiled",
  });
  assert.equal(apple.validation.status, "pass");
  assert.equal(apple.validation.checks[0].difference, "0");
  assert.ok(
    apple.validation.checks[0].sourceUrls.every((url) =>
      url.startsWith("https://www.sec.gov/Archives/"),
    ),
  );
  const reit = await edgar.financials.balanceSheet({
    cik: 726728,
    fiscalYear: 2025,
    validate: true,
  });
  assert.equal(reit.validation.status, "pass");
  assert.equal(
    reit.details.equity.tag,
    "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
  );
});

test("PR-05 balance validation reports a discrepancy without changing source values", async () => {
  const facts = await fixture("apple-companyfacts-fy2025.json");
  const assets = facts.facts["us-gaap"].Assets.units.USD.find(
    (x) => x.end === "2025-03-29" && x.accn === "0000320193-25-000057",
  );
  assets.val += 1000000;
  const url = "https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json";
  const { edgar } = client({
    [url]: () =>
      new Response(JSON.stringify(facts), {
        headers: { "content-type": "application/json" },
      }),
  });
  const result = await edgar.financials.balanceSheet({
    ticker: "AAPL",
    fiscalYear: 2025,
    fiscalQuarter: 2,
    validate: true,
    revision: "asFiled",
  });
  assert.equal(result.validation.status, "fail");
  assert.equal(result.validation.checks[0].difference, "1000000");
  assert.equal(result.values.totalAssets, assets.val);
  assert.ok(result.validation.checks[0].sourceUrls.length >= 1);
});

test("PR-05 balance validation is unavailable for missing or incoherent operands", async () => {
  const facts = await fixture("apple-companyfacts-fy2025.json");
  delete facts.facts["us-gaap"].StockholdersEquity;
  const url = "https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json";
  const { edgar } = client({
    [url]: () =>
      new Response(JSON.stringify(facts), {
        headers: { "content-type": "application/json" },
      }),
  });
  const result = await edgar.financials.balanceSheet({
    ticker: "AAPL",
    fiscalYear: 2025,
    fiscalQuarter: 2,
    validate: true,
  });
  assert.equal(result.validation.status, "unavailable");
  assert.match(result.validation.checks[0].reason, /equity/);
  assert.equal(result.values.equity, null);
});

test("PR-05 archive adapter finds primary Inline HTML when no instance XML exists", async () => {
  const indexUrl =
    "https://www.sec.gov/Archives/edgar/data/320193/000032019325000057/index.json";
  const htmlUrl =
    "https://www.sec.gov/Archives/edgar/data/320193/000032019325000057/aapl-20250329.htm";
  const index = await fixture("apple-q2-archive-index.json");
  index.directory.item = index.directory.item.filter(
    (x) => !x.name.endsWith("_htm.xml"),
  );
  const html = await readFile(
    new URL(
      "../../../test/fixtures/apple-q2-inline-excerpt.html",
      import.meta.url,
    ),
    "utf8",
  );
  const { edgar } = client({
    [indexUrl]: () =>
      new Response(JSON.stringify(index), {
        headers: { "content-type": "application/json" },
      }),
    [htmlUrl]: () =>
      new Response(html, { headers: { "content-type": "text/html" } }),
  });
  const facts = await edgar.filings.xbrlFacts({
    cik: 320193,
    accessionNumber: "0000320193-25-000057",
  });
  assert.equal(
    facts.find((x) => x.tag === "Assets").exactValue,
    "331233000000",
  );
});

test("PR-04 audit flags a historical filing supplied by an opaque external cache", async () => {
  const oldUrl =
    "https://data.sec.gov/submissions/CIK0000320193-submissions-001.json";
  const factsUrl =
    "https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json";
  const old = await fixture("apple-older-submissions-sample.json");
  const facts = await fixture("apple-fy2015-companyfacts.json");
  const cache = {
    get(key) {
      return key === oldUrl ? old : undefined;
    },
    set() {},
  };
  const { edgar } = client(
    {
      [factsUrl]: () =>
        new Response(JSON.stringify(facts), {
          headers: { "content-type": "application/json" },
        }),
    },
    { cache },
  );
  const statement = await edgar.financials.incomeStatement({
    ticker: "AAPL",
    fiscalYear: 2015,
  });
  assert.equal(statement.values.revenue, 233715000000);
  assert.equal(statement.audit.complete, false);
  assert.ok(!statement.audit.inputs.some((entry) => entry.url === oldUrl));
});

test("PR-04 replay snapshot cannot be mutated after integrity validation", () => {
  const snapshot = new SecSnapshot();
  const url = "https://data.sec.gov/submissions/CIK0000320193.json";
  snapshot.capture(url, 200, "application/json", "{}");
  const replay = SecSnapshot.replay(snapshot.export());
  assert.throws(() => {
    replay.get(url).body = '{"tampered":true}';
  }, TypeError);
  assert.equal(replay.get(url).body, "{}");
});

test("PR-04 replay misses fail closed without a network request", async () => {
  let calls = 0;
  const edgar = secEdgar({
    userAgent: "Replay Research replay@example.com",
    snapshot: SecSnapshot.replay({ version: 1, entries: [] }),
    http: {
      fetch() {
        calls++;
        throw new Error("unexpected network");
      },
    },
    retries: 0,
  });
  await assert.rejects(edgar.xbrl.companyFacts({ cik: 320193 }), {
    code: "SNAPSHOT_MISS",
  });
  assert.equal(calls, 0);
});

test("PR-03 absent reporting-currency evidence requires an explicit unit", async () => {
  const facts = await fixture("apple-companyfacts-fy2025.json");
  facts.facts = {};
  const url = "https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json";
  const { edgar } = client({
    [url]: () =>
      new Response(JSON.stringify(facts), {
        headers: { "content-type": "application/json" },
      }),
  });
  await assert.rejects(
    edgar.financials.incomeStatement({ ticker: "AAPL", fiscalYear: 2025 }),
    {
      code: "AMBIGUOUS_CURRENCY",
    },
  );
  const explicit = await edgar.financials.incomeStatement({
    ticker: "AAPL",
    fiscalYear: 2025,
    unit: "USD",
  });
  assert.equal(explicit.coverage.status, "partial");
  assert.equal(explicit.values.revenue, null);
});

test("PR-05 balance validation refuses operands from different filing revisions", () => {
  const period = { end: "2025-03-29", start: undefined };
  const source = (accessionNumber) => ({
    accessionNumber,
    form: "10-Q",
    filed: "2025-05-02",
    url: `https://www.sec.gov/Archives/${accessionNumber}`,
  });
  const fact = (value, accessionNumber) => ({
    exactValue: value,
    unit: "USD",
    status: "reported",
    taxonomy: "us-gaap",
    tag: "Assets",
    ...period,
    source: source(accessionNumber),
  });
  const validation = validateBalance({
    totalAssets: fact("100", "A"),
    totalLiabilities: fact("60", "A"),
    equity: fact("40", "B"),
  });
  assert.equal(validation.status, "unavailable");
  assert.match(validation.checks[0].reason, /different filing/);
});

test("PR-03 industry balance fields keep deposits, reserves, property and investments distinct", async () => {
  const { edgar } = client();
  for (const [cik, profile, field, value, tag] of [
    [19617, "bank", "deposits", 2559320000000, "Deposits"],
    [
      899051,
      "insurance",
      "claimsReserve",
      41079000000,
      "LiabilityForClaimsAndClaimsAdjustmentExpense",
    ],
    [
      726728,
      "reit",
      "realEstateInvestmentPropertyNet",
      53413903000,
      "RealEstateInvestmentPropertyNet",
    ],
    [
      1578348,
      "investmentCompany",
      "investmentsAtFairValue",
      172658862,
      "InvestmentOwnedAtFairValue",
    ],
  ]) {
    const result = await edgar.financials.balanceSheet({
      cik,
      fiscalYear: 2025,
    });
    assert.equal(result.industry?.profile, profile);
    assert.equal(result.industry.values[field], value);
    assert.equal(result.industry.details[field].tag, tag);
    assert.equal(result.industry.details[field].source.form, "10-K");
  }
});

test("PR-05 Inline contexts cannot silently overwrite duplicate IDs", async () => {
  const html = await readFile(
    new URL(
      "../../../test/fixtures/apple-q2-inline-excerpt.html",
      import.meta.url,
    ),
    "utf8",
  );
  const match = html.match(
    /<xbrli:context id="c-23">[\s\S]*?<\/xbrli:context>/,
  );
  assert.ok(match);
  const duplicate = html.replace(
    "</ix:resources>",
    match[0] + "</ix:resources>",
  );
  assert.throws(
    () =>
      parseInlineXbrl(
        duplicate,
        "https://www.sec.gov/Archives/edgar/data/320193/000032019325000057/aapl-20250329.htm",
      ),
    { code: "SCHEMA" },
  );
  const unit = html.match(/<xbrli:unit id="usd">[\s\S]*?<\/xbrli:unit>/);
  assert.ok(unit);
  assert.throws(
    () =>
      parseInlineXbrl(
        html.replace("</ix:resources>", unit[0] + "</ix:resources>"),
        "https://www.sec.gov/Archives/edgar/data/320193/000032019325000057/aapl-20250329.htm",
      ),
    { code: "SCHEMA" },
  );
});

test("PR-05 Inline decimal transforms and invalid scale preserve precision rules", async () => {
  const html = await readFile(
    new URL(
      "../../../test/fixtures/apple-q2-inline-excerpt.html",
      import.meta.url,
    ),
    "utf8",
  );
  const source =
    "https://www.sec.gov/Archives/edgar/data/320193/000032019325000057/aapl-20250329.htm";
  const comma = html.replace(
    'format="ixt:num-dot-decimal" scale="6" id="f-192">331,233',
    'format="ixt:num-comma-decimal" scale="-2" id="f-192">1.234,5',
  );
  assert.equal(
    parseInlineXbrl(comma, source).find((x) => x.tag === "Assets").exactValue,
    "12.345",
  );
  const hugeScale = html.replace(
    'scale="6" id="f-192"',
    'scale="9999" id="f-192"',
  );
  assert.throws(() => parseInlineXbrl(hugeScale, source), { code: "SCHEMA" });
});

test("financial query refresh bypasses persistent SEC inputs", async () => {
  const factsUrl =
    "https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json";
  const { edgar, seen } = client();
  await edgar.financials.incomeStatement({ ticker: "AAPL", fiscalYear: 2025 });
  await edgar.financials.incomeStatement({ ticker: "AAPL", fiscalYear: 2025 });
  assert.equal(seen.filter(([url]) => url === factsUrl).length, 1);
  await edgar.financials.incomeStatement({
    ticker: "AAPL",
    fiscalYear: 2025,
    refresh: true,
  });
  assert.equal(seen.filter(([url]) => url === factsUrl).length, 2);
});
