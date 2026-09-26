import { createHash } from "node:crypto";
import { SecSnapshot, responseEvidence } from "./snapshot.js";
import { waitWithSignal } from "./wait.js";
import { MemoryCache } from "../cache/index.js";
import { EdgarError, assertInput } from "../errors.js";
import { parseLosslessJson } from "../parsers/json.js";
const hosts = new Set(["data.sec.gov", "www.sec.gov"]);
const defaultHttp = { fetch: (url, init) => fetch(url, init) };
function networkFailureCode(error) {
    const nested = typeof error === "object" && error !== null && "cause" in error
        ? error.cause
        : error;
    const code = typeof nested === "object" && nested !== null && "code" in nested
        ? String(nested.code)
        : "";
    if (["ENOTFOUND", "EAI_AGAIN"].includes(code))
        return "NETWORK_DNS";
    if (code.startsWith("ERR_TLS") ||
        code.startsWith("CERT_") ||
        code.includes("CERTIFICATE"))
        return "NETWORK_TLS";
    if (code.startsWith("Z_") || code.startsWith("ERR_ZLIB"))
        return "DECOMPRESSION";
    if (["ECONNRESET", "ECONNREFUSED", "EPIPE", "UND_ERR_CONNECT_TIMEOUT"].includes(code))
        return "NETWORK_CONNECTION";
    return "NETWORK";
}
let processNextAt = 0;
let processActive = 0;
const processWaiters = [];
export class SecTransport {
    cache;
    snapshot;
    observations = new Map();
    snapshotParsed = new Map();
    http;
    userAgent;
    interval;
    concurrency;
    retries;
    timeoutMs;
    maxQueue;
    sharedLimiter;
    circuitThreshold;
    circuitResetMs;
    circuitFailures = 0;
    circuitOpenUntil = 0;
    queued = 0;
    metricsState = {
        requests: 0,
        successes: 0,
        failures: 0,
        retries: 0,
        cacheHits: 0,
        queueDepth: 0,
        queueWaitMs: 0,
        rateLimitWaitMs: 0,
        retryWaitMs: 0,
        latencyMs: 0,
        circuitOpen: 0,
        overloads: 0,
    };
    active = 0;
    nextAt = 0;
    inflight = new Map();
    constructor(options) {
        assertInput(/\S+\s+[^\s@]+@[^\s@]+\.[^\s@]+/.test(options.userAgent), "userAgent must identify an organization or person and contact email");
        const rate = options.requestsPerSecond ?? 5;
        assertInput(rate > 0 && rate < 10, "requestsPerSecond must be greater than zero and below 10");
        this.concurrency = options.concurrency ?? 2;
        assertInput(Number.isInteger(this.concurrency) &&
            this.concurrency > 0 &&
            this.concurrency <= 8, "concurrency must be an integer from 1 to 8");
        this.retries = options.retries ?? 2;
        assertInput(Number.isInteger(this.retries) && this.retries >= 0 && this.retries <= 5, "retries must be an integer from 0 to 5");
        this.timeoutMs = options.timeoutMs ?? 15000;
        this.interval = 1000 / rate;
        this.userAgent = options.userAgent;
        this.http = options.http ?? defaultHttp;
        this.cache = options.cache ?? new MemoryCache();
        this.snapshot = options.snapshot;
        this.sharedLimiter = options.sharedLimiter;
        this.maxQueue = options.maxQueue ?? 64;
        assertInput(Number.isInteger(this.maxQueue) && this.maxQueue >= 0, "maxQueue must be a nonnegative integer");
        this.circuitThreshold = options.circuitBreaker?.failureThreshold ?? 3;
        this.circuitResetMs = options.circuitBreaker?.resetMs ?? 30_000;
        assertInput(Number.isInteger(this.circuitThreshold) && this.circuitThreshold > 0, "Invalid circuit failure threshold");
        assertInput(Number.isFinite(this.circuitResetMs) && this.circuitResetMs > 0, "Invalid circuit reset time");
    }
    metrics() {
        return { ...this.metricsState, queueDepth: this.queued };
    }
    beforeRequest() {
        if (Date.now() < this.circuitOpenUntil) {
            this.metricsState.circuitOpen++;
            throw new EdgarError("CIRCUIT_OPEN", "SEC circuit is temporarily open");
        }
    }
    recordFailure(code) {
        if (!["HTTP_403", "HTTP_429", "HTTP_5XX"].includes(code))
            return;
        if (++this.circuitFailures >= this.circuitThreshold)
            this.circuitOpenUntil = Date.now() + this.circuitResetMs;
    }
    recordSuccess() {
        this.circuitFailures = 0;
        this.circuitOpenUntil = 0;
        this.metricsState.successes++;
    }
    observedResponses() {
        return [...this.observations.values()].sort((a, b) => a.url.localeCompare(b.url));
    }
    observe(url, status, contentType, body, bodyCaptured = true, retryAfter) {
        const entry = this.snapshot?.mode === "record"
            ? this.snapshot.capture(url, status, contentType, body, bodyCaptured, retryAfter)
            : (this.snapshot?.get(url) ?? {
                url,
                retrievedAt: new Date().toISOString(),
                status,
                contentType,
                sha256: createHash("sha256").update(body, "utf8").digest("hex"),
                body,
                bodyCaptured,
            });
        this.observations.set(url, responseEvidence(entry));
    }
    async slot(signal) {
        if (signal?.aborted)
            throw new EdgarError("ABORTED", "Request aborted");
        while (this.active >= this.concurrency || processActive >= 8) {
            if (this.queued >= this.maxQueue || processWaiters.length >= 512) {
                this.metricsState.overloads++;
                throw new EdgarError("QUEUE_FULL", "SEC request queue is full");
            }
            this.queued++;
            const waitingSince = Date.now();
            try {
                await new Promise((resolve, reject) => {
                    const wake = () => {
                        signal?.removeEventListener("abort", abort);
                        resolve();
                    };
                    const abort = () => {
                        const index = processWaiters.indexOf(wake);
                        if (index >= 0)
                            processWaiters.splice(index, 1);
                        reject(new EdgarError("ABORTED", "Request aborted"));
                    };
                    processWaiters.push(wake);
                    signal?.addEventListener("abort", abort, { once: true });
                    if (signal?.aborted)
                        abort();
                });
            }
            finally {
                this.queued--;
                this.metricsState.queueWaitMs += Date.now() - waitingSince;
            }
        }
        this.active++;
        processActive++;
        const reserved = Math.max(Date.now(), this.nextAt, processNextAt);
        const delay = Math.max(0, reserved - Date.now());
        this.nextAt = reserved + this.interval;
        processNextAt = reserved + 1000 / 8;
        try {
            if (delay) {
                this.metricsState.rateLimitWaitMs += delay;
                await waitWithSignal(delay, signal);
            }
            if (this.sharedLimiter) {
                const started = Date.now();
                await this.sharedLimiter.acquire(signal);
                this.metricsState.rateLimitWaitMs += Date.now() - started;
            }
        }
        catch (error) {
            this.release();
            throw error;
        }
    }
    release() {
        this.active--;
        processActive--;
        for (const wake of processWaiters.splice(0))
            wake();
    }
    async json(url, options = {}) {
        this.validateUrl(url);
        if (this.snapshotParsed.has(url))
            return structuredClone(this.snapshotParsed.get(url));
        if (!this.snapshot && !options.refresh) {
            const entry = await this.cache.getEntry?.(url);
            if (entry) {
                if (entry.source)
                    this.observations.set(url, entry.source);
                this.metricsState.cacheHits++;
                return entry.value;
            }
            if (!this.cache.getEntry) {
                const cached = await this.cache.get(url);
                if (cached !== undefined) {
                    this.metricsState.cacheHits++;
                    return cached;
                }
            }
        }
        const inflightKey = `${url}|${options.refresh ? "refresh" : "normal"}`;
        if (!options.signal && this.inflight.has(inflightKey)) {
            const pending = await this.inflight.get(inflightKey);
            return this.snapshot ? structuredClone(pending) : pending;
        }
        const work = this.request(url, "json", options);
        if (!options.signal)
            this.inflight.set(inflightKey, work);
        try {
            const value = await work;
            if (this.snapshot) {
                this.snapshotParsed.set(url, value);
                return structuredClone(value);
            }
            await this.cache.set(url, value, options.ttlMs ?? this.defaultTtl(url), {
                source: this.observations.get(url),
            });
            return value;
        }
        finally {
            if (!options.signal)
                this.inflight.delete(inflightKey);
        }
    }
    async text(url, options = {}) {
        this.validateUrl(url);
        return (await this.request(url, "text", options));
    }
    defaultTtl(url) {
        if (url.includes("company_tickers"))
            return 24 * 60 * 60_000;
        if (url.includes("/Archives/"))
            return 6 * 60 * 60_000;
        if (url.includes("/submissions/"))
            return 5 * 60_000;
        return 15 * 60_000;
    }
    validateUrl(url) {
        let parsed;
        try {
            parsed = new URL(url);
        }
        catch {
            throw new EdgarError("INVALID_PATH", "Invalid SEC URL");
        }
        if (parsed.protocol !== "https:" ||
            !hosts.has(parsed.hostname) ||
            parsed.username ||
            parsed.password ||
            parsed.port ||
            parsed.search ||
            parsed.hash)
            throw new EdgarError("INVALID_PATH", "Only approved HTTPS SEC paths are allowed", { url });
        if (!(parsed.hostname === "data.sec.gov" &&
            /^\/(submissions|api\/xbrl)\//.test(parsed.pathname)) &&
            !(parsed.hostname === "www.sec.gov" &&
                /^\/(Archives\/edgar\/data|files\/company_tickers)/.test(parsed.pathname)))
            throw new EdgarError("INVALID_PATH", "SEC path is outside the public-data allowlist", { url });
    }
    async request(url, kind, options) {
        for (let attempt = 0; attempt <= this.retries; attempt++) {
            this.beforeRequest();
            await this.slot(options.signal);
            this.metricsState.requests++;
            const started = Date.now();
            const controller = new AbortController();
            const onAbort = () => controller.abort(options.signal?.reason);
            options.signal?.addEventListener("abort", onAbort, { once: true });
            const timer = setTimeout(() => controller.abort(), this.timeoutMs);
            let retryAfter = 0;
            try {
                const response = this.snapshot?.mode === "replay"
                    ? this.snapshot.response(url)
                    : await this.http.fetch(url, {
                        headers: {
                            "User-Agent": this.userAgent,
                            Accept: kind === "json" ? "application/json" : "*/*",
                        },
                        signal: controller.signal,
                        redirect: "manual",
                    });
                if (response.status >= 300 && response.status < 400)
                    throw new EdgarError("REDIRECT", "SEC redirected an allowlisted request", { url, status: response.status });
                if (!response.ok) {
                    const code = response.status === 400
                        ? "HTTP_400"
                        : response.status === 403
                            ? "HTTP_403"
                            : response.status === 404
                                ? "HTTP_404"
                                : response.status === 408
                                    ? "HTTP_408"
                                    : response.status === 429
                                        ? "HTTP_429"
                                        : response.status >= 500
                                            ? "HTTP_5XX"
                                            : "HTTP_UNEXPECTED";
                    const header = response.headers.get("retry-after");
                    retryAfter = header
                        ? /^\d+$/.test(header)
                            ? Number(header) * 1000
                            : Math.max(0, Date.parse(header) - Date.now())
                        : 0;
                    if (!Number.isFinite(retryAfter))
                        retryAfter = 0;
                    if ((response.status === 404 || response.status === 410) &&
                        this.cache.delete)
                        await this.cache.delete(url);
                    this.observe(url, response.status, response.headers.get("content-type") ?? "", "", false, header ?? undefined);
                    throw new EdgarError(code, `SEC returned HTTP ${response.status}`, {
                        url,
                        status: response.status,
                        retryable: [408, 429].includes(response.status) || response.status >= 500,
                    });
                }
                const contentType = response.headers.get("content-type") ?? "";
                const maxBytes = options.maxBytes ?? (kind === "json" ? 30_000_000 : 5_000_000);
                const length = Number(response.headers.get("content-length") ?? 0);
                if (length > maxBytes)
                    throw new EdgarError("OVERSIZED", "SEC response exceeds configured size", { url });
                const reader = response.body?.getReader();
                let body = "";
                if (reader) {
                    const decoder = new TextDecoder();
                    let bytes = 0;
                    while (true) {
                        const chunk = await reader.read();
                        if (chunk.done)
                            break;
                        bytes += chunk.value.byteLength;
                        if (bytes > maxBytes) {
                            await reader.cancel();
                            throw new EdgarError("OVERSIZED", "SEC response exceeds configured size", { url });
                        }
                        body += decoder.decode(chunk.value, { stream: true });
                    }
                    body += decoder.decode();
                }
                else
                    body = await response.text();
                if (body.length > maxBytes)
                    throw new EdgarError("OVERSIZED", "SEC response exceeds configured size", { url });
                this.observe(url, response.status, contentType, body);
                if (!body.trim())
                    throw new EdgarError("EMPTY_BODY", "SEC returned an empty response", {
                        url,
                    });
                if (kind === "text") {
                    this.recordSuccess();
                    return body;
                }
                if (/html/i.test(contentType) || /^\s*</.test(body))
                    throw new EdgarError("BLOCKED_HTML", "SEC returned HTML where JSON was expected; check access and User-Agent", { url });
                if (!/\b(?:application|text)\/(?:json|[^;]+\+json)\b/i.test(contentType))
                    throw new EdgarError("CONTENT_TYPE", "SEC JSON response has an unexpected content type", { url });
                const parsed = parseLosslessJson(body, url);
                this.recordSuccess();
                return parsed;
            }
            catch (cause) {
                const error = cause instanceof EdgarError
                    ? cause
                    : new EdgarError(options.signal?.aborted
                        ? "ABORTED"
                        : controller.signal.aborted
                            ? "TIMEOUT"
                            : networkFailureCode(cause), "SEC request failed", { url, retryable: !options.signal?.aborted, cause });
                this.metricsState.failures++;
                this.recordFailure(error.code);
                if (!error.retryable || attempt === this.retries)
                    throw error;
                this.metricsState.retries++;
                const retryDelay = Math.max(retryAfter, Math.min(4000, 250 * 2 ** attempt + Math.random() * 150));
                this.metricsState.retryWaitMs += retryDelay;
                await waitWithSignal(retryDelay, options.signal);
            }
            finally {
                clearTimeout(timer);
                options.signal?.removeEventListener("abort", onAbort);
                this.metricsState.latencyMs += Date.now() - started;
                this.release();
            }
        }
        throw new EdgarError("NETWORK", "SEC request exhausted retries", { url });
    }
}
