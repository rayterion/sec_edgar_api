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

## 2026-09-24: PR-02 historical submissions and fiscal labels

**Question and method.** Rechecked [SEC public API documentation](https://www.sec.gov/search-filings/edgar-application-programming-interfaces) and [EDGAR data access guidance](https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data). Requested current Apple and Sportsman’s Warehouse submissions and company-facts JSON with an identifying User-Agent, saved compact rows with source/date provenance, and checked Sportsman’s 10-K narrative against its XBRL metadata. Added regression tests before changing period discovery.

**Findings.** Apple's FY2015 10-K is still in recent submissions, but Q1–Q3 and its prior annual filing are in the referenced older file. Sportsman’s fiscal 2025 ended in calendar 2026; both its FY2024 and FY2025 annual fact rows expose `fy: 2025`. Thus neither report-end calendar year nor aggregate `fy` alone establishes the narrative fiscal-year label. The SEC root provides older-file `filingFrom`/`filingTo` ranges that permit selective retrieval. See [financial semantics](financial-semantics.md) and `test/fixtures/manifest.json`.

**Decision and verification.** Statement discovery now uses a bounded filing-date window and fetches intersecting older files. January/February annual ends require explicit `periodEnd`; a >125-day observed quarter gap fails rather than shifting quarter numbers. Recorded Apple FY2015 annual/Q1–Q4, Q2 balance, historical `asOf` before its annual report, Sportsman’s annual/Q1–Q4 with explicit end, historical-file filtering, malformed ranges, and a missing-Q2 simulation pass deterministic tests.

**Remaining uncertainty.** The 125-day guard can reject unusual quarters; it is a safety heuristic, not an SEC guarantee. Automatic company fiscal labels for January/February reporters, broader short-quarter transitions, and filing-level validation remain open research topics. A named `periodEnd` is required in the documented ambiguous case.

## 2026-09-24: PR-03 currencies and industry fields

**Question and method.** Re-read the [SEC public XBRL API](https://www.sec.gov/search-filings/edgar-application-programming-interfaces), which groups company facts by unit and limits the JSON aggregates to standard, entity-wide tags. Requested current submissions and company facts for JPMorgan Chase (CIK 0000019617), Allstate (0000899051), Realty Income (0000726728), ICMB (0001578348), and the existing SAP IFRS example (0001000184). Inspected annual accessions, exact periods, units, and tags. Saved compact, dated excerpts in `test/fixtures/`.

**Findings.** JPMorgan's FY2025 10-K reports `InterestIncomeExpenseNet` of 95,443,000,000 USD. Allstate reports `PremiumsEarnedNet` of 61,449,000,000 USD. Realty Income reports `LeaseIncome` of 5,437,332,000 USD and total equity including noncontrolling interest of 40,123,968,000 USD; parent-only equity is 39,438,695,000 USD. ICMB reports `GrossInvestmentIncomeOperating` of 17,396,235 USD. SAP's FY2025 `ifrs-full:Revenue` is 36,800,000,000 EUR. These fields are not interchangeable: a fund's investment income is not silently called revenue.

**Decision and tests.** Derive default currency only when exact-period monetary anchors in the target filing agree on one three-letter unit; otherwise return `AMBIGUOUS_CURRENCY` and require `unit`. An explicit unit can produce a partial statement. Expose separately named bank, insurance, REIT, and investment-company fields with exact source details. Prefer total equity including noncontrolling interest where available for the canonical balance equity field. Recorded fixtures and synthetic conflicting/absent-unit overlays cover these policies. See [ADR 007](../decisions/007-mapping.md) and [ADR 015](../decisions/015-reporting-currency.md).

**Uncertainty.** The anchors cannot prove an issuer's presentation currency in every filing. Some entities have multiple currencies in one filing, custom tags, or no eligible standard fact. These cases require an explicit unit or remain partial. The industry profiles are tested examples, not a universal classification of every issuer.

## 2026-09-24: PR-04 reproducible responses

**Question and method.** Rechecked SEC timing and coverage notes in the [public API guide](https://www.sec.gov/search-filings/edgar-application-programming-interfaces) and removal/correction discussion in [Accessing EDGAR Data](https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data). Replayed recorded SEC fixtures through a recording transport, changed a compact fact in a synthetic overlay, and simulated a later HTTP 404.

**Findings and decision.** Submissions and XBRL aggregates may update on different schedules; `asOf` filters the current aggregate and does not reconstruct an immutable historical view. A `SecSnapshot` records URL, retrieval time, response status, content type, UTF-8 response body, SHA-256, and whether the body was captured. Successful inputs can be exported as JSON and replayed offline with integrity validation. Error statuses are recorded without their body (`bodyCaptured: false`), so their status changes are observable but their payload is not replayed byte-for-byte. A missing replay URL fails closed. Statements include evaluation time, source evidence, and mapping/selection versions; external cache entries lacking retrieval metadata make audit completeness false. See [ADR 016](../decisions/016-response-snapshots.md).

**Verification and limits.** Replay produces the same `values` and `details` from recorded inputs without network calls. SHA-256 detects accidental change but is not an authenticity signature. A missing URL from a second capture means only that it was not captured; an observed 404 indicates removal. Recording a response does not guarantee that SEC will keep publishing it.

## 2026-09-24: PR-05 Inline facts and reconciliation

**Question and method.** Read the [SEC August 2026 EDGAR XBRL Guide](https://www.sec.gov/files/edgar/filer-information/specifications/xbrl-guide.pdf), the [XBRL International Inline XBRL specification](https://specifications.xbrl.org/work-product-index-inline-xbrl-inline-xbrl-1.1.html), and [Apple's FY2025 Q2 Inline filing](https://www.sec.gov/Archives/edgar/data/320193/000032019325000057/aapl-20250329.htm). Captured original `ix:nonFraction` elements and their contexts/units in a compact wrapper. Verified scale, `sign`, `xsi:nil`, custom taxonomy, and explicit dimension examples against the original filing.

**Findings and decision.** Apple's assets fact displays `331,233` with scale 6, yielding exactly 331,233,000,000 USD; a signed nonoperating fact displays `279` with scale 6 and sign `-`; a nil commitments fact has no number; a product-axis revenue fact is dimensional. Parse bounded Inline HTML documents with `htmlparser2`, preserve context and source URL, and support plain decimals plus verified dot/comma decimal and fixed-zero transforms. Unknown transforms and nested numeric content receive `status: unsupported` with null value and reason. Do not map custom or dimensional facts into canonical fields. When `_htm.xml` is absent, use the filing's primary HTML document after confirming it exists in the archive index.

Optional balance validation compares exact assets, liabilities, and total equity only when selected facts share accession, unit, instant end, and an available source. A discrepancy is reported with exact decimal difference and source URLs; no SEC value is changed. Missing or mixed-revision operands make the check unavailable. See [ADR 011](../decisions/011-archive-parsing.md) and [ADR 017](../decisions/017-balance-validation.md).

**Uncertainty.** Inline XBRL has additional transformation registries, continuations, nested facts, tuples, and multi-document cases; the parser marks unsupported numeric transformations unavailable and does not claim full Inline conformance. Reconciliation is one arithmetic consistency check, not an audit of the filing or accounting policy.

**Industry balance follow-up.** Rechecked the same four 2025 company-facts responses for exact instant facts in the target 10-K accession. JPMorgan deposits are 2,559,320,000,000 USD; Allstate claims and adjustment expense liability is 41,079,000,000 USD; Realty Income investment property net is 53,413,903,000 USD; ICMB investments at fair value are 172,658,862 USD. Added those real rows to the compact fixtures and independent balance-profile tests. These fields remain separate from general assets and liabilities.

## 2026-09-25: PR-06–08 server operation and nightly bulk

**Question and method.** Rechecked the [SEC developer resources](https://www.sec.gov/about/developer-resources), [privacy and security policy](https://www.sec.gov/about/privacy-information), and [public API bulk documentation](https://www.sec.gov/search-filings/edgar-application-programming-interfaces). The SEC still states an aggregate maximum of ten requests per second across machines and says the company-facts and submissions ZIPs are republished nightly. Sent declared-agent HEAD requests, then fetched only the last 64 KiB of each official ZIP with HTTP range requests; no full archive was downloaded. Parsed ZIP end records for entry counts. Read [yauzl's streaming/lazy-entry documentation](https://github.com/thejoshwolfe/yauzl) before choosing a bounded local importer.

**Observed 2026-09-25 UTC.** `companyfacts.zip` returned HTTP 200, `content-length: 1,409,389,023`, `last-modified: 2026-09-24 04:24:14 GMT`, and range support; its ZIP footer listed 20,396 entries. `submissions.zip` returned HTTP 200, `content-length: 1,565,294,470`, `last-modified: 2026-09-24 04:31:44 GMT`, and range support; its ZIP64 footer listed 991,556 entries. Tail entries in both archives were root-level `CIK##########.json`. These are volatile observations, not permanent SEC size guarantees. The limited range did not verify every entry or the complete archive's integrity.

**Decisions and verification.** The default process reservation now spaces starts at eight per second after an 18-request rolling-window test showed that nine-per-second spacing could produce ten starts in one second. The optional `FileRateLimiter` coordinates processes sharing one atomic-lock file; an external `SharedRateLimiter` can coordinate separate machines. Queues have a bound and cancellation; repeated 403/429/5xx responses open a configurable circuit. `FileCache` stores atomic bounded entries with expiry and response provenance. A local ZIP importer uses strict names, per-entry and total decompression bounds, and optional CIK filtering. Its defaults exceed the observed current ZIP sizes and counts. Synthetic ZIPs carrying recorded SEC JSON shapes cover imports; a 100-entry local test completes under a declared two-second budget. A weekly, one-request-per-second live contract workflow is separate from pull-request CI. See [ADRs 018](../decisions/018-shared-traffic.md), [019](../decisions/019-persistent-cache-bulk.md), and [020](../decisions/020-operational-monitoring.md).

**Uncertainty and follow-up.** The full nightly ZIPs were not downloaded or fully parsed, so complete-import throughput and every internal entry variant remain unverified. The file limiter depends on one shared filesystem with reliable atomic directory creation; multi-host organizations need their own shared limiter adapter. The scheduled live workflow requires a repository `SEC_USER_AGENT` secret and has not yet produced a scheduled run in this checkout. Health alerts are local signals returned to callers; deployment-specific alert delivery remains the operator's responsibility.

## 2026-09-25: Documentation deployment

**Question and method.** Checked the current [Docusaurus deployment guide](https://docusaurus.io/docs/deployment), [GitHub Pages publishing-source guide](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site), [custom workflow guide](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), and the official `configure-pages` action input definition. Queried the public repository Pages API; it returned HTTP 404 before configuration. Inspected the existing Docusaurus build and observed `https://example.invalid/` canonical links and root-relative assets.

**Findings and decision.** Repository project sites use the owner origin and `/<repository>/` base path. The official custom workflow builds static files, uploads a Pages artifact, and deploys with `pages: write` plus `id-token: write`. `configure-pages` can enable Pages only with a token other than the workflow's default `GITHUB_TOKEN`; repository settings must first select GitHub Actions as the publishing source. Use the project path in Docusaurus and a separate Pages workflow. See [ADR 021](../decisions/021-documentation-hosting.md).

**Verification and open gate.** A generated-site test checks canonical, CSS, and JavaScript URLs under `/sec_edgar_api/`; local build and root scripts are tested. The public Pages URL and remote deploy must still be verified after repository configuration.

## 2026-09-26: npm v1 distribution

**Question and method.** Verified `npm whoami` in the project shell returned `rayterion`. Queried the npm registry for `@rayterion/sec-edgar`; it returned HTTP 404 before publication. Read npm's [scoped public package instructions](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/), [scope ownership description](https://docs.npmjs.com/about-scopes/), and [2FA publishing requirements](https://docs.npmjs.com/requiring-2fa-for-package-publishing-and-settings-modification/). Ran `npm publish --dry-run --json --workspace packages/sec-edgar` with fnm-managed Node 24.21.0.

**Findings and decision.** Use the publisher-owned `@rayterion` scope and publish `@rayterion/sec-edgar@1.0.0` with public access. A registry 404 alone does not reserve the name; the actual publish must establish availability. The dry run contained 47 files (34,953 packed bytes): compiled ESM, declarations, manifest, README, and MIT license. The package `prepack` script rebuilt output before packing. `npm run check` passed, including a clean consumer import from the packed tarball.

**Operational limit.** The first actual `npm publish` attempt returned `E403`: 2FA or a granular token with bypass permission is required. This historical attempt was abandoned when the distribution decision changed to GitHub tags. No npm registry artifact was created.

## 2026-09-26: GitHub Pages live verification

**Method and finding.** [Docs Pages run 36210634709](https://github.com/rayterion/sec_edgar_api/actions/runs/36210634709) completed successfully after repository Pages activation. A direct GET of `https://rayterion.github.io/sec_edgar_api/` returned HTTP 200 and Docusaurus HTML. The v1 source commit also passed [Docs Pages run 36211645644](https://github.com/rayterion/sec_edgar_api/actions/runs/36211645644) and [CI run 36211645682](https://github.com/rayterion/sec_edgar_api/actions/runs/36211645682). See [ADR 021](../decisions/021-documentation-hosting.md) and the [website guide](../guide/website.md).

## 2026-09-26: npm first-publish authentication failure

**Observation.** The account owner ran the public `@rayterion/sec-edgar@1.0.0` publish with a private 2FA code. The npm debug log recorded two expected pre-publication GET 404 responses followed by `PUT https://registry.npmjs.org/@rayterion%2fsec-edgar` returning HTTP 404. No version appeared in the public registry afterward. The response did not distinguish a package-name restriction from an authorization failure. Do not interpret the pre-publication GET 404 as proof of name ownership or publish permission.

**Follow-up.** At a later check, `npm whoami` and `npm profile get` returned E401: the saved credential was then invalid. This does not prove it was invalid at the earlier PUT. A fresh `npm login --auth-type=web` was started, but its browser authorization timed out and the CLI was canceled without entering credentials. Repeat login when the account owner is ready, confirm `npm whoami`, and publish immediately with 2FA. If the PUT still returns 404 while authentication is valid, inspect account/scope permissions and contact npm support with a redacted request ID rather than silently changing the release name.

## 2026-09-26 GitHub tag distribution

**Question and method.** Checked npm's Git dependency and lifecycle documentation against this workspace layout. A `github:owner/repo#tag` dependency installs the package at the repository root; a tag of `main` would expose the private workspace manifest instead of the library. A standalone root-installable release tree is therefore required. The build script strips development and publication settings but keeps runtime dependencies, compiled ESM/declarations, license, README, and a source-commit link.

**Decision.** Use a dedicated release commit tagged `v1.0.0`. Keep source and tests on `main`. The standalone example pins the GitHub tag, and its lockfile should pin the resolved commit. The library itself will not be sent to npm; its runtime dependencies still use npm unless consumers configure another registry. See [ADR 014](../decisions/014-distribution.md).

**Verification and uncertainty.** Local assembly tests cover manifest and required output. The public annotated tag was pushed and resolves to release commit `e0d3bddd67ca3bbbd5a56d1acc753a005fdbd242`, assembled from source commit `81ae9902ad22aaf0f732233f22c52d0812017c35`. `npm ci` in the standalone app and ESM imports passed. A new temporary consumer with `GIT_SSH_COMMAND=false` and an empty cache also installed the tag, confirming public access without an SSH key. GitHub availability remains an operational dependency.
