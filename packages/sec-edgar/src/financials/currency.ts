import { EdgarError } from "../errors.js";
import type { CompanyFacts } from "../xbrl/index.js";
import type { FiscalPeriod } from "./periods.js";

// Only standard, monetary, entity-wide concepts with unambiguous period
// semantics qualify as reporting-currency evidence. This is not an FX rate.
const anchors = [
  "us-gaap:Assets",
  "ifrs-full:Assets",
  "us-gaap:Revenues",
  "us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax",
  "us-gaap:SalesRevenueNet",
  "ifrs-full:Revenue",
  "us-gaap:NetIncomeLoss",
  "ifrs-full:ProfitLoss",
  "us-gaap:InterestIncomeExpenseNet",
  "us-gaap:PremiumsEarnedNet",
  "us-gaap:LeaseIncome",
  "us-gaap:GrossInvestmentIncomeOperating",
  "us-gaap:NetCashProvidedByUsedInOperatingActivities",
  "ifrs-full:CashFlowsFromUsedInOperatingActivities",
];
export function detectCurrency(
  data: CompanyFacts,
  period: FiscalPeriod,
  asOf?: string,
): string {
  const candidates: Array<{ unit: string; accession: string }> = [];
  for (const concept of anchors) {
    const [taxonomy, tag] = concept.split(":") as [string, string];
    const units = data.facts[taxonomy]?.[tag]?.units ?? {};
    for (const [unit, rows] of Object.entries(units)) {
      if (!/^[A-Z]{3}$/.test(unit) || !Array.isArray(rows)) continue;
      for (const unknownRow of rows) {
        if (typeof unknownRow !== "object" || unknownRow === null) continue;
        const row = unknownRow as Record<string, unknown>;
        if (
          row.end === period.end &&
          (row.start === undefined || row.start === period.start) &&
          typeof row.accn === "string" &&
          typeof row.filed === "string" &&
          (!asOf || row.filed <= asOf) &&
          [
            "10-K",
            "10-K/A",
            "10-Q",
            "10-Q/A",
            "10-KT",
            "10-KT/A",
            "20-F",
            "20-F/A",
            "40-F",
            "40-F/A",
          ].includes(String(row.form))
        )
          candidates.push({ unit, accession: row.accn });
      }
    }
  }
  const target = candidates.filter(
    (row) => row.accession === period.filingAccession,
  );
  const currencies = new Set(
    (target.length ? target : candidates).map((x) => x.unit),
  );
  if (currencies.size !== 1)
    throw new EdgarError(
      "AMBIGUOUS_CURRENCY",
      currencies.size
        ? `Multiple eligible reporting currencies (${[...currencies].sort().join(", ")}); specify unit`
        : "Reporting currency cannot be established from exact-period monetary facts; specify unit",
    );
  return [...currencies][0]!;
}
