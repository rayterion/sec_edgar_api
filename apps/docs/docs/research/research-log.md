# Research log

## 2026-09-24: Public API contracts and access policy

**Question.** Which public SEC surfaces can support a local Node client, and what request policy applies?

**Method.** Read the SEC public API, EDGAR access, developer resources, webmaster FAQ, financial data sets, and Inline XBRL pages. Requested the Apple submissions, company facts, company concept, calendar frame, ticker exchange lookup, archive index, and an XBRL instance with a declared contact `User-Agent`. Saved compact excerpts in `test/fixtures/`.

**Findings.** `data.sec.gov` exposes submissions and standardized entity-wide XBRL facts with no API key. Submissions use column arrays and refer to older files. Frames are calendar aligned. SEC guidance caps aggregate access at 10 requests per second and asks for an identifying `User-Agent`. Archive `index.json` lists filing documents. Apple's fiscal 2025 Q2 report date is 2025-03-29; revenue appears as both a six-month and standalone three-month fact in the same 10-Q. Its assets fact has an end date and no start date. See [source register](sources.md) and [financial semantics](financial-semantics.md).

**Uncertainty and follow-up.** The SEC does not promise ticker mapping accuracy or completeness. The current normalized statement mapping has been proven against Apple, but not against enough IFRS, bank, insurer, 53-week, or changed-year-end filings. Those cases remain release blockers. The public JSON excludes custom or dimensional facts; filing-level XML can improve coverage only when parsed with full context and units. Browser access to the Apple submissions endpoint failed in one web tool; direct declared-agent requests succeeded. Do not infer general availability from one request.

## 2026-09-24: Node and docs baseline

Node's release page listed 24 as LTS and 26 as Current. Docusaurus installation documentation required Node 20 or newer. Node 24 is the baseline. A temporary Node 24.21.0 runtime was downloaded for local verification because the shell image did not provide Node.

## 2026-09-24: npm name

A registry GET for `sec-edgar-api` returned HTTP 200 and `@sec-edgar/research-client` returned HTTP 404. The scoped name is provisional: 404 does not establish ownership or permission to publish under that scope. Rename the package before publication under an owned scope.

## 2026-09-24: 53-week, IFRS, transition, and filing XML follow-up

**Method.** Captured Apple FY2023 (53 weeks), SAP 2025 20-F IFRS facts in EUR, ICMB 2024 10-KT after moving year-end from June to December, and a context/unit/custom-tag excerpt from Apple's Q2 2025 XBRL instance. Parsed the full Apple instance in a separate live smoke check (674 numeric facts, including custom and dimensional entries).

**Findings.** Apple FY2023 ran 2022-09-25 through 2023-09-30 (371 days). SAP has `ifrs-full` concepts and both EUR and USD units; explicit EUR selection prevents mixing. ICMB filed a June 2024 annual report and December 2024 six-month transition report, so fiscal year alone can be ambiguous. The API now accepts `periodEnd`; default picks the latest report end in that year and marks a 10-KT period as `transition`. XBRL XML extraction can expose standard and custom numeric facts with context, units, dates, and dimensions. It does not equate custom tags with canonical fields.

**Remaining uncertainty.** Broad industry mappings, further restatements, full Inline XBRL extraction beyond `_htm.xml` instances, and cash-flow statements remain unverified.

## 2026-09-24: Cash-flow duration facts

**Method.** Re-read Apple company facts for operating, investing, financing, and property/plant/equipment payment concepts for FY2025. Added those exact SEC entries to `apple-companyfacts-fy2025.json` and tested annual and derived Q2/Q4 values.

**Finding.** Apple reports fiscal-year-to-date cash-flow totals for Q1, Q2, Q3, and FY; the selected operating cash-flow Q2 quarter is 53,887,000,000 minus 29,935,000,000 = 23,952,000,000 USD. Q4 is 111,482,000,000 minus 81,754,000,000 = 29,728,000,000 USD. These concepts are additive; the result records both operands and their SEC accessions. IFRS cash-flow mapping remains unverified.

## 2026-09-24: Real amended annual values

**Method.** Read BayFirst Financial Corp.'s 2025 10-K/A and captured the original 10-K and amended 10-K rows and company facts. The amended filing states it restates financial statements.

**Findings.** For the exact 2025 annual duration, `NetIncomeLoss` changed from -22,937,000 USD (10-K filed 2026-03-27) to -24,565,000 USD (10-K/A filed 2026-08-12). Instant assets at 2025-12-31 changed from 1,300,258,000 to 1,294,269,000 USD. The default selects the amendment; `asFiled` and an `asOf` before the amendment select the original. Fixtures and tests are dated.

**Selection correction.** An exact direct fact in a later mapping alias now outranks a derived value in the first alias. `asOf` limits eligible facts, while current submissions metadata identifies historical fiscal boundaries; it does not reconstruct a complete historical SEC API snapshot. Missing canonical fields now carry field-specific reasons.

## 2026-09-24: Open fiscal year and as-of metadata

**Method.** Replayed the recorded Apple submissions fixture with filings after 2025-05-02 excluded. FY2025 Q2 remained observable (2025-03-29 report, filed 2025-05-02), while its FY2025 10-K did not yet exist. The regression test initially failed because period discovery required that later 10-K.

**Finding and decision.** For Q1–Q3 of an open year, anchor the fiscal start to the preceding filed annual report and use quarter reports filed by `asOf`. Annual and Q4 periods still require the target annual report. This is deterministic reconstruction from available metadata, not an SEC historical snapshot. See [ADR 009](../decisions/009-fiscal-period.md).

## 2026-09-24: PR-01 revision compatibility and conflicting facts

**Question and method.** Rechecked the [SEC public XBRL API description](https://www.sec.gov/search-filings/edgar-application-programming-interfaces) and [SEC as-filed data guide](https://www.sec.gov/files/financial-statement-data-sets.pdf). Compared the recorded Apple FY2025 original/Q1–Q3 FY2026 comparative rows and BayFirst original/amended annual rows. Added a manifest-labeled synthetic overlay with a later Q1 amendment, equal-source conflicting values, and an alternate-tag revision; these overlays are tests, not claims about actual Apple filings.

**Finding.** Apple comparative rows for the same economic FY2025 periods can carry filing `fy=2026`, demonstrating that `fy` identifies a filing cycle rather than the fact's economic period. BayFirst's real 10-K/A changes exact-period values. The SEC guide warns that as-filed submissions can contain redundant or inconsistent data. The JSON aggregate does not provide an explicit cross-filing revision graph.

**Decision and verification.** Direct exact-period facts rank across approved aliases by revision policy before any derivation. For additive YTD subtraction, require equal tag/unit/dates, a shared accession or filing `fy` cohort, and prior filing chronology. Conflicting equal-source values or a later prior-boundary amendment make the field unavailable with a stable code and trace. Tests cover real comparative and amended rows plus the synthetic unsafe cases. See [ADR 008](../decisions/008-revision-policy.md) and [ADR 010](../decisions/010-quarter-derivation.md).

**Remaining uncertainty.** Matching filing cohort and chronology cannot prove that separate filings used exactly the same accounting basis. Filing-level validation remains open under PR-05.
