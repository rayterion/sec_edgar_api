# Currency and industry-specific fields

The client selects a default reporting currency only when exact-period monetary anchors in the selected filing agree on one three-letter unit. Otherwise it raises `AMBIGUOUS_CURRENCY`. Pass `unit` to state your choice; no exchange-rate conversion occurs, and a chosen unit may leave fields `null`.

```js
import { createEdgarClient } from "@sec-edgar/research-client";

const edgar = createEdgarClient({
  userAgent: "Example Research contact@example.com",
});
const income = await edgar.financials.incomeStatement({
  ticker: "AAPL",
  fiscalYear: 2025,
});
console.log(income.currency, income.details.revenue?.unit);
```

Income and balance statements can include `industry` with a separate `profile`, `values`, `details`, and `missingFields`. Income profiles are `bank` (`netInterestIncome`, `noninterestIncome`), `insurance` (`premiumsEarned`, `netInvestmentIncome`), `reit` (`leaseIncome`), and `investmentCompany` (`grossInvestmentIncome`, `netInvestmentIncome`). Balance profiles add `deposits`, `claimsReserve`, `realEstateInvestmentPropertyNet`, and `investmentsAtFairValue` respectively. The profile is inferred from a supported standard fact for the requested period, not from an official SEC industry designation. Every value retains taxonomy, tag, unit, and filing URL. A fund's investment income does not fill the general `revenue` field.

The tested real examples are [JPMorgan Chase](https://data.sec.gov/api/xbrl/companyfacts/CIK0000019617.json), [Allstate](https://data.sec.gov/api/xbrl/companyfacts/CIK0000899051.json), [Realty Income](https://data.sec.gov/api/xbrl/companyfacts/CIK0000726728.json), and [ICMB](https://data.sec.gov/api/xbrl/companyfacts/CIK0001578348.json). [SAP's IFRS facts](https://data.sec.gov/api/xbrl/companyfacts/CIK0001000184.json) show EUR income and assets. The tested mappings establish these cases and keep other industry or custom concepts unavailable until researched. See [mapping research](../research/financial-semantics.md) and [ADR 015](../decisions/015-reporting-currency.md).
