export type EdgarErrorCode = "INVALID_INPUT" | "INVALID_PATH" | "ABORTED" | "TIMEOUT" | "NETWORK" | "NETWORK_DNS" | "NETWORK_TLS" | "NETWORK_CONNECTION" | "DECOMPRESSION" | "REDIRECT" | "HTTP_400" | "HTTP_403" | "HTTP_404" | "HTTP_408" | "HTTP_429" | "HTTP_5XX" | "HTTP_UNEXPECTED" | "BLOCKED_HTML" | "CONTENT_TYPE" | "EMPTY_BODY" | "MALFORMED_JSON" | "MALFORMED_XML" | "SCHEMA" | "NOT_FOUND" | "AMBIGUOUS_PERIOD" | "AMBIGUOUS_CURRENCY" | "MISSING_HISTORY" | "SNAPSHOT_MISS" | "SNAPSHOT_INTEGRITY" | "PRECISION" | "UNSUPPORTED" | "OVERSIZED" | "QUEUE_FULL" | "CIRCUIT_OPEN" | "SHARED_LIMITER" | "CACHE_CORRUPT" | "UNSAFE_ARCHIVE";
export declare class EdgarError extends Error {
    readonly code: EdgarErrorCode;
    readonly url?: string;
    readonly status?: number;
    readonly retryable: boolean;
    readonly cause?: unknown;
    constructor(code: EdgarErrorCode, message: string, context?: {
        url?: string;
        status?: number;
        retryable?: boolean;
        cause?: unknown;
    });
}
export declare function assertInput(condition: unknown, message: string): asserts condition;
export declare function schema(condition: unknown, message: string, url?: string): asserts condition;
