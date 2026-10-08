# FlowSketch — Competitive Research (Phase 1)

Scope: Whimsical, Balsamiq, Excalidraw, FigJam, tldraw, Miro, evaluated specifically for lo-fi wireframing + flow/diagram linking. Inspiration only — no proprietary assets or branding are reproduced here.

## 1. Plain-language summary (for the Director)

- **No competitor truly treats "a screen" and "a flow step" as the same thing.** Whimsical and Miro get closest (wireframes + connectors on one canvas), but none make comparing *alternative* flows ("Option A vs B") a first-class, built-in feature — that's an opening for FlowSketch.
- **Speed tools (Whimsical, Excalidraw, tldraw) are fast but shallow**; power tools (Miro, FigJam) are richer but slower and need onboarding. FlowSketch should sit at the fast end, since our principle #2 is "speed over power."
- **Click-through prototyping is usually bolted onto a separate "mode"** (Balsamiq's clickable preview, Miro's separate Prototyping Library, Figma Design hand-off) rather than being the same arrows you draw. FlowSketch can keep the diagram arrow *as* the prototype link.
- **Pricing in this market is cheap at entry** ($0–$16/editor to start) and gets expensive once real collaboration or prototyping is needed ($20+/user at Miro Business, $6k/yr for tldraw's commercial SDK). There's room for a generous free/indie tier.
- **The most common user complaint across every tool is the same: things get messy and slow once a board has many screens/elements** — exactly the quality bar our MVP targets (smooth at 50+ screens), so this is a real differentiator if we nail it.

## 2. Comparison table

| Tool | Lo-fi wireframe kit | Diagram/flow connectors | Element→screen linking | Click-through prototype | Variants/alternatives comparison | Templates | Export/share | Pricing model | Notable weakness |
|---|---|---|---|---|---|---|---|---|---|
| **Whimsical** | Yes — drag-drop UI components, device frames (web/mobile/tablet), icon library, adjustable states [whimsical.com/wireframes] | Yes — arrows auto-snap/reroute between shapes/screens on the same canvas [whimsical.com/wireframes] | Yes — wireframes and flowchart arrows live on one canvas, screens link via directional arrows [whimsical.com/wireframes] | Limited — no dedicated "play" click-through mode; linking is visual/presentational, not a runtime preview | No — duplicating a flow for comparison is manual copy/paste, no native "variant" concept | Yes — expert-made templates | PNG/PDF export, read-only share links, embeds | Free (3,000 items/workspace); Pro from $12/editor/mo; Org tier w/ SSO [lemonsight.com/tool/productivity/whimsical] | Weak layer management on complex diagrams; guest collaborators must create accounts; free tier item cap pushes upgrades [selecthub.com comparison] |
| **Balsamiq** | Yes — core strength; intentionally "sketchy" wireframe-only component set | No real flow/diagram shapes (no decision diamonds, swimlanes) — it's wireframe-first, not diagram-first | Yes — explicit "link this element to another screen" feature is the product's signature capability [balsamiq.com/product] | Yes — strongest in the set: true clickable prototype, exportable as a working PDF with live links [balsamiq.com/product] | No — no native variant/compare view; teams duplicate project files to explore alternatives | Yes — reusable component libraries & templates | PDF/PNG export with working links; unlimited free "reviewer" accounts | Cloud: Starter $16, Teams $24, Enterprise $35 per editor/mo; desktop one-time license also exists [balsamiq.com/pricing] | Scope is narrow — no mind-maps/diagrams/sticky-note ideation; not built for polished or mid-fi work; thinner integrations than FigJam |
| **Excalidraw** | No dedicated kit out of the box, but community libraries exist (UX/UI stick-figure and wireframe libraries) [libraries.excalidraw.com] | Yes — arrows/lines with hand-drawn style; "frames" group content into slide-like areas | Partial — arrows can visually connect frames, but there's no structured "this button navigates to this screen" relationship or runtime behavior | No — explicitly no interactive/clickable prototyping; by design it stays at a sketch/ideation level | No | No built-in template system (relies on community libraries) | PNG/SVG export, shareable read-only/embeddable links (Excalidraw+) | Free for core use; Excalidraw+ ~$6–7/user/mo for cloud sync, workspaces, presentation mode [plus.excalidraw.com/pricing] | No interactive prototyping or linking logic at all; free plan historically limited to one page/scene; image-handling limits [g2.com reviews] |
| **FigJam** | Yes, via Figma Community "Wireframe Kit" plugins/libraries (buttons, nav, cards, variants/properties) [figma.com/community wireframe-kit] | Yes — straight/bent/curved connectors, styleable, move with shapes; can auto-diagram from text/Mermaid | Partial — connectors suggest flow between wireframe pieces, but actual clickable prototyping requires moving to Figma Design — a separate tool/mode [help.figma.com connectors article] | No (not in FigJam itself) — hand-off to Figma Design is required for real click-through | No native "Option A/B" comparison primitive; teams duplicate frames side by side manually | Yes — large community template gallery | Export to Figma Design, image export, shareable links, dev hand-off | Free (3 collab files); paid tiers from ~$5/editor/mo (Figma-wide pricing) [thedigitalprojectmanager.com figjam-pricing] | Splits the workflow across two tools (FigJam for sketch, Figma Design for interactivity); gets cluttered with complex diagrams; needs internet connection [capterra reviews] |
| **tldraw** | No shipped kit — it's a canvas *SDK*, not an end-user wireframing product; teams must build their own component sets | Yes — arrows/bindings snap to shapes, fully supported as first-class primitives in the SDK | Developer-buildable — bindings/arrows can be wired to custom navigation logic, but nothing ships out of the box | Developer-buildable only — no consumer product ships this | N/A (framework, not a finished app) | None shipped; devs build their own | SVG/PNG/JSON export; devs build their own sharing | Free web app for individuals; commercial SDK license ~$6,000/yr for production use, free hobby/watermarked tier [tldraw.dev/pricing] | Not a finished product for our users — everything (wireframe kit, linking semantics, prototyping) must be built from scratch; real differentiator only for teams with engineering capacity |
| **Miro** | Yes — "Prototyping library" with drag-drop screens (mobile/tablet/desktop) + UI components | Yes — large shape/connector library for flowcharts, architectures, journeys | Yes — Business-plan "Prototypes" feature makes components interactive and lets you define navigation between screens | Yes — AI-assisted or manual clickable prototypes, previewable in-app [help.miro.com prototyping-library] | No native "compare variants side by side" feature; relies on duplicating boards/frames | Yes — 7,000+ templates, including wireframe/flow/sitemap/blueprint | PNG/PDF/SVG export, Figma/Adobe XD integration, dev hand-off | Free (3 boards); Starter $8/user/mo; Business $20/user/mo required for Prototypes feature; AI credits metered per screen | Gets sluggish on large/complex boards; prototyping/AI features gated behind the expensive Business tier; weaker mobile app; steep learning curve for advanced features [workflowautomation.net, uxmagic.ai reviews] |

## 3. Ten interaction patterns worth borrowing

1. **Sticky, auto-rerouting connector arrows** (Whimsical) — arrows stay attached and reroute live as shapes move, so a flow never looks broken mid-edit. Fits principle #2 (speed) and #3 (wireframes+diagrams are one thing).
2. **Element-level link targets, not just screen-level** (Balsamiq) — letting a specific button/hotspot carry a link to another screen, not just drawing an arrow between frames, matches our MVP requirement "connect a button/element inside a wireframe to another screen."
3. **Exportable click-through as a shareable artifact** (Balsamiq's linked PDF) — a "play" mode output a non-technical stakeholder can click through without an account supports our click-through-mode scope and calm/accessible principle.
4. **Frames as both grouping and presentation units** (Excalidraw, tldraw) — a frame is simultaneously "a container of shapes" and "a slide/screen" for presenting; this double-duty is exactly what a FlowSketch screen-frame should do.
5. **Swap-able component variants/properties** (FigJam Wireframe Kit) — letting one component (e.g., a button) carry alternate states/icons via a property switch, rather than needing a separate duplicated shape, keeps kits lean — relevant to our wireframe-kit component set.
6. **Device-frame presets (desktop/tablet/mobile) as drag-in containers** (Miro, Whimsical, FigJam) — standard, named frames users drop content into rather than configuring dimensions manually — directly matches our MVP wireframe-kit scope.
7. **Text/Mermaid-to-diagram generation for first draft** (FigJam) — useful later for speed, but should stay optional and never block manual sketching (keeps it out of MVP, but worth parking).
8. **Unlimited free "reviewer" role, no account friction** (Balsamiq) — removing login friction for people who just need to look/comment supports "no mandatory setup" and the Later-scope sharing/comments.
9. **Keyboard-first shape/connector creation** (tldraw SDK's tool shortcuts, Excalidraw's single-letter tool shortcuts) — single-key tool switching (e.g., "R" rectangle, "A" arrow) is a proven pattern for the "1–2 clicks or a shortcut" principle.
10. **Large first-party template gallery addressing common flows** (Miro's 7,000+ templates, Whimsical's "expert" templates) — validates our MVP's 3–5 starter templates (sign-up, onboarding, checkout, settings, search) as the right opening move, not over-scoped.

## 4. Five pitfalls to avoid (with evidence)

1. **Splitting sketching and interactivity into two tools/modes.** FigJam requires hand-off to Figma Design for real click-through prototyping, which breaks flow and adds a tool switch [help.figma.com connectors article; theafrodity.com workflow post]. FlowSketch's principle #3 ("wireframes + diagrams are one thing") exists precisely to avoid this trap — click-through must work on the same canvas as sketching.
2. **Gating core interactivity behind the most expensive tier.** Miro's clickable "Prototypes" feature requires the $20/user/mo Business plan plus metered AI credits, pricing out small teams from the feature that matters most for flow exploration [uxmagic.ai Miro AI Prototyping Review; help.miro.com]. Avoid making flow-linking a paywalled afterthought.
3. **Letting boards degrade at scale.** Multiple independent reviews cite Miro and FigJam becoming sluggish or messy ("layer management," "gets clunky with complex diagrams") once boards grow large [workflowautomation.net Miro review; selecthub.com FigJam vs Whimsical]. Our quality bar ("smooth with 50+ screens") must be tested continuously, not left to late-stage optimization.
4. **No built-in way to compare alternatives.** None of the six tools has a first-class "Option A vs Option B" comparison view — teams resort to manual copy/paste and side-by-side board arrangement in every tool reviewed. Treating variant-comparison as a bolt-on (as every competitor does) would forfeit FlowSketch's one clear point of differentiation.
5. **Forcing collaborators to create accounts just to view or comment.** Whimsical and FigJam both require guest sign-up for real-time participation, a friction point explicitly called out as a complaint [selecthub.com comparison]. Even though real-time collaboration is "Later" scope for us, the read-only share link (in MVP scope) must stay truly account-free.

## 5. Positioning angle

Candidate one-liners:
- A) "FlowSketch is the fastest way to sketch a screen and wire it into a flow — without leaving the canvas."
- B) "Whimsical for wireframes, but built to compare Option A vs Option B from day one." **(Recommended)**
- C) "The lo-fi canvas where exploring alternative user flows is as easy as drawing an arrow."

