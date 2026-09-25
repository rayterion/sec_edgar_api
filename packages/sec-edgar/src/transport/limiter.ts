import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { EdgarError, assertInput } from "../errors.js";
import { waitWithSignal } from "./wait.js";

export interface SharedRateLimiter {
  acquire(signal?: AbortSignal): Promise<void>;
}

export interface FileRateLimiterOptions {
  path: string;
  requestsPerSecond?: number;
  lockTimeoutMs?: number;
}

// All processes sharing this file share one rolling one-second request budget.
export class FileRateLimiter implements SharedRateLimiter {
  private readonly rate: number;
  private readonly lockTimeoutMs: number;
  constructor(private readonly options: FileRateLimiterOptions) {
    assertInput(options.path.length > 0, "Shared limiter path is required");
    this.rate = options.requestsPerSecond ?? 9;
    assertInput(
      Number.isInteger(this.rate) && this.rate > 0 && this.rate < 10,
      "Shared limiter rate must be an integer from 1 to 9",
    );
    this.lockTimeoutMs = options.lockTimeoutMs ?? 10_000;
    assertInput(
      this.lockTimeoutMs > 0,
      "Shared limiter lock timeout must be positive",
    );
  }
  async acquire(signal?: AbortSignal): Promise<void> {
    for (;;) {
      const release = await this.lock(signal);
      let delay = 0;
      try {
        const now = Date.now();
        const previous = await this.readTimestamps();
        const recent = previous.filter((time) => time > now - 1000);
        if (recent.length < this.rate) {
          recent.push(now);
          await this.writeTimestamps(recent);
          return;
        }
        delay = Math.max(1, recent[0]! + 1001 - now);
      } finally {
        await release();
      }
      await waitWithSignal(delay, signal);
    }
  }
  private async lock(signal?: AbortSignal): Promise<() => Promise<void>> {
    const path = `${this.options.path}.lock`;
    const deadline = Date.now() + this.lockTimeoutMs;
    for (;;) {
      if (signal?.aborted) throw new EdgarError("ABORTED", "Request aborted");
      try {
        await mkdir(path);
        return () => rm(path, { recursive: true, force: true });
      } catch (cause) {
        if (!isCode(cause, "EEXIST"))
          throw new EdgarError(
            "SHARED_LIMITER",
            "Cannot create shared limiter lock",
            { cause },
          );
        const metadata = await stat(path).catch(() => undefined);
        if (metadata && Date.now() - metadata.mtimeMs > this.lockTimeoutMs * 2)
          await rm(path, { recursive: true, force: true });
        if (Date.now() >= deadline)
          throw new EdgarError(
            "SHARED_LIMITER",
            "Shared limiter lock timed out",
          );
        await waitWithSignal(10, signal);
      }
    }
  }
  private async readTimestamps(): Promise<number[]> {
    let body: string;
    try {
      body = await readFile(this.options.path, "utf8");
    } catch (cause) {
      if (isCode(cause, "ENOENT")) return [];
      throw new EdgarError(
        "SHARED_LIMITER",
        "Cannot read shared limiter state",
        { cause },
      );
    }
    try {
      const parsed: unknown = JSON.parse(body);
      if (
        !Array.isArray(parsed) ||
        !parsed.every((value) => Number.isFinite(value))
      )
        throw new Error("Invalid timestamps");
      return parsed;
    } catch (cause) {
      throw new EdgarError(
        "SHARED_LIMITER",
        "Shared limiter state is corrupt",
        { cause },
      );
    }
  }
  private async writeTimestamps(timestamps: number[]): Promise<void> {
    const temp = `${this.options.path}.${process.pid}.${Date.now()}.tmp`;
    try {
      await writeFile(temp, JSON.stringify(timestamps), { flag: "wx" });
      await rename(temp, this.options.path);
    } catch (cause) {
      await rm(temp, { force: true });
      throw new EdgarError(
        "SHARED_LIMITER",
        "Cannot write shared limiter state",
        { cause },
      );
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
