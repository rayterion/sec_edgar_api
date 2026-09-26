# ADR 014: Distribution

- **Date:** 2026-09-24; revised 2026-09-26
- **Status:** Accepted

## Context

The library lives in `packages/sec-edgar` inside a workspace. npm Git dependencies install the repository root at a tag. The user chose GitHub tags for distributing this package after npm publication failed. See the [dated research](../research/research-log.md#2026-09-26-github-tag-distribution).

## Decision

Keep the MIT core free and SEC retrieval direct. Assemble a release tree with a root `package.json`, compiled `dist/`, license, README, and a link to its source commit. Commit that tree on a release branch and tag it `v1.0.0`. Consumers depend on `github:rayterion/sec_edgar_api#v1.0.0` under the `@rayterion/sec-edgar` package name. Do not publish the library to the npm registry.

## Alternatives considered

A registry publication, a Git tag of the workspace root, and a hosted service. A workspace-root tag would install `sec-edgar-workspace`, which has no library export.

## Rationale

The release tag offers a root-installable artifact without changing the source workspace or requiring registry publication. A source commit link keeps the build auditable.

## Consequences

Git and GitHub availability are required for a fresh install; runtime dependencies still resolve through npm. Tags are immutable release identifiers and must never be moved. Each version needs a new assembled release commit and tag. The package remains unofficial and its coverage limits apply.

## Evidence

[Research log](../research/research-log.md#2026-09-26-github-tag-distribution); [source register](../research/sources.md); [ecosystem review](../research/ecosystem-review.md).
