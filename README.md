# UI Workflow Editor

Sketch lo-fi wireframes, link them into flows, and compare Option A vs Option B — on one calm, infinite canvas.

**Live app: https://timea-ve.github.io/ui-workflow-editor/**

## Run it

You need [Node.js](https://nodejs.org) 20 or newer. Then, in this folder:

```bash
npm install && npm run dev
```

Your browser opens the app automatically (http://localhost:5173).

## Other commands

| Command | What it does |
|---|---|
| `npm test` | Runs the automated tests |
| `npm run build` | Builds the production version |

## How it's published

- Every push to `main` builds the app and publishes it to GitHub Pages ([`.github/workflows/pages.yml`](.github/workflows/pages.yml)). Every push and pull request also runs the checks and tests ([`ci.yml`](.github/workflows/ci.yml)).
- There is no server. Boards stay on each person's own device (in the browser).
- A share link carries a read-only copy of the board inside the link itself. Making a new link after changes shares the latest version; links already sent keep showing the copy they were made with.
- To build for a sub-path yourself: `BASE_PATH=/ui-workflow-editor/ npm run build` (the build also writes `dist/404.html` so direct links work on GitHub Pages).

## Docs

- [Project status](docs/PROJECT-STATUS.md)
- [Decision log](docs/DECISION-LOG.md)
- [Product brief](docs/BRIEF.md)
- Gate summaries: [`docs/gates/`](docs/gates/)
