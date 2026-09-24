import secEdgar from "../packages/sec-edgar/dist/index.js";
const userAgent = process.env.SEC_USER_AGENT;
if (!userAgent)
  throw new Error("Set SEC_USER_AGENT to an organization and contact email");
const edgar = secEdgar({
  userAgent,
  requestsPerSecond: 1,
  concurrency: 1,
  retries: 1,
});
const company = await edgar.companies.resolve({ ticker: "AAPL" });
const filings = await edgar.filings.list({ cik: company.cik, limit: 1 });
const facts = await edgar.xbrl.companyFacts({ cik: company.cik });
console.log(
  JSON.stringify({
    company,
    latestAccession: filings[0]?.accessionNumber,
    taxonomies: Object.keys(facts.facts),
  }),
);
