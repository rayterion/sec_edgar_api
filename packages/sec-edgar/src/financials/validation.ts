import { subtractDecimal } from "./decimal.js";
import type { SelectedFact } from "./selection.js";
export interface ValidationCheck {
  name: "assetsEqualsLiabilitiesPlusEquity";
  status: "pass" | "fail" | "unavailable";
  difference: string | null;
  reason: string | null;
  sourceUrls: string[];
}
export interface StatementValidation {
  status: ValidationCheck["status"];
  checks: ValidationCheck[];
}
export function validateBalance(
  details: Record<string, SelectedFact | null>,
): StatementValidation {
  const fields = ["totalAssets", "totalLiabilities", "equity"] as const;
  const facts = fields.map((field) => details[field] ?? null);
  const sourceUrls = [
    ...new Set(facts.flatMap((fact) => (fact ? [fact.source.url] : []))),
  ];
  const missing = fields.filter((_, index) => facts[index] === null);
  let reason: string | null = null;
  if (missing.length)
    reason = `Missing ${missing.join(", ")} for reconciliation`;
  else if (
    new Set(facts.map((fact) => fact!.source.accessionNumber)).size !== 1
  )
    reason = "Balance operands come from different filing accessions";
  else if (
    new Set(facts.map((fact) => fact!.unit)).size !== 1 ||
    new Set(facts.map((fact) => fact!.end)).size !== 1 ||
    facts.some((fact) => fact!.start !== undefined)
  )
    reason = "Balance operands do not share unit, instant period, and context";
  if (reason) {
    const check: ValidationCheck = {
      name: "assetsEqualsLiabilitiesPlusEquity",
      status: "unavailable",
      difference: null,
      reason,
      sourceUrls,
    };
    return { status: check.status, checks: [check] };
  }
  const difference = subtractDecimal(
    subtractDecimal(facts[0]!.exactValue, facts[1]!.exactValue),
    facts[2]!.exactValue,
  );
  const status = difference === "0" ? "pass" : "fail";
  const check: ValidationCheck = {
    name: "assetsEqualsLiabilitiesPlusEquity",
    status,
    difference,
    reason: status === "fail" ? "Comparable SEC facts do not reconcile" : null,
    sourceUrls,
  };
  return { status, checks: [check] };
}
