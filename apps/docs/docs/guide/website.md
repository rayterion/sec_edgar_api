# Run and publish the documentation site

From the repository root, install locked dependencies with `npm ci`, then run:

```bash
npm run docs:start
```

Docusaurus serves the development site at `http://localhost:3000/sec_edgar_api/`. To inspect the production build locally, run `npm run docs:build` followed by `npm run docs:serve`. Both commands use the same project base path.

The [Docs Pages workflow](https://github.com/rayterion/sec_edgar_api/actions/workflows/docs-pages.yml) builds `apps/docs`, uploads `apps/docs/build`, and deploys it from `main`. GitHub Pages serves this repository's project site at `https://rayterion.github.io/sec_edgar_api/`. The workflow also supports manual runs. It needs no SEC user agent or API key because it only builds static documentation.

Before the first deployment, a repository administrator must open **Settings → Pages → Build and deployment**, then select **GitHub Actions** as the source. GitHub's default workflow token cannot enable Pages on a repository that has not enabled it yet. After selecting the source, re-run **Docs Pages** from the Actions tab or push to `main`. Check that both build and deploy jobs pass and open the published URL. See [GitHub's Pages source instructions](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

The configured `url` is the site origin and `baseUrl` is `/sec_edgar_api/`. If the repository name or Pages domain changes, update both in `apps/docs/docusaurus.config.cjs` and run `npm run test:deployment` after a new build. See [Docusaurus deployment guidance](https://docusaurus.io/docs/deployment).
