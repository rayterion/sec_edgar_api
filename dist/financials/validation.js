import { subtractDecimal } from "./decimal.js";
export function validateBalance(details) {
    const fields = ["totalAssets", "totalLiabilities", "equity"];
    const facts = fields.map((field) => details[field] ?? null);
    const sourceUrls = [
        ...new Set(facts.flatMap((fact) => (fact ? [fact.source.url] : []))),
    ];
    const missing = fields.filter((_, index) => facts[index] === null);
    let reason = null;
    if (missing.length)
        reason = `Missing ${missing.join(", ")} for reconciliation`;
    else if (new Set(facts.map((fact) => fact.source.accessionNumber)).size !== 1)
        reason = "Balance operands come from different filing accessions";
    else if (new Set(facts.map((fact) => fact.unit)).size !== 1 ||
        new Set(facts.map((fact) => fact.end)).size !== 1 ||
        facts.some((fact) => fact.start !== undefined))
        reason = "Balance operands do not share unit, instant period, and context";
    if (reason) {
        const check = {
            name: "assetsEqualsLiabilitiesPlusEquity",
            status: "unavailable",
            difference: null,
            reason,
            sourceUrls,
        };
        return { status: check.status, checks: [check] };
    }
    const difference = subtractDecimal(subtractDecimal(facts[0].exactValue, facts[1].exactValue), facts[2].exactValue);
    const status = difference === "0" ? "pass" : "fail";
    const check = {
        name: "assetsEqualsLiabilitiesPlusEquity",
        status,
        difference,
        reason: status === "fail" ? "Comparable SEC facts do not reconcile" : null,
        sourceUrls,
    };
    return { status, checks: [check] };
}
