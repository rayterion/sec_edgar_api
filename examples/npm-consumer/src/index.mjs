import secEdgar from "@rayterion/sec-edgar";
import { getStatements, parseQuery } from "./report.mjs";

try {
  const query = parseQuery(process.argv.slice(2));
  const userAgent = process.env.SEC_USER_AGENT;
  if (!userAgent) {
    throw new Error(
      "Set SEC_USER_AGENT to a descriptive name and contact email.",
    );
  }
  const client = secEdgar({ userAgent });
  const report = await getStatements(client, query);
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
