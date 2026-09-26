import type { ResponseEvidence } from "../transport/snapshot.js";
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
    getEntry?(key: string): Promise<CacheEntry | undefined> | CacheEntry | undefined;
    set(key: string, value: unknown, ttlMs: number, metadata?: CacheWriteMetadata): Promise<void> | void;
    delete?(key: string): Promise<void> | void;
}
export declare class MemoryCache implements Cache {
    readonly maxEntries: number;
    readonly maxBytes: number;
    private entries;
    private bytes;
    constructor(maxEntries?: number, maxBytes?: number);
    get(key: string): unknown | undefined;
    getEntry(key: string): CacheEntry | undefined;
    set(key: string, value: unknown, ttlMs: number, metadata?: CacheWriteMetadata): void;
    delete(key: string): void;
}
export interface FileCacheOptions {
    directory: string;
    maxEntries?: number;
    maxBytes?: number;
}
export declare class FileCache implements Cache {
    private readonly options;
    private readonly maxEntries;
    private readonly maxBytes;
    constructor(options: FileCacheOptions);
    private path;
    get(key: string): Promise<unknown | undefined>;
    getEntry(key: string): Promise<CacheEntry | undefined>;
    set(key: string, value: unknown, ttlMs: number, metadata?: CacheWriteMetadata): Promise<void>;
    delete(key: string): Promise<void>;
    private prune;
    private withLock;
}
