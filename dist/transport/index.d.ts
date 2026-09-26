import { SecSnapshot } from "./snapshot.js";
import type { SharedRateLimiter } from "./limiter.js";
import type { ResponseEvidence } from "./snapshot.js";
import type { Cache } from "../cache/index.js";
export interface HttpTransport {
    fetch(url: string, init: RequestInit): Promise<Response>;
}
export interface RequestOptions {
    signal?: AbortSignal;
    ttlMs?: number;
    maxBytes?: number;
    refresh?: boolean;
}
export interface TransportOptions {
    userAgent: string;
    http?: HttpTransport;
    cache?: Cache;
    requestsPerSecond?: number;
    concurrency?: number;
    retries?: number;
    timeoutMs?: number;
    snapshot?: SecSnapshot;
    sharedLimiter?: SharedRateLimiter;
    maxQueue?: number;
    circuitBreaker?: {
        failureThreshold: number;
        resetMs: number;
    };
}
export interface TransportMetrics {
    requests: number;
    successes: number;
    failures: number;
    retries: number;
    cacheHits: number;
    queueDepth: number;
    queueWaitMs: number;
    rateLimitWaitMs: number;
    retryWaitMs: number;
    latencyMs: number;
    circuitOpen: number;
    overloads: number;
}
export declare class SecTransport {
    readonly cache: Cache;
    private readonly snapshot?;
    private readonly observations;
    private readonly snapshotParsed;
    private readonly http;
    private readonly userAgent;
    private readonly interval;
    private readonly concurrency;
    private readonly retries;
    private readonly timeoutMs;
    private readonly maxQueue;
    private readonly sharedLimiter?;
    private readonly circuitThreshold;
    private readonly circuitResetMs;
    private circuitFailures;
    private circuitOpenUntil;
    private queued;
    private readonly metricsState;
    private active;
    private nextAt;
    private inflight;
    constructor(options: TransportOptions);
    metrics(): TransportMetrics;
    private beforeRequest;
    private recordFailure;
    private recordSuccess;
    observedResponses(): ResponseEvidence[];
    private observe;
    private slot;
    private release;
    json(url: string, options?: RequestOptions): Promise<unknown>;
    text(url: string, options?: RequestOptions): Promise<string>;
    private defaultTtl;
    private validateUrl;
    private request;
}
