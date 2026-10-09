# Phase 4 — Performance

**Owner:** Performance agent · **Status:** done · **Visible changes:** none (same lines, same screens, same behaviour)

## In one paragraph

We built a deliberately heavy "stress board" and measured how FlowSketch handles it: 60 phone screens with 10 components each, plus 86 routed lines that cross, share sides and detour around screens. The new line routing (decision #42) was the bottleneck: recalculating every line took about a tenth of a second, and that happened after every move. It now takes about a quarter of that for the whole board. Most edits only recalculate the lines they affect, and edits that don't move anything skip the work entirely. Every line on the five templates is drawn exactly as before (checked point by point). The dashboard now downloads half as much code, because the editor loads only when you open a board.

## Before / after

Measured on a developer laptop (Apple Silicon). The machine is shared with other agents, so expect about ±20% noise. "Line routing" numbers are the routing step on its own; the browser rows are the full app.

| What | Before | After | Target |
|---|---|---|---|
| **Line routing: whole stress board (cold, nothing cached)** | 106–115 ms | **~25 ms** | < 30 ms ✅ |
| Line routing: the existing 60-screen test board (`/b/perf-60`, fewer lines) | ~12 ms | ~4 ms | — |
| Line routing after moving one screen | 80–84 ms | **6–17 ms** | < 30 ms ✅ |
| Line routing after adding a line | ~85 ms | **~14 ms** | < 30 ms ✅ |
| Line routing after moving a component that has no line | ~80 ms | **0 ms (skipped)** | skip ✅ |
| Line routing after editing text, colour, labels or names | 0 ms (skipped) | 0 ms (skipped) | skip ✅ |
| Pause when you let go of a dragged screen (stress board) | ~200 ms | **~70–120 ms** | — |
| Pause when you let go of a dragged component | ~160 ms | **~45 ms** | — |
| Smoothness while dragging a screen (stress board, everything visible) | 57 fps | **59–60 fps** | ≥ 50 fps ✅ |
| Smoothness while panning and zooming (stress board) | — | 60 fps, no pauses | ≥ 50 fps ✅ |
| **Code the dashboard must download before it shows** (compressed) | 323 kB | **162 kB (−50%)** | small ✅ |
| Dashboard on screen (production build, simulated fast 4G) | ~535 ms | **~395 ms (−26%)** | — |
| Opening a board straight from a link (same conditions) | ~680 ms | ~690 ms (same) | no worse ✅ |

Export (PDF/PNG) code was already downloaded only when you export; that hasn't changed.

## What changed (plain language)

1. **Faster route finding.** The router searches a grid for each line. The search now uses compact number tables instead of text lookups. The result is the same, it just gets there about four times faster.
2. **Remembering lines that didn't change.** When you move a screen, most lines on the board aren't near it. Each line now remembers its last route together with everything that influenced it (the screens and other lines in its area). If none of that changed, the router reuses the route. Only nearby lines are recalculated.
3. **Ignoring changes that can't affect lines.** Moving a component that has no line attached, editing text, renaming a screen, or changing a colour no longer triggers routing at all.
4. **Cheaper cache checks.** Export asks for each line's route separately. Each request used to rebuild a fingerprint of the whole board. It's now a direct lookup.
5. **The editor loads on demand.** The dashboard no longer carries the canvas, its storage engine or the dev preview pages. While you browse the dashboard, the editor downloads quietly in the background, so opening a board still feels instant. When you open a board link directly, the editor's files download in parallel with the app instead of one after another. That's why direct links are as fast as before.
6. **New tests keep it fast:**
   - A unit test fails if routing the stress board gets dramatically slower.
   - The same test fails if text edits start rerouting.
   - A browser test drags, pans and zooms on the stress board and checks smoothness. Thresholds are set loose enough that a slower CI machine won't fail at random.

The stress board is available at `/b/perf-stress` (not saved, like `/b/perf-60`).

## How we know the lines look the same

During development we kept a copy of the original router and compared both versions point by point on 73 boards:
- the 5 templates
- both stress boards
- 60 randomly generated boards
- 6 variations of the stress board with screens moved

All 1,126 lines matched exactly. The existing routing tests still pass.

## Risks

- **Numbers are from a development laptop.** A slow office laptop could be 2–3× slower. Even so, the slowest case (~25 ms) stays well under the point where people notice a pause (~100 ms).
- **The pause on drop is mostly not routing any more.** The remaining ~70–120 ms after letting go of a screen on the stress board is React redrawing the board, measured in development mode. Production builds are faster. We didn't take on a deeper redraw optimisation (see parking lot).
- **Caching assumes boards are replaced, not edited in place.** The app always creates a new board snapshot on each change, which is what the cache relies on. A future feature that edited a board in place would need to clear the cache (`clearRouteCache()`).
- **The first moments of a direct board link render nothing until the editor code arrives** (previously the same wait happened before any JavaScript ran). There's no visible difference today. If someone adds a loading screen later, it should go in `src/App.tsx`.
- **Shared file touched:** `src/platform/boards.ts` (Platform area) now loads the storage engine on first use instead of at startup. Behaviour is unchanged and its tests pass.

## Parking lot (ideas, not done)

- Route lines in a background thread (Web Worker), so even a 200-screen board never pauses on drop.
- Reduce the React redraw on drop by updating only the lines and screens that changed.
- Run the performance tests against a production build in CI, for more realistic and stable numbers.
- Trim the fonts (only the characters we use) and stop loading the canvas styles on the dashboard. Each would save a few more kB on first load.
- A loading shimmer for direct board links on slow connections.
