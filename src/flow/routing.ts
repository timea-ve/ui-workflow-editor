// Orthogonal connector routing for elbow ("step") connectors, shared by the canvas and export.
//
// Rules (Director-approved round 3 of Gate 3):
// 1. Lines never run through screens or canvas shapes: they route around padded boxes (A* on a sparse grid).
// 2. Each end picks the side that gives the shortest, least-bendy path (unless the anchor is fixed).
// 3. Several lines on the same side of a box get their own attachment points, ordered by where the
//    other end is, so they don't merge or cross near the box.
// 4. Lines prefer free corridors and avoid sharing a corridor with an earlier line.
// 5. Corners are rounded; where two lines cross, the horizontal one hops over the vertical one.
import type { BoardDoc, Connector, ID } from '../model/types';
import { DEVICE_TITLE_H } from '../kit/wireframe/DeviceFrame';
import type { Rect } from './ops';

export type Pt = [number, number];
export type Side = 'top' | 'right' | 'bottom' | 'left';

export interface Route {
  /** Final polyline with rounded corners and line jumps (canvas coords). */
  points: Pt[];
  labelX: number;
  labelY: number;
  sourceSide: Side;
  targetSide: Side;
  /** Absolute top-left of the two end nodes the route was computed for (stale check while dragging). */
  from: { x: number; y: number };
  to: { x: number; y: number };
  key: string;
}

const SIDES: Side[] = ['right', 'left', 'bottom', 'top'];
const PAD = 20;
/** Extra clearance above screens for their name label. */
const PAD_TITLE = DEVICE_TITLE_H + 12;
const STUB_EXTRA = 4;
const BEND = 40;
const HUG = 0.25;
const OVERLAP = 0.8;
const ESCAPE_WEIGHT = 1.5;
export const CORNER_RADIUS = 10;
export const HOP_RADIUS = 6;
const PORT_GAP = 24;
const EPS = 0.01;
const LANE_MIN = 12;
const LANE_STEP = 16;

const NORMAL: Record<Side, Pt> = { right: [1, 0], left: [-1, 0], bottom: [0, 1], top: [0, -1] };
// Direction indices: 0 = +x, 1 = -x, 2 = +y, 3 = -y.
const DIRS: Pt[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const SIDE_DIR: Record<Side, number> = { right: 0, left: 1, bottom: 2, top: 3 };
const INWARD_DIR: Record<Side, number> = { right: 1, left: 0, bottom: 3, top: 2 };

interface Box extends Rect { padTop: number; pad: number }
interface End { nodeId: ID; rect: Rect; frame?: Box; fixed?: Side }
interface EndOpt { side: Side; attach: Pt; exit: Pt; stub: Pt; cost: number }

const cx = (r: Rect) => r.x + r.w / 2;
const cy = (r: Rect) => r.y + r.h / 2;

function padded(b: Box): Rect {
  return { x: b.x - b.pad, y: b.y - b.padTop, w: b.w + 2 * b.pad, h: b.h + b.padTop + b.pad };
}

function sidePad(b: Box | undefined, side: Side): number {
  if (!b) return PAD;
  return side === 'top' ? b.padTop : b.pad;
}

function endOptions(end: End, offsets: Partial<Record<Side, number>>, ownBox: Box): EndOpt[] {
  const r = end.rect;
  return (end.fixed ? [end.fixed] : SIDES).map((side) => {
    const o = offsets[side] ?? 0;
    const attach: Pt =
      side === 'left' ? [r.x, cy(r) + o]
        : side === 'right' ? [r.x + r.w, cy(r) + o]
          : side === 'top' ? [cx(r) + o, r.y] : [cx(r) + o, r.y + r.h];
    const f = end.frame;
    let exit: Pt = attach;
    let inside = 0;
    if (f) {
      exit = side === 'left' ? [f.x, attach[1]] : side === 'right' ? [f.x + f.w, attach[1]] : side === 'top' ? [attach[0], f.y] : [attach[0], f.y + f.h];
      inside = Math.abs(exit[0] - attach[0]) + Math.abs(exit[1] - attach[1]);
    }
    const n = NORMAL[side];
    const len = sidePad(f ?? ownBox, side) + STUB_EXTRA;
    const stub: Pt = [exit[0] + n[0] * len, exit[1] + n[1] * len];
    return { side, attach, exit, stub, cost: ESCAPE_WEIGHT * inside + STUB_EXTRA };
  });
}

// ---------- A* on a sparse orthogonal grid ----------

// Binary heap on parallel arrays (no per-push allocation). Same sift rules as a textbook heap, so pop
// order (incl. ties) is deterministic and identical across runs.
class Heap {
  private f: number[] = [];
  private v: number[] = [];
  get size() { return this.f.length; }
  push(f: number, v: number) {
    const F = this.f;
    const V = this.v;
    F.push(f);
    V.push(v);
    let i = F.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (F[p] <= F[i]) break;
      const tf = F[p];
      F[p] = F[i];
      F[i] = tf;
      const tv = V[p];
      V[p] = V[i];
      V[i] = tv;
      i = p;
    }
  }
  /** Removes the top; read it first with topF/topV. */
  pop(): void {
    const F = this.f;
    const V = this.v;
    const lastF = F.pop()!;
    const lastV = V.pop()!;
    if (F.length) {
      F[0] = lastF;
      V[0] = lastV;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < F.length && F[l] < F[m]) m = l;
        if (r < F.length && F[r] < F[m]) m = r;
        if (m === i) break;
        const tf = F[m];
        F[m] = F[i];
        F[i] = tf;
        const tv = V[m];
        V[m] = V[i];
        V[i] = tv;
        i = m;
      }
    }
  }
  get topF() { return this.f[0]; }
  get topV() { return this.v[0]; }
}

