# ADR 021: Documentation hosting on GitHub Pages

- **Date:** 2026-09-25
- **Status:** Accepted; first remote deployment pending repository Pages activation.

## Context

The Docusaurus site exists in the workspace, but its origin is a placeholder and no public deployment is configured. Readers need an accessible site while source and builds remain reviewable in the repository.

## Decision

Use GitHub Pages for the repository project site at `https://rayterion.github.io/sec_edgar_api/`. Set Docusaurus `url`, `baseUrl`, and trailing-slash behavior for that path. Add root commands for local development and serving the production build. A separate Actions workflow builds static files, uploads the Pages artifact, and deploys from `main` with `pages: write` and `id-token: write` only in the deploy job. Keep the existing CI docs build gate. Test generated canonical and asset URLs.

## Alternatives considered

Commit generated files to a `gh-pages` branch; use an external hosting service; publish from the repository's source `docs` directory.

## Rationale

The official Pages artifact workflow publishes the generated site without committing build output or requiring a third-party host. The repository project path is stable and the local script uses the same configuration. Separating build and deploy jobs keeps deployment credentials out of the build job.

## Consequences

A repository administrator must first select **GitHub Actions** as the Pages source. The workflow token cannot activate an unconfigured Pages site. Changing the repository name, owner, or custom domain requires a coordinated config and test update. The site is public; documentation must not include secrets or private data. See the [website guide](../guide/website.md).

## Evidence

[Pages and Docusaurus research](../research/research-log.md#2026-09-25-documentation-deployment), [source register](../research/sources.md), `test/docs-deployment.test.mjs`, and the [GitHub Pages custom workflow guide](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
