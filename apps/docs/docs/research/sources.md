# Source register

Accessed 2026-09-24. URLs are primary sources except where marked ecosystem review.

| Source and publisher                | URL                                                                                   | Relevant evidence                                                                         | Implementation                           |
| ----------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------- |
| EDGAR public data APIs, SEC         | https://www.sec.gov/search-filings/edgar-application-programming-interfaces           | Submissions, company facts/concept, frames, update timing, entity-wide standard-tag scope | `companies`, `filings`, `xbrl`, selector |
| Accessing EDGAR Data, SEC           | https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data       | archive paths, indexes, ticker files, corrections/deletions, fair access                  | archive paths, lookup, transport         |
| Developer Resources, SEC            | https://www.sec.gov/about/developer-resources                                         | aggregate ten-per-second limit across machines                                            | limiter default and guide                |
| Webmaster FAQ, SEC                  | https://www.sec.gov/about/webmaster-frequently-asked-questions                        | declared user agent and blocks                                                            | transport errors                         |
| Financial Statement Data Sets, SEC  | https://www.sec.gov/data-research/sec-markets-data/financial-statement-data-sets      | as-filed face data and extraction limitations                                             | coverage boundary                        |
| Inline XBRL, SEC                    | https://www.sec.gov/data-research/structured-data/inline-xbrl                         | tagged filing format                                                                      | archive backlog                          |
| Node releases, Node.js              | https://nodejs.org/en/about/previous-releases                                         | Node 24 LTS in September 2026                                                             | package engine                           |
| Docusaurus installation, Docusaurus | https://docusaurus.io/docs/installation                                               | Node requirement and site tooling                                                         | docs package                             |
| Apple submissions, SEC              | https://data.sec.gov/submissions/CIK0000320193.json                                   | column arrays and Apple fiscal report dates                                               | fixture and periods                      |
| Apple company facts, SEC            | https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json                         | facts, units, Q2 duration/instant evidence                                                | fixture and statement tests              |
| Apple Q2 archive index, SEC         | https://www.sec.gov/Archives/edgar/data/320193/000032019325000057/index.json          | document metadata and source URLs                                                         | archive fixture                          |
| Apple net income concept, SEC       | https://data.sec.gov/api/xbrl/companyconcept/CIK0000320193/us-gaap/NetIncomeLoss.json | concept-level units                                                                       | concept fixture                          |
| Assets calendar frame, SEC          | https://data.sec.gov/api/xbrl/frames/us-gaap/Assets/USD/CY2025Q1I.json                | frame shape, calendar period                                                              | frame fixture                            |
| Apple ticker exchange mapping, SEC  | https://www.sec.gov/files/company_tickers_exchange.json                               | lookup fields/data arrays                                                                 | lookup fixture                           |
| EdgarTools, community project       | https://github.com/dgunning/edgartools                                                | Python direct-SEC feature comparison                                                      | ecosystem review                         |
| sec-api.io, commercial              | https://sec-api.io/                                                                   | hosted API positioning                                                                    | ecosystem review                         |

| Apple FY2023 10-K, SEC | https://www.sec.gov/Archives/edgar/data/320193/000032019323000106/aapl-20230930.htm | 53-week fiscal year | period tests |
| SAP FY2025 20-F, SEC | https://www.sec.gov/Archives/edgar/data/1000184/000110465926020058/sap-20251231x20f.htm | IFRS annual statements | EUR mapping test |
| ICMB 2024 10-KT, SEC | https://www.sec.gov/Archives/edgar/data/1578348/000095017025044673/icmb-20241231.htm | six-month year-end transition | period disambiguation |
| Apple Q2 filing XML, SEC | https://www.sec.gov/Archives/edgar/data/320193/000032019325000057/aapl-20250329_htm.xml | custom tag, context, unit, dimensions | XML extractor |
| Fast XML Parser, project docs | https://github.com/NaturalIntelligence/fast-xml-parser | XML validation and parsing options | archive parser dependency |
| Docusaurus Mermaid diagrams, Docusaurus | https://docusaurus.io/docs/markdown-features/diagrams | Mermaid theme setup | docs architecture diagrams |

| BayFirst 2025 10-K/A, SEC | https://www.sec.gov/Archives/edgar/data/1649739/000164973926000049/0001649739-26-000049.txt | Restated annual statements | revision fixture/test |
| BayFirst company facts, SEC | https://data.sec.gov/api/xbrl/companyfacts/CIK0001649739.json | Changed net income and assets | revision policy |

| Financial Statement Data Sets guide, SEC | https://www.sec.gov/files/financial-statement-data-sets.pdf | As-filed submissions can include amendments, redundancies, and inconsistencies | PR-01 conflict and revision decisions |