/**
 * Corridor segments already taken by earlier lines (unit steps of earlier searches, canvas coords).
 * Equality is exact on coordinates, so a step only counts as "shared" when it joins the same two grid points.
 * Duplicates are harmless (a step is either taken or not), so they're not filtered.
 */
const USED_BAND = 512;

class UsedSegments {
  /** Flat [x1, y1, x2, y2, …] with x1 <= x2 and y1 <= y2. */
  readonly segs: number[] = [];
  /** Horizontal bands of USED_BAND px → indices (into segs / 4) of segments touching the band. */
  private bands = new Map<number, number[]>();
  private stamp: number[] = [];
  private query = 0;
  add(a: Pt, b: Pt) {
    const x1 = Math.min(a[0], b[0]);
    const x2 = Math.max(a[0], b[0]);
    const y1 = Math.min(a[1], b[1]);
    const y2 = Math.max(a[1], b[1]);
    const idx = this.segs.length / 4;
    this.segs.push(x1, y1, x2, y2);
    this.stamp.push(0);
    for (let band = Math.floor(y1 / USED_BAND); band <= Math.floor(y2 / USED_BAND); band++) {
      const list = this.bands.get(band);
      if (list) list.push(idx); else this.bands.set(band, [idx]);
    }
  }
  /** Segments lying fully inside the box, flat and in insertion order. */
  within(minX: number, maxX: number, minY: number, maxY: number): number[] {
    const q = ++this.query;
    const hits: number[] = [];
    for (let band = Math.floor(minY / USED_BAND); band <= Math.floor(maxY / USED_BAND); band++) {
      for (const idx of this.bands.get(band) ?? []) {
        if (this.stamp[idx] === q) continue;
        this.stamp[idx] = q;
        const k = idx * 4;
        const s = this.segs;
        if (s[k] < minX || s[k + 2] > maxX || s[k + 1] < minY || s[k + 3] > maxY) continue;
        hits.push(idx);
      }
    }
    hits.sort((a, b) => a - b);
    const out: number[] = [];
    for (const idx of hits) out.push(this.segs[idx * 4], this.segs[idx * 4 + 1], this.segs[idx * 4 + 2], this.segs[idx * 4 + 3]);
    return out;
  }
}

function uniqSorted(v: number[]): number[] {
  const s = [...v].sort((a, b) => a - b);
  return s.filter((x, i) => i === 0 || x - s[i - 1] > EPS);
}

/** First index with a[i] >= v (a sorted ascending). */
function lowerBound(a: ArrayLike<number>, v: number): number {
  let lo = 0;
  let hi = a.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (a[mid] < v) lo = mid + 1; else hi = mid;
  }
  return lo;
}

/** First index with a[i] > v (a sorted ascending). */
function upperBound(a: ArrayLike<number>, v: number): number {
  let lo = 0;
  let hi = a.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (a[mid] <= v) lo = mid + 1; else hi = mid;
  }
  return lo;
}

/** Index of exactly v in a strictly increasing array, or -1. */
function exactIndex(a: ArrayLike<number>, v: number): number {
  const i = lowerBound(a, v);
  return i < a.length && a[i] === v ? i : -1;
}

