# Fiscal periods, selection, and lineage

```mermaid
flowchart TD
  A[Requested fiscal year and quarter] --> B[Submissions report dates]
  B --> C[Exact start and end]
  C --> D[Company facts candidates]
  D --> E{Direct matching fact?}
  E -- Yes --> F[Rank periodic filings by revision policy]
  E -- No, additive duration --> G[Compatible YTD operands]
  E -- No, other --> H[null and coverage warning]
  F --> I[Value and source detail]
  G --> I
```

The Apple FY2025 Q2 period runs 2024-12-29 through 2025-03-29. The [SEC company facts response](https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json) reports revenue for that exact three-month duration and for six months beginning 2024-09-29. The direct quarter wins. A direct fact from any supported mapping alias wins before a derived value is attempted. If it were absent, the approved additive revenue concept could use six-month revenue minus first-quarter revenue. The result records both operands. Balance sheet assets at 2025-03-29 are an instant fact and are never subtracted. `CY2025Q1I` on the SEC frame is a calendar label, not Apple's fiscal quarter.

`latest` considers exact-period facts in later periodic filings and chooses the latest eligible filing. `asFiled` prefers the target filing accession. `asOf` excludes facts filed later than a cutoff date while current submissions metadata establishes the fiscal boundaries; it is not a historical API snapshot. Every chosen detail includes taxonomy, tag, unit, start/end, accession, form, filing date, and a full-submission archive URL. Set `trace: true` to see considered candidates and their rejection reasons. If statement fields come from several filings, a warning says so.

Selection requires the same unit for all derived operands. The result's `currency` is the requested three-letter unit, default `USD`; specify `EUR` for euro filings. No conversion occurs. Non-additive EPS is direct-only. Other unmapped standard concepts remain discoverable via `unmappedConcepts` and `xbrl.companyFacts`.

BayFirst's 2025 net income is -22,937,000 USD in the original 10-K and -24,565,000 USD in its later 10-K/A. `latest` selects the latter; `asFiled` selects the original. See the [restatement research](../research/financial-semantics.md).
