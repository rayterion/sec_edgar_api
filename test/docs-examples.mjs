import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import ts from "typescript";
const root = new URL("..", import.meta.url).pathname;
const preparation = `
import { readFile } from 'node:fs/promises';
const files = {
  'https://www.sec.gov/files/company_tickers_exchange.json': 'apple-ticker-lookup.json',
  'https://data.sec.gov/submissions/CIK0000320193.json': 'apple-submissions-fy2025.json',
  'https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json': 'apple-companyfacts-fy2025.json',
  'https://www.sec.gov/Archives/edgar/data/320193/000032019325000057/index.json': 'apple-q2-archive-index.json'
};
globalThis.fetch = async url => {
  const name = files[url];
  if (!name) return new Response('not found', { status: 404 });
  const data = await readFile(new URL('./test/fixtures/' + name, 'file://${root}/'), 'utf8');
  return new Response(data, { headers: { 'content-type': 'application/json' } });
};
`;
let checked = 0;
for (const [file, needsClient] of [
  ["apps/docs/docs/guide/quick-start.md", false],
  ["apps/docs/docs/guide/tasks.md", true],
]) {
  const markdown = await readFile(
    new URL("../" + file, import.meta.url),
    "utf8",
  );
  const blocks = [...markdown.matchAll(/```(js|ts)\n([\s\S]*?)```/g)];
  const scripts = blocks.map(([, language, code]) =>
    language === "ts"
      ? ts.transpileModule(code, {
          compilerOptions: {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.ESNext,
          },
        }).outputText
      : code,
  );
  const setup = needsClient
    ? `import { createEdgarClient } from '@sec-edgar/research-client';\nconst edgar = createEdgarClient({ userAgent: 'Docs Test docs@example.com' });\n`
    : "";
  for (const script of needsClient ? [scripts.join("\n")] : scripts) {
    execFileSync(
      process.execPath,
      ["--input-type=module", "-e", preparation + setup + script],
      {
        cwd: root,
        encoding: "utf8",
        timeout: 20_000,
      },
    );
  }
  checked += blocks.length;
}
console.log(`documentation snippets executed: ${checked}`);
