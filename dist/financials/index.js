import { assertInput } from "../errors.js";
import { isoDate } from "../parsers/json.js";
import { CompaniesApi } from "../companies/index.js";
import { FilingsApi } from "../filings/index.js";
import { XbrlApi } from "../xbrl/index.js";
export const CANONICAL_MAPPING_VERSION = "canonical-1";
export const SELECTION_POLICY_VERSION = "selection-2";
import { balanceMappings, cashFlowMappings, incomeMappings, industryMappings, industryBalanceMappings, } from "./mapping.js";
import { detectCurrency } from "./currency.js";
import { determineFiscalPeriod } from "./periods.js";
import { selectFactResult } from "./selection.js";
import { safeNumber } from "./decimal.js";
import { validateBalance } from "./validation.js";
export class FinancialsApi {
    companies;
    filings;
    xbrl;
    transport;
    constructor(companies, filings, xbrl, transport) {
        this.companies = companies;
        this.filings = filings;
        this.xbrl = xbrl;
        this.transport = transport;
    }
    async statement(query, kind) {
        assertInput(query.asOf === undefined || isoDate(query.asOf), "Invalid asOf date");
        assertInput(query.revision === undefined ||
            ["latest", "asFiled"].includes(query.revision), "Invalid revision policy");
        assertInput(query.precision === undefined ||
            ["number", "string"].includes(query.precision), "Invalid precision mode");
        assertInput(query.unit === undefined || /^[A-Z]{3}$/.test(query.unit), "unit must be a three-letter currency");
        assertInput(Number.isInteger(query.fiscalYear) &&
            query.fiscalYear >= 1994 &&
            query.fiscalYear <= 2100, "Invalid fiscal year");
        assertInput(query.validate === undefined || typeof query.validate === "boolean", "Invalid validate option");
        assertInput(!query.validate || kind === "balance", "validate is available for balance sheets");
        assertInput(query.refresh === undefined || typeof query.refresh === "boolean", "Invalid refresh option");
        const identifier = query.ticker !== undefined
            ? { ticker: query.ticker }
            : { cik: query.cik };
        const request = {
            signal: query.signal,
            refresh: query.refresh,
        };
        const company = await this.companies.resolve(identifier, request);
        // Filing dates lag report dates. This window reaches the prior annual
        // while the submissions reference ranges avoid unrelated history files.
        const from = `${query.fiscalYear - 2}-01-01`;
        const windowEnd = `${query.fiscalYear + 2}-12-31`;
        const to = query.asOf && query.asOf < windowEnd ? query.asOf : windowEnd;
        const [filings, facts] = await Promise.all([
            this.filings.list({ cik: company.cik, from, to }, request),
            this.xbrl.companyFacts({ cik: company.cik }, request),
        ]);
        const period = determineFiscalPeriod(filings, query.fiscalYear, query.fiscalQuarter, query.asOf, query.periodEnd);
        const unit = query.unit ?? detectCurrency(facts, period, query.asOf);
        const options = {
            asOf: query.asOf,
            revision: query.revision,
            unit,
            trace: query.trace,
        };
        const mappings = kind === "income"
            ? incomeMappings
            : kind === "balance"
                ? balanceMappings
                : cashFlowMappings;
        const values = {};
        const details = {};
        const missingFields = [];
        const missingReasons = {};
        const missingCodes = {};
        const selectionTraces = {};
        const warnings = [];
        for (const [field, mapping] of Object.entries(mappings)) {
            const selection = selectFactResult(facts, company.cik, period, mapping, kind, options);
            const detail = selection.fact;
            details[field] = detail;
            if (query.trace)
                selectionTraces[field] = selection.candidates;
            if (!detail) {
                values[field] = null;
                missingFields.push(field);
                missingCodes[field] = selection.failureCode;
                missingReasons[field] =
                    `${selection.reason}; no compatible ${unit} standard entity-wide fact for ${kind === "balance" ? period.end : `${period.start} to ${period.end}`} among ${mapping.tags.join(", ")}; filing custom or dimensional facts may require separate inspection`;
                continue;
            }
            if (query.precision === "string")
                values[field] = detail.exactValue;
            else {
                values[field] = safeNumber(detail.exactValue);
                if (values[field] === null)
                    warnings.push(`${field} exceeds safe JavaScript number precision; use details.${field}.exactValue or precision: 'string'`);
            }
            if (detail.status === "derived")
                warnings.push(`${field} was derived from compatible year-to-date facts`);
        }
        const industryMappingsForKind = kind === "income"
            ? industryMappings
            : kind === "balance"
                ? industryBalanceMappings
                : undefined;
        const industry = industryMappingsForKind
            ? Object.entries(industryMappingsForKind).find(([, fields]) => {
                const anchor = Object.values(fields)[0];
                return (selectFactResult(facts, company.cik, period, anchor, kind, options)
                    .fact !== null);
            })
            : undefined;
        const industryResult = industry
            ? { profile: industry[0], values: {}, details: {}, missingFields: [] }
            : undefined;
        if (industryResult && industry) {
            for (const [field, mapping] of Object.entries(industry[1])) {
                const detail = selectFactResult(facts, company.cik, period, mapping, kind, options).fact;
                industryResult.details[field] = detail;
                if (!detail) {
                    industryResult.values[field] = null;
                    industryResult.missingFields.push(field);
                }
                else {
                    industryResult.values[field] =
                        query.precision === "string"
                            ? detail.exactValue
                            : safeNumber(detail.exactValue);
                    if (industryResult.values[field] === null)
                        warnings.push(`industry.${field} exceeds safe JavaScript number precision; use its exactValue or precision: 'string'`);
                    if (detail.status === "derived")
                        warnings.push(`industry.${field} was derived from compatible year-to-date facts`);
                }
            }
        }
        const validation = query.validate ? validateBalance(details) : undefined;
        if (validation?.status === "fail")
            warnings.push("Comparable balance facts do not reconcile; values were not changed");
        if (validation?.status === "unavailable")
            warnings.push(`Balance reconciliation unavailable: ${validation.checks[0]?.reason}`);
        const accessions = new Set(Object.values(details)
            .filter((x) => x !== null)
            .flatMap((x) => [
            x.source.accessionNumber,
            ...(x.operands?.map((operand) => operand.accessionNumber) ?? []),
        ]));
        if (accessions.size > 1)
            warnings.push("Statement combines facts from multiple filings; inspect each detail source");
        if (missingFields.length)
            warnings.push("Some canonical fields are unavailable in supported SEC company facts");
        const mapped = new Set([
            ...Object.values(mappings).flatMap((x) => x.tags),
            ...(industry ? Object.values(industry[1]).flatMap((x) => x.tags) : []),
        ]);
        const unmappedConcepts = Object.entries(facts.facts)
            .flatMap(([taxonomy, concepts]) => Object.keys(concepts).map((tag) => `${taxonomy}:${tag}`))
            .filter((tag) => !mapped.has(tag));
        const rootUrl = `https://data.sec.gov/submissions/CIK${company.cik}.json`;
        const factsUrl = `https://data.sec.gov/api/xbrl/companyfacts/CIK${company.cik}.json`;
        const lookupUrl = "https://www.sec.gov/files/company_tickers_exchange.json";
        const inputs = this.transport
            .observedResponses()
            .filter((entry) => entry.url === lookupUrl ||
            entry.url === factsUrl ||
            entry.url === rootUrl ||
            entry.url.startsWith(`https://data.sec.gov/submissions/CIK${company.cik}-submissions-`));
        const requiredUrls = new Set([
            rootUrl,
            factsUrl,
            lookupUrl,
            ...filings.flatMap((filing) => filing.sourceUrl ? [filing.sourceUrl] : []),
        ]);
        const complete = [...requiredUrls].every((url) => inputs.some((entry) => entry.url === url && entry.status === 200 && entry.bodyCaptured));
        if (!complete)
            warnings.push("Response hashes are incomplete, possibly because an external cache supplied data without retrieval metadata");
        return {
            company,
            period,
            currency: unit,
            audit: {
                evaluatedAt: new Date().toISOString(),
                mappingVersion: CANONICAL_MAPPING_VERSION,
                selectionPolicyVersion: SELECTION_POLICY_VERSION,
                complete,
                inputs,
            },
            values,
            details,
            coverage: {
                status: missingFields.length ? "partial" : "complete",
                missingFields,
                missingReasons,
                missingCodes,
            },
            ...(query.trace ? { selectionTraces } : {}),
            ...(industryResult ? { industry: industryResult } : {}),
            ...(validation ? { validation } : {}),
            warnings,
            unmappedConcepts,
        };
    }
    incomeStatement(query) {
        return this.statement(query, "income");
    }
    cashFlowStatement(query) {
        return this.statement(query, "cashFlow");
    }
    balanceSheet(query) {
        return this.statement(query, "balance");
    }
    async history(query) {
        assertInput(query.toFiscalYear >= query.fromFiscalYear &&
            query.toFiscalYear - query.fromFiscalYear <= 20, "History range must be from 0 to 20 years");
        const results = [];
        for (let year = query.fromFiscalYear; year <= query.toFiscalYear; year++) {
            const request = { ...query, fiscalYear: year };
            results.push(query.kind === "income"
                ? await this.incomeStatement(request)
                : query.kind === "balance"
                    ? await this.balanceSheet(request)
                    : await this.cashFlowStatement(request));
        }
        return results;
    }
}
