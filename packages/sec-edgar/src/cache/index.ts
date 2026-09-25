import { createHash, randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { EdgarError, assertInput } from "../errors.js";
import type { ResponseEvidence } from "../transport/snapshot.js";
import { waitWithSignal } from "../transport/wait.js";

export interface CacheEntry {
  value: unknown;
  cachedAt: string;
  expiresAt: string;
  bytes: number;
  source?: ResponseEvidence;
}
export interface CacheWriteMetadata {
  source?: ResponseEvidence;
}
export interface Cache {
  get(key: string): Promise<unknown | undefined> | unknown | undefined;
  getEntry?(
    key: string,
  ): Promise<CacheEntry | undefined> | CacheEntry | undefined;
  set(
    key: string,
    value: unknown,
    ttlMs: number,
    metadata?: CacheWriteMetadata,
  ): Promise<void> | void;
  delete?(key: string): Promise<void> | void;
}
function encode(
  value: unknown,
  ttlMs: number,
  metadata: CacheWriteMetadata = {},
): CacheEntry {
  assertInput(
    Number.isFinite(ttlMs) && ttlMs >= 0,
    "Cache TTL must be nonnegative",
  );
  const json = JSON.stringify(value);
  assertInput(json !== undefined, "Cache value must be JSON serializable");
  const now = Date.now();
  return {
    value: JSON.parse(json),
    cachedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttlMs).toISOString(),
    bytes: Buffer.byteLength(json),
    ...(metadata.source ? { source: metadata.source } : {}),
  };
}
function expired(entry: CacheEntry): boolean {
  return Date.now() >= Date.parse(entry.expiresAt);
}
export class MemoryCache implements Cache {
  private entries = new Map<string, CacheEntry>();
  private bytes = 0;
  constructor(
    readonly maxEntries = 256,
    readonly maxBytes = 32_000_000,
  ) {
    assertInput(
      Number.isInteger(maxEntries) && maxEntries > 0,
      "maxEntries must be positive",
    );
    assertInput(
      Number.isInteger(maxBytes) && maxBytes > 0,
      "maxBytes must be positive",
    );
  }
  get(key: string): unknown | undefined {
    return this.getEntry(key)?.value;
  }
  getEntry(key: string): CacheEntry | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (expired(entry)) {
      this.delete(key);
      return undefined;
    }
    this.entries.delete(key);
    this.entries.set(key, entry);
    return structuredClone(entry);
  }
  set(
    key: string,
    value: unknown,
    ttlMs: number,
    metadata?: CacheWriteMetadata,
  ): void {
    const entry = encode(value, ttlMs, metadata);
    if (entry.bytes > this.maxBytes)
      throw new EdgarError("OVERSIZED", "Cache entry exceeds byte limit");
    this.delete(key);
    this.entries.set(key, entry);
    this.bytes += entry.bytes;
    while (this.entries.size > this.maxEntries || this.bytes > this.maxBytes)
      this.delete(this.entries.keys().next().value!);
  }
  delete(key: string): void {
    const old = this.entries.get(key);
    if (old) this.bytes -= old.bytes;
    this.entries.delete(key);
  }
}
interface StoredEntry extends CacheEntry {
  key: string;
  contentHash: string;
}
export interface FileCacheOptions {
  directory: string;
  maxEntries?: number;
  maxBytes?: number;
}
function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
export class FileCache implements Cache {
  private readonly maxEntries: number;
  private readonly maxBytes: number;
  constructor(private readonly options: FileCacheOptions) {
    assertInput(options.directory.length > 0, "Cache directory is required");
    this.maxEntries = options.maxEntries ?? 256;
    this.maxBytes = options.maxBytes ?? 100_000_000;
    assertInput(
      Number.isInteger(this.maxEntries) && this.maxEntries > 0,
      "maxEntries must be positive",
    );
    assertInput(
      Number.isInteger(this.maxBytes) && this.maxBytes > 0,
      "maxBytes must be positive",
    );
  }
  private path(key: string): string {
    return join(this.options.directory, `${hash(key)}.json`);
  }
  async get(key: string): Promise<unknown | undefined> {
    return (await this.getEntry(key))?.value;
  }
  async getEntry(key: string): Promise<CacheEntry | undefined> {
    let stored: StoredEntry;
    try {
      stored = JSON.parse(
        await readFile(this.path(key), "utf8"),
      ) as StoredEntry;
    } catch (cause) {
      if (isCode(cause, "ENOENT")) return undefined;
      throw new EdgarError("CACHE_CORRUPT", "Cannot read cache entry", {
        cause,
      });
    }
    const { contentHash, ...payload } = stored;
    if (
      stored.key !== key ||
      contentHash !== hash(JSON.stringify(payload)) ||
      !Number.isFinite(Date.parse(stored.expiresAt)) ||
      !Number.isFinite(Date.parse(stored.cachedAt))
    )
      throw new EdgarError(
        "CACHE_CORRUPT",
        "Cache entry failed integrity validation",
      );
    if (expired(stored)) {
      await this.delete(key);
      return undefined;
    }
    const { value, cachedAt, expiresAt, bytes, source } = stored;
    return { value, cachedAt, expiresAt, bytes, ...(source ? { source } : {}) };
  }
  async set(
    key: string,
    value: unknown,
    ttlMs: number,
    metadata?: CacheWriteMetadata,
  ): Promise<void> {
    const entry = encode(value, ttlMs, metadata);
    const payload = { ...entry, key };
    const stored: StoredEntry = {
      ...payload,
      contentHash: hash(JSON.stringify(payload)),
    };
    const body = JSON.stringify(stored);
    if (Buffer.byteLength(body) > this.maxBytes)
      throw new EdgarError("OVERSIZED", "Cache entry exceeds byte limit");
    await this.withLock(async () => {
      const temp = join(this.options.directory, `${randomUUID()}.tmp`);
      try {
        await writeFile(temp, body, { flag: "wx" });
        await rename(temp, this.path(key));
      } finally {
        await rm(temp, { force: true });
      }
      await this.prune();
    });
  }
  async delete(key: string): Promise<void> {
    await rm(this.path(key), { force: true });
  }
  private async prune(): Promise<void> {
    const names = (await readdir(this.options.directory)).filter((name) =>
      /^[a-f0-9]{64}\.json$/.test(name),
    );
    const entries = await Promise.all(
      names.map(async (name) => {
        const path = join(this.options.directory, name);
        const info = await stat(path).catch(() => undefined);
        return info
          ? { path, bytes: info.size, time: info.mtimeMs }
          : undefined;
      }),
    );
    const oldest = entries
      .filter((entry) => entry !== undefined)
      .sort((a, b) => a.time - b.time);
    let bytes = oldest.reduce((sum, entry) => sum + entry.bytes, 0);
    while (oldest.length > this.maxEntries || bytes > this.maxBytes) {
      const removed = oldest.shift()!;
      await rm(removed.path, { force: true });
      bytes -= removed.bytes;
    }
  }
  private async withLock(work: () => Promise<void>): Promise<void> {
    await mkdir(this.options.directory, { recursive: true });
    const lock = join(this.options.directory, ".lock");
    const deadline = Date.now() + 5000;
    for (;;) {
      try {
        await mkdir(lock);
        break;
      } catch (cause) {
        if (!isCode(cause, "EEXIST")) throw cause;
        const info = await stat(lock).catch(() => undefined);
        if (info && Date.now() - info.mtimeMs > 10_000)
          await rm(lock, { recursive: true, force: true });
        if (Date.now() >= deadline)
          throw new EdgarError("CACHE_CORRUPT", "Cache write lock timed out");
        await waitWithSignal(10);
      }
    }
    try {
      await work();
    } finally {
      await rm(lock, { recursive: true, force: true });
    }
  }
}
function isCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
}
