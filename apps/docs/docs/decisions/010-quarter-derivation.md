# ADR 010: Quarter derivation and revision cohorts

- **Date:** 2026-09-24 (revised 2026-09-24 for PR-01)
- **Status:** Accepted for the current implementation; broader filer validation remains in the production backlog.

## Context

Some [SEC company-facts responses](https://www.sec.gov/search-filings/edgar-application-programming-interfaces) contain year-to-date duration facts without a standalone quarterly fact. Recorded [Apple FY2025 revenue and cash-flow facts](../research/financial-semantics.md) have Q1, six-month, nine-month, and annual contexts, including later comparative filings. Independent selection of the two operands could mix incompatible revisions.

## Decision

Subtract only approved additive duration concepts with identical taxonomy, tag, unit, fiscal start, and requested boundary dates. Prefer a direct exact-quarter fact first. For derived Q2–Q4 values, select the later YTD fact under the requested revision policy. A prior YTD operand must be in the same accession or carry the same filing fiscal-year (`fy`) cohort and be filed no later than the later operand. Within that cohort use the revision policy; an eligible newer prior-period amendment filed after the later operand causes `INCOMPATIBLE_REVISIONS`, rather than fallback to an older prior value. Conflicting equal-source YTD values cause `CONFLICTING_FACTS`. Preserve both operands and all candidate reasons when tracing. `fy` groups filing cycles here; fact start/end dates still define the economic period.

## Alternatives considered

Never derive; subtract any matching dates; pick the latest operand for each boundary independently; fall back silently to an older coherent pair when the newest later fact cannot be paired.

## Rationale

The Apple real comparative facts demonstrate that a later filing cycle can supply both operands. The conservative cohort and chronology rule prevents the specific mixed-revision failure reproduced by the synthetic overlay fixture. The [SEC as-filed data guide](https://www.sec.gov/files/financial-statement-data-sets.pdf) notes that submissions may contain redundancies and inconsistencies; the aggregate provides no explicit revision graph.

## Consequences

Some quarters remain unavailable even when arithmetic could be performed. A shared `fy` and chronology are a client compatibility rule, not proof that two filings used identical accounting judgments; high-stakes consumers should inspect operands and source filings. EPS, weighted-average shares, ratios, and balance-sheet instants remain direct-only. See [PR-05](../backlog/production-readiness.md) for filing-level validation.

## Evidence

[Research log](../research/research-log.md), [financial semantics](../research/financial-semantics.md), [data anomalies](../research/data-anomalies.md), and fixture provenance in `test/fixtures/manifest.json`.
