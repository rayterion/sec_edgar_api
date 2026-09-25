import { SecTransport } from "./transport/index.js";
import type { TransportOptions } from "./transport/index.js";
import { CompaniesApi } from "./companies/index.js";
import { FilingsApi } from "./filings/index.js";
import { XbrlApi } from "./xbrl/index.js";
import { FinancialsApi } from "./financials/index.js";
export {
  CANONICAL_MAPPING_VERSION,
  SELECTION_POLICY_VERSION,
} from "./financials/index.js";
import { assertInput } from "./errors.js";
export type {
  TransportOptions,
  HttpTransport,
  RequestOptions,
} from "./transport/index.js";
export { SecSnapshot, diffSnapshots } from "./transport/snapshot.js";
export type {
  SnapshotEntry,
  SnapshotArtifact,
  SnapshotDifference,
  ResponseEvidence,
} from "./transport/snapshot.js";
export type { Cache } from "./cache/index.js";
export { MemoryCache } from "./cache/index.js";
export { EdgarError } from "./errors.js";
export type { EdgarErrorCode } from "./errors.js";
export type { Company, CompanyIdentifier } from "./companies/index.js";
export { normalizeCik } from "./companies/index.js";
export type { Filing, FilingDocument, FilingQuery } from "./filings/index.js";
export { archiveBase, normalizeColumns } from "./filings/index.js";
export type { CompanyFacts, Taxonomy } from "./xbrl/index.js";
export type { FinancialQuery, Statement } from "./financials/index.js";
export type { FiscalPeriod } from "./financials/periods.js";
export { validateBalance } from "./financials/validation.js";
export type {
  StatementValidation,
  ValidationCheck,
} from "./financials/validation.js";
export { determineFiscalPeriod } from "./financials/periods.js";
export { selectFact, selectFactResult } from "./financials/selection.js";
export type {
  CandidateTrace,
  SelectionFailureCode,
  SelectionResult,
} from "./financials/selection.js";
export { parseXbrlInstance } from "./parsers/xbrl.js";
export { parseInlineXbrl } from "./parsers/inline-xbrl.js";
export type { FilingXbrlFact } from "./parsers/xbrl.js";
export { subtractDecimal, safeNumber } from "./financials/decimal.js";
export {
  incomeMappings,
  balanceMappings,
  cashFlowMappings,
  industryMappings,
  industryBalanceMappings,
} from "./financials/mapping.js";
export function createEdgarClient(options: TransportOptions) {
  const transport = new SecTransport(options);
  const companies = new CompaniesApi(transport);
  const filings = new FilingsApi(transport);
  const xbrl = new XbrlApi(transport);
  const financials = new FinancialsApi(companies, filings, xbrl, transport);
  const raw = {
    async get(query: {
      source: "data" | "archive" | "files";
      path: string;
      signal?: AbortSignal;
    }): Promise<unknown> {
      assertInput(
        /^\/[A-Za-z0-9_./-]+$/.test(query.path) && !query.path.includes(".."),
        "Invalid raw SEC path",
      );
      const host = query.source === "data" ? "data.sec.gov" : "www.sec.gov";
      if (query.source === "archive")
        assertInput(
          query.path.startsWith("/Archives/edgar/data/"),
          "Invalid archive path",
        );
      if (query.source === "files")
        assertInput(
          /^\/files\/company_tickers(?:_exchange|_mf)?\.json$/.test(query.path),
          "Invalid lookup path",
        );
      if (query.source === "data")
        assertInput(
          /^\/(submissions|api\/xbrl)\//.test(query.path),
          "Invalid data path",
        );
      return transport.json(`https://${host}${query.path}`, {
        signal: query.signal,
      });
    },
  };
  return { companies, filings, xbrl, financials, raw };
}
export default createEdgarClient;
