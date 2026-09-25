# ADR 008: Revision policy and conflicting facts

- **Date:** 2026-09-24 (revised 2026-09-24 for PR-01)
- **Status:** Accepted for the current implementation; broader filer validation remains in the production backlog.

## Context

The [SEC company-facts API](https://www.sec.gov/search-filings/edgar-application-programming-interfaces) aggregates facts from multiple filings, including comparative periods. The [SEC financial data set guide](https://www.sec.gov/files/financial-statement-data-sets.pdf) also cautions that as-filed submissions can contain redundancies and inconsistencies. Recorded [Apple comparative rows](../research/financial-semantics.md) and [BayFirst's 10-K/A](../research/data-anomalies.md) show why array order and the first available fact are insufficient.

## Decision

For an exact requested period and unit, direct facts across approved canonical aliases outrank derived values. `latest` ranks eligible direct facts by filing date descending; `asFiled` first prefers the accession of the target-period filing and then ranks remaining facts by earliest filing date. Mapping order breaks equal-rank alias ties. `asOf` removes facts filed after the cutoff. Identical duplicate facts from one accession, filing date, form, context, tag, and unit are harmless. Different values at that same source and context are ambiguous and yield `CONFLICTING_FACTS` rather than an arbitrary winner. `selectFactResult` exposes a stable failure code, reason, and optional candidate trace; normalized statements include missing codes and traces when requested.

## Alternatives considered

Choose the first array row; always prefer mapping order ahead of filing recency; silently choose one of conflicting values; throw for a missing canonical field.

## Rationale

A later amendment can use another approved standard tag. Ranking direct facts across aliases lets a newer eligible revision win while keeping the original target accession available through `asFiled`. Ambiguous equal-source values cannot safely be resolved from the aggregate alone. Missing fields must leave the rest of a statement usable without inventing a value.

## Consequences

Historical output can change when SEC aggregates update. A conflicting field is `null` with an explicit reason and candidate trace, making statement coverage partial. The policy is a deterministic client interpretation, not an SEC guarantee that all aliases are semantically identical for every industry. See [PR-03](../backlog/production-readiness.md) for broader mapping validation.

## Evidence

[Research log](../research/research-log.md), [financial semantics](../research/financial-semantics.md), [data anomalies](../research/data-anomalies.md), and the recorded Apple/BayFirst fixtures in `test/fixtures/manifest.json`.
