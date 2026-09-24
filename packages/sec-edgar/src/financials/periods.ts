import { EdgarError, assertInput } from "../errors.js";
import { isoDate } from "../parsers/json.js";
import type { Filing } from "../filings/index.js";
export interface FiscalPeriod {
  fiscalYear: number;
  fiscalQuarter: number | null;
  start: string;
  end: string;
  kind: "quarter" | "year" | "transition";
  filingAccession: string;
  fiscalStart?: string;
  priorEnd?: string;
}
const annualForms = new Set([
  "10-K",
  "10-K/A",
  "20-F",
  "20-F/A",
  "40-F",
  "40-F/A",
  "10-KT",
  "10-KT/A",
]);
const quarterForms = new Set(["10-Q", "10-Q/A"]);
function nextDay(date: string): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
export function determineFiscalPeriod(
  filings: Filing[],
  fiscalYear: number,
  fiscalQuarter?: number,
  asOf?: string,
  periodEnd?: string,
): FiscalPeriod {
  assertInput(
    Number.isInteger(fiscalYear) && fiscalYear >= 1994 && fiscalYear <= 2100,
    "Invalid fiscal year",
  );
  assertInput(
    fiscalQuarter === undefined ||
      (Number.isInteger(fiscalQuarter) &&
        fiscalQuarter >= 1 &&
        fiscalQuarter <= 4),
    "Invalid fiscal quarter",
  );
  if (periodEnd !== undefined)
    assertInput(isoDate(periodEnd), "Invalid periodEnd date");
  const visible = filings.filter(
    (x) => x.reportDate && (!asOf || x.filed <= asOf),
  );
  const annual = visible
    .filter(
      (x) =>
        annualForms.has(x.form) &&
        x.reportDate!.slice(0, 4) === String(fiscalYear) &&
        (!periodEnd || x.reportDate === periodEnd),
    )
    .sort(
      (a, b) =>
        b.reportDate!.localeCompare(a.reportDate!) ||
        a.filed.localeCompare(b.filed),
    );
  const target =
    annual.find(
      (x) => x.reportDate === annual[0]?.reportDate && !x.form.endsWith("/A"),
    ) ?? annual[0];
  if (!target && (fiscalQuarter === undefined || fiscalQuarter === 4))
    throw new EdgarError(
      "NOT_FOUND",
      `Fiscal ${fiscalYear} annual filing was not found`,
    );
  // A current-year quarter can be known before that year's annual report exists.
  // Anchor it to the previous annual report and only use quarter filings visible asOf.
  const end = target?.reportDate;
  const prior = visible
    .filter(
      (x) =>
        annualForms.has(x.form) &&
        (end
          ? x.reportDate! < end
          : x.reportDate!.slice(0, 4) === String(fiscalYear - 1)),
    )
    .sort((a, b) => b.reportDate!.localeCompare(a.reportDate!))[0];
  if (!prior)
    throw new EdgarError(
      "NOT_FOUND",
      "Prior annual report is needed to establish fiscal-year start",
    );
  const start = nextDay(prior.reportDate!);
  if (fiscalQuarter === undefined) {
    if (!target || !end)
      throw new EdgarError("NOT_FOUND", "Annual filing was not found");
    return {
      fiscalYear,
      fiscalQuarter: null,
      start,
      end,
      kind: target.form.startsWith("10-KT") ? "transition" : "year",
      filingAccession: target.accessionNumber,
    };
  }
  const quarters = visible
    .filter(
      (x) =>
        quarterForms.has(x.form) &&
        x.reportDate! > prior.reportDate! &&
        (!end || x.reportDate! < end),
    )
    .sort(
      (a, b) =>
        a.reportDate!.localeCompare(b.reportDate!) ||
        a.filed.localeCompare(b.filed),
    );
  const unique = [...new Map(quarters.map((x) => [x.reportDate, x])).values()];
  if (target?.form.startsWith("10-KT") && fiscalQuarter === unique.length + 1) {
    const previous = unique.at(-1)?.reportDate ?? prior.reportDate!;
    return {
      fiscalYear,
      fiscalQuarter,
      start: nextDay(previous),
      end: target.reportDate!,
      kind: "quarter",
      filingAccession: target.accessionNumber,
      fiscalStart: start,
      priorEnd: previous,
    };
  }
  if (fiscalQuarter === 4) {
    if (!target || !end || unique.length < 3)
      throw new EdgarError(
        "NOT_FOUND",
        "Q3 filing is needed to establish Q4 start",
      );
    return {
      fiscalYear,
      fiscalQuarter,
      start: nextDay(unique[2]!.reportDate!),
      end,
      kind: "quarter",
      filingAccession: target.accessionNumber,
      fiscalStart: start,
      priorEnd: unique[2]!.reportDate!,
    };
  }
  const quarter = unique[fiscalQuarter - 1];
  if (!quarter)
    throw new EdgarError(
      "NOT_FOUND",
      `Fiscal Q${fiscalQuarter} filing was not found`,
    );
  return {
    fiscalYear,
    fiscalQuarter,
    start:
      fiscalQuarter === 1
        ? start
        : nextDay(unique[fiscalQuarter - 2]!.reportDate!),
    end: quarter.reportDate!,
    kind: "quarter",
    filingAccession: quarter.accessionNumber,
    fiscalStart: start,
    priorEnd:
      fiscalQuarter === 1 ? undefined : unique[fiscalQuarter - 2]!.reportDate!,
  };
}
export function fiscalYearStart(
  filings: Filing[],
  year: number,
  asOf?: string,
): string {
  return determineFiscalPeriod(filings, year, undefined, asOf).start;
}
export function previousQuarterEnd(
  filings: Filing[],
  year: number,
  quarter: number,
  asOf?: string,
): string {
  if (quarter <= 1)
    throw new EdgarError(
      "INVALID_INPUT",
      "Q1 has no prior quarter in the fiscal year",
    );
  return determineFiscalPeriod(filings, year, quarter - 1, asOf).end;
}
