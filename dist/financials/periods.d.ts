import type { Filing } from "../filings/index.js";
export interface FiscalPeriod {
    fiscalYear: number;
    fiscalQuarter: number | null;
    start: string;
    end: string;
    kind: "quarter" | "year" | "transition";
    filingAccession: string;
    fiscalStart?: string;
    priorEnd?: string;
}
export declare function determineFiscalPeriod(filings: Filing[], fiscalYear: number, fiscalQuarter?: number, asOf?: string, periodEnd?: string): FiscalPeriod;
export declare function fiscalYearStart(filings: Filing[], year: number, asOf?: string): string;
export declare function previousQuarterEnd(filings: Filing[], year: number, quarter: number, asOf?: string): string;
