import { createHash } from "node:crypto";
import { EdgarError, schema } from "../errors.js";

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
export type ResponseEvidence = Pick<
  SnapshotEntry,
  "url" | "retrievedAt" | "status" | "sha256" | "bodyCaptured"
>;
export interface SnapshotDifference {
  url: string;
  kind: "added" | "changed" | "removed" | "notCaptured";
  before?: ResponseEvidence;
  after?: ResponseEvidence;
}
const digest = (body: string) =>
  createHash("sha256").update(body, "utf8").digest("hex");
function valid(entry: SnapshotEntry): boolean {
  return (
    typeof entry.url === "string" &&
    /^https:\/\/(?:data|www)\.sec\.gov\//.test(entry.url) &&
    typeof entry.retrievedAt === "string" &&
    !Number.isNaN(Date.parse(entry.retrievedAt)) &&
    Number.isInteger(entry.status) &&
    entry.status >= 100 &&
    entry.status <= 599 &&
    typeof entry.contentType === "string" &&
    typeof entry.body === "string" &&
    typeof entry.bodyCaptured === "boolean" &&
    entry.sha256 === digest(entry.body)
  );
}
export class SecSnapshot {
  readonly mode: "record" | "replay";
  private entries = new Map<string, SnapshotEntry>();
  private bytes = 0;
  constructor(
    mode: "record" | "replay" = "record",
    private readonly maxBytes = 100_000_000,
    private readonly maxEntries = 256,
  ) {
    this.mode = mode;
  }
  static replay(artifact: SnapshotArtifact): SecSnapshot {
    schema(
      artifact?.version === 1 && Array.isArray(artifact.entries),
      "Invalid SEC snapshot format",
    );
    const snapshot = new SecSnapshot("replay");
    for (const entry of artifact.entries) {
      if (!valid(entry) || snapshot.entries.has(entry.url))
        throw new EdgarError(
          "SNAPSHOT_INTEGRITY",
          "SEC snapshot entry is corrupt or duplicated",
          { url: entry?.url },
        );
      snapshot.store(entry);
    }
    return snapshot;
  }
  private store(entry: SnapshotEntry): void {
    const old = this.entries.get(entry.url);
    const size = Buffer.byteLength(entry.body, "utf8");
    const nextBytes =
      this.bytes - (old ? Buffer.byteLength(old.body, "utf8") : 0) + size;
    if (
      nextBytes > this.maxBytes ||
      (!old && this.entries.size >= this.maxEntries)
    )
      throw new EdgarError("OVERSIZED", "SEC snapshot limit exceeded", {
        url: entry.url,
      });
    this.bytes = nextBytes;
    this.entries.set(entry.url, Object.freeze({ ...entry }));
  }
  capture(
    url: string,
    status: number,
    contentType: string,
    body: string,
    bodyCaptured = true,
    retryAfter?: string,
  ): SnapshotEntry {
    if (this.mode !== "record")
      throw new EdgarError("INVALID_INPUT", "Cannot write a replay snapshot");
    const entry: SnapshotEntry = {
      url,
      retrievedAt: new Date().toISOString(),
      status,
      contentType,
      sha256: digest(body),
      body,
      bodyCaptured,
      ...(retryAfter ? { retryAfter } : {}),
    };
    this.store(entry);
    return entry;
  }
  get(url: string): SnapshotEntry | undefined {
    return this.entries.get(url);
  }
  response(url: string): Response {
    if (this.mode !== "replay")
      throw new EdgarError("INVALID_INPUT", "Snapshot is not in replay mode");
    const entry = this.entries.get(url);
    if (!entry)
      throw new EdgarError("SNAPSHOT_MISS", "SEC URL is absent from snapshot", {
        url,
      });
    return new Response(entry.body, {
      status: entry.status,
      headers: {
        "content-type": entry.contentType,
        ...(entry.retryAfter ? { "retry-after": entry.retryAfter } : {}),
      },
    });
  }
  export(): SnapshotArtifact {
    return {
      version: 1,
      entries: [...this.entries.values()]
        .sort((a, b) => a.url.localeCompare(b.url))
        .map((entry) => ({ ...entry })),
    };
  }
}
function evidence(entry: SnapshotEntry): ResponseEvidence {
  const { url, retrievedAt, status, sha256, bodyCaptured } = entry;
  return { url, retrievedAt, status, sha256, bodyCaptured };
}
export function diffSnapshots(
  before: SnapshotArtifact,
  after: SnapshotArtifact,
): SnapshotDifference[] {
  const older = new Map(before.entries.map((x) => [x.url, x]));
  const newer = new Map(after.entries.map((x) => [x.url, x]));
  return [...new Set([...older.keys(), ...newer.keys()])]
    .sort()
    .flatMap((url): SnapshotDifference[] => {
      const a = older.get(url),
        b = newer.get(url);
      if (!a) return [{ url, kind: "added", after: evidence(b!) }];
      if (!b) return [{ url, kind: "notCaptured", before: evidence(a) }];
      if (a.status === b.status && a.sha256 === b.sha256) return [];
      return [
        {
          url,
          kind: b.status === 404 || b.status === 410 ? "removed" : "changed",
          before: evidence(a),
          after: evidence(b),
        },
      ];
    });
}
export function responseEvidence(entry: SnapshotEntry): ResponseEvidence {
  return evidence(entry);
}
