# Flow files

Each `.json` file here describes one lo-fi UI flow: its screens, what's on them, where each button goes, and any decisions or notes. Copilot writes these when the Director asks for a flow (see [docs/AGENT-FLOWS.md](../docs/AGENT-FLOWS.md)).

Turn a file into a link that opens it as a **new, editable board**:

```bash
npm run flow -- flows/password-reset.json          # link to the live app
npm run flow -- flows/password-reset.json --local  # link to http://localhost:5173/ (npm run dev)
```

The command checks the file first. If something is wrong (for example a button going to a screen that doesn't exist) it lists the problems and prints no link.

The link holds the whole flow, compressed, after a `#` — nothing is uploaded. Opening it in a browser builds the board, saves it on that device as a new board (named after the flow) and opens the editor. Opening it twice makes two boards.

## Format in short

```json
{
  "name": "Password reset",
  "device": "mobile",
  "screens": [
    { "id": "login", "name": "Log in", "components": [
      { "type": "header", "text": "Log in" },
      { "type": "input", "label": "Email" },
      { "type": "button", "text": "Forgot password?", "goTo": "reset" }
    ] },
    { "id": "reset", "name": "Reset password", "components": [ { "type": "button", "text": "Send link", "goTo": "found" } ] },
    { "id": "sent", "name": "Check your inbox" },
    { "id": "error", "name": "Email not found" }
  ],
  "decisions": [ { "id": "found", "text": "Email found?", "yes": "sent", "no": "error" } ],
  "notes": [ { "text": "Ask security about wording", "near": "error" } ]
}
```

- `device`: `mobile` (default), `tablet` or `desktop`.
- The first screen is where Play starts. `goTo` on a button, link, card, list… makes it clickable in Play; `next` on a screen draws a plain arrow. Add `"tap": "<item>"` (or `taps` for several targets, `{ "row": 2 }` for a table row) to say which part is tapped; the board marks it with a lime tap highlight and the arrow starts there. On desktop, `"side": "right"` puts a component in a right-hand column (e.g. an in-page Contents list).
- Component `type` is any kit component (`header`, `nav`, `button`, `link`, `input`, `textarea`, `search`, `dropdown`, `checkbox`, `toggle`, `radio`, `slider`, `datepicker`, `heading`, `text`, `caption`, `image`, `icon`, `icon-button`, `fab`, `avatar`, `badge`, `card`, `list`, `table`, `tabs`, `menu`, `sidebar`, `breadcrumbs`, `pagination`, `modal`, `toast`, `tooltip`, `progress`, `spinner`, `calendar`, `line-chart`, `stacked-chart`, `video`, `divider`) or a friendly alias (`title`, `paragraph`, `email`, `cta`, `select`, `switch`, `photo`, `dialog`…). Unknown types become a placeholder, never an error.
- `options`: other versions of the same flow (Option B…) shown in their own lanes, ready for Compare.

The full reference — every field, component option, alias and icon name — is in the [flow-designer agent](../.github/agents/flow-designer.agent.md). The code is `src/platform/flowSpec.ts` (checks) and `src/platform/flowSpecBoard.ts` (layout).
