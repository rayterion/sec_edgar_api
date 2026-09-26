export interface SharedRateLimiter {
    acquire(signal?: AbortSignal): Promise<void>;
}
export interface FileRateLimiterOptions {
    path: string;
    requestsPerSecond?: number;
    lockTimeoutMs?: number;
}
export declare class FileRateLimiter implements SharedRateLimiter {
    private readonly options;
    private readonly rate;
    private readonly lockTimeoutMs;
    constructor(options: FileRateLimiterOptions);
    acquire(signal?: AbortSignal): Promise<void>;
    private lock;
    private readTimestamps;
    private writeTimestamps;
}
