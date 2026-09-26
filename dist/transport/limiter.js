import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { EdgarError, assertInput } from "../errors.js";
import { waitWithSignal } from "./wait.js";
// All processes sharing this file share one rolling one-second request budget.
export class FileRateLimiter {
    options;
    rate;
    lockTimeoutMs;
    constructor(options) {
        this.options = options;
        assertInput(options.path.length > 0, "Shared limiter path is required");
        this.rate = options.requestsPerSecond ?? 9;
        assertInput(Number.isInteger(this.rate) && this.rate > 0 && this.rate < 10, "Shared limiter rate must be an integer from 1 to 9");
        this.lockTimeoutMs = options.lockTimeoutMs ?? 10_000;
        assertInput(this.lockTimeoutMs > 0, "Shared limiter lock timeout must be positive");
    }
    async acquire(signal) {
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
                delay = Math.max(1, recent[0] + 1001 - now);
            }
            finally {
                await release();
            }
            await waitWithSignal(delay, signal);
        }
    }
    async lock(signal) {
        const path = `${this.options.path}.lock`;
        const deadline = Date.now() + this.lockTimeoutMs;
        for (;;) {
            if (signal?.aborted)
                throw new EdgarError("ABORTED", "Request aborted");
            try {
                await mkdir(path);
                return () => rm(path, { recursive: true, force: true });
            }
            catch (cause) {
                if (!isCode(cause, "EEXIST"))
                    throw new EdgarError("SHARED_LIMITER", "Cannot create shared limiter lock", { cause });
                const metadata = await stat(path).catch(() => undefined);
                if (metadata && Date.now() - metadata.mtimeMs > this.lockTimeoutMs * 2)
                    await rm(path, { recursive: true, force: true });
                if (Date.now() >= deadline)
                    throw new EdgarError("SHARED_LIMITER", "Shared limiter lock timed out");
                await waitWithSignal(10, signal);
            }
        }
    }
    async readTimestamps() {
        let body;
        try {
            body = await readFile(this.options.path, "utf8");
        }
        catch (cause) {
            if (isCode(cause, "ENOENT"))
                return [];
            throw new EdgarError("SHARED_LIMITER", "Cannot read shared limiter state", { cause });
        }
        try {
            const parsed = JSON.parse(body);
            if (!Array.isArray(parsed) ||
                !parsed.every((value) => Number.isFinite(value)))
                throw new Error("Invalid timestamps");
            return parsed;
        }
        catch (cause) {
            throw new EdgarError("SHARED_LIMITER", "Shared limiter state is corrupt", { cause });
        }
    }
    async writeTimestamps(timestamps) {
        const temp = `${this.options.path}.${process.pid}.${Date.now()}.tmp`;
        try {
            await writeFile(temp, JSON.stringify(timestamps), { flag: "wx" });
            await rename(temp, this.options.path);
        }
        catch (cause) {
            await rm(temp, { force: true });
            throw new EdgarError("SHARED_LIMITER", "Cannot write shared limiter state", { cause });
        }
    }
}
function isCode(error, code) {
    return (typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === code);
}
