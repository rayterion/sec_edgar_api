import { EdgarError, assertInput, schema } from "../errors.js";
import { isoDate, record } from "../parsers/json.js";
import { parseXbrlInstance } from "../parsers/xbrl.js";
import type { FilingXbrlFact } from "../parsers/xbrl.js";
import { normalizeCik } from "../companies/index.js";
import type { SecTransport, RequestOptions } from "../transport/index.js";
export interface Filing {
  cik: string;
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
const accn = /^\d{10}-\d{2}-\d{6}$/;
export function archiveBase(
  cik: string | number,
  accessionNumber: string,
): string {
  const normalized = normalizeCik(cik);
  assertInput(accn.test(accessionNumber), "Invalid accession number");
  return `https://www.sec.gov/Archives/edgar/data/${Number(normalized)}/${accessionNumber.replaceAll("-", "")}/`;
}
export function normalizeColumns(raw: unknown, cik: string): Filing[] {
  schema(
    record(raw) && Array.isArray(raw.accessionNumber),
    "Submissions filing columns missing accessionNumber",
  );
  const columns = Object.entries(raw).filter(([, value]) =>
    Array.isArray(value),
  ) as [string, unknown[]][];
  const count = raw.accessionNumber.length;
  schema(
    columns.every(([, values]) => values.length === count),
    "Submissions filing columns have different lengths",
  );
  return Array.from({ length: count }, (_, i) => {
    const row = Object.fromEntries(
      columns.map(([key, values]) => [key, values[i]]),
    );
    schema(
      typeof row.accessionNumber === "string" && accn.test(row.accessionNumber),
      "Invalid filing accession",
    );
    schema(
      typeof row.form === "string" && row.form.length > 0,
      "Invalid filing form",
    );
    schema(isoDate(row.filingDate), "Invalid filing date");
    schema(
      row.reportDate === "" ||
        row.reportDate === undefined ||
        isoDate(row.reportDate),
      "Invalid report date",
    );
    return {
      ...row,
      cik,
      accessionNumber: row.accessionNumber,
      form: row.form,
      filed: row.filingDate,
      reportDate:
        typeof row.reportDate === "string" && row.reportDate
          ? row.reportDate
          : null,
      primaryDocument:
        typeof row.primaryDocument === "string" && row.primaryDocument
          ? row.primaryDocument
          : null,
      isXbrl: row.isXBRL === 1 || row.isXBRL === true,
    };
  });
}
export class FilingsApi {
  constructor(private transport: SecTransport) {}
  async recent(
    cikInput: string | number,
    options: RequestOptions = {},
  ): Promise<Filing[]> {
    const cik = normalizeCik(cikInput);
    const url = `https://data.sec.gov/submissions/CIK${cik}.json`;
    const root = await this.transport.json(url, options);
    schema(
      record(root) && record(root.filings) && record(root.filings.recent),
      "Invalid submissions response",
      url,
    );
    return normalizeColumns(root.filings.recent, cik);
  }
  async list(
    query: FilingQuery,
    options: RequestOptions = {},
  ): Promise<Filing[]> {
    const cik = normalizeCik(query.cik);
    if (query.form !== undefined)
      assertInput(/^[A-Z0-9-]{1,12}(?:\/A)?$/.test(query.form), "Invalid form");
    if (query.from !== undefined)
      assertInput(isoDate(query.from), "Invalid from date");
    if (query.to !== undefined)
      assertInput(isoDate(query.to), "Invalid to date");
    if (query.limit !== undefined)
      assertInput(
        Number.isInteger(query.limit) && query.limit > 0,
        "limit must be positive",
      );
    const url = `https://data.sec.gov/submissions/CIK${cik}.json`;
    const root = await this.transport.json(url, options);
    schema(
      record(root) && record(root.filings) && record(root.filings.recent),
      "Invalid submissions response",
      url,
    );
    const rows = normalizeColumns(root.filings.recent, cik);
    const files = root.filings.files;
    schema(
      files === undefined || Array.isArray(files),
      "Invalid older submissions file references",
      url,
    );
    const recentMatches = rows.filter(
      (row) =>
        (!query.form || row.form === query.form) &&
        (!query.from || row.filed >= query.from) &&
        (!query.to || row.filed <= query.to),
    );
    const needHistory = !query.limit || recentMatches.length < query.limit;
    for (const file of needHistory ? (files ?? []) : []) {
      schema(
        record(file) &&
          typeof file.name === "string" &&
          /^CIK\d{10}-submissions-\d{3}\.json$/.test(file.name),
        "Invalid older submissions filename",
        url,
      );
      const historyUrl = `https://data.sec.gov/submissions/${file.name}`;
      try {
        rows.push(
          ...normalizeColumns(
            await this.transport.json(historyUrl, options),
            cik,
          ),
        );
      } catch (cause) {
        throw new EdgarError(
          "MISSING_HISTORY",
          `Cannot read referenced submissions file ${file.name}`,
          { url: historyUrl, cause },
        );
      }
    }
    const unique = [
      ...new Map(rows.map((row) => [row.accessionNumber, row])).values(),
    ];
    return unique
      .filter(
        (row) =>
          (!query.form || row.form === query.form) &&
          (!query.from || row.filed >= query.from) &&
          (!query.to || row.filed <= query.to),
      )
      .sort(
        (a, b) =>
          b.filed.localeCompare(a.filed) ||
          b.accessionNumber.localeCompare(a.accessionNumber),
      )
      .slice(0, query.limit);
  }
  async *iterate(
    query: FilingQuery,
    options: RequestOptions = {},
  ): AsyncGenerator<Filing> {
    for (const filing of await this.list(query, options)) yield filing;
  }
  async get(
    query: { cik: string | number; accessionNumber: string },
    options: RequestOptions = {},
  ): Promise<Filing> {
    assertInput(accn.test(query.accessionNumber), "Invalid accession number");
    const filing = (await this.list({ cik: query.cik }, options)).find(
      (row) => row.accessionNumber === query.accessionNumber,
    );
    if (!filing)
      throw new EdgarError(
        "NOT_FOUND",
        "Filing not found in submissions history",
      );
    return filing;
  }
  async documents(
    query: { cik: string | number; accessionNumber: string },
    options: RequestOptions = {},
  ): Promise<FilingDocument[]> {
    const base = archiveBase(query.cik, query.accessionNumber);
    const url = base + "index.json";
    const data = await this.transport.json(url, options);
    schema(
      record(data) &&
        record(data.directory) &&
        Array.isArray(data.directory.item),
      "Invalid archive index",
      url,
    );
    return data.directory.item.map((item) => {
      schema(
        record(item) &&
          typeof item.name === "string" &&
          /^[\w.-]+$/.test(item.name),
        "Invalid archive document name",
        url,
      );
      return {
        name: item.name,
        size:
          typeof item.size === "string" || typeof item.size === "number"
            ? item.size
            : null,
        type: typeof item.type === "string" ? item.type : null,
        url: base + item.name,
      };
    });
  }
  async xbrlFacts(
    query: { cik: string | number; accessionNumber: string; name?: string },
    options: RequestOptions = {},
  ): Promise<FilingXbrlFact[]> {
    const documents = await this.documents(query, options);
    const name =
      query.name ?? documents.find((x) => /_htm\.xml$/.test(x.name))?.name;
    if (
      !name ||
      !documents.some((x) => x.name === name) ||
      !/_htm\.xml$/.test(name)
    )
      throw new EdgarError(
        "UNSUPPORTED",
        "A supported XBRL instance XML document was not found",
      );
    const url = archiveBase(query.cik, query.accessionNumber) + name;
    return parseXbrlInstance(
      await this.transport.text(url, {
        ...options,
        maxBytes: options.maxBytes ?? 5_000_000,
      }),
      url,
    );
  }
  async documentText(
    query: { cik: string | number; accessionNumber: string; name: string },
    options: RequestOptions = {},
  ): Promise<string> {
    assertInput(
      /^[\w.-]+\.(?:xml|xsd|htm|html|txt)$/.test(query.name),
      "Unsupported or unsafe archive document name",
    );
    return this.transport.text(
      archiveBase(query.cik, query.accessionNumber) + query.name,
      options,
    );
  }
}
