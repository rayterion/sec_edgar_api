import type { CompanyIdentifier, Company } from "../companies/index.js";
import { CompaniesApi } from "../companies/index.js";
import { FilingsApi } from "../filings/index.js";
import { XbrlApi } from "../xbrl/index.js";
import type { SecTransport } from "../transport/index.js";
import type { ResponseEvidence } from "../transport/snapshot.js";
export declare const CANONICAL_MAPPING_VERSION = "canonical-1";
export declare const SELECTION_POLICY_VERSION = "selection-2";
import type { IndustryProfile } from "./mapping.js";
import type { FiscalPeriod } from "./periods.js";
import type { CandidateTrace, SelectedFact, SelectionFailureCode } from "./selection.js";
import type { StatementValidation } from "./validation.js";
export type FinancialQuery = CompanyIdentifier & {
    fiscalYear: number;
    fiscalQuarter?: number;
    periodEnd?: string;
    asOf?: string;
    revision?: "latest" | "asFiled";
    unit?: string;
    precision?: "number" | "string";
    trace?: boolean;
    validate?: boolean;
    refresh?: boolean;
    signal?: AbortSignal;
};
export interface Statement {
    company: Company;
    period: FiscalPeriod;
    currency: string;
    audit: {
        evaluatedAt: string;
        mappingVersion: string;
        selectionPolicyVersion: string;
        complete: boolean;
        inputs: ResponseEvidence[];
    };
    values: Record<string, number | string | null>;
    details: Record<string, SelectedFact | null>;
    coverage: {
        status: "complete" | "partial";
        missingFields: string[];
        missingReasons: Record<string, string>;
        missingCodes: Record<string, SelectionFailureCode>;
    };
    selectionTraces?: Record<string, CandidateTrace[]>;
    validation?: StatementValidation;
    industry?: {
        profile: IndustryProfile;
        values: Record<string, number | string | null>;
        details: Record<string, SelectedFact | null>;
        missingFields: string[];
    };
    warnings: string[];
    unmappedConcepts: string[];
}
export declare class FinancialsApi {
    private companies;
    private filings;
    private xbrl;
    private transport;
    constructor(companies: CompaniesApi, filings: FilingsApi, xbrl: XbrlApi, transport: SecTransport);
    private statement;
    incomeStatement(query: FinancialQuery): Promise<Statement>;
    cashFlowStatement(query: FinancialQuery): Promise<Statement>;
    balanceSheet(query: FinancialQuery): Promise<Statement>;
    history(query: Omit<FinancialQuery, "fiscalYear" | "fiscalQuarter"> & {
        fromFiscalYear: number;
        toFiscalYear: number;
        kind: "income" | "balance" | "cashFlow";
        fiscalQuarter?: number;
    }): Promise<Statement[]>;
}
