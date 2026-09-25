import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import type { Readable } from "node:stream";
import * as yauzl from "yauzl";
import type { Cache } from "../cache/index.js";
import { normalizeCik } from "../companies/index.js";
import { EdgarError, assertInput, schema } from "../errors.js";
import { parseLosslessJson, record } from "../parsers/json.js";

export type BulkKind = "companyfacts" | "submissions";
export interface BulkImportOptions {
  path: string;
  kind: BulkKind;
  cache: Cache;
  ttlMs?: number;
  maxCompressedBytes?: number;
  maxUncompressedBytes?: number;
  maxEntryBytes?: number;
  maxEntries?: number;
  signal?: AbortSignal;
  includeCiks?: Array<string | number>;
}
export interface BulkImportReport {
  kind: BulkKind;
  sourceUrl: string;
  sha256: string;
  imported: number;
  skipped: number;
  uncompressedBytes: number;
  completedAt: string;
}
interface ZipEntry {
  fileName: string;
  uncompressedSize: number;
  isEncrypted(): boolean;
}
interface StreamingZip {
  eachEntry(): AsyncIterable<ZipEntry>;
  openReadStreamPromise(entry: ZipEntry): Promise<Readable>;
  close(): void;
}
const zipApi = yauzl as typeof yauzl & {
  openPromise(path: string, options: yauzl.Options): Promise<StreamingZip>;
};
const sources: Record<BulkKind, string> = {
  companyfacts:
    "https://www.sec.gov/Archives/edgar/daily-index/xbrl/companyfacts.zip",
  submissions:
    "https://www.sec.gov/Archives/edgar/daily-index/bulkdata/submissions.zip",
};
export const DEFAULT_BULK_LIMITS = Object.freeze({
  maxCompressedBytes: 2_000_000_000,
  maxUncompressedBytes: 20_000_000_000,
  maxEntryBytes: 50_000_000,
  maxEntries: 1_200_000,
});
function limits(options: BulkImportOptions) {
  const maxCompressedBytes =
    options.maxCompressedBytes ?? DEFAULT_BULK_LIMITS.maxCompressedBytes;
  const maxUncompressedBytes =
    options.maxUncompressedBytes ?? DEFAULT_BULK_LIMITS.maxUncompressedBytes;
  const maxEntryBytes =
    options.maxEntryBytes ?? DEFAULT_BULK_LIMITS.maxEntryBytes;
  const maxEntries = options.maxEntries ?? DEFAULT_BULK_LIMITS.maxEntries;
  for (const value of [
    maxCompressedBytes,
    maxUncompressedBytes,
    maxEntryBytes,
    maxEntries,
  ])
    assertInput(
      Number.isSafeInteger(value) && value > 0,
      "Bulk import limits must be positive safe integers",
    );
  return {
    maxCompressedBytes,
    maxUncompressedBytes,
    maxEntryBytes,
    maxEntries,
  };
}
async function archiveDigest(
  path: string,
  signal?: AbortSignal,
): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path, { signal }))
    hash.update(chunk as Buffer);
  return hash.digest("hex");
}
async function entryText(
  zip: StreamingZip,
  entry: ZipEntry,
  maxBytes: number,
  signal?: AbortSignal,
): Promise<string> {
  const stream = await zip.openReadStreamPromise(entry);
  const abort = () =>
    stream.destroy(new EdgarError("ABORTED", "Bulk import aborted"));
  signal?.addEventListener("abort", abort, { once: true });
  const chunks: Buffer[] = [];
  let bytes = 0;
  try {
    for await (const piece of stream) {
      if (signal?.aborted)
        throw new EdgarError("ABORTED", "Bulk import aborted");
      const chunk = Buffer.from(piece as Buffer);
      bytes += chunk.length;
      if (bytes > maxBytes)
        throw new EdgarError("OVERSIZED", "Bulk entry exceeds byte limit");
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString("utf8");
  } finally {
    signal?.removeEventListener("abort", abort);
    stream.destroy();
  }
}
function entryCik(name: string): string {
  if (!/^(?:[A-Za-z0-9_-]+\/)*CIK\d{10}\.json$/.test(name))
    throw new EdgarError(
      "UNSAFE_ARCHIVE",
      "Bulk ZIP entry has an unsafe or unknown name",
    );
  return name.match(/CIK(\d{10})\.json$/)![1]!;
}
function target(kind: BulkKind, cik: string, value: unknown): string {
  schema(
    record(value) && String(value.cik).padStart(10, "0") === cik,
    "Bulk entry CIK does not match its name",
  );
  if (kind === "companyfacts")
    schema(
      record(value.facts) && typeof value.entityName === "string",
      "Invalid bulk company facts entry",
    );
  else schema(record(value.filings), "Invalid bulk submissions entry");
  return kind === "companyfacts"
    ? `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`
    : `https://data.sec.gov/submissions/CIK${cik}.json`;
}
export async function importBulkZip(
  options: BulkImportOptions,
): Promise<BulkImportReport> {
  assertInput(
    options.kind === "companyfacts" || options.kind === "submissions",
    "Invalid bulk kind",
  );
  const bound = limits(options);
  assertInput(
    options.includeCiks === undefined || Array.isArray(options.includeCiks),
    "includeCiks must be an array",
  );
  const included = options.includeCiks
    ? new Set(options.includeCiks.map(normalizeCik))
    : undefined;
  if (options.signal?.aborted)
    throw new EdgarError("ABORTED", "Bulk import aborted");
  const info = await stat(options.path);
  if (info.size > bound.maxCompressedBytes)
    throw new EdgarError("OVERSIZED", "Bulk ZIP exceeds compressed byte limit");
  const sha256 = await archiveDigest(options.path, options.signal);
  let zip: StreamingZip;
  try {
    zip = await zipApi.openPromise(options.path, {
      lazyEntries: true,
      validateEntrySizes: true,
      strictFileNames: true,
    });
  } catch (cause) {
    throw new EdgarError("UNSAFE_ARCHIVE", "Cannot open bulk ZIP", { cause });
  }
  let imported = 0;
  let skipped = 0;
  let scanned = 0;
  let uncompressedBytes = 0;
  try {
    for await (const entry of zip.eachEntry()) {
      if (options.signal?.aborted)
        throw new EdgarError("ABORTED", "Bulk import aborted");
      if (entry.isEncrypted())
        throw new EdgarError(
          "UNSAFE_ARCHIVE",
          "Encrypted bulk entry is unsupported",
        );
      if (++scanned > bound.maxEntries)
        throw new EdgarError("OVERSIZED", "Bulk entry count exceeded");
      const cik = entryCik(entry.fileName);
      if (included && !included.has(cik)) {
        skipped++;
        continue;
      }
      if (
        entry.uncompressedSize > bound.maxEntryBytes ||
        uncompressedBytes + entry.uncompressedSize > bound.maxUncompressedBytes
      )
        throw new EdgarError(
          "OVERSIZED",
          "Bulk decompressed byte limit exceeded",
        );
      const text = await entryText(
        zip,
        entry,
        bound.maxEntryBytes,
        options.signal,
      );
      uncompressedBytes += Buffer.byteLength(text);
      const parsed = parseLosslessJson(text, sources[options.kind]);
      const key = target(options.kind, cik, parsed);
      await options.cache.set(key, parsed, options.ttlMs ?? 24 * 60 * 60_000);
      imported++;
    }
  } catch (cause) {
    if (cause instanceof EdgarError) throw cause;
    throw new EdgarError("UNSAFE_ARCHIVE", "Bulk ZIP extraction failed", {
      cause,
    });
  } finally {
    zip.close();
  }
  return {
    kind: options.kind,
    sourceUrl: sources[options.kind],
    sha256,
    imported,
    skipped,
    uncompressedBytes,
    completedAt: new Date().toISOString(),
  };
}
