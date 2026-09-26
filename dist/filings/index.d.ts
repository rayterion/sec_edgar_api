import type { FilingXbrlFact } from "../parsers/xbrl.js";
import type { SecTransport, RequestOptions } from "../transport/index.js";
export interface Filing {
    cik: string;
    sourceUrl?: string;
    accessionNumber: string;
    form: string;
    filed: string;
    reportDate: string | null;
    primaryDocument: string | null;
    isXbrl: boolean;
    [key: string]: unknown;
}
export interface FilingQuery {
    cik: string | number;
    form?: string;
    from?: string;
    to?: string;
    limit?: number;
}
export interface FilingDocument {
    name: string;
    size: string | number | null;
    type: string | null;
    url: string;
}
export declare function archiveBase(cik: string | number, accessionNumber: string): string;
export declare function normalizeColumns(raw: unknown, cik: string, sourceUrl?: string): Filing[];
export declare class FilingsApi {
    private transport;
    constructor(transport: SecTransport);
    recent(cikInput: string | number, options?: RequestOptions): Promise<Filing[]>;
    list(query: FilingQuery, options?: RequestOptions): Promise<Filing[]>;
    iterate(query: FilingQuery, options?: RequestOptions): AsyncGenerator<Filing>;
    get(query: {
        cik: string | number;
        accessionNumber: string;
    }, options?: RequestOptions): Promise<Filing>;
    documents(query: {
        cik: string | number;
        accessionNumber: string;
    }, options?: RequestOptions): Promise<FilingDocument[]>;
    xbrlFacts(query: {
        cik: string | number;
        accessionNumber: string;
        name?: string;
    }, options?: RequestOptions): Promise<FilingXbrlFact[]>;
    documentText(query: {
        cik: string | number;
        accessionNumber: string;
        name: string;
    }, options?: RequestOptions): Promise<string>;
}
