# Standalone GitHub-tag consumer

This app installs `@rayterion/sec-edgar` from `github:rayterion/sec_edgar_api#v1.0.0`. Its lockfile pins the tag commit. It is outside the repository workspaces, so `npm ci` here does not use the local package symlink.

Use Node.js 24 or newer. Run:

```bash
cd examples/npm-consumer
npm ci
npm test
cp -n .env.example .env
# Edit .env: SEC_USER_AGENT="Your Name your-real-email@your-domain.com"
npm start -- AAPL 2025 2
```

`npm start` loads `.env` when present. Set `SEC_USER_AGENT` there once using your real name or organization and a monitored contact address. An environment variable supplied in the shell overrides the file. If neither is set, the app stops before contacting the SEC. Do not commit `.env`; it is ignored by Git. The command returns full income and balance statements, including `details` with SEC source links, `coverage`, and `warnings`. Missing values remain `null`. The live command contacts SEC; the unit tests do not.
