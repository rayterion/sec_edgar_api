import { DomUtils, parseDocument } from "htmlparser2";
import { EdgarError, schema } from "../errors.js";
import { normalizeCik } from "../companies/index.js";
import { isoDate } from "./json.js";
const byName = (name) => (node) => node.name === name;
function descendants(root, name) {
    return DomUtils.findAll(byName(name), root.children);
}
function first(root, name) {
    return descendants(root, name)[0];
}
function text(root, name) {
    const element = first(root, name);
    return element ? DomUtils.textContent(element).trim() : undefined;
}
function scaleDecimal(raw, scale, negative) {
    const [integer, fraction = ""] = raw.split(".");
    const coefficient = BigInt(integer + fraction);
    const shift = scale - fraction.length;
    const unsigned = shift >= 0
        ? (coefficient * 10n ** BigInt(shift)).toString()
        : (() => {
            const digits = coefficient.toString().padStart(-shift + 1, "0");
            const point = digits.length + shift;
            return `${digits.slice(0, point)}.${digits.slice(point).replace(/0+$/, "")}`.replace(/\.$/, "");
        })();
    return negative && coefficient !== 0n ? `-${unsigned}` : unsigned;
}
function transformedValue(fact) {
    if (fact.attribs["xsi:nil"] === "true")
        return { exactValue: null, status: "nil" };
    const format = fact.attribs.format?.split(":").at(-1)?.toLowerCase();
    if (format &&
        ![
            "num-dot-decimal",
            "numdotdecimal",
            "num-comma-decimal",
            "numcommadecimal",
            "fixed-zero",
            "fixedzero",
        ].includes(format))
        return {
            exactValue: null,
            status: "unsupported",
            reason: `Unsupported Inline XBRL transform ${fact.attribs.format}`,
        };
    if (fact.children.some((child) => child.type === "tag"))
        return {
            exactValue: null,
            status: "unsupported",
            reason: "Nested Inline XBRL numeric content is unsupported",
        };
    const raw = DomUtils.textContent(fact)
        .trim()
        .replace(/[\s\u00a0]/g, "");
    const number = format === "fixed-zero" || format === "fixedzero"
        ? "0"
        : format === "num-comma-decimal" || format === "numcommadecimal"
            ? raw.replace(/\./g, "").replace(",", ".")
            : raw.replace(/,/g, "");
    if (!/^\d+(?:\.\d+)?$/.test(number))
        return {
            exactValue: null,
            status: "unsupported",
            reason: "Numeric Inline XBRL text cannot be transformed safely",
        };
    const scale = Number(fact.attribs.scale ?? "0");
    schema(Number.isInteger(scale) && Math.abs(scale) <= 30, "Invalid Inline XBRL scale");
    schema(fact.attribs.sign === undefined || fact.attribs.sign === "-", "Invalid Inline XBRL sign");
    return {
        exactValue: scaleDecimal(number, scale, fact.attribs.sign === "-"),
        status: "reported",
    };
}
function unitsFrom(document) {
    const units = new Map();
    for (const unit of descendants(document, "xbrli:unit")) {
        const id = unit.attribs.id;
        schema(id, "Inline XBRL unit is missing an ID");
        schema(!units.has(id), "Duplicate Inline XBRL unit ID");
        const simple = text(unit, "xbrli:measure");
        if (simple) {
            units.set(id, simple.replace(/^iso4217:/, "").replace(/^xbrli:/, ""));
            continue;
        }
        const numerator = first(unit, "xbrli:unitNumerator");
        const denominator = first(unit, "xbrli:unitDenominator");
        const top = numerator && text(numerator, "xbrli:measure");
        const bottom = denominator && text(denominator, "xbrli:measure");
        schema(top && bottom, "Invalid Inline XBRL divided unit");
        units.set(id, `${top.replace(/^iso4217:/, "")}-per-${bottom.replace(/^xbrli:/, "")}`);
    }
    return units;
}
function contextsFrom(document) {
    const contexts = new Map();
    for (const context of descendants(document, "xbrli:context")) {
        const id = context.attribs.id;
        const identifier = text(context, "xbrli:identifier");
        const start = text(context, "xbrli:startDate");
        const end = text(context, "xbrli:endDate") ?? text(context, "xbrli:instant");
        schema(id && identifier && end && isoDate(end) && (!start || isoDate(start)), "Invalid Inline XBRL context");
        schema(!contexts.has(id), "Duplicate Inline XBRL context ID");
        const dimensions = DomUtils.findAll((node) => node.name === "xbrldi:explicitMember" ||
            node.name === "xbrldi:typedMember", context.children).map((node) => ({
            dimension: node.attribs.dimension ?? null,
            member: DomUtils.textContent(node).trim(),
        }));
        contexts.set(id, {
            cik: normalizeCik(identifier),
            ...(start ? { start } : {}),
            end,
            dimensions,
        });
    }
    return contexts;
}
export function parseInlineXbrl(html, sourceUrl) {
    const document = parseDocument(html, {
        lowerCaseTags: false,
        lowerCaseAttributeNames: false,
        decodeEntities: true,
        recognizeSelfClosing: true,
    });
    const root = document;
    const numeric = descendants(root, "ix:nonFraction");
    if (!numeric.length)
        throw new EdgarError("UNSUPPORTED", "No Inline XBRL numeric facts were found", { url: sourceUrl });
    const contexts = contextsFrom(root);
    const units = unitsFrom(root);
    return numeric.map((fact) => {
        const contextRef = fact.attribs.contextRef;
        const unitRef = fact.attribs.unitRef;
        const name = fact.attribs.name;
        const context = contextRef && contexts.get(contextRef);
        const unit = unitRef && units.get(unitRef);
        schema(context && unit && name && name.includes(":"), "Inline XBRL fact has a missing context, unit, or name", sourceUrl);
        const [taxonomy, tag] = name.split(":", 2);
        const value = transformedValue(fact);
        return {
            taxonomy,
            tag,
            ...value,
            unit,
            cik: context.cik,
            ...(context.start ? { start: context.start } : {}),
            end: context.end,
            contextRef,
            unitRef,
            ...(fact.attribs.decimals ? { decimals: fact.attribs.decimals } : {}),
            dimensions: context.dimensions,
            sourceUrl,
        };
    });
}
