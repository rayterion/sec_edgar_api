import type { Cache } from "../cache/index.js";
import { MemoryCache } from "../cache/index.js";
import { EdgarError, assertInput } from "../errors.js";
import { parseLosslessJson } from "../parsers/json.js";

export interface HttpTransport {
  fetch(url: string, init: RequestInit): Promise<Response>;
}
export interface RequestOptions {
  signal?: AbortSignal;
  ttlMs?: number;
  maxBytes?: number;
}
export interface TransportOptions {
  userAgent: string;
  http?: HttpTransport;
  cache?: Cache;
  requestsPerSecond?: number;
  concurrency?: number;
  retries?: number;
  timeoutMs?: number;
}
const hosts = new Set(["data.sec.gov", "www.sec.gov"]);
const defaultHttp: HttpTransport = { fetch: (url, init) => fetch(url, init) };
const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
function networkFailureCode(
  error: unknown,
):
  | "NETWORK"
  | "NETWORK_DNS"
  | "NETWORK_TLS"
  | "NETWORK_CONNECTION"
  | "DECOMPRESSION" {
  const nested =
    typeof error === "object" && error !== null && "cause" in error
      ? error.cause
      : error;
  const code =
    typeof nested === "object" && nested !== null && "code" in nested
      ? String(nested.code)
      : "";
  if (["ENOTFOUND", "EAI_AGAIN"].includes(code)) return "NETWORK_DNS";
  if (
    code.startsWith("ERR_TLS") ||
    code.startsWith("CERT_") ||
    code.includes("CERTIFICATE")
  )
    return "NETWORK_TLS";
  if (code.startsWith("Z_") || code.startsWith("ERR_ZLIB"))
    return "DECOMPRESSION";
  if (
    ["ECONNRESET", "ECONNREFUSED", "EPIPE", "UND_ERR_CONNECT_TIMEOUT"].includes(
      code,
    )
  )
    return "NETWORK_CONNECTION";
  return "NETWORK";
}
let processNextAt = 0;
let processActive = 0;
const processWaiters: Array<() => void> = [];
export class SecTransport {
  readonly cache: Cache;
  private readonly http: HttpTransport;
  private readonly userAgent: string;
  private readonly interval: number;
  private readonly concurrency: number;
  private readonly retries: number;
  private readonly timeoutMs: number;
  private active = 0;
  private nextAt = 0;
  private inflight = new Map<string, Promise<unknown>>();
  constructor(options: TransportOptions) {
    assertInput(
      /\S+\s+[^\s@]+@[^\s@]+\.[^\s@]+/.test(options.userAgent),
      "userAgent must identify an organization or person and contact email",
    );
    const rate = options.requestsPerSecond ?? 5;
    assertInput(
      rate > 0 && rate < 10,
      "requestsPerSecond must be greater than zero and below 10",
    );
    this.concurrency = options.concurrency ?? 2;
    assertInput(
      Number.isInteger(this.concurrency) &&
        this.concurrency > 0 &&
        this.concurrency <= 8,
      "concurrency must be an integer from 1 to 8",
    );
    this.retries = options.retries ?? 2;
    assertInput(
      Number.isInteger(this.retries) && this.retries >= 0 && this.retries <= 5,
      "retries must be an integer from 0 to 5",
    );
    this.timeoutMs = options.timeoutMs ?? 15000;
    this.interval = 1000 / rate;
    this.userAgent = options.userAgent;
    this.http = options.http ?? defaultHttp;
    this.cache = options.cache ?? new MemoryCache();
  }
  private async slot(signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) throw new EdgarError("ABORTED", "Request aborted");
    while (this.active >= this.concurrency || processActive >= 8)
      await new Promise<void>((resolve) => processWaiters.push(resolve));
    this.active++;
    processActive++;
    const reserved = Math.max(Date.now(), this.nextAt, processNextAt);
    const delay = Math.max(0, reserved - Date.now());
    this.nextAt = reserved + this.interval;
    processNextAt = reserved + 1000 / 9;
    if (delay) await sleep(delay);
    if (signal?.aborted) {
      this.release();
      throw new EdgarError("ABORTED", "Request aborted");
    }
  }
  private release(): void {
    this.active--;
    processActive--;
    for (const wake of processWaiters.splice(0)) wake();
  }
  async json(url: string, options: RequestOptions = {}): Promise<unknown> {
    this.validateUrl(url);
    const cached = await this.cache.get(url);
    if (cached !== undefined) return cached;
    if (!options.signal && this.inflight.has(url))
      return this.inflight.get(url)!;
    const work = this.request(url, "json", options);
    if (!options.signal) this.inflight.set(url, work);
    try {
      const value = await work;
      await this.cache.set(url, value, options.ttlMs ?? this.defaultTtl(url));
      return value;
    } finally {
      if (!options.signal) this.inflight.delete(url);
    }
  }
  async text(url: string, options: RequestOptions = {}): Promise<string> {
    this.validateUrl(url);
    return (await this.request(url, "text", options)) as string;
  }
  private defaultTtl(url: string): number {
    if (url.includes("company_tickers")) return 24 * 60 * 60_000;
    if (url.includes("/Archives/")) return 6 * 60 * 60_000;
    if (url.includes("/submissions/")) return 5 * 60_000;
    return 15 * 60_000;
  }
  private validateUrl(url: string): void {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new EdgarError("INVALID_PATH", "Invalid SEC URL");
    }
    if (
      parsed.protocol !== "https:" ||
      !hosts.has(parsed.hostname) ||
      parsed.username ||
      parsed.password ||
      parsed.port ||
      parsed.search ||
      parsed.hash
    )
      throw new EdgarError(
        "INVALID_PATH",
        "Only approved HTTPS SEC paths are allowed",
        { url },
      );
    if (
      !(
        parsed.hostname === "data.sec.gov" &&
        /^\/(submissions|api\/xbrl)\//.test(parsed.pathname)
      ) &&
      !(
        parsed.hostname === "www.sec.gov" &&
        /^\/(Archives\/edgar\/data|files\/company_tickers)/.test(
          parsed.pathname,
        )
      )
    )
      throw new EdgarError(
        "INVALID_PATH",
        "SEC path is outside the public-data allowlist",
        { url },
      );
  }
  private async request(
    url: string,
    kind: "json" | "text",
    options: RequestOptions,
  ): Promise<unknown> {
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      await this.slot(options.signal);
      const controller = new AbortController();
      const onAbort = () => controller.abort(options.signal?.reason);
      options.signal?.addEventListener("abort", onAbort, { once: true });
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      let retryAfter = 0;
      try {
        const response = await this.http.fetch(url, {
          headers: {
            "User-Agent": this.userAgent,
            Accept: kind === "json" ? "application/json" : "*/*",
          },
          signal: controller.signal,
          redirect: "manual",
        });
        if (response.status >= 300 && response.status < 400)
          throw new EdgarError(
            "REDIRECT",
            "SEC redirected an allowlisted request",
            { url, status: response.status },
          );
        if (!response.ok) {
          const code =
            response.status === 400
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
          if (!Number.isFinite(retryAfter)) retryAfter = 0;
          throw new EdgarError(code, `SEC returned HTTP ${response.status}`, {
            url,
            status: response.status,
            retryable:
              [408, 429].includes(response.status) || response.status >= 500,
          });
        }
        const contentType = response.headers.get("content-type") ?? "";
        const maxBytes =
          options.maxBytes ?? (kind === "json" ? 30_000_000 : 5_000_000);
        const length = Number(response.headers.get("content-length") ?? 0);
        if (length > maxBytes)
          throw new EdgarError(
            "OVERSIZED",
            "SEC response exceeds configured size",
            { url },
          );
        const reader = response.body?.getReader();
        let body = "";
        if (reader) {
          const decoder = new TextDecoder();
          let bytes = 0;
          while (true) {
            const chunk = await reader.read();
            if (chunk.done) break;
            bytes += chunk.value.byteLength;
            if (bytes > maxBytes) {
              await reader.cancel();
              throw new EdgarError(
                "OVERSIZED",
                "SEC response exceeds configured size",
                { url },
              );
            }
            body += decoder.decode(chunk.value, { stream: true });
          }
          body += decoder.decode();
        } else body = await response.text();
        if (body.length > maxBytes)
          throw new EdgarError(
            "OVERSIZED",
            "SEC response exceeds configured size",
            { url },
          );
        if (!body.trim())
          throw new EdgarError("EMPTY_BODY", "SEC returned an empty response", {
            url,
          });
        if (kind === "text") return body;
        if (/html/i.test(contentType) || /^\s*</.test(body))
          throw new EdgarError(
            "BLOCKED_HTML",
            "SEC returned HTML where JSON was expected; check access and User-Agent",
            { url },
          );
        if (
          !/\b(?:application|text)\/(?:json|[^;]+\+json)\b/i.test(contentType)
        )
          throw new EdgarError(
            "CONTENT_TYPE",
            "SEC JSON response has an unexpected content type",
            { url },
          );
        return parseLosslessJson(body, url);
      } catch (cause) {
        const error =
          cause instanceof EdgarError
            ? cause
            : new EdgarError(
                options.signal?.aborted
                  ? "ABORTED"
                  : controller.signal.aborted
                    ? "TIMEOUT"
                    : networkFailureCode(cause),
                "SEC request failed",
                { url, retryable: !options.signal?.aborted, cause },
              );
        if (!error.retryable || attempt === this.retries) throw error;
        await sleep(
          Math.max(
            retryAfter,
            Math.min(4000, 250 * 2 ** attempt + Math.random() * 150),
          ),
        );
      } finally {
        clearTimeout(timer);
        options.signal?.removeEventListener("abort", onAbort);
        this.release();
      }
    }
    throw new EdgarError("NETWORK", "SEC request exhausted retries", { url });
  }
}
