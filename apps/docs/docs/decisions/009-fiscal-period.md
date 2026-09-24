# ADR 009: Fiscal Period

- **Date:** 2026-09-24
- **Status:** Accepted for the current implementation; evidence gaps are tracked in the research log.

## Context

The public SEC client must expose useful financial data while respecting the endpoint behavior recorded in [research](../research/financial-semantics.md).

## Decision

Use annual, transition, and quarterly filing report dates to establish company fiscal periods and match fact start/end dates. An open-year Q1–Q3 request uses the prior annual report and quarter filings available by `asOf`; it does not require a future 10-K. When a year has multiple annual or transition ends, default to the latest and accept `periodEnd` for explicit selection.

## Alternatives considered

Use calendar frames or fy/fp alone.

## Rationale

Apple fiscal Q2 appears in CY2025Q1I; metadata fields can describe a filing carrying comparative facts.

## Consequences

Annual and Q4 requests require the target annual report. Open-year quarters require the prior annual report and enough filed quarter reports. Missing metadata raises an explicit error; complex fiscal changes need more tests. Revisit this record when new fixtures contradict its assumptions.

## Evidence

[Research finding](../research/financial-semantics.md); [source register](../research/sources.md).
