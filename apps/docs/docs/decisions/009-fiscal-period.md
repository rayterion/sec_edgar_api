# ADR 009: Fiscal Period

- **Date:** 2026-09-24
- **Status:** Accepted for the current implementation; evidence gaps are tracked in the research log.

## Context

The public SEC client must expose useful financial data while respecting the endpoint behavior recorded in [research](../research/financial-semantics.md).

## Decision

Use annual, transition, and quarterly filing report dates to establish company fiscal periods and match fact start/end dates. Financial requests query submissions across a bounded filing-date window and follow only historical-file references whose documented range intersects it. An open-year Q1–Q3 request uses the prior annual report and quarter filings available by `asOf`; it does not require a future 10-K. When a year has multiple annual or transition ends, default to the latest and accept `periodEnd` for explicit selection. For a January or February annual report end, require `periodEnd`: the report-date calendar year and the SEC aggregate `fy` cannot independently prove the company's fiscal-year label. A gap greater than 125 days between annual/quarter report ends is treated as a missing or ambiguous quarter, so later reports cannot shift into an earlier quarter slot. Preserve actual dates; the guard is a conservative client heuristic, not an SEC calendar rule.

## Alternatives considered

Use calendar frames, `fy`/`fp`, or report-end calendar year alone; download every historical submissions file for each statement; assume every observed quarterly report is the next numbered quarter.

## Rationale

Apple fiscal Q2 appears in CY2025Q1I; metadata fields can describe a filing carrying comparative facts. Sportsman’s Warehouse calls the year ended 2026-01-31 fiscal 2025, while its 2025-02-01 and 2026-01-31 annual fact rows both carry `fy: 2025`. The SEC submissions root identifies older date ranges, and Apple FY2015 Q1–Q3 reside in its referenced history file.

## Consequences

Annual and Q4 requests require the target annual report. Open-year quarters require the prior annual report and enough filed quarter reports. Missing or ambiguous metadata raises an explicit error. January/February year-end companies need an explicit `periodEnd`; the client does not auto-identify their fiscal label. The 125-day gap guard can reject unusual reporting calendars. More transition and changed-year-end fixtures remain needed. Revisit this record when new fixtures contradict its assumptions.

## Evidence

[Research finding](../research/financial-semantics.md); [source register](../research/sources.md).
