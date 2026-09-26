# Standalone npm consumer

This app installs `@rayterion/sec-edgar@1.0.0` from the public npm registry. It is outside the repository workspaces, so `npm ci` here does not use the local package symlink.

Use Node.js 24 or newer. Once the package is published:

```bash
cd examples/npm-consumer
npm install
npm test
SEC_USER_AGENT="Example Research contact@example.com" npm start -- AAPL 2025 2
```

Use your real name or organization and a monitored contact address in `SEC_USER_AGENT`. The command returns full income and balance statements, including `details` with SEC source links, `coverage`, and `warnings`. Missing values remain `null`. The live command contacts SEC; the unit tests do not.
