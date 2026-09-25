# ADR 017: Optional balance reconciliation

- **Date:** 2026-09-24
- **Status:** Accepted for one exact arithmetic check.

## Context

Selected balance facts can be missing, revised in different filings, or use parent-only equity while liabilities and assets cover the consolidated entity. [Realty Income evidence](../research/financial-semantics.md) demonstrates the noncontrolling-interest difference.

## Decision

`balanceSheet({validate: true})` checks `totalAssets = totalLiabilities + equity` using exact decimal arithmetic only when all three chosen instant facts share the same accession, end date, and currency. Prefer the standard total-equity tag including noncontrolling interest at equal ranking. Return `pass`, `fail` with exact difference, or `unavailable` with a reason; include operand source URLs. Never change source values or general field coverage because of this check.

## Alternatives considered

Silently adjust totals; validate using parent-only equity; compare mixed-filing or mixed-currency operands; claim accounting audit status.

## Rationale

Only like-for-like facts support the identity. A failed arithmetic check is useful evidence, not authority to rewrite a filing.

## Consequences

Other reconciliations and materiality/rounding policies are outside this check. `coverage.complete` remains canonical-field coverage, not filing validation. See [PR-05 research](../research/research-log.md) and [data anomalies](../research/data-anomalies.md).
