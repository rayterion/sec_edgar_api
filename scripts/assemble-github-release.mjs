import { cp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

async function requireCompiledOutput(source) {
  for (const file of ["dist/index.js", "dist/index.d.ts"]) {
    try {
      await stat(resolve(source, file));
    } catch {
      throw new Error(`Missing compiled output: ${file}`);
    }
  }
}

export async function assembleGitHubRelease({
  source,
  destination,
  sourceCommit,
}) {
  if (!/^[a-f0-9]{40}$/.test(sourceCommit)) {
    throw new Error("sourceCommit must be a full Git SHA-1 commit ID");
  }
  await requireCompiledOutput(source);
  try {
    await mkdir(destination);
  } catch (error) {
    if (error?.code === "EEXIST") {
      throw new Error(`Release destination already exists: ${destination}`);
    }
    throw error;
  }
  const manifest = JSON.parse(
    await readFile(resolve(source, "package.json"), "utf8"),
  );
  delete manifest.scripts;
  delete manifest.devDependencies;
  delete manifest.publishConfig;
  if (manifest.repository && typeof manifest.repository === "object") {
    delete manifest.repository.directory;
  }
  manifest.files = ["dist", "README.md", "LICENSE", "SOURCE.md"];
  await cp(resolve(source, "dist"), resolve(destination, "dist"), {
    recursive: true,
  });
  for (const file of ["README.md", "LICENSE"]) {
    await cp(resolve(source, file), resolve(destination, file));
  }
  await writeFile(
    resolve(destination, "package.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  await writeFile(
    resolve(destination, "SOURCE.md"),
    `# Source\n\nBuilt from [source commit ${sourceCommit}](https://github.com/rayterion/sec_edgar_api/commit/${sourceCommit}) in \`packages/sec-edgar\`.\n`,
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [destination, sourceCommit] = process.argv.slice(2);
  if (!destination || !sourceCommit) {
    throw new Error(
      "Usage: node scripts/assemble-github-release.mjs DESTINATION SOURCE_COMMIT",
    );
  }
  await assembleGitHubRelease({
    source: fileURLToPath(new URL("../packages/sec-edgar/", import.meta.url)),
    destination: resolve(destination),
    sourceCommit,
  });
}
