# Record and replay SEC responses

A `SecSnapshot` pins the SEC response bodies used by a client. It stores their URLs, retrieval times, SHA-256 hashes, and statuses. Replay uses only the recorded artifact and fails with `SNAPSHOT_MISS` if a required URL is absent.

```js
import {
  createEdgarClient,
  SecSnapshot,
  diffSnapshots,
} from "@rayterion/sec-edgar";

const recording = new SecSnapshot();
const live = createEdgarClient({
  userAgent: "Example Research contact@example.com",
  snapshot: recording,
});
const first = await live.financials.incomeStatement({
  ticker: "AAPL",
  fiscalYear: 2025,
  fiscalQuarter: 2,
});
const portableJson = JSON.stringify(recording.export());

const replayed = createEdgarClient({
  userAgent: "Example Research contact@example.com",
  snapshot: SecSnapshot.replay(JSON.parse(portableJson)),
});
const second = await replayed.financials.incomeStatement({
  ticker: "AAPL",
  fiscalYear: 2025,
  fiscalQuarter: 2,
});
console.log(first.values.revenue, second.values.revenue);
console.log(
  second.audit.inputs.map(({ url, sha256, retrievedAt }) => ({
    url,
    sha256,
    retrievedAt,
  })),
);
console.log(diffSnapshots(recording.export(), recording.export())); // []
```

Persist `portableJson` using your chosen storage and access controls. The artifact contains the captured SEC response bodies; default bounds are 100 MB and 256 URLs. A fresh second capture can be compared with `diffSnapshots(old, fresh)`: `changed` means an observed content/status change, `removed` means an observed HTTP 404/410, and `notCaptured` means the second capture did not request that URL. `notCaptured` is not evidence of SEC deletion.

`audit.evaluatedAt` is the time the statement was computed. `audit.inputs[].retrievedAt` is when each SEC response was obtained, and `details[field].source.filed` is the filing date. These timestamps have different meanings. `audit.complete: false` means at least one required response had no observed content hash, such as data served by an opaque external cache. Replay protects repeatability of `values` and `details` and isolates parsed responses from consumer mutation; the evaluation timestamp changes. SHA-256 detects corruption, not origin authenticity. `asOf` filters recorded filing/fact dates and does not recreate a past SEC API state. See [the snapshot decision](../decisions/016-response-snapshots.md).
