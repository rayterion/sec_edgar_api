# Data anomalies and failure cases

| Observation                                                                               | Reproduction / fixture                                           | Expected handling                                         | Status                                             |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------- |
| Apple Q2 revenue appears in the same filing as both six-month and three-month facts       | `apple-companyfacts-fy2025.json`, accession 0000320193-25-000057 | Exact start/end selects direct quarter                    | Tested 2026-09-24                                  |
| Apple Q2 assets have calendar frame `CY2025Q1I` although the company calls this fiscal Q2 | same fixture                                                     | Fiscal period comes from report dates and instant end     | Tested 2026-09-24                                  |
| Duplicate/comparative facts may appear in later filings                                   | same fixture, synthetic late amendment in test                   | `latest`, `asFiled`, and `asOf` deterministic             | Synthetic edge test; broader live amendment needed |
| SEC may return HTML instead of JSON or access denial                                      | synthetic `blocked-html.txt` based on documented webmaster issue | `BLOCKED_HTML`, no plausible financial value              | Tested 2026-09-24                                  |
| Mismatched submissions column lengths                                                     | synthetic test                                                   | `SCHEMA`                                                  | Tested 2026-09-24                                  |
| Unsafe JSON integer magnitude                                                             | synthetic test with `9007199254740993`                           | preserve exact string; numeric mode warns/returns null    | Parser tested 2026-09-24                           |
| Filing removed after appearing in index                                                   | SEC documents post-acceptance removals                           | archive request surfaces HTTP 404; no fabricated document | Test pending                                       |

| Apple FY2023 spans 371 days | `apple-fy2023-53week-*` | Preserve actual dates, no 365-day assumption | Tested 2026-09-24 |
| ICMB has two annual/transition ends in calendar 2024 | `icmb-fiscal-transition-submissions.json` | Default latest end, allow `periodEnd` | Tested 2026-09-24 |
| SAP reports IFRS facts in EUR and USD | `sap-fy2025-ifrs-companyfacts.json` | Select requested unit only | Tested 2026-09-24 |
| Apple filing XML contains custom and dimensional facts | `apple-custom-xbrl-sample.xml` | Expose context-aware raw facts; no false canonical mapping | Tested 2026-09-24 |

| BayFirst 2025 10-K/A changes annual net income and assets | `bayfirst-amended-fy2025-*` | Latest amendment wins; `asFiled` and `asOf` recover original | Tested 2026-09-24 |

The synthetic fixtures are marked as such in the manifest. SEC corrections and deletions can make cached data stale; default TTLs are finite.

| Synthetic late Q1 amendment after an Apple comparative Q2 YTD filing | `selection-anomalies.json` overlay on recorded Apple company facts | Refuse cross-revision subtraction with `INCOMPATIBLE_REVISIONS`; `asOf` and `asFiled` retain compatible pairs | Tested 2026-09-24; synthetic, not an SEC observation |
| Synthetic duplicate and conflicting values in one source/context | `selection-anomalies.json` overlay | Accept identical duplicates; refuse differing direct or YTD values with `CONFLICTING_FACTS` | Tested 2026-09-24; synthetic, not an SEC observation |
| Synthetic later direct revision under an alternate approved tag | `selection-anomalies.json` overlay | `latest` selects later direct fact across aliases; `asFiled` retains target filing | Tested 2026-09-24; synthetic, not an SEC observation |