/** Index range [lo, hi) of sorted values strictly inside (min + EPS, max - EPS), same test as a point-in-box check. */
function interior(a: ArrayLike<number>, min: number, max: number): [number, number] {
  return [upperBound(a, min + EPS), lowerBound(a, max - EPS)];
}

interface Found { path: Pt[]; steps: [Pt, Pt][]; s: EndOpt; g: EndOpt }

/** The part of the board a search looks at: its end stubs, the obstacles near them, and the grid bounds. */
interface Window { stubs: Pt[]; obs: Rect[]; minX: number; maxX: number; minY: number; maxY: number }

function windowOf(starts: EndOpt[], goals: EndOpt[], boxes: Rect[]): Window {
  const stubs = [...starts, ...goals].map((o) => o.stub);
  let minX = Math.min(...stubs.map((p) => p[0])) - 120;
  let maxX = Math.max(...stubs.map((p) => p[0])) + 120;
  let minY = Math.min(...stubs.map((p) => p[1])) - 120;
  let maxY = Math.max(...stubs.map((p) => p[1])) + 120;
  const obs = boxes.filter((b) => b.x < maxX && b.x + b.w > minX && b.y < maxY && b.y + b.h > minY);
  for (const b of obs) {
    minX = Math.min(minX, b.x - 40);
    maxX = Math.max(maxX, b.x + b.w + 40);
    minY = Math.min(minY, b.y - 40);
    maxY = Math.max(maxY, b.y + b.h + 40);
  }
  return { stubs, obs, minX, maxX, minY, maxY };
}

// ---------- search memo ----------
// A search is a pure function of its end options, the obstacles in its window and the taken corridors
// inside that window. Keeping the last board's searches (per connector and pass) lets a geometry edit
// re-run only the searches whose inputs actually changed; the rest reuse their result exactly.

interface SearchMemo { ends: number[]; obs: number[]; segs: number[]; found: Found | undefined }
let searchMemo = new Map<string, SearchMemo>();
let nextSearchMemo = new Map<string, SearchMemo>();

const SIDE_NUM: Record<Side, number> = { right: 0, left: 1, bottom: 2, top: 3 };

