import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const manifest = JSON.parse(
  await readFile("packages/sec-edgar/package.json", "utf8"),
);
const readme = await readFile("packages/sec-edgar/README.md", "utf8");

test("v1 package has public publishing and source metadata", () => {
  assert.equal(manifest.name, "@rayterion/sec-edgar");
  assert.equal(manifest.version, "1.0.0");
  assert.equal(manifest.publishConfig?.access, "public");
  assert.equal(
    manifest.repository?.url,
    "git+https://github.com/rayterion/sec_edgar_api.git",
  );
  assert.equal(manifest.repository?.directory, "packages/sec-edgar");
  assert.equal(
    manifest.bugs?.url,
    "https://github.com/rayterion/sec_edgar_api/issues",
  );
});

test("publishing rebuilds JavaScript and declaration files", () => {
  assert.equal(manifest.scripts.prepack, "npm run build");
  assert.equal(manifest.exports["."].types, "./dist/index.d.ts");
  assert.equal(manifest.exports["."].import, "./dist/index.js");
});

test("published README links to documentation inside the public repository", () => {
  assert.match(
    readme,
    /https:\/\/github\.com\/rayterion\/sec_edgar_api\/tree\/main\/apps\/docs\/docs/,
  );
  assert.doesNotMatch(readme, /provisional/i);
});

test("consumer documentation identifies the published package", async () => {
  const rootReadme = await readFile("README.md", "utf8");
  const quickStart = await readFile(
    "apps/docs/docs/guide/quick-start.md",
    "utf8",
  );
  const releaseReport = await readFile(
    "apps/docs/docs/release-report.md",
    "utf8",
  );
  for (const document of [rootReadme, quickStart]) {
    assert.match(document, /npm install @rayterion\/sec-edgar/);
    assert.doesNotMatch(document, /provisional/i);
  }
  assert.match(releaseReport, /Release report — 1\.0\.0/);
});
