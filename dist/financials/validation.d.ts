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
export declare function validateBalance(details: Record<string, SelectedFact | null>): StatementValidation;
