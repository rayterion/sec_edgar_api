import { XMLParser, XMLValidator } from "fast-xml-parser";
import { EdgarError, schema } from "../errors.js";
import { isoDate, record } from "./json.js";
import { normalizeCik } from "../companies/index.js";
export interface FilingXbrlFact {
  taxonomy: string;
  tag: string;
  exactValue: string | null;
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
function asArray(value: unknown): unknown[] {
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}
function child(object: Record<string, unknown>, name: string): unknown {
  return (
    object[name] ??
    Object.entries(object).find(([key]) => key.endsWith(":" + name))?.[1]
  );
}
function stringNode(value: unknown): string | null {
  return typeof value === "string"
    ? value
    : record(value) && typeof value["#text"] === "string"
      ? value["#text"]
      : null;
}
function dimensions(value: unknown): unknown[] {
  if (!record(value)) return [];
  const result: unknown[] = [];
  for (const [key, entry] of Object.entries(value)) {
    if (key.endsWith("explicitMember") || key.endsWith("typedMember"))
      result.push(entry);
    else if (record(entry)) result.push(...dimensions(entry));
    else if (Array.isArray(entry))
      for (const item of entry) result.push(...dimensions(item));
  }
  return result;
}
export function parseXbrlInstance(
  xml: string,
  sourceUrl: string,
): FilingXbrlFact[] {
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml))
    throw new EdgarError(
      "UNSUPPORTED",
      "DTD and entities are not accepted in XBRL instance XML",
      { url: sourceUrl },
    );
  const valid = XMLValidator.validate(xml);
  if (valid !== true)
    throw new EdgarError("MALFORMED_XML", "Filing XBRL XML is malformed", {
      url: sourceUrl,
    });
  const parser = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: true,
  });
  const parsed = parser.parse(xml) as unknown;
  schema(record(parsed), "Invalid XBRL instance root", sourceUrl);
  const root = child(parsed, "xbrl");
  schema(record(root), "Missing XBRL instance root", sourceUrl);
  const contexts = new Map<string, Record<string, unknown>>();
  for (const value of asArray(child(root, "context"))) {
    schema(
      record(value) && typeof value["@_id"] === "string",
      "Invalid XBRL context",
      sourceUrl,
    );
    contexts.set(value["@_id"], value);
  }
  const units = new Map<string, string>();
  for (const value of asArray(child(root, "unit"))) {
    schema(
      record(value) && typeof value["@_id"] === "string",
      "Invalid XBRL unit",
      sourceUrl,
    );
    const measure = stringNode(child(value, "measure"));
    const divide = child(value, "divide");
    if (measure)
      units.set(
        value["@_id"],
        measure.replace(/^iso4217:/, "").replace(/^xbrli:/, ""),
      );
    else if (record(divide)) {
      const numerator = child(divide, "unitNumerator"),
        denominator = child(divide, "unitDenominator");
      const n = record(numerator)
        ? stringNode(child(numerator, "measure"))
        : null;
      const d = record(denominator)
        ? stringNode(child(denominator, "measure"))
        : null;
      if (n && d)
        units.set(
          value["@_id"],
          `${n.replace(/^iso4217:/, "")}-per-${d.replace(/^xbrli:/, "")}`,
        );
    }
  }
  const results: FilingXbrlFact[] = [];
  for (const [qualified, item] of Object.entries(root)) {
    for (const fact of asArray(item)) {
      if (
        !record(fact) ||
        typeof fact["@_contextRef"] !== "string" ||
        typeof fact["@_unitRef"] !== "string"
      )
        continue;
      const context = contexts.get(fact["@_contextRef"]);
      const unit = units.get(fact["@_unitRef"]);
      schema(
        context && unit,
        "XBRL fact references a missing context or unit",
        sourceUrl,
      );
      const period = child(context, "period");
      const entity = child(context, "entity");
      schema(
        record(period) && record(entity),
        "Invalid XBRL fact context",
        sourceUrl,
      );
      const identifier = stringNode(child(entity, "identifier"));
      schema(
        identifier && /^\d{1,10}$/.test(identifier),
        "Invalid XBRL entity identifier",
        sourceUrl,
      );
      const start = stringNode(child(period, "startDate"));
      const end =
        stringNode(child(period, "endDate")) ??
        stringNode(child(period, "instant"));
      schema(
        end && isoDate(end) && (start === null || isoDate(start)),
        "Invalid XBRL context dates",
        sourceUrl,
      );
      const nil = fact["@_xsi:nil"] === "true" || fact["@_nil"] === "true";
      const exactValue = nil ? null : stringNode(fact["#text"]);
      schema(
        nil || (exactValue !== null && /^-?\d+(?:\.\d+)?$/.test(exactValue)),
        "Invalid numeric XBRL fact",
        sourceUrl,
      );
      const [taxonomy = "", tag = qualified] = qualified.includes(":")
        ? qualified.split(":", 2)
        : ["", qualified];
      results.push({
        taxonomy,
        tag,
        exactValue,
        unit,
        cik: normalizeCik(identifier),
        ...(start ? { start } : {}),
        end,
        contextRef: fact["@_contextRef"],
        unitRef: fact["@_unitRef"],
        ...(typeof fact["@_decimals"] === "string"
          ? { decimals: fact["@_decimals"] }
          : {}),
        dimensions: [
          ...dimensions(child(entity, "segment")),
          ...dimensions(child(context, "scenario")),
        ],
        sourceUrl,
      });
    }
  }
  return results;
}
