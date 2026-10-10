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
| `npm run flow -- flows/<file>.json` | Turns a flow file into a link that opens it as a new board (`--local` for this computer) |

## Ask Copilot for a flow

Describe a flow in plain words to Copilot (on github.com or in the Copilot app) and get back a link that opens it as a new, editable board. No AI keys in the app. How to ask, with example prompts: [docs/AGENT-FLOWS.md](docs/AGENT-FLOWS.md).

## Save boards to GitHub

Boards are saved on your device as you work. Sign in with GitHub (dashboard, top right) and they're also
copied to a private repository, `ui-workflow-boards`, in your account — so they're backed up and show up on
your other devices. How it works and how to set it up: [docs/GITHUB-SAVE.md](docs/GITHUB-SAVE.md). Without
the three `VITE_*` values in [`.env.example`](.env.example) the button simply doesn't appear.

## How it's published

- Every push to `main` builds the app and publishes it to GitHub Pages ([`.github/workflows/pages.yml`](.github/workflows/pages.yml)). Every push and pull request also runs the checks and tests ([`ci.yml`](.github/workflows/ci.yml)).
- There is no server. Boards stay on each person's own device (in the browser).
- A share link carries a read-only copy of the board inside the link itself. Making a new link after changes shares the latest version; links already sent keep showing the copy they were made with.
- To build for a sub-path yourself: `BASE_PATH=/ui-workflow-editor/ npm run build` (the build also writes `dist/404.html` so direct links work on GitHub Pages).

## Docs

- [Ask Copilot for a flow](docs/AGENT-FLOWS.md)
- [Save boards to GitHub](docs/GITHUB-SAVE.md)
- [Project status](docs/PROJECT-STATUS.md)
- [Decision log](docs/DECISION-LOG.md)
- [Product brief](docs/BRIEF.md)
- Gate summaries: [`docs/gates/`](docs/gates/)
