import type { CompanyFacts } from "../xbrl/index.js";
import type { FiscalPeriod } from "./periods.js";
export declare function detectCurrency(data: CompanyFacts, period: FiscalPeriod, asOf?: string): string;
