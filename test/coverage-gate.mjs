import { execFileSync } from "node:child_process";
const output = execFileSync(
  process.execPath,
  [
    "--test",
    "--experimental-test-coverage",
    "--test-coverage-include=packages/sec-edgar/dist/financials/*.js",
    "--test-coverage-include=packages/sec-edgar/dist/parsers/*.js",
    "packages/sec-edgar/test/client.test.mjs",
  ],
  { encoding: "utf8", maxBuffer: 2_000_000 },
);
process.stdout.write(output);
const minimums = {
  "decimal.js": [90, 70],
  "periods.js": [80, 70],
  "selection.js": [90, 80],
  "json.js": [95, 80],
  "xbrl.js": [80, 70],
};
for (const [file, [lines, branches]] of Object.entries(minimums)) {
  const match = output.match(
    new RegExp(
      `\\b${file.replace(".", "\\.")}\\s*\\|\\s*([0-9.]+)\\s*\\|\\s*([0-9.]+)`,
    ),
  );
  if (!match || Number(match[1]) < lines || Number(match[2]) < branches)
    throw new Error(
      `${file} coverage below ${lines}% lines or ${branches}% branches`,
    );
}
console.log("core coverage targets: passed");
