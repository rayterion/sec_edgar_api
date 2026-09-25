# Tested compatibility matrix

This matrix names the cases covered by deterministic fixtures and tests. It is a bounded support claim, not a guarantee for every filing in a class. Source URLs and capture dates are in the fixture manifest (`test/fixtures/manifest.json`) and [research log](../research/research-log.md).

| Filing or data class   | Recorded example                                    | Tested behavior                                                     | Boundary                                         |
| ---------------------- | --------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------ |
| Domestic 10-K and 10-Q | Apple FY2025                                        | Annual, Q1–Q4, direct/derived income, quarter-end assets, cash flow | Standard entity-wide tags                        |
| Historical submissions | Apple FY2015 older file                             | Pagination, selective history, annual/Q1–Q4 and balance             | Referenced JSON history only                     |
| Amended 10-K/A         | BayFirst FY2025                                     | Latest, `asFiled`, `asOf`, changed income/assets                    | Other amendments need fixtures                   |
| 53-week year           | Apple FY2023                                        | Actual dates retained                                               | Other unusual calendars may require explicit end |
| 20-F IFRS              | SAP FY2025                                          | EUR revenue, taxonomy/unit lineage                                  | Broader IFRS mappings partial                    |
| Transition 10-KT       | ICMB 2024                                           | Six-month transition, explicit period end                           | Other transitions unverified                     |
| Bank                   | JPMorgan FY2025                                     | Net interest income and deposits                                    | Sector profile is not universal                  |
| Insurer                | Allstate FY2025                                     | Premiums and claim reserves                                         | Sector profile is not universal                  |
| REIT                   | Realty Income FY2025                                | Lease income, investment property, total equity reconciliation      | Sector profile is not universal                  |
| Investment company     | ICMB FY2025                                         | Gross investment income and investments at fair value               | Fund series/class lookup remains raw             |
| Filing XML             | Apple FY2025 Q2                                     | Custom/dimensional numeric extraction                               | Not mapped to canonical fields                   |
| Inline HTML            | Apple FY2025 Q2                                     | Scale, sign, nil, context, custom/dimensions                        | Limited transform set                            |
| SEC bulk ZIP payload   | Recorded Apple JSON wrapped in generated ZIP        | CIK shape, unsafe names, size bounds, selective import              | Full official ZIP not downloaded                 |
| Access failures        | Synthetic blocked HTML/429/404 and malformed bodies | Typed errors, circuit, retry, invalidation                          | Future SEC shapes remain unknown                 |

The weekly live suite checks a small subset of domestic, IFRS, and bank classes at one request per second. Ordinary CI uses only recorded fixtures and generated failure cases. The [coverage matrix](../research/endpoint-inventory.md) tracks official sources separately from these filer classes.
