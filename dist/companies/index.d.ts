import type { SecTransport, RequestOptions } from "../transport/index.js";
export interface Company {
    cik: string;
    ticker: string | null;
    name: string;
    exchange?: string | null;
}
export type CompanyIdentifier = {
    ticker: string;
    cik?: never;
} | {
    cik: string | number;
    ticker?: never;
};
export declare function normalizeCik(cik: string | number): string;
export declare function tickerName(ticker: string): string;
export declare class CompaniesApi {
    private transport;
    constructor(transport: SecTransport);
    private lookup;
    resolve(identifier: CompanyIdentifier, options?: RequestOptions): Promise<Company>;
    search(name: string, options?: RequestOptions): Promise<Company[]>;
    get(identifier: CompanyIdentifier, options?: RequestOptions): Promise<Company & {
        submissions: Record<string, unknown>;
    }>;
}
