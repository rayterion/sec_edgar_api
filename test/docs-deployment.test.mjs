import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const site = require("../apps/docs/docusaurus.config.cjs");
const workspace = JSON.parse(await readFile("package.json", "utf8"));

test("documentation scripts run the Docusaurus workspace from the repository root", () => {
  assert.equal(workspace.scripts["docs:start"], "npm run start -w apps/docs");
  assert.equal(workspace.scripts["docs:serve"], "npm run serve -w apps/docs");
});

test("Docusaurus uses the repository's GitHub Pages origin and project path", () => {
  assert.equal(site.url, "https://rayterion.github.io");
  assert.equal(site.baseUrl, "/sec_edgar_api/");
  assert.equal(site.organizationName, "rayterion");
  assert.equal(site.projectName, "sec_edgar_api");
});

test("the Pages workflow builds and deploys only from main", async () => {
  const workflow = await readFile(".github/workflows/docs-pages.yml", "utf8");
  assert.match(workflow, /push:\s*\n\s*branches:\s*\[main\]/);
  assert.match(workflow, /actions\/upload-pages-artifact@v4/);
  assert.match(workflow, /path:\s*apps\/docs\/build/);
  assert.match(workflow, /actions\/deploy-pages@v4/);
  assert.match(workflow, /pages:\s*write/);
  assert.match(workflow, /id-token:\s*write/);
});

test("the built site links assets and canonical URL under its Pages path", async () => {
  const html = await readFile("apps/docs/build/index.html", "utf8");
  assert.match(html, /href="https:\/\/rayterion\.github\.io\/sec_edgar_api\/"/);
  assert.match(html, /href="\/sec_edgar_api\/assets\/css\//);
  assert.match(html, /src="\/sec_edgar_api\/assets\/js\//);
  assert.doesNotMatch(html, /example\.invalid/);
});
