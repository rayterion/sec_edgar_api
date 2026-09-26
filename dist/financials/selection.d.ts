import type { FiscalPeriod } from "./periods.js";
import type { CompanyFacts } from "../xbrl/index.js";
import type { FieldMapping } from "./mapping.js";
export interface Operand {
    exactValue: string;
    start?: string;
    end: string;
    accessionNumber: string;
    filed: string;
    url: string;
}
export interface CandidateTrace {
    accessionNumber: string;
    filed: string;
    start?: string;
    end: string;
    taxonomy: string;
    tag: string;
    exactValue: string;
    reason: string;
}
export interface SelectedFact {
    exactValue: string;
    unit: string;
    status: "reported" | "derived";
    taxonomy: string;
    tag: string;
    start?: string;
    end: string;
    source: {
        accessionNumber: string;
        form: string;
        filed: string;
        url: string;
    };
    operands?: [Operand, Operand];
    candidates?: CandidateTrace[];
}
export type SelectionFailureCode = "NO_COMPATIBLE_FACT" | "CONFLICTING_FACTS" | "INCOMPATIBLE_REVISIONS";
export type SelectionResult = {
    fact: SelectedFact;
    candidates: CandidateTrace[];
    failureCode?: never;
    reason?: never;
} | {
    fact: null;
    candidates: CandidateTrace[];
    failureCode: SelectionFailureCode;
    reason: string;
};
export interface SelectionOptions {
    asOf?: string;
    revision?: "latest" | "asFiled";
    unit?: string;
    trace?: boolean;
}
export declare function selectFactResult(data: CompanyFacts, cik: string, period: FiscalPeriod, mapping: FieldMapping, statementKind: "income" | "balance" | "cashFlow", options?: SelectionOptions): SelectionResult;
export declare function selectFact(data: CompanyFacts, cik: string, period: FiscalPeriod, mapping: FieldMapping, statementKind: "income" | "balance" | "cashFlow", options?: SelectionOptions): SelectedFact | null;
