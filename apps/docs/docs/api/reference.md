# API reference

Import `secEdgar` as the default factory or `{ createEdgarClient }` as a named export. Both accept the same options and return the same namespaces.

## Factory options

| Option              | Type            | Default                    | Meaning                                       |
| ------------------- | --------------- | -------------------------- | --------------------------------------------- |
| `userAgent`         | `string`        | required                   | Descriptive name and contact email            |
| `http`              | `HttpTransport` | Node fetch                 | Replaceable transport with `fetch(url, init)` |
| `cache`             | `Cache`         | bounded `MemoryCache(256)` | `get`, `set`, optional `delete`               |
| `requestsPerSecond` | number          | 5                          | Must be below 10 per client                   |
| `concurrency`       | integer         | 2                          | 1–8                                           |
| `retries`           | integer         | 2                          | 0–5                                           |
| `timeoutMs`         | number          | 15000                      | Request timeout                               |

## Companies

`companies.resolve({ ticker })`, `companies.resolve({ cik })`, `companies.search(name)`, and `companies.get(identifier)` read the SEC ticker exchange mapping and submissions metadata. `get` includes the original `submissions` object. CIKs in API responses are ten-digit strings. Ticker mappings are not guaranteed complete by the SEC.

## Filings

`filings.list({ cik, form?, from?, to?, limit? })` follows all referenced older submissions files, deduplicates accessions, and sorts newest first. `filings.iterate(query)` yields the list. `filings.get({ cik, accessionNumber })` finds a record. `filings.documents(...)` reads archive `index.json` and returns document metadata. `filings.documentText({ cik, accessionNumber, name })` retrieves a bounded XML, HTML, or text document. `filings.xbrlFacts({ cik, accessionNumber, name? })` extracts numeric facts from a filing `_htm.xml` instance with context, dimensions, and exact value; it does not normalize custom concepts.

## XBRL and raw

`xbrl.companyFacts({ cik })`, `xbrl.companyConcept({ cik, taxonomy, tag })`, and `xbrl.frame({ taxonomy, tag, unit, frame })` expose validated SEC JSON. Frames have **calendar** semantics. `raw.get({ source: 'data' | 'archive' | 'files', path })` returns original parsed JSON only for approved SEC paths.

## Financials

`financials.incomeStatement(query)`, `financials.balanceSheet(query)`, `financials.cashFlowStatement(query)`, and `financials.history({ ticker | cik, fromFiscalYear, toFiscalYear, kind, fiscalQuarter? })` return normalized statements. A query requires `fiscalYear`; optional `fiscalQuarter` is 1–4; `periodEnd` disambiguates multiple annual or transition reports in one calendar year. Options: `asOf` ISO filing cutoff, `revision: 'latest' | 'asFiled'`, `unit` three-letter currency, `precision: 'number' | 'string'`, `trace`, and `signal`.

Each `Statement` contains `company`, `period`, `currency`, `values`, `details`, `coverage`, `warnings`, and `unmappedConcepts`. `values` has stable fields and `null` for unavailable or unsafe numeric values. Each non-null detail contains `exactValue`, `unit`, `status`, `taxonomy`, `tag`, `start?`, `end`, and `source` with `accessionNumber`, `form`, `filed`, and `url`. A derived fact also contains two operands, each with its exact value, period, accession, filing date, and SEC URL. `coverage.status` is `complete` or `partial`; `missingFields`, `missingReasons`, and stable `missingCodes` identify unavailable canonical fields. Codes are `NO_COMPATIBLE_FACT`, `CONFLICTING_FACTS`, or `INCOMPATIBLE_REVISIONS`. With `trace: true`, `selectionTraces` includes considered facts and rejection reasons, including for missing fields. `unmappedConcepts` lists standard tags excluded from canonical mappings; the original data remains in `xbrl.companyFacts`.

Income fields: `revenue`, `costOfRevenue`, `grossProfit`, `operatingIncome`, `pretaxIncome`, `netIncome`, `incomeTaxExpense`, `earningsPerShareDiluted`. Cash-flow fields: `netCashFromOperations`, `netCashFromInvesting`, `netCashFromFinancing`, `capitalExpenditures` (a positive payment/outflow). Balance fields: `cash`, `receivables`, `inventory`, `currentAssets`, `totalAssets`, `currentLiabilities`, `longTermDebt`, `totalLiabilities`, `equity`. Direct exact-period facts outrank derivation. Within direct facts, `latest` ranks filing recency across approved aliases; `asFiled` prefers the target filing accession. The listed mapping order breaks equal-rank alias ties. Pure `selectFactResult` returns a selected fact or a stable refusal code, reason, and optional candidate trace; `selectFact` remains the fact-or-null convenience export. For YTD derivation, operands must share the filing `fy` cohort (or accession) and the prior fact must not be filed after the later fact. This cohort rule is a conservative client policy, not a proof of filing-level agreement. `earningsPerShareDiluted` is never derived.

## Error codes

`EdgarError` carries `code`, `url?`, `status?`, `retryable`, and `cause?`. Stable codes: `INVALID_INPUT`, `INVALID_PATH`, `ABORTED`, `TIMEOUT`, `NETWORK`, `HTTP_400`, `HTTP_403`, `HTTP_404`, `HTTP_408`, `HTTP_429`, `HTTP_5XX`, `HTTP_UNEXPECTED`, `REDIRECT`, `NETWORK_DNS`, `NETWORK_TLS`, `NETWORK_CONNECTION`, `DECOMPRESSION`, `BLOCKED_HTML`, `CONTENT_TYPE`, `EMPTY_BODY`, `MALFORMED_JSON`, `MALFORMED_XML`, `SCHEMA`, `NOT_FOUND`, `MISSING_HISTORY`, `PRECISION`, `UNSUPPORTED`, and `OVERSIZED`. Unknown fields are preserved in raw objects; malformed required structure raises `SCHEMA`.
