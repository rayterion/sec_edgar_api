# ADR 016: Response snapshots and statement audit evidence

- **Date:** 2026-09-24
- **Status:** Accepted for deterministic JSON/HTML response replay.

## Context

SEC submissions and XBRL responses update on different schedules and can be corrected or removed. `asOf` filters currently available data but is not a historical response archive. See [PR-04 research](../research/research-log.md) and the [SEC API update notes](https://www.sec.gov/search-filings/edgar-application-programming-interfaces).

## Decision

Offer a bounded, serializable `SecSnapshot` in record and replay modes. Store each allowed response URL, retrieval time, HTTP status, content type, UTF-8 body, SHA-256, and body-capture flag. Verify hashes and duplicate URLs on replay; missing URLs fail closed without network access. `diffSnapshots` distinguishes changed bodies/statuses, observed 404/410 removals, newly captured URLs, and URLs absent from a comparison capture. A statement exposes `audit.evaluatedAt`, `mappingVersion`, `selectionPolicyVersion`, source hashes/times, and `audit.complete`. External cache data without observed retrieval metadata makes the audit incomplete.

## Alternatives considered

Cache TTL as provenance; retain only parsed JSON; attach a single evaluation timestamp; use `asOf` as a historical snapshot.

## Rationale

Only retained source content allows deterministic replay after upstream changes. Parsed objects can lose original numeric tokens or schema details. Hashes detect corruption; their values are not proof of SEC authenticity.

## Consequences

Snapshots contain SEC response content and can be large; the default limits are 100 MB and 256 URLs. Error responses record status but not body, marked `bodyCaptured: false`. Persisting the exported JSON is the caller's choice. Compare `values`/`details` for deterministic financial output; `evaluatedAt` records each evaluation and will differ across replays. See [data anomalies](../research/data-anomalies.md).
