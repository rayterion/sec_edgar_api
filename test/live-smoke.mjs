import secEdgar from "../packages/sec-edgar/dist/index.js";
import { verifyLiveContracts } from "./live-contract.mjs";
import { assessHealth } from "../packages/sec-edgar/dist/index.js";
const userAgent = process.env.SEC_USER_AGENT;
if (!userAgent)
  throw new Error("Set SEC_USER_AGENT to an organization and contact email");
const edgar = secEdgar({
  userAgent,
  requestsPerSecond: 1,
  concurrency: 1,
  retries: 1,
});
const result = await verifyLiveContracts(edgar);
const alerts = assessHealth(
  { metrics: edgar.metrics(), statements: result.statements },
  { minCoverage: 0 },
);
if (alerts.length)
  throw new Error(`SEC live health alerts: ${JSON.stringify(alerts)}`);
const summary = { checkedAt: result.checkedAt, checks: result.checks };
console.log(JSON.stringify({ ...summary, metrics: edgar.metrics(), alerts }));
