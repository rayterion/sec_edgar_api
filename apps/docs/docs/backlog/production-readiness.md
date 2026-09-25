---
title: Production readiness backlog
sidebar_position: 1
---

# Production readiness backlog

**Recorded:** 2026-09-24  
**Status:** Open. The current package is a tested preview, not a complete v1 or a sole source for high-stakes financial decisions.

This is the maintained list of work needed before relying on normalized statements in large server deployments. Each item needs a documented decision, real-response fixtures where SEC behavior is involved, deterministic tests, and an update to the [release report](../release-report.md) when completed. Priority P0 blocks high-stakes use; P1 blocks large-scale service operation. Status is **Open** until its acceptance criteria pass.

| ID    | Priority | Work item                                           | Status |
| ----- | -------- | --------------------------------------------------- | ------ |
| PR-01 | P0       | Coherent fact selection and safe quarter derivation | Done   |
| PR-02 | P0       | Fiscal periods and historical filing coverage       | Open   |
| PR-03 | P0       | Currency detection and broader statement mappings   | Open   |
| PR-04 | P0       | Reproducible, auditable data snapshots              | Open   |
| PR-05 | P0       | Filing-level coverage and financial validation      | Open   |
| PR-06 | P1       | Server-wide traffic control and resilience          | Open   |
| PR-07 | P1       | Persistent cache and bulk ingestion strategy        | Open   |
| PR-08 | P1       | Production-scale verification and monitoring        | Open   |

## PR-01 — Coherent fact selection and safe quarter derivation

`financials/selection.ts` currently ranks the later and earlier year-to-date operands independently. The selection policy must establish that operands belong to a compatible revision set, identify conflicting or duplicate facts, and return an explicit unavailable result when no safe pair exists. Direct facts and aliases need a documented, tested precedence across forms and amendments. Preserve losing candidates and reasons in the trace.

**Acceptance:** Real amended and comparative fixtures exercise direct versus derived selection, mixed-revision operands, conflicting equal-rank facts, `latest`, `asFiled`, and `asOf`. No test produces a derived number from an incompatible pair. A statement exposes a specific reason when derivation is refused. See [financial semantics](../research/financial-semantics.md) and [ADR 008](../decisions/008-revision-policy.md), [ADR 010](../decisions/010-quarter-derivation.md).

