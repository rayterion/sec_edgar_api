import { SecTransport } from "./transport/index.js";
import { CompaniesApi } from "./companies/index.js";
import { FilingsApi } from "./filings/index.js";
import { XbrlApi } from "./xbrl/index.js";
import { FinancialsApi } from "./financials/index.js";
export { CANONICAL_MAPPING_VERSION, SELECTION_POLICY_VERSION, } from "./financials/index.js";
import { assertInput } from "./errors.js";
export { assessHealth } from "./monitor/index.js";
export { importBulkZip, DEFAULT_BULK_LIMITS } from "./bulk/index.js";
export { SecTransport } from "./transport/index.js";
export { FileRateLimiter } from "./transport/limiter.js";
export { SecSnapshot, diffSnapshots } from "./transport/snapshot.js";
export { MemoryCache, FileCache } from "./cache/index.js";
export { EdgarError } from "./errors.js";
export { normalizeCik } from "./companies/index.js";
export { archiveBase, normalizeColumns } from "./filings/index.js";
export { validateBalance } from "./financials/validation.js";
export { determineFiscalPeriod } from "./financials/periods.js";
export { selectFact, selectFactResult } from "./financials/selection.js";
export { parseXbrlInstance } from "./parsers/xbrl.js";
export { parseInlineXbrl } from "./parsers/inline-xbrl.js";
export { subtractDecimal, safeNumber } from "./financials/decimal.js";
export { incomeMappings, balanceMappings, cashFlowMappings, industryMappings, industryBalanceMappings, } from "./financials/mapping.js";
export function createEdgarClient(options) {
    const transport = new SecTransport(options);
    const companies = new CompaniesApi(transport);
    const filings = new FilingsApi(transport);
    const xbrl = new XbrlApi(transport);
    const financials = new FinancialsApi(companies, filings, xbrl, transport);
    const raw = {
        async get(query) {
            assertInput(/^\/[A-Za-z0-9_./-]+$/.test(query.path) && !query.path.includes(".."), "Invalid raw SEC path");
            const host = query.source === "data" ? "data.sec.gov" : "www.sec.gov";
            if (query.source === "archive")
                assertInput(query.path.startsWith("/Archives/edgar/data/"), "Invalid archive path");
            if (query.source === "files")
                assertInput(/^\/files\/company_tickers(?:_exchange|_mf)?\.json$/.test(query.path), "Invalid lookup path");
            if (query.source === "data")
                assertInput(/^\/(submissions|api\/xbrl)\//.test(query.path), "Invalid data path");
            return transport.json(`https://${host}${query.path}`, {
                signal: query.signal,
            });
        },
    };
    return {
        companies,
        filings,
        xbrl,
        financials,
        raw,
        metrics: () => transport.metrics(),
    };
}
export default createEdgarClient;
