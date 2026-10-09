# Copilot instructions — UI Workflow Editor

A browser app (React + TypeScript + Vite) for lo-fi wireframes and flows. No server: boards live in the browser. Checks: `npx tsc -b`, `npm run lint`, `npx vitest run`, `npx playwright test`.

## Creating flows for the Director

The Director is not technical and may ask for a flow in plain words ("make me a checkout flow with guest checkout"). Don't change app code for this. Instead:

1. Write a flow file `flows/<kebab-case-name>.json` in the format described in [`.github/agents/flow-designer.agent.md`](agents/flow-designer.agent.md) (example: [`flows/password-reset.json`](../flows/password-reset.json)).
2. Run `npm run flow -- flows/<file>.json`. Fix any errors it lists and run it again until it prints a link.
3. Reply with the link as a clickable markdown link plus a 2–4 line summary of the screens. In a pull request, put the link at the top of the description.

Opening the link creates a new editable board on the Director's device. Keep flows lo-fi: few components per screen, short realistic labels, and a `goTo` on every button or link that moves the user on.
