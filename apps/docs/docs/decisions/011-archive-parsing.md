# ADR 011: Archive Parsing

- **Date:** 2026-09-24
- **Status:** Accepted for the current implementation; evidence gaps are tracked in the research log.

## Context

The public SEC client must expose useful financial data while respecting the endpoint behavior recorded in [research](../research/endpoint-inventory.md).

## Decision

Allowlist filing archive paths and expose document index and bounded text retrieval, and extract numeric `_htm.xml` facts with their XBRL context and units; do not map custom or dimensional facts to canonical fields without a supported policy.

## Alternatives considered

Fetch arbitrary URL; regex values from HTML.

## Rationale

Filing context and dimensions are essential to meaning.

## Consequences

Inline HTML-only extraction and canonical enrichment remain explicit release blockers. Revisit this record when new fixtures contradict its assumptions.

## Evidence

[Research finding](../research/endpoint-inventory.md); [source register](../research/sources.md).
