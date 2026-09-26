import type { SecTransport, RequestOptions } from "../transport/index.js";
export type Taxonomy = "us-gaap" | "ifrs-full" | "dei" | "srt";
export interface CompanyFacts {
    cik: number | string;
    entityName: string;
    facts: Record<string, Record<string, {
        label?: string;
        units: Record<string, unknown[]>;
    }>>;
    [key: string]: unknown;
}
export declare class XbrlApi {
    private transport;
    constructor(transport: SecTransport);
    companyFacts(identifier: {
        cik: string | number;
    }, options?: RequestOptions): Promise<CompanyFacts>;
    companyConcept(query: {
        cik: string | number;
        taxonomy: Taxonomy;
        tag: string;
    }, options?: RequestOptions): Promise<Record<string, unknown>>;
    frame(query: {
        taxonomy: Taxonomy;
        tag: string;
        unit: string;
        frame: string;
    }, options?: RequestOptions): Promise<Record<string, unknown>>;
}
