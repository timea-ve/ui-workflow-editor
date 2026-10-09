# Ask Copilot for a flow

You can describe a flow in plain words and get back a link. Opening the link adds the flow to your boards as a **new board you can edit**, with screens already linked so Play works straight away.

Nothing extra to set up and no AI keys in the app: Copilot writes a small flow file in the project and turns it into the link. The link holds the whole flow, and nothing is uploaded when you open it.

## What to ask

Say what the flow is for, the device, and anything that must be in it. Short is fine.

> Make a password reset flow for mobile. If the email isn't found, show an error and let them try again.

> Checkout for a shop on desktop: cart, delivery address, payment, confirmation. Guests can check out without an account.

> Onboarding for a meditation app: 3 intro screens with Skip, then pick goals, then the home screen with a bottom tab bar.

> Same sign-up flow, but give me Option A with a password and Option B with a magic email link so I can compare them.

> Add a "Remember me" checkbox to the log-in screen in the password reset flow.

Tips:
- Mention a **decision** when the flow branches ("if the card is declined…").
- Ask for **Option A / Option B** when you want to compare two ideas.
- Big products work better as several smaller flows (one link each).

## Where to ask

### A. On github.com

Open the project: https://github.com/timea-ve/ui-workflow-editor

**Option 1 — open an issue and give it to Copilot** (best when you don't need it right away)
1. Go to **Issues → New issue**.
2. Title: what you want, e.g. "Flow: password reset (mobile)". Write your request in the description.
3. On the right, under **Assignees**, choose **Copilot**. If you see a choice of agent, pick **flow-designer**.
4. Copilot works for a few minutes and opens a pull request. The **link is at the top of the pull request description** — click it. You'll also get a notification.

**Option 2 — ask in the Copilot panel**
1. On the project page, open **Copilot** (the Copilot icon at the top), or go to https://github.com/copilot/agents and choose this repository.
2. In the agent picker choose **flow-designer**, type your request and send.
3. When it's done, open the task or pull request it made and click the link.

You don't need to merge the pull request for the link to work. Merging just keeps the flow file in the project for later changes.

### B. In the Copilot app or the terminal (here)

1. Open the project in the Copilot app (or run `copilot` in the project folder).
2. Ask for the flow, e.g. "Use the flow-designer agent: a password reset flow for mobile…". In the terminal you can also type `/agent` and pick **flow-designer** first.
3. Copilot replies with the link. Click it.

If the app is running on your computer (`npm run dev`), you can ask for a "local link" to open it there instead of the live site.

## When you open the link

- A new board appears with the flow's name and opens in the editor. It's saved on this device, like any other board.
- Press **Play** (or P) to click through it. Edit anything — it's your board now.
- Opening the same link again makes another copy. Delete extras from your boards page.
- If you see **"This flow link is incomplete"**, the link was probably cut off when copied. Ask Copilot to send it again.

## Changing a flow

Ask in the same issue, pull request or chat, e.g. "Make the error screen friendlier and add a support link." Copilot updates the file and gives you a **new link**, which opens as a new board (your earlier board stays as it was).

---

For the people setting this up: the flow format and Copilot's instructions are in [`.github/agents/flow-designer.agent.md`](../.github/agents/flow-designer.agent.md); flow files live in [`flows/`](../flows/README.md); `npm run flow -- flows/<file>.json` prints the link. Copilot on github.com needs a Copilot plan that includes the coding agent, enabled for this repository.
