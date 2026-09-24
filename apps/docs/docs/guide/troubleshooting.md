# Troubleshooting

| Symptom                                         | Action                                                                                                                                                                      |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BLOCKED_HTML` or `HTTP_403`                    | Use a real organization and contact email in `userAgent`; reduce traffic and check the [SEC webmaster FAQ](https://www.sec.gov/about/webmaster-frequently-asked-questions). |
| `HTTP_429`                                      | Lower `requestsPerSecond`; coordinate multiple processes or machines.                                                                                                       |
| Missing field                                   | Inspect `coverage.missingFields`, requested unit, and `xbrl.companyFacts`. It may be a custom or dimensional tag absent from public JSON.                                   |
| Stale facts                                     | Default cache TTLs are finite; a replacement cache can implement explicit invalidation. SEC submissions and XBRL updates may differ in time.                                |
| `SCHEMA` or `MALFORMED_JSON`                    | Record the URL and response shape, then add a compact fixture and test before adapting the parser.                                                                          |
| Archive `HTTP_404`                              | SEC may correct or remove filings; refresh submissions and do not assume prior index entries still exist.                                                                   |
| `values` field is `null` with precision warning | Read `details.field.exactValue` or request `precision: 'string'`.                                                                                                           |