**Completion evidence (2026-09-24):** Tests commit `69bbee0`; implementation and research commit `5fa7022`. The recorded Apple comparative and BayFirst amended fixtures, plus the explicitly synthetic `selection-anomalies.json` overlay, exercise the cases above in `packages/sec-edgar/test/client.test.mjs`. `selectFactResult` returns `CONFLICTING_FACTS` or `INCOMPATIBLE_REVISIONS` when appropriate; statements expose `coverage.missingCodes`, `missingReasons`, and optional `selectionTraces`. The cohort rule is a conservative client policy; it cannot prove agreement between separate filings. Broader filing-level verification remains [PR-05](#pr-05--filing-level-coverage-and-financial-validation).

## PR-02 — Fiscal periods and historical filing coverage

Financial statements currently call `filings.recent`, even though `filings.list` can follow referenced older submissions files. Extend period discovery to the relevant historical files without downloading unrelated history. Expand real fixtures for 52/53-week years, missing quarter reports, short periods, year-end changes, transition reports, and foreign filers. Verify fiscal-year labels separately from the report date's calendar year.

**Acceptance:** Annual and Q1–Q4 queries work for recorded current and older periods; ambiguous or unsupported periods fail explicitly. Tests cover historical-file pagination and `asOf` before the annual filing. See [endpoint inventory](../research/endpoint-inventory.md) and [ADR 009](../decisions/009-fiscal-period.md).

## PR-03 — Currency detection and broader statement mappings

Normalized statements currently default to USD. Define a verified reporting-currency policy: detect it from appropriate filed facts where unambiguous, or require `unit` and report ambiguity. Keep different units separate. Add researched, versioned canonical mappings for banks, insurers, REITs, funds, and broader IFRS reporting; do not force company-specific concepts into incorrect fields.

**Acceptance:** Real foreign and industry fixtures prove the selected currency and each mapped field's meaning and lineage. Ambiguous or mixed-currency inputs never yield a plausible blended statement. Tests cover missing fields and explicit `unit` overrides. See [mapping decision](../decisions/007-mapping.md) and [financial semantics](../research/financial-semantics.md).

## PR-04 — Reproducible, auditable data snapshots

Record when each SEC response was retrieved, its source URL and content hash, and the mapping and selection-policy versions used for an output. Provide a way to persist or replay the exact inputs behind a financial decision. Document that `asOf` filters currently available facts and filings; it does not recreate an immutable historical SEC snapshot. Define how corrections, removals, and differences between submissions and XBRL update times are detected and surfaced.

**Acceptance:** The same recorded snapshot produces byte-for-byte equivalent financial values and lineage after cache expiry or upstream changes. A changed or removed SEC response is observable, and a caller can distinguish source time, filing time, and evaluation time. See [data anomalies](../research/data-anomalies.md) and [cache decision](../decisions/003-cache.md).

## PR-05 — Filing-level coverage and financial validation

Extend archive parsing beyond supported `_htm.xml` numeric instances to researched Inline XBRL HTML cases. Handle contexts, dimensions, scale, sign, nil values, and custom tags without guessing their canonical meaning. Add optional reconciliation checks, such as assets against liabilities plus equity when all required facts are comparable; report discrepancies rather than changing values.

**Acceptance:** Compact real filing fixtures cover each supported format and variant. Unsupported formats and failed reconciliations carry explicit status and source references. Statement `complete` is documented as canonical-field coverage, never a filing audit. See [endpoint inventory](../research/endpoint-inventory.md), [archive parsing decision](../decisions/011-archive-parsing.md), and [known limitations](../guide/limitations.md).

## PR-06 — Server-wide traffic control and resilience

The current limiter coordinates one Node process. Large deployments need a shared limiter across replicas and organizations, bounded queues, abort-aware queue and retry waits, overload behavior, circuit breaking, and request metrics. Recheck SEC access policy before changing defaults. The [SEC fair-access policy](https://www.sec.gov/about/privacy-information) limits aggregate traffic across machines; its [developer guidance](https://www.sec.gov/about/developer-resources) asks for efficient access and an identifying User-Agent.

**Acceptance:** Multi-process load tests keep aggregate requests below the configured organizational limit. Aborted callers leave queues promptly; sustained SEC 429/403/5xx responses do not create unbounded work. Metrics expose queue depth, rate-limit waits, retries, latency, cache hits, and failures. See [rate-limit decision](../decisions/004-rate-limiting.md).

## PR-07 — Persistent cache and bulk ingestion strategy

The default cache is in memory, bounded by entry count rather than bytes, and uses fixed endpoint TTLs. Provide a production adapter contract with size limits, freshness metadata, explicit invalidation/refresh, and safe behavior when replicas see different versions. For broad historical backfills, research and implement a bounded bulk ingestion workflow separately from ordinary single-company requests. The [SEC describes nightly bulk archives](https://www.sec.gov/search-filings/edgar-application-programming-interfaces) as the efficient large-scale path.

**Acceptance:** Tests cover cache expiry, stale data, correction/removal, concurrent refresh, and maximum memory or storage use. A benchmarked backfill meets a declared throughput target while respecting SEC access limits. See [cache decision](../decisions/003-cache.md) and [endpoint inventory](../research/endpoint-inventory.md).

## PR-08 — Production-scale verification and monitoring

The deterministic suite uses a small set of real filers, and the live smoke test is separate from CI. Expand domestic, foreign, industry, amendment, and anomaly fixtures. Add scheduled, rate-limited live contract checks; load and failure-injection tests; performance budgets; and alerts for schema drift, coverage drops, stale data, and repeated SEC access failures. Keep live tests outside ordinary pull-request CI.

**Acceptance:** A documented compatibility matrix names supported filer and filing classes and has passing scenario tests. Scheduled checks report upstream changes without overwhelming SEC hosts. Release gates include the packed-package import, docs build, production dependency review, and measured load behavior. See the [release report](../release-report.md) and [fixture provenance](../research/data-anomalies.md).

## Updating this backlog

For a completed item, change its table status to **Done**, link the implementing commit or pull request and the passing acceptance tests, and update the linked research and decision records. Add newly discovered failure modes as new IDs; do not silently fold them into a completed item.
