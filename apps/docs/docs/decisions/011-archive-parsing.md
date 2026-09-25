# ADR 011: Archive Parsing

- **Date:** 2026-09-24
- **Status:** Accepted for the current implementation; evidence gaps are tracked in the research log.

## Context

The public SEC client must expose useful financial data while respecting the endpoint behavior recorded in [research](../research/endpoint-inventory.md).

## Decision

Allowlist filing archive paths and expose document index and bounded text retrieval. Extract numeric `_htm.xml` facts and supported Inline `ix:nonFraction` HTML facts with context, unit, exact scale/sign, nil, taxonomy, dimensions, status, and source URL. Prefer the XML instance when present; otherwise find the primary HTML document through filing metadata and the archive index. Unsupported Inline transformations or nested numeric content yield null with an explicit reason. Do not map custom or dimensional facts to canonical fields without a researched policy.

## Alternatives considered

Fetch arbitrary URL; regex values from HTML.

## Rationale

Filing context and dimensions are essential to meaning.

## Consequences

Full Inline XBRL conformance, additional transformation registries, continuations, nested facts, and canonical enrichment remain unsupported. The parser depends on `htmlparser2` to handle HTML syntax, while the existing XML parser remains for `_htm.xml`. Revisit this record when new fixtures contradict its assumptions.

## Evidence

[Research finding](../research/endpoint-inventory.md); [source register](../research/sources.md).
