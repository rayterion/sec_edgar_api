export interface SnapshotEntry {
    url: string;
    retrievedAt: string;
    status: number;
    contentType: string;
    sha256: string;
    body: string;
    bodyCaptured: boolean;
    retryAfter?: string;
}
export interface SnapshotArtifact {
    version: 1;
    entries: SnapshotEntry[];
}
export type ResponseEvidence = Pick<SnapshotEntry, "url" | "retrievedAt" | "status" | "sha256" | "bodyCaptured">;
export interface SnapshotDifference {
    url: string;
    kind: "added" | "changed" | "removed" | "notCaptured";
    before?: ResponseEvidence;
    after?: ResponseEvidence;
}
export declare class SecSnapshot {
    private readonly maxBytes;
    private readonly maxEntries;
    readonly mode: "record" | "replay";
    private entries;
    private bytes;
    constructor(mode?: "record" | "replay", maxBytes?: number, maxEntries?: number);
    static replay(artifact: SnapshotArtifact): SecSnapshot;
    private store;
    capture(url: string, status: number, contentType: string, body: string, bodyCaptured?: boolean, retryAfter?: string): SnapshotEntry;
    get(url: string): SnapshotEntry | undefined;
    response(url: string): Response;
    export(): SnapshotArtifact;
}
export declare function diffSnapshots(before: SnapshotArtifact, after: SnapshotArtifact): SnapshotDifference[];
export declare function responseEvidence(entry: SnapshotEntry): ResponseEvidence;
