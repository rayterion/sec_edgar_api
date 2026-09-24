---
sidebar_position: 1
slug: /
---

# SEC EDGAR Client

An unofficial, read-only Node.js library for public SEC data. It runs locally, makes requests directly to SEC hosts, and needs no API key. It never submits filings. SEC data can be delayed, corrected, removed, or incomplete.

```mermaid
flowchart LR
  A[Your Node.js program] --> B[SEC EDGAR client]
  B --> C[data.sec.gov JSON]
  B --> D[sec.gov filing archives]
  C --> E[Normalized statement]
  D --> E
  E --> F[Values, exact details, coverage, warnings]
```

Start with the [five-minute quick start](guide/quick-start.md), then inspect the [API reference](api/reference.md), [selection guide](guide/lineage.md), [source coverage](research/endpoint-inventory.md), and [known limitations](guide/limitations.md).
