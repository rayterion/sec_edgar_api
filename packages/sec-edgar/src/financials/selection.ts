import { subtractDecimal } from "./decimal.js";
import type { FiscalPeriod } from "./periods.js";
import type { CompanyFacts } from "../xbrl/index.js";
import type { FieldMapping } from "./mapping.js";
export interface Operand {
  exactValue: string;
  start?: string;
  end: string;
  accessionNumber: string;
  filed: string;
  url: string;
}
export interface SelectedFact {
  exactValue: string;
  unit: string;
  status: "reported" | "derived";
  taxonomy: string;
  tag: string;
  start?: string;
  end: string;
  source: { accessionNumber: string; form: string; filed: string; url: string };
  operands?: [Operand, Operand];
  candidates?: Array<{
    accessionNumber: string;
    filed: string;
    start?: string;
    end: string;
    reason: string;
  }>;
}
export interface SelectionOptions {
  asOf?: string;
  revision?: "latest" | "asFiled";
  unit?: string;
  trace?: boolean;
}
interface Candidate {
  start?: string;
  end: string;
  val: number | string;
  accn: string;
  form: string;
  filed: string;
  frame?: string;
}
const forms = new Set([
  "10-Q",
  "10-Q/A",
  "10-K",
  "10-K/A",
  "20-F",
  "20-F/A",
  "40-F",
  "40-F/A",
  "10-KT",
  "10-KT/A",
]);
function factsFor(
  data: CompanyFacts,
  taxonomy: string,
  tag: string,
  unit: string,
): Candidate[] {
  const entries = data.facts[taxonomy]?.[tag]?.units?.[unit];
  return Array.isArray(entries)
    ? entries.filter(
        (x): x is Candidate =>
          typeof x === "object" &&
          x !== null &&
          typeof (x as Candidate).end === "string" &&
          (typeof (x as Candidate).val === "number" ||
            typeof (x as Candidate).val === "string") &&
          typeof (x as Candidate).accn === "string" &&
          typeof (x as Candidate).filed === "string" &&
          typeof (x as Candidate).form === "string",
      )
    : [];
}
function rank(
  a: Candidate,
  b: Candidate,
  policy: "latest" | "asFiled",
  accession: string,
): number {
  const exactA = a.accn === accession ? 1 : 0,
    exactB = b.accn === accession ? 1 : 0;
  if (policy === "asFiled" && exactA !== exactB) return exactB - exactA;
  const formA = forms.has(a.form) ? 1 : 0,
    formB = forms.has(b.form) ? 1 : 0;
  if (formA !== formB) return formB - formA;
  const date =
    policy === "latest"
      ? b.filed.localeCompare(a.filed)
      : a.filed.localeCompare(b.filed);
  return (
    date ||
    (policy === "latest"
      ? b.accn.localeCompare(a.accn)
      : a.accn.localeCompare(b.accn))
  );
}
export function selectFact(
  data: CompanyFacts,
  cik: string,
  period: FiscalPeriod,
  mapping: FieldMapping,
  statementKind: "income" | "balance" | "cashFlow",
  options: SelectionOptions = {},
): SelectedFact | null {
  const unit = options.unit ?? "USD";
  const policy = options.revision ?? "latest";
  const concepts = mapping.tags.map((concept) => {
    const [taxonomy, tag] = concept.split(":") as [string, string];
    const candidates = factsFor(data, taxonomy, tag, unit).filter(
      (x) => forms.has(x.form) && (!options.asOf || x.filed <= options.asOf),
    );
    return { taxonomy, tag, candidates };
  });
  // A direct exact-period fact wins before any mapping alias is considered for derivation.
  for (const { taxonomy, tag, candidates } of concepts) {
    const target = candidates
      .filter(
        (x) =>
          x.end === period.end &&
          (statementKind === "balance"
            ? x.start === undefined
            : x.start === period.start),
      )
      .sort((a, b) => rank(a, b, policy, period.filingAccession));
    const selected = target[0];
    if (!selected) continue;
    const trace = options.trace
      ? candidates.map((x) => ({
          accessionNumber: x.accn,
          filed: x.filed,
          start: x.start,
          end: x.end,
          reason:
            x === selected
              ? "selected direct fact"
              : target.includes(x)
                ? "lower ranked exact-period fact"
                : "different period",
        }))
      : undefined;
    return makeSelected(selected, cik, taxonomy, tag, unit, "reported", trace);
  }
  if (
    statementKind === "balance" ||
    !mapping.additive ||
    period.kind !== "quarter" ||
    !period.fiscalQuarter ||
    period.fiscalQuarter <= 1 ||
    !period.fiscalStart ||
    !period.priorEnd
  )
    return null;
  for (const { taxonomy, tag, candidates } of concepts) {
    const later = candidates
      .filter((x) => x.start === period.fiscalStart && x.end === period.end)
      .sort((a, b) => rank(a, b, policy, period.filingAccession))[0];
    const earlier = candidates
      .filter(
        (x) => x.start === period.fiscalStart && x.end === period.priorEnd,
      )
      .sort((a, b) => rank(a, b, policy, period.filingAccession))[0];
    if (!later || !earlier) continue;
    const trace = options.trace
      ? candidates.map((x) => ({
          accessionNumber: x.accn,
          filed: x.filed,
          start: x.start,
          end: x.end,
          reason:
            x === later
              ? "later YTD operand"
              : x === earlier
                ? "prior YTD operand"
                : "different period or lower rank",
        }))
      : undefined;
    const result = makeSelected(
      later,
      cik,
      taxonomy,
      tag,
      unit,
      "derived",
      trace,
    );
    result.exactValue = subtractDecimal(String(later.val), String(earlier.val));
    result.start = period.start;
    result.operands = [later, earlier].map((x) => ({
      exactValue: String(x.val),
      start: x.start,
      end: x.end,
      accessionNumber: x.accn,
      filed: x.filed,
      url: filingUrl(cik, x.accn),
    })) as [Operand, Operand];
    return result;
  }
  return null;
}
function filingUrl(cik: string, accession: string): string {
  return `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accession.replaceAll("-", "")}/${accession}.txt`;
}
function makeSelected(
  value: Candidate,
  cik: string,
  taxonomy: string,
  tag: string,
  unit: string,
  status: "reported" | "derived",
  candidates?: SelectedFact["candidates"],
): SelectedFact {
  return {
    exactValue: String(value.val),
    unit,
    status,
    taxonomy,
    tag,
    start: value.start,
    end: value.end,
    source: {
      accessionNumber: value.accn,
      form: value.form,
      filed: value.filed,
      url: filingUrl(cik, value.accn),
    },
    ...(candidates ? { candidates } : {}),
  };
}
