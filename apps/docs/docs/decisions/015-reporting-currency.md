# ADR 015: Reporting currency

- **Date:** 2026-09-24
- **Status:** Accepted for the tested standard-fact scope.

## Context

Company facts group values by unit; defaulting to USD makes a foreign filer look plausibly partial and may hide its primary facts. [PR-03 research](../research/research-log.md) records SAP and four USD industry filers.

## Decision

Without `unit`, inspect exact-period monetary anchors in the target filing. Accept one three-letter currency when all eligible anchors agree. If none or several qualify, raise `AMBIGUOUS_CURRENCY` and require an explicit `unit`. An explicit unit filters facts; it never converts values. The returned `currency` is the selected/requested unit, and each line retains its own unit.

## Alternatives considered

Default USD; choose the largest amount or most numerous unit; infer currency from domicile or ticker.

## Rationale

Those shortcuts can silently select the wrong unit. The [SEC API](https://www.sec.gov/search-filings/edgar-application-programming-interfaces) explicitly exposes multiple units per concept.

## Consequences

Some filers require `unit`, and an explicit unit may yield a partial statement. Currency detection is a conservative inference from supported standard facts, not a universal presentation-currency guarantee. See [financial semantics](../research/financial-semantics.md).
