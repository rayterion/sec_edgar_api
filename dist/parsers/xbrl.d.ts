export interface FilingXbrlFact {
    taxonomy: string;
    tag: string;
    exactValue: string | null;
    status?: "reported" | "nil" | "unsupported";
    reason?: string;
    unit: string;
    cik: string;
    start?: string;
    end: string;
    contextRef: string;
    unitRef: string;
    decimals?: string;
    dimensions: unknown[];
    sourceUrl: string;
}
export declare function parseXbrlInstance(xml: string, sourceUrl: string): FilingXbrlFact[];