function sameNumbers(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function search(starts: EndOpt[], goals: EndOpt[], boxes: Rect[], used: UsedSegments, memoKey: string): Found | undefined {
  const win = windowOf(starts, goals, boxes);
  const ends: number[] = [starts.length];
  for (const o of [...starts, ...goals]) ends.push(SIDE_NUM[o.side], o.attach[0], o.attach[1], o.exit[0], o.exit[1], o.stub[0], o.stub[1], o.cost);
  const obs: number[] = [];
  for (const b of win.obs) obs.push(b.x, b.y, b.w, b.h);
  // Only corridors inside the window can touch this grid.
  const segs = used.within(win.minX, win.maxX, win.minY, win.maxY);
  const hit = searchMemo.get(memoKey);
  if (hit && sameNumbers(hit.ends, ends) && sameNumbers(hit.obs, obs) && sameNumbers(hit.segs, segs)) {
    nextSearchMemo.set(memoKey, hit);
    return hit.found;
  }
  const found = searchGrid(starts, goals, win, segs);
  nextSearchMemo.set(memoKey, { ends, obs, segs, found });
  return found;
}

function searchGrid(starts: EndOpt[], goals: EndOpt[], win: Window, segs: number[]): Found | undefined {
  const { stubs, obs, minX, maxX, minY, maxY } = win;
  const edgeX = obs.flatMap((b) => [b.x, b.x + b.w]);
  const edgeY = obs.flatMap((b) => [b.y, b.y + b.h]);
  const baseX = uniqSorted([...edgeX, ...stubs.map((p) => p[0])]);
  const baseY = uniqSorted([...edgeY, ...stubs.map((p) => p[1])]);
  const mids = (v: number[]) => v.slice(1).map((x, i) => (x + v[i]) / 2);
  // Lanes closer than LANE_MIN would draw parallel lines that look merged: keep stubs, then the rest by priority.
  // `kept` stays sorted, so only the two nearest neighbours need checking.
  const lanes = (must: number[], ...rest: number[][]) => {
    const kept = uniqSorted(must);
    for (const group of rest) {
      for (const v of group) {
        const k = lowerBound(kept, v);
        if (k < kept.length && Math.abs(kept[k] - v) < LANE_MIN) continue;
        if (k > 0 && Math.abs(kept[k - 1] - v) < LANE_MIN) continue;
        kept.splice(k, 0, v);
      }
    }
    return uniqSorted(kept);
  };
  // Spare parallel lanes just outside each box, so lines sharing a corridor can run side by side.
  const outX = obs.flatMap((b) => [1, 2].flatMap((k) => [b.x - k * LANE_STEP, b.x + b.w + k * LANE_STEP]));
  const outY = obs.flatMap((b) => [1, 2].flatMap((k) => [b.y - k * LANE_STEP, b.y + b.h + k * LANE_STEP]));
  const xs = lanes(stubs.map((p) => p[0]), edgeX, [minX, maxX], mids(baseX), outX);
  const ys = lanes(stubs.map((p) => p[1]), edgeY, [minY, maxY], mids(baseY), outY);
  const W = xs.length;
  const H = ys.length;
  const hugXs = new Set([...edgeX, minX, maxX]);
  const hugYs = new Set([...edgeY, minY, maxY]);
  const hugCol = new Uint8Array(W);
  const hugRow = new Uint8Array(H);
  for (let i = 0; i < W; i++) hugCol[i] = hugXs.has(xs[i]) ? 1 : 0;
  for (let j = 0; j < H; j++) hugRow[j] = hugYs.has(ys[j]) ? 1 : 0;
  const idxX = (x: number) => xs.findIndex((v) => Math.abs(v - x) <= EPS);
  const idxY = (y: number) => ys.findIndex((v) => Math.abs(v - y) <= EPS);
  const node = (p: Pt) => idxY(p[1]) * W + idxX(p[0]);

  // Rasterise obstacles once: grid points inside a box, and steps whose midpoint is inside a box.
  const N = W * H;
  const midX = mids(xs);
  const midY = mids(ys);
  const blocked = new Uint8Array(N);
  const blockedH = new Uint8Array(Math.max(0, W - 1) * H); // step (i,j)→(i+1,j) at [j*(W-1)+i]
  const blockedV = new Uint8Array(W * Math.max(0, H - 1)); // step (i,j)→(i,j+1) at [j*W+i]
  for (const b of obs) {
    const [i0, i1] = interior(xs, b.x, b.x + b.w);
    const [j0, j1] = interior(ys, b.y, b.y + b.h);
    const [m0, m1] = interior(midX, b.x, b.x + b.w);
    const [k0, k1] = interior(midY, b.y, b.y + b.h);
    for (let j = j0; j < j1; j++) {
      for (let i = i0; i < i1; i++) blocked[j * W + i] = 1;
      for (let i = m0; i < m1; i++) blockedH[j * (W - 1) + i] = 1;
    }
    for (let j = k0; j < k1; j++) for (let i = i0; i < i1; i++) blockedV[j * W + i] = 1;
  }
  const valid = new Uint8Array(N);
  for (let n = 0; n < N; n++) valid[n] = blocked[n] ? 0 : 1;
  for (const p of stubs) valid[node(p)] = 1;

  // Corridors taken by earlier lines, mapped onto this grid's steps.
  const usedH = new Uint8Array(blockedH.length);
  const usedV = new Uint8Array(blockedV.length);
  const [gx0, gx1, gy0, gy1] = [xs[0], xs[W - 1], ys[0], ys[H - 1]];
  for (let s = 0; s < segs.length; s += 4) {
    const x1 = segs[s];
    const y1 = segs[s + 1];
    const x2 = segs[s + 2];
    const y2 = segs[s + 3];
    if (x1 < gx0 || x2 > gx1 || y1 < gy0 || y2 > gy1) continue;
    if (y1 === y2) {
      const j = exactIndex(ys, y1);
      const i = j < 0 ? -1 : exactIndex(xs, x1);
      if (i >= 0 && i + 1 < W && xs[i + 1] === x2) usedH[j * (W - 1) + i] = 1;
    } else if (x1 === x2) {
      const i = exactIndex(xs, x1);
      const j = i < 0 ? -1 : exactIndex(ys, y1);
      if (j >= 0 && j + 1 < H && ys[j + 1] === y2) usedV[j * W + i] = 1;
    }
  }

  const goalAt = new Map<number, EndOpt[]>();
  for (const g of goals) {
    const n = node(g.stub);
    goalAt.set(n, [...(goalAt.get(n) ?? []), g]);
  }
  const gx = goals.map((g) => g.stub[0]);
  const gy = goals.map((g) => g.stub[1]);
  const h = (n: number) => {
    const x = xs[n % W];
    const y = ys[Math.floor(n / W)];
    let best = Infinity;
    for (let k = 0; k < gx.length; k++) {
      const d = Math.abs(gx[k] - x) + Math.abs(gy[k] - y);
      if (d < best) best = d;
    }
    return best;
  };

  const S = N * 4;
  const gScore = new Float64Array(S).fill(Infinity);
  const prev = new Int32Array(S).fill(-1);
  const startOf = new Map<number, EndOpt>();
  const heap = new Heap();
  for (const s of starts) {
    const v = node(s.stub) * 4 + SIDE_DIR[s.side];
    if (s.cost < gScore[v]) {
      gScore[v] = s.cost;
      startOf.set(v, s);
      heap.push(s.cost + h(node(s.stub)), v);
    }
  }
  // Terminal states are encoded as S + index into `terminals`.
  const terminals: { v: number; g: EndOpt; cost: number }[] = [];
  while (heap.size) {
    const f = heap.topF;
    const v = heap.topV;
    heap.pop();
    if (v >= S) {
      const t = terminals[v - S];
      const path: Pt[] = [];
      const steps: [Pt, Pt][] = [];
      let cur = t.v;
      let s: EndOpt | undefined;
      for (;;) {
        const n = cur >> 2;
        const p: Pt = [xs[n % W], ys[Math.floor(n / W)]];
        if (path.length) steps.push([p, path[path.length - 1]]);
        path.push(p);
        if (prev[cur] < 0) {
          s = startOf.get(cur);
          break;
        }
        cur = prev[cur];
      }
      path.reverse();
      return { path, steps, s: s!, g: t.g };
    }
    const g0 = gScore[v];
    if (f - h(v >> 2) > g0 + EPS) continue;
    const n = v >> 2;
    const dir = v & 3;
    const goalsHere = goalAt.get(n);
    if (goalsHere) {
      for (const goal of goalsHere) {
        const cost = g0 + goal.cost + (dir === INWARD_DIR[goal.side] ? 0 : BEND);
        terminals.push({ v, g: goal, cost });
        heap.push(cost, S + terminals.length - 1);
      }
    }
    const i = n % W;
    const j = Math.floor(n / W);
    for (let d = 0; d < 4; d++) {
      if ((d ^ 1) === dir) continue; // no U-turns
      const ni = i + DIRS[d][0];
      const nj = j + DIRS[d][1];
      if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
      const m = nj * W + ni;
      if (!valid[m]) continue;
      let len: number;
      let hug: number;
      let overlap: number;
      if (d < 2) {
        const e = j * (W - 1) + Math.min(i, ni);
        if (blockedH[e]) continue;
        len = Math.abs(xs[ni] - xs[i]);
        hug = hugRow[j];
        overlap = usedH[e];
      } else {
        const e = Math.min(j, nj) * W + i;
        if (blockedV[e]) continue;
        len = Math.abs(ys[nj] - ys[j]);
        hug = hugCol[i];
        overlap = usedV[e];
      }
      const cost = g0 + len * (1 + (hug ? HUG : 0) + (overlap ? OVERLAP : 0)) + (d === dir ? 0 : BEND);
      const w = m * 4 + d;
      if (cost < gScore[w] - EPS) {
        gScore[w] = cost;
        prev[w] = v;
        heap.push(cost + h(m), w);
      }
    }
  }
  return undefined;
}

function simplify(pts: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (last && Math.abs(last[0] - p[0]) < EPS && Math.abs(last[1] - p[1]) < EPS) continue;
    out.push(p);
  }
  return out.filter((p, i) => {
    if (i === 0 || i === out.length - 1) return true;
    const [a, b] = [out[i - 1], out[i + 1]];
    return Math.abs((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) > EPS;
  });
}

function assemble(f: Found): Pt[] {
  const { s, g } = f;
  return simplify([s.attach, s.exit, ...f.path, g.exit, g.attach]);
}

// ---------- board-level routing ----------

interface Job { c: Connector; from: End; to: End; fromBox: Box; toBox: Box }

function boxesOf(doc: BoardDoc): Map<ID, Box> {
  const m = new Map<ID, Box>();
  for (const f of Object.values(doc.frames)) m.set(f.id, { x: f.x, y: f.y, w: f.w, h: f.h, pad: PAD, padTop: PAD_TITLE });
  for (const e of Object.values(doc.elements)) {
    if (e.parentId && doc.frames[e.parentId]) continue;
    m.set(e.id, { x: e.x, y: e.y, w: e.w, h: e.h, pad: PAD, padTop: PAD });
  }
  return m;
}

function endOf(doc: BoardDoc, boxes: Map<ID, Box>, nodeId: ID, anchor: Connector['from']['anchor']): End | undefined {
  const fixed = anchor === 'auto' ? undefined : anchor;
  const own = boxes.get(nodeId);
  if (own) return { nodeId, rect: own, fixed };
  const e = doc.elements[nodeId];
  const frame = e?.parentId ? boxes.get(e.parentId) : undefined;
  if (!e || !frame) return undefined;
  return { nodeId, rect: { x: frame.x + e.x, y: frame.y + e.y, w: e.w, h: e.h }, frame, fixed };
}

/**
 * Everything routing depends on: screens, loose canvas shapes (obstacles), elements that are line ends,
 * and the connectors. Elements inside a screen that no line touches don't matter, so editing or moving
 * them keeps the cached routes.
 */
function signature(doc: BoardDoc): string {
  const ends = new Set<ID>();
  for (const c of Object.values(doc.connectors)) {
    ends.add(c.from.nodeId);
    ends.add(c.to.nodeId);
  }
  const parts: string[] = [];
  for (const f of Object.values(doc.frames)) parts.push(`f${f.id}:${f.x},${f.y},${f.w},${f.h}`);
  for (const e of Object.values(doc.elements)) {
    if (e.parentId && doc.frames[e.parentId] && !ends.has(e.id)) continue;
    parts.push(`e${e.id}:${e.parentId ?? ''}:${e.x},${e.y},${e.w},${e.h}`);
  }
  for (const c of Object.values(doc.connectors)) parts.push(`c${c.id}:${c.style}:${c.from.nodeId}:${c.from.anchor}:${c.to.nodeId}:${c.to.anchor}`);
  return parts.join('|');
}

// Routes for the last few geometries (canvas + export can ask for different boards), plus a per-object
// fast path so repeated calls with the same doc skip even the signature.
const CACHE_SIZE = 4;
let cache: { sig: string; routes: Map<ID, Route> }[] = [];
let byDoc = new WeakMap<BoardDoc, Map<ID, Route>>();

/** Routes for every elbow connector on the board (others, and unroutable ones, are absent → caller falls back). */
export function routeBoard(doc: BoardDoc): Map<ID, Route> {
  const known = byDoc.get(doc);
  if (known) return known;
  const sig = signature(doc);
  const i = cache.findIndex((c) => c.sig === sig);
  let routes: Map<ID, Route>;
  if (i >= 0) {
    routes = cache[i].routes;
    if (i > 0) cache = [cache[i], ...cache.slice(0, i), ...cache.slice(i + 1)];
  } else {
    routes = computeRoutes(doc);
    cache = [{ sig, routes }, ...cache].slice(0, CACHE_SIZE);
  }
  byDoc.set(doc, routes);
  return routes;
}

/** Test/benchmark hook: forget every cached route and search. */
export function clearRouteCache(): void {
  cache = [];
  byDoc = new WeakMap();
  searchMemo = new Map();
}

function computeRoutes(doc: BoardDoc): Map<ID, Route> {
  nextSearchMemo = new Map();
  try {
    return computeRoutesInner(doc);
  } finally {
    searchMemo = nextSearchMemo;
  }
}

function computeRoutesInner(doc: BoardDoc): Map<ID, Route> {
  const boxes = boxesOf(doc);
  const obstacles = [...boxes.values()].map(padded);
  const jobs: Job[] = [];
  for (const c of Object.values(doc.connectors).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    if (c.style !== 'step' || c.from.nodeId === c.to.nodeId) continue;
    const from = endOf(doc, boxes, c.from.nodeId, c.from.anchor);
    const to = endOf(doc, boxes, c.to.nodeId, c.to.anchor);
    if (!from || !to) continue;
    // Both ends inside the same screen: leave it to the simple router.
    if (from.frame && from.frame === to.frame) continue;
    if ((from.frame && from.frame === boxes.get(to.nodeId)) || (to.frame && to.frame === boxes.get(from.nodeId))) continue;
    jobs.push({ c, from, to, fromBox: from.frame ?? boxes.get(from.nodeId)!, toBox: to.frame ?? boxes.get(to.nodeId)! });
  }

  // Pass 1: free sides, centred ports.
  const first = new Map<ID, Found>();
  const used1 = new UsedSegments();
  for (const j of jobs) {
    const f = search(endOptions(j.from, {}, j.fromBox), endOptions(j.to, {}, j.toBox), obstacles, used1, `1|${j.c.id}`);
    if (!f) continue;
    first.set(j.c.id, f);
    for (const [a, b] of f.steps) used1.add(a, b);
  }

  // Spread ports: lines sharing a node side get their own point, ordered by where the other end is.
  type PortUse = { id: ID; end: 'from' | 'to'; other: Pt };
  const groups = new Map<string, { len: number; centre: number; side: Side; uses: PortUse[] }>();
  for (const j of jobs) {
    const f = first.get(j.c.id);
    if (!f) continue;
    for (const [end, opt, other, e] of [['from', f.s, f.g.attach, j.from], ['to', f.g, f.s.attach, j.to]] as const) {
      const k = `${e.nodeId}|${opt.side}`;
      const vertical = opt.side === 'left' || opt.side === 'right';
      const g = groups.get(k) ?? { len: vertical ? e.rect.h : e.rect.w, centre: vertical ? cy(e.rect) : cx(e.rect), side: opt.side, uses: [] };
      g.uses.push({ id: j.c.id, end, other });
      groups.set(k, g);
    }
  }
  const offsets = new Map<string, number>(); // `${connectorId}|from|to` → offset along side
  // A lone line goes straight across when its other end is within reach of this side; else it meets the middle.
  // Target ends first, then sources look at where their target end now is, so screen→screen lines line up.
  const singles = [...groups.values()].filter((g) => g.uses.length === 1);
  for (const end of ['to', 'from'] as const) {
    for (const g of singles) {
      const u = g.uses[0];
      if (u.end !== end) continue;
      const axis = g.side === 'left' || g.side === 'right' ? 1 : 0;
      const otherSide = end === 'from' ? first.get(u.id)?.g.side : undefined;
      const otherAxis = otherSide === 'left' || otherSide === 'right' ? 1 : 0;
      const shift = otherSide && otherAxis === axis ? offsets.get(`${u.id}|to`) ?? 0 : 0;
      const want = u.other[axis] + shift - g.centre;
      if (Math.abs(want) <= Math.max(0, g.len / 2 - 40)) offsets.set(`${u.id}|${end}`, want);
    }
  }
  for (const g of groups.values()) {
    if (g.uses.length < 2) continue;
    const axis = g.side === 'left' || g.side === 'right' ? 1 : 0;
    g.uses.sort((a, b) => a.other[axis] - b.other[axis] || (a.id < b.id ? -1 : 1));
    const n = g.uses.length;
    const gap = Math.min(PORT_GAP, (g.len * 0.8) / n);
    // Each port goes as close to straight-across from its other end as the order and spacing allow.
    const half = g.len * 0.4;
    const centre = g.centre;
    const pos = g.uses.map((u) => Math.max(-half, Math.min(half, u.other[axis] - centre)));
    for (let i = 1; i < n; i++) pos[i] = Math.max(pos[i], pos[i - 1] + gap);
    const over = pos[n - 1] - half;
    if (over > 0) for (let i = 0; i < n; i++) pos[i] -= over;
    for (let i = n - 2; i >= 0; i--) pos[i] = Math.min(pos[i], pos[i + 1] - gap);
    g.uses.forEach((u, i) => offsets.set(`${u.id}|${u.end}`, pos[i]));
  }

  // Pass 2: fixed sides + spread ports; later lines avoid corridors already taken.
  const raw = new Map<ID, { pts: Pt[]; s: Side; t: Side; job: Job }>();
  const used2 = new UsedSegments();
  for (const j of jobs) {
    const f1 = first.get(j.c.id);
    if (!f1) continue;
    const so = offsets.get(`${j.c.id}|from`) ?? 0;
    const to = offsets.get(`${j.c.id}|to`) ?? 0;
    const f2 = search(
      endOptions({ ...j.from, fixed: f1.s.side }, { [f1.s.side]: so }, j.fromBox),
      endOptions({ ...j.to, fixed: f1.g.side }, { [f1.g.side]: to }, j.toBox),
      obstacles, used2, `2|${j.c.id}`,
    ) ?? f1;
    for (const [a, b] of f2.steps) used2.add(a, b);
    raw.set(j.c.id, { pts: assemble(f2), s: f2.s.side, t: f2.g.side, job: j });
  }

  const hops = lineJumps([...raw].map(([id, r]) => [id, r.pts] as const));
  const routes = new Map<ID, Route>();
  for (const [id, r] of raw) {
    const points = smooth(r.pts, hops.get(id) ?? new Map());
    const [labelX, labelY] = midpoint(r.pts);
    const fr = r.job.from.rect;
    const tr = r.job.to.rect;
    routes.set(id, {
      points, labelX, labelY, sourceSide: r.s, targetSide: r.t,
      from: { x: fr.x, y: fr.y }, to: { x: tr.x, y: tr.y },
      key: points.map((p) => `${Math.round(p[0] * 10) / 10},${Math.round(p[1] * 10) / 10}`).join(' '),
    });
  }
  return routes;
}

/** Crossings where a horizontal segment of one line passes a vertical segment of another: segment index → hop xs. */
export function lineJumps(lines: readonly (readonly [ID, Pt[]])[]): Map<ID, Map<number, number[]>> {
  const verticals: { id: ID; x: number; y1: number; y2: number }[] = [];
  for (const [id, pts] of lines) {
    for (let i = 0; i + 1 < pts.length; i++) {
      const [a, b] = [pts[i], pts[i + 1]];
      if (Math.abs(a[0] - b[0]) < EPS) verticals.push({ id, x: a[0], y1: Math.min(a[1], b[1]), y2: Math.max(a[1], b[1]) });
    }
  }
  const out = new Map<ID, Map<number, number[]>>();
  const m = CORNER_RADIUS + HOP_RADIUS + 2;
  for (const [id, pts] of lines) {
    for (let i = 0; i + 1 < pts.length; i++) {
      const [a, b] = [pts[i], pts[i + 1]];
      if (Math.abs(a[1] - b[1]) >= EPS) continue;
      const y = a[1];
      const x1 = Math.min(a[0], b[0]);
      const x2 = Math.max(a[0], b[0]);
      const xs = verticals
        .filter((v) => v.id !== id && v.x > x1 + m && v.x < x2 - m && y > v.y1 + CORNER_RADIUS && y < v.y2 - CORNER_RADIUS)
        .map((v) => v.x);
      if (!xs.length) continue;
      const segs = out.get(id) ?? new Map<number, number[]>();
      segs.set(i, uniqSorted(xs));
      out.set(id, segs);
    }
  }
  return out;
}

/** Rounded corners + hop arcs, as a dense polyline. */
export function smooth(pts: Pt[], hops: Map<number, number[]>): Pt[] {
  if (pts.length < 2) return pts;
  const out: Pt[] = [pts[0]];
  const len = (a: Pt, b: Pt) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
  const toward = (a: Pt, b: Pt, d: number): Pt => {
    const l = len(a, b) || 1;
    return [a[0] + ((b[0] - a[0]) * d) / l, a[1] + ((b[1] - a[1]) * d) / l];
  };
  const radius = (i: number) => Math.min(CORNER_RADIUS, len(pts[i - 1], pts[i]) / 2, len(pts[i], pts[i + 1]) / 2);
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const xs = hops.get(i);
    if (xs) {
      const sx = Math.sign(b[0] - a[0]) || 1;
      const ordered = sx > 0 ? xs : [...xs].reverse();
      for (const x of ordered) {
        out.push([x - sx * HOP_RADIUS, a[1]]);
        for (let k = 1; k < 6; k++) {
          const t = (Math.PI * k) / 6;
          out.push([x - sx * HOP_RADIUS * Math.cos(t), a[1] - HOP_RADIUS * Math.sin(t)]);
        }
        out.push([x + sx * HOP_RADIUS, a[1]]);
      }
    }
    if (i + 1 === pts.length - 1) {
      out.push(b);
      break;
    }
    const r = radius(i + 1);
    const c = pts[i + 2];
    const p0 = toward(b, a, r);
    const p2 = toward(b, c, r);
    out.push(p0);
    for (const t of [0.25, 0.5, 0.75]) {
      const u = 1 - t;
      out.push([u * u * p0[0] + 2 * u * t * b[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * b[1] + t * t * p2[1]]);
    }
    out.push(p2);
  }
  return out;
}

/** Point halfway along a polyline. */
export function midpoint(pts: Pt[]): Pt {
  const lens = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
  let rest = lens.reduce((a, b) => a + b, 0) / 2;
  for (let i = 0; i < lens.length; i++) {
    if (rest <= lens[i]) {
      const t = lens[i] ? rest / lens[i] : 0;
      return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t];
    }
    rest -= lens[i];
  }
  return pts[pts.length - 1];
}

export function pointsToPath(pts: Pt[]): string {
  return pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ');
}
