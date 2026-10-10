# ui-workflow-editor-auth

Tiny Cloudflare Worker that swaps a GitHub sign-in code (or refresh token) for tokens, adding the
GitHub App's client secret. Stores nothing. Setup and deploy steps: [docs/GITHUB-SAVE.md](../docs/GITHUB-SAVE.md).

```sh
cd worker
npx wrangler deploy                          # set GITHUB_CLIENT_ID in wrangler.toml first
npx wrangler secret put GITHUB_CLIENT_SECRET
```

Tests run with the app's tests: `npx vitest run worker`.
