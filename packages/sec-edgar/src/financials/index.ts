import { assertInput } from "../errors.js";
import { isoDate } from "../parsers/json.js";
import type { CompanyIdentifier, Company } from "../companies/index.js";
import { CompaniesApi } from "../companies/index.js";
import { FilingsApi } from "../filings/index.js";
import { XbrlApi } from "../xbrl/index.js";
import type { RequestOptions } from "../transport/index.js";
import {
  balanceMappings,
  cashFlowMappings,
  incomeMappings,
} from "./mapping.js";
import { determineFiscalPeriod } from "./periods.js";
import type { FiscalPeriod } from "./periods.js";
import { selectFact } from "./selection.js";
import type { SelectedFact, SelectionOptions } from "./selection.js";
import { safeNumber } from "./decimal.js";
export type FinancialQuery = CompanyIdentifier & {
  fiscalYear: number;
  fiscalQuarter?: number;
  periodEnd?: string;
  asOf?: string;
  revision?: "latest" | "asFiled";
  unit?: string;
  precision?: "number" | "string";
  trace?: boolean;
  signal?: AbortSignal;
};
export interface Statement {
  company: Company;
  period: FiscalPeriod;
  currency: string;
  values: Record<string, number | string | null>;
  details: Record<string, SelectedFact | null>;
  coverage: {
    status: "complete" | "partial";
    missingFields: string[];
    missingReasons: Record<string, string>;
  };
  warnings: string[];
  unmappedConcepts: string[];
}
export class FinancialsApi {
  constructor(
    private companies: CompaniesApi,
    private filings: FilingsApi,
    private xbrl: XbrlApi,
  ) {}
  private async statement(
    query: FinancialQuery,
    kind: "income" | "balance" | "cashFlow",
  ): Promise<Statement> {
    assertInput(
      query.asOf === undefined || isoDate(query.asOf),
      "Invalid asOf date",
    );
    assertInput(
      query.revision === undefined ||
        ["latest", "asFiled"].includes(query.revision),
      "Invalid revision policy",
    );
    assertInput(
      query.precision === undefined ||
        ["number", "string"].includes(query.precision),
      "Invalid precision mode",
    );
    assertInput(
      query.unit === undefined || /^[A-Z]{3}$/.test(query.unit),
      "unit must be a three-letter currency",
    );
    const identifier =
      query.ticker !== undefined
        ? { ticker: query.ticker }
        : { cik: query.cik! };
    const company = await this.companies.resolve(identifier, {
      signal: query.signal,
    });
    const request: RequestOptions = { signal: query.signal };
    const [filings, facts] = await Promise.all([
      this.filings.recent(company.cik, request),
      this.xbrl.companyFacts({ cik: company.cik }, request),
    ]);
    const period = determineFiscalPeriod(
      filings,
      query.fiscalYear,
      query.fiscalQuarter,
      query.asOf,
      query.periodEnd,
    );
    const unit = query.unit ?? "USD";
    const options: SelectionOptions = {
      asOf: query.asOf,
      revision: query.revision,
      unit,
      trace: query.trace,
    };
    const mappings =
      kind === "income"
        ? incomeMappings
        : kind === "balance"
          ? balanceMappings
          : cashFlowMappings;
    const values: Statement["values"] = {};
    const details: Statement["details"] = {};
    const missingFields: string[] = [];
    const missingReasons: Record<string, string> = {};
    const warnings: string[] = [];
    for (const [field, mapping] of Object.entries(mappings)) {
      const detail = selectFact(
        facts,
        company.cik,
        period,
        mapping,
        kind,
        options,
      );
      details[field] = detail;
      if (!detail) {
        values[field] = null;
        missingFields.push(field);
        missingReasons[field] =
          `No compatible ${unit} standard entity-wide fact for ${kind === "balance" ? period.end : `${period.start} to ${period.end}`} among ${mapping.tags.join(", ")}; filing custom or dimensional facts may require separate inspection`;
        continue;
      }
      if (query.precision === "string") values[field] = detail.exactValue;
      else {
        values[field] = safeNumber(detail.exactValue);
        if (values[field] === null)
          warnings.push(
            `${field} exceeds safe JavaScript number precision; use details.${field}.exactValue or precision: 'string'`,
          );
      }
      if (detail.status === "derived")
        warnings.push(
          `${field} was derived from compatible year-to-date facts`,
        );
    }
    const accessions = new Set(
      Object.values(details)
        .filter((x): x is SelectedFact => x !== null)
        .flatMap((x) => [
          x.source.accessionNumber,
          ...(x.operands?.map((operand) => operand.accessionNumber) ?? []),
        ]),
    );
    if (accessions.size > 1)
      warnings.push(
        "Statement combines facts from multiple filings; inspect each detail source",
      );
    if (missingFields.length)
      warnings.push(
        "Some canonical fields are unavailable in supported SEC company facts",
      );
    const mapped = new Set(Object.values(mappings).flatMap((x) => x.tags));
    const unmappedConcepts = Object.entries(facts.facts)
      .flatMap(([taxonomy, concepts]) =>
        Object.keys(concepts).map((tag) => `${taxonomy}:${tag}`),
      )
      .filter((tag) => !mapped.has(tag));
    return {
      company,
      period,
      currency: unit,
      values,
      details,
      coverage: {
        status: missingFields.length ? "partial" : "complete",
        missingFields,
        missingReasons,
      },
      warnings,
      unmappedConcepts,
    };
  }
  incomeStatement(query: FinancialQuery): Promise<Statement> {
    return this.statement(query, "income");
  }
  cashFlowStatement(query: FinancialQuery): Promise<Statement> {
    return this.statement(query, "cashFlow");
  }
  balanceSheet(query: FinancialQuery): Promise<Statement> {
    return this.statement(query, "balance");
  }
  async history(
    query: Omit<FinancialQuery, "fiscalYear" | "fiscalQuarter"> & {
      fromFiscalYear: number;
      toFiscalYear: number;
      kind: "income" | "balance" | "cashFlow";
      fiscalQuarter?: number;
    },
  ): Promise<Statement[]> {
    assertInput(
      query.toFiscalYear >= query.fromFiscalYear &&
        query.toFiscalYear - query.fromFiscalYear <= 20,
      "History range must be from 0 to 20 years",
    );
    const results: Statement[] = [];
    for (let year = query.fromFiscalYear; year <= query.toFiscalYear; year++) {
      const request = { ...query, fiscalYear: year } as FinancialQuery;
      results.push(
        query.kind === "income"
          ? await this.incomeStatement(request)
          : query.kind === "balance"
            ? await this.balanceSheet(request)
            : await this.cashFlowStatement(request),
      );
    }
    return results;
  }
}