**Recommended: (B)** — it names the familiar reference point (de-risks adoption, everyone already understands "Whimsical, but...") and leads with the one gap every competitor shares: no first-class way to compare flow variants. It directly mirrors design principle #4 ("exploration is first-class").

**White space FlowSketch can own:** *Variant-native flow exploration.* Every competitor treats "duplicate this board and compare manually" as an unsupported workaround; none have a structured "variant" object (labeled Option A/B, viewable side-by-side, diffable). Owning "compare alternative workflows before anyone designs pixels" as the category-defining feature is open territory — it's also explicitly named in our MVP scope ("Workflow variants... view side by side"), so research and product scope are already aligned.

## 6. Open questions for the Director

1. **Should FlowSketch's free tier cap by item count (like Whimsical's 3,000 items) or by board count (like Miro's 3 boards)?**
   - a) Item/element count cap
   - b) Board count cap
   - c) No hard cap, soft nudge to upgrade only on advanced features (e.g., export)
   - **Recommended: (c)** — keeps "no mandatory setup" friction-free for the target quality bar (3-screen flow in <3 minutes), and avoids penalizing exactly the exploratory, many-small-boards usage pattern FlowSketch encourages.

2. **Should variant comparison (Option A vs B) ship as literally side-by-side boards, or an overlay/diff view?**
   - a) Side-by-side boards (simplest, matches MVP wording "view side by side")
   - b) Overlay/diff highlighting differences between variants
   - c) Both, with side-by-side first and diff later
   - **Recommended: (c)** — side-by-side is explicitly in MVP scope and cheap to build; diff view is a natural "Later" enhancement once the data model supports variants.

