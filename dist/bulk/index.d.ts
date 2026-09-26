import type { Cache } from "../cache/index.js";
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
export declare const DEFAULT_BULK_LIMITS: Readonly<{
    maxCompressedBytes: 2000000000;
    maxUncompressedBytes: 20000000000;
    maxEntryBytes: 50000000;
    maxEntries: 1200000;
}>;
export declare function importBulkZip(options: BulkImportOptions): Promise<BulkImportReport>;
