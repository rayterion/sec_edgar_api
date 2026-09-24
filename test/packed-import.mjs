import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
const root = new URL("..", import.meta.url).pathname;
const temporary = await mkdtemp(join(tmpdir(), "sec-edgar-pack-"));
try {
  const result = JSON.parse(
    execFileSync(
      "npm",
      [
        "pack",
        "--workspace",
        "packages/sec-edgar",
        "--pack-destination",
        temporary,
        "--json",
      ],
      { cwd: root, encoding: "utf8" },
    ),
  );
  const tarball = join(temporary, result[0].filename);
  const consumer = join(temporary, "consumer");
  await import("node:fs/promises").then((fs) => fs.mkdir(consumer));
  await writeFile(
    join(consumer, "package.json"),
    JSON.stringify({ private: true, type: "module" }),
  );
  execFileSync(
    "npm",
    ["install", tarball, "--ignore-scripts", "--no-audit", "--no-fund"],
    { cwd: consumer, stdio: "pipe" },
  );
  await writeFile(
    join(consumer, "test.mjs"),
    `import secEdgar, { createEdgarClient, normalizeCik } from '@sec-edgar/research-client';
if (secEdgar !== createEdgarClient || normalizeCik(320193) !== '0000320193') throw new Error('packed import failed');
const client = secEdgar({ userAgent: 'Packed Test packed@example.com' });
if (!client.financials.incomeStatement || !client.filings.xbrlFacts) throw new Error('missing exports');
console.log('packed ESM import: ok');`,
  );
  process.stdout.write(
    execFileSync(process.execPath, ["test.mjs"], {
      cwd: consumer,
      encoding: "utf8",
    }),
  );
} finally {
  await rm(temporary, { recursive: true, force: true });
}
