import { assertInput, schema } from "../errors.js";
import { normalizeCik } from "../companies/index.js";
import { record } from "../parsers/json.js";
import type { SecTransport, RequestOptions } from "../transport/index.js";
export type Taxonomy = "us-gaap" | "ifrs-full" | "dei" | "srt";
export interface CompanyFacts {
  cik: number | string;
  entityName: string;
  facts: Record<
    string,
    Record<string, { label?: string; units: Record<string, unknown[]> }>
  >;
  [key: string]: unknown;
}
export class XbrlApi {
  constructor(private transport: SecTransport) {}
  async companyFacts(
    identifier: { cik: string | number },
    options: RequestOptions = {},
  ): Promise<CompanyFacts> {
    const url = `https://data.sec.gov/api/xbrl/companyfacts/CIK${normalizeCik(identifier.cik)}.json`;
    const value = await this.transport.json(url, options);
    schema(
      record(value) &&
        record(value.facts) &&
        typeof value.entityName === "string" &&
        (typeof value.cik === "number" || typeof value.cik === "string"),
      "Invalid company facts",
      url,
    );
    return value as unknown as CompanyFacts;
  }
  async companyConcept(
    query: { cik: string | number; taxonomy: Taxonomy; tag: string },
    options: RequestOptions = {},
  ): Promise<Record<string, unknown>> {
    assertInput(
      /^[A-Za-z][A-Za-z0-9_]{0,199}$/.test(query.tag),
      "Invalid XBRL tag",
    );
    assertInput(
      ["us-gaap", "ifrs-full", "dei", "srt"].includes(query.taxonomy),
      "Invalid taxonomy",
    );
    const url = `https://data.sec.gov/api/xbrl/companyconcept/CIK${normalizeCik(query.cik)}/${query.taxonomy}/${query.tag}.json`;
    const value = await this.transport.json(url, options);
    schema(
      record(value) && record(value.units) && typeof value.tag === "string",
      "Invalid company concept",
      url,
    );
    return value;
  }
  async frame(
    query: { taxonomy: Taxonomy; tag: string; unit: string; frame: string },
    options: RequestOptions = {},
  ): Promise<Record<string, unknown>> {
    assertInput(
      ["us-gaap", "ifrs-full", "dei", "srt"].includes(query.taxonomy),
      "Invalid taxonomy",
    );
    assertInput(/^[A-Za-z][A-Za-z0-9_]{0,199}$/.test(query.tag), "Invalid tag");
    assertInput(/^[A-Za-z0-9-]{1,50}$/.test(query.unit), "Invalid unit");
    assertInput(
      /^CY\d{4}(?:Q[1-4]I?)?$/.test(query.frame),
      "Invalid calendar frame",
    );
    const url = `https://data.sec.gov/api/xbrl/frames/${query.taxonomy}/${query.tag}/${query.unit}/${query.frame}.json`;
    const value = await this.transport.json(url, options);
    schema(
      record(value) && Array.isArray(value.data),
      "Invalid XBRL frame",
      url,
    );
    return value;
  }
}
