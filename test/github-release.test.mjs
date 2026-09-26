import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { assembleGitHubRelease } from "../scripts/assemble-github-release.mjs";

const sourceCommit = "a".repeat(40);

async function withFixture(callback) {
  const root = await mkdtemp(join(tmpdir(), "sec-edgar-github-release-"));
  const source = join(root, "source");
  const destination = join(root, "release");
  await mkdir(join(source, "dist"), { recursive: true });
  await writeFile(
    join(source, "package.json"),
    JSON.stringify({
      name: "@rayterion/sec-edgar",
      version: "1.0.0",
      repository: {
        type: "git",
        url: "git+https://github.com/rayterion/sec_edgar_api.git",
        directory: "packages/sec-edgar",
      },
      type: "module",
      exports: {
        ".": { types: "./dist/index.d.ts", import: "./dist/index.js" },
      },
      types: "./dist/index.d.ts",
      dependencies: { "fast-xml-parser": "^5.11.1" },
      devDependencies: { typescript: "^5.9.2" },
      scripts: { prepack: "npm run build" },
      publishConfig: { access: "public" },
    }),
  );
  await writeFile(
    join(source, "dist/index.js"),
    "export const ready = true;\n",
  );
  await writeFile(
    join(source, "dist/index.d.ts"),
    "export declare const ready: boolean;\n",
  );
  await writeFile(join(source, "README.md"), "# SEC EDGAR\n");
  await writeFile(join(source, "LICENSE"), "MIT\n");
  try {
    await callback({ source, destination });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("assembles a root-installable GitHub release with compiled ESM and lineage", async () => {
  await withFixture(async ({ source, destination }) => {
    await assembleGitHubRelease({ source, destination, sourceCommit });
    const manifest = JSON.parse(
      await readFile(join(destination, "package.json"), "utf8"),
    );
    assert.equal(manifest.name, "@rayterion/sec-edgar");
    assert.equal(manifest.version, "1.0.0");
    assert.equal(manifest.repository.directory, undefined);
    assert.equal(manifest.exports["."].import, "./dist/index.js");
    assert.deepEqual(manifest.dependencies, { "fast-xml-parser": "^5.11.1" });
    assert.equal(manifest.scripts, undefined);
    assert.equal(manifest.devDependencies, undefined);
    assert.equal(manifest.publishConfig, undefined);
    assert.equal(
      await readFile(join(destination, "dist/index.js"), "utf8"),
      "export const ready = true;\n",
    );
    assert.match(
      await readFile(join(destination, "SOURCE.md"), "utf8"),
      new RegExp(sourceCommit),
    );
  });
});

test("refuses missing compiled output and existing release destinations", async () => {
  await withFixture(async ({ source, destination }) => {
    await rm(join(source, "dist/index.d.ts"));
    await assert.rejects(
      assembleGitHubRelease({ source, destination, sourceCommit }),
      /compiled output/i,
    );
    await writeFile(
      join(source, "dist/index.d.ts"),
      "export declare const ready: boolean;\n",
    );
    await mkdir(destination);
    await assert.rejects(
      assembleGitHubRelease({ source, destination, sourceCommit }),
      /already exists/i,
    );
  });
});