3. **Should read-only share links require zero account creation for viewers (like Balsamiq's free reviewers), even once real-time collaboration ships later?**
   - a) Yes, always account-free for viewers
   - b) Require accounts once comments/collaboration ship
   - **Recommended: (a)** — competitor complaints consistently cite forced guest sign-up as friction; keeping viewing/commenting account-free is a low-cost differentiator worth committing to now.

## 7. Risks

- **Scope creep toward "another Miro"**: the richest competitor (Miro) wins on breadth, not speed — chasing feature parity would violate principle #2 ("speed over power") and dilute focus.
- **Variant/comparison UX is unproven**: because no competitor has shipped this well, FlowSketch has no reference implementation to crib from — more design risk, more validation needed before/after MVP.
- **Performance at 50+ screens is a real, documented failure mode** for larger competitors (Miro, FigJam); if FlowSketch's canvas/rendering approach isn't validated early, we risk repeating the same complaint.
- **"Lo-fi by design" could read as "limited" to users coming from FigJam/Miro** who expect richer visual fidelity; positioning and onboarding need to frame constraint as a feature, not a gap.

## 8. Parking lot (ideas beyond MVP scope — not to be built now)

- Text/Mermaid-to-diagram or AI "describe a flow → generate screens" (seen in FigJam, Miro) — aligns with the brief's own "Later" list.
- Overlay/diff view for comparing variants (vs. side-by-side only).
- Guest/account-free real-time co-editing presence (cursors) — explicitly "Later" per brief.
- Component variant/property switching within wireframe kit elements (FigJam-style) — nice-to-have polish, not MVP-critical.
- Dev hand-off / code export integrations (Miro↔Figma style) — explicitly out of scope per brief ("no code export").
- Metered AI-generation credits as a monetization lever (Miro's model) — a pricing idea, not a product decision for now.

## 9. Sources

- Whimsical wireframes page — https://whimsical.com/wireframes
- Whimsical review/pricing — https://lemonsight.com/tool/productivity/whimsical
- Balsamiq product page — https://balsamiq.com/product/
- Balsamiq pricing — https://balsamiq.com/pricing/?LanguageId=1
- Balsamiq review — https://vitara.ai/balsamiq-review/
- Excalidraw libraries — https://libraries.excalidraw.com/
- Excalidraw+ pricing — https://plus.excalidraw.com/pricing
- Excalidraw G2 pros/cons — https://www.g2.com/products/excalidraw/reviews?qs=pros-and-cons
- Excalidraw review — https://pulsetools.dpdns.org/posts/excalidraw-review-2026.html
- Figma Community Wireframe Kit — https://www.figma.com/community/plugin/1598123323289847362/wireframe-kit
- FigJam connectors help doc — https://help.figma.com/hc/en-us/articles/1500004414542-Create-diagrams-and-flows-with-connectors-in-FigJam
- FigJam pricing — https://thedigitalprojectmanager.com/tools/figjam-pricing/
- FigJam→Figma prototyping workflow — https://www.theafrodity.com/post/from-wireframe-to-prototype-a-designer-s-complete-workflow
- FigJam vs Whimsical comparison — https://www.selecthub.com/diagram-software/figjam-vs-whimsical-com/
- tldraw pricing/licensing — https://tldraw.dev/pricing
- tldraw SDK overview — https://react.wiki/libraries/tldraw-tldraw
- Miro prototyping library help doc — https://help.miro.com/hc/en-us/articles/360017572154-Prototyping-library
- Miro AI prototyping review — https://uxmagic.ai/blog/miro-ai-prototyping-review
- Miro review (2025/2026) — https://workflowautomation.net/reviews/miro
- Balsamiq vs Whimsical (G2) — https://www.g2.com/compare/balsamiq-vs-whimsical
