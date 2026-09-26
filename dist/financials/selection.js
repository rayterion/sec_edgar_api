import { subtractDecimal } from "./decimal.js";
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
function factsFor(data, taxonomy, tag, unit) {
    const entries = data.facts[taxonomy]?.[tag]?.units?.[unit];
    return Array.isArray(entries)
        ? entries.filter((x) => typeof x === "object" &&
            x !== null &&
            typeof x.end === "string" &&
            (typeof x.val === "number" ||
                typeof x.val === "string") &&
            typeof x.accn === "string" &&
            typeof x.filed === "string" &&
            typeof x.form === "string")
        : [];
}
function rank(a, b, policy, accession) {
    const exactA = a.accn === accession ? 1 : 0;
    const exactB = b.accn === accession ? 1 : 0;
    if (policy === "asFiled" && exactA !== exactB)
        return exactB - exactA;
    const formA = forms.has(a.form) ? 1 : 0;
    const formB = forms.has(b.form) ? 1 : 0;
    if (formA !== formB)
        return formB - formA;
    const date = policy === "latest"
        ? b.filed.localeCompare(a.filed)
        : a.filed.localeCompare(b.filed);
    return (date ||
        (policy === "latest"
            ? b.accn.localeCompare(a.accn)
            : a.accn.localeCompare(b.accn)));
}
function sameSource(a, b) {
    return (a.accn === b.accn &&
        a.filed === b.filed &&
        a.form === b.form &&
        a.start === b.start &&
        a.end === b.end);
}
function conflicting(source, rows) {
    return (new Set(rows
        .filter((row) => sameSource(row, source))
        .map((row) => String(row.val))).size > 1);
}
function trace(concepts, enabled, describe) {
    if (!enabled)
        return [];
    return concepts.flatMap(({ taxonomy, tag, candidates, excluded }) => [
        ...candidates.map((row) => ({
            row,
            reason: describe(row, taxonomy, tag),
        })),
        ...excluded,
    ].map(({ row, reason }) => ({
        accessionNumber: row.accn,
        filed: row.filed,
        ...(row.start ? { start: row.start } : {}),
        end: row.end,
        taxonomy,
        tag,
        exactValue: String(row.val),
        reason,
    })));
}
function failure(failureCode, reason, candidates) {
    return { fact: null, failureCode, reason, candidates };
}
export function selectFactResult(data, cik, period, mapping, statementKind, options = {}) {
    const unit = options.unit ?? "USD";
    const policy = options.revision ?? "latest";
    const concepts = mapping.tags.map((concept) => {
        const [taxonomy, tag] = concept.split(":");
        const all = factsFor(data, taxonomy, tag, unit);
        return {
            taxonomy,
            tag,
            candidates: all.filter((row) => forms.has(row.form) && (!options.asOf || row.filed <= options.asOf)),
            excluded: all
                .filter((row) => !forms.has(row.form) ||
                (options.asOf !== undefined && row.filed > options.asOf))
                .map((row) => ({
                row,
                reason: options.asOf && row.filed > options.asOf
                    ? "filed after asOf"
                    : "unsupported form",
            })),
        };
    });
    // Exact direct periods outrank every derived value. Revision rank crosses
    // approved aliases; mapping order breaks equal-source/equal-date ties.
    const direct = concepts
        .flatMap((concept, aliasIndex) => concept.candidates
        .filter((row) => row.end === period.end &&
        (statementKind === "balance"
            ? row.start === undefined
            : row.start === period.start))
        .map((row) => ({ row, concept, aliasIndex })))
        .sort((a, b) => rank(a.row, b.row, policy, period.filingAccession) ||
        a.aliasIndex - b.aliasIndex);
    const directWinner = direct[0];
    if (directWinner) {
        const { row: winner, concept } = directWinner;
        const sameAlias = direct
            .filter((entry) => entry.concept === concept)
            .map((entry) => entry.row);
        const hasConflict = conflicting(winner, sameAlias);
        const candidates = trace(concepts, options.trace, (row, taxonomy, tag) => {
            if (taxonomy === concept.taxonomy &&
                tag === concept.tag &&
                sameSource(row, winner))
                return hasConflict
                    ? "conflicting equal-source fact"
                    : row === winner
                        ? "selected direct fact"
                        : "duplicate identical fact";
            if (row.end === period.end &&
                (statementKind === "balance"
                    ? row.start === undefined
                    : row.start === period.start))
                return "lower ranked exact-period fact";
            return "different period";
        });
        if (hasConflict)
            return failure("CONFLICTING_FACTS", `Conflicting equal-source values for ${concept.taxonomy}:${concept.tag} in ${winner.accn}`, candidates);
        const fact = makeSelected(winner, cik, concept.taxonomy, concept.tag, unit, "reported", options.trace ? candidates : undefined);
        return { fact, candidates };
    }
    if (statementKind !== "balance" &&
        mapping.additive &&
        period.kind === "quarter" &&
        period.fiscalQuarter &&
        period.fiscalQuarter > 1 &&
        period.fiscalStart &&
        period.priorEnd) {
        for (const concept of concepts) {
            const laterRows = concept.candidates
                .filter((row) => row.start === period.fiscalStart && row.end === period.end)
                .sort((a, b) => rank(a, b, policy, period.filingAccession));
            const earlierRows = concept.candidates.filter((row) => row.start === period.fiscalStart && row.end === period.priorEnd);
            const later = laterRows[0];
            if (!later || !earlierRows.length)
                continue;
            const sameCohort = earlierRows.filter((row) => row.accn === later.accn ||
                (Number.isInteger(later.fy) &&
                    Number.isInteger(row.fy) &&
                    row.fy === later.fy));
            const earlier = sameCohort.sort((a, b) => (a.accn === later.accn ? -1 : 0) - (b.accn === later.accn ? -1 : 0) ||
                rank(a, b, policy, period.filingAccession))[0];
            const candidates = trace(concepts, options.trace, (row, taxonomy, tag) => {
                if (taxonomy !== concept.taxonomy || tag !== concept.tag)
                    return "different alias";
                if (sameSource(row, later))
                    return conflicting(later, laterRows)
                        ? "conflicting equal-source fact"
                        : row === later
                            ? "later YTD operand"
                            : "duplicate identical fact";
                if (earlier && sameSource(row, earlier))
                    return conflicting(earlier, earlierRows)
                        ? "conflicting equal-source fact"
                        : row === earlier && earlier.filed <= later.filed
                            ? "prior YTD operand"
                            : row === earlier
                                ? "incompatible revision candidate"
                                : "duplicate identical fact";
                if (earlierRows.includes(row))
                    return "incompatible or lower-ranked prior YTD fact";
                if (laterRows.includes(row))
                    return "lower-ranked later YTD fact";
                return "different period";
            });
            if (conflicting(later, laterRows) ||
                (earlier && conflicting(earlier, earlierRows)))
                return failure("CONFLICTING_FACTS", `Conflicting equal-source year-to-date values for ${concept.taxonomy}:${concept.tag}`, candidates);
            if (!earlier)
                return failure("INCOMPATIBLE_REVISIONS", `No prior YTD fact shares the filing fiscal-year cohort of later ${concept.taxonomy}:${concept.tag} fact ${later.accn}`, candidates);
            if (earlier.filed > later.filed)
                return failure("INCOMPATIBLE_REVISIONS", `A newer prior YTD revision was filed after the selected later YTD fact ${later.accn}; no coherent pair is available`, candidates);
            const fact = makeSelected(later, cik, concept.taxonomy, concept.tag, unit, "derived", options.trace ? candidates : undefined);
            fact.exactValue = subtractDecimal(String(later.val), String(earlier.val));
            fact.start = period.start;
            fact.operands = [later, earlier].map((row) => ({
                exactValue: String(row.val),
                start: row.start,
                end: row.end,
                accessionNumber: row.accn,
                filed: row.filed,
                url: filingUrl(cik, row.accn),
            }));
            return { fact, candidates };
        }
    }
    return failure("NO_COMPATIBLE_FACT", "No exact reported fact or compatible additive year-to-date pair was available", trace(concepts, options.trace, () => "different period or unsupported context"));
}
export function selectFact(data, cik, period, mapping, statementKind, options = {}) {
    return selectFactResult(data, cik, period, mapping, statementKind, options)
        .fact;
}
function filingUrl(cik, accession) {
    return `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accession.replaceAll("-", "")}/${accession}.txt`;
}
function makeSelected(value, cik, taxonomy, tag, unit, status, candidates) {
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
