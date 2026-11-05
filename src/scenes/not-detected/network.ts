import {createRandom} from '../../components/random';
import {ease} from '../../styles/motion';
import {CAMERA_TRACK, FRAME, GLYPH, SCAN_BOX, ZOOM_OUT_TARGET} from './layout';

/**
 * Deterministic generation of the demo's "software system": a core module
 * (the region the scanner inspects) surrounded by many other modules that the
 * scanner never looks at. Generated once at import time from fixed seeds, so
 * the Player and the renderer always see identical geometry.
 */

export type NetModule = {
  readonly index: number;
  readonly id: string;
  readonly label: string;
  readonly cx: number;
  readonly cy: number;
  readonly w: number;
  readonly h: number;
  readonly scanned: boolean;
  /** Fraction (0..1) of the zoom-out beat at which this module comes into view. */
  readonly reveal: number;
};

export type NetNode = {
  readonly index: number;
  readonly x: number;
  readonly y: number;
  readonly module: number;
  readonly scanned: boolean;
  readonly bug: boolean;
  /** Stable per-node random number in [0, 1). */
  readonly seed: number;
  /** Fraction (0..1) of the zoom-out beat at which the node enters the frame. */
  readonly reveal: number;
  /** Distance from the core centre, for radial staggers. */
  readonly dist: number;
  /** Target position in the final ≠ glyph (screen space). */
  readonly glyphX: number;
  readonly glyphY: number;
  /** Order in which the node departs during the assemble beat (0..1). */
  readonly departure: number;
};

export type NetEdge = {
  readonly a: number;
  readonly b: number;
  readonly module: number;
  readonly trunk: boolean;
};

const SPACING = 96;
const ROW = SPACING * (Math.sqrt(3) / 2);
const PAD = 56;

const MODULE_SPECS = [
  {id: 'core', label: 'core-services', cx: SCAN_BOX.cx, cy: SCAN_BOX.cy, w: SCAN_BOX.w, h: SCAN_BOX.h, bugs: 0},
  {id: 'auth', label: 'auth', cx: -1560, cy: -720, w: 760, h: 440, bugs: 2},
  {id: 'gateway', label: 'gateway', cx: -120, cy: -960, w: 1100, h: 340, bugs: 1},
  {id: 'billing', label: 'billing', cx: 1420, cy: -760, w: 820, h: 420, bugs: 2},
  {id: 'queue', label: 'queue', cx: 1860, cy: 120, w: 520, h: 700, bugs: 1},
  {id: 'payments', label: 'payments', cx: 1300, cy: 960, w: 900, h: 400, bugs: 1},
  {id: 'legacy', label: 'legacy-api', cx: -80, cy: 1000, w: 1080, h: 360, bugs: 2},
  {id: 'analytics', label: 'analytics', cx: -1480, cy: 860, w: 820, h: 460, bugs: 1},
  {id: 'cache', label: 'cache', cx: -1960, cy: 40, w: 480, h: 640, bugs: 1},
] as const;

const TRUNKS: readonly [string, string][] = [
  ['core', 'gateway'],
  ['core', 'legacy'],
  ['core', 'cache'],
  ['core', 'queue'],
  ['core', 'auth'],
  ['core', 'payments'],
  ['auth', 'gateway'],
  ['gateway', 'billing'],
  ['billing', 'queue'],
  ['queue', 'payments'],
  ['payments', 'legacy'],
  ['legacy', 'analytics'],
  ['analytics', 'cache'],
  ['cache', 'auth'],
];

/** Numerically invert a monotonic easing curve on [0, 1]. */
const invertEasing = (fn: (t: number) => number, value: number): number => {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (fn(mid) < value) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
};

const zoomOutSegment = CAMERA_TRACK.find((s) => s.beat === 'zoom-out');
const CAM_END = zoomOutSegment ? zoomOutSegment.to : {x: 0, y: 0, zoom: ZOOM_OUT_TARGET};

/**
 * Fraction of the zoom-out beat at which a world point comes into view
 * (with a small inset so marks appear just inside the frame edge).
 */
const revealFraction = (x: number, y: number): number => {
  const inset = 0.9;
  const entry = Math.max(
    Math.abs(x - CAM_END.x) / ((FRAME.width / 2) * inset),
    Math.abs(y - CAM_END.y) / ((FRAME.height / 2) * inset),
  );
  if (entry <= 1) return 0;
  const required = Math.log(1 / entry) / Math.log(CAM_END.zoom);
  return invertEasing(ease.camera, required);
};

const build = () => {
  const modules: NetModule[] = [];
  const nodes: Omit<NetNode, 'glyphX' | 'glyphY' | 'departure'>[] = [];
  const edges: NetEdge[] = [];

  MODULE_SPECS.forEach((spec, m) => {
    const rand = createRandom(1009 * (m + 1));
    const scanned = spec.id === 'core';
    const x0 = spec.cx - spec.w / 2 + PAD;
    const x1 = spec.cx + spec.w / 2 - PAD;
    const y0 = spec.cy - spec.h / 2 + PAD;
    const y1 = spec.cy + spec.h / 2 - PAD;
    const rows = Math.floor((y1 - y0) / ROW) + 1;
    const offY = (y1 - y0 - (rows - 1) * ROW) / 2;
    const members: number[] = [];

    for (let r = 0; r < rows; r++) {
      const shift = r % 2 === 0 ? 0 : SPACING / 2;
      const cols = Math.floor((x1 - x0 - shift) / SPACING) + 1;
      const offX = (x1 - x0 - shift - (cols - 1) * SPACING) / 2;
      for (let c = 0; c < cols; c++) {
        const bx = x0 + offX + shift + c * SPACING;
        const by = y0 + offY + r * ROW;
        // Carve rounded corners with a superellipse and thin out randomly so
        // modules read as organic clusters rather than grids.
        const nx = (bx - spec.cx) / (spec.w / 2 - PAD + 20);
        const ny = (by - spec.cy) / (spec.h / 2 - PAD + 20);
        const keep = Math.pow(Math.abs(nx), 4) + Math.pow(Math.abs(ny), 4) <= 1;
        const drop = rand.next() < (scanned ? 0.04 : 0.1);
        const jx = rand.range(-13, 13);
        const jy = rand.range(-11, 11);
        if (!keep || drop) continue;
        const x = bx + jx;
        const y = by + jy;
        members.push(nodes.length);
        nodes.push({
          index: nodes.length,
          x,
          y,
          module: m,
          scanned,
          bug: false,
          seed: rand.next(),
          reveal: scanned ? 0 : revealFraction(x, y),
          dist: Math.hypot(x - SCAN_BOX.cx, y - SCAN_BOX.cy),
        });
      }
    }

    // Local mesh: connect lattice neighbours with some probability.
    const degree = new Map<number, number>();
    const bump = (i: number) => degree.set(i, (degree.get(i) ?? 0) + 1);
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const a = nodes[members[i]];
        const b = nodes[members[j]];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < SPACING * 1.25 && rand.next() < (scanned ? 0.8 : 0.72)) {
          edges.push({a: a.index, b: b.index, module: m, trunk: false});
          bump(a.index);
          bump(b.index);
        }
      }
    }
    // Make sure no node is isolated.
    for (const i of members) {
      if ((degree.get(i) ?? 0) > 0) continue;
      let best = -1;
      let bestD = Infinity;
      for (const j of members) {
        if (j === i) continue;
        const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
        if (d < bestD) {
          bestD = d;
          best = j;
        }
      }
      if (best >= 0) {
        edges.push({a: i, b: best, module: m, trunk: false});
        bump(i);
        bump(best);
      }
    }

    // Module comes into view when its nearest point enters the frame.
    const nearX = Math.min(Math.max(CAM_END.x, spec.cx - spec.w / 2), spec.cx + spec.w / 2);
    const nearY = Math.min(Math.max(CAM_END.y, spec.cy - spec.h / 2), spec.cy + spec.h / 2);
    modules.push({
      index: m,
      id: spec.id,
      label: spec.label,
      cx: spec.cx,
      cy: spec.cy,
      w: spec.w,
      h: spec.h,
      scanned,
      reveal: scanned ? 0 : revealFraction(nearX, nearY),
    });
  });

  // Trunk lines between modules.
  const moduleIndex = (id: string) => MODULE_SPECS.findIndex((s) => s.id === id);
  const nearestNodeTo = (m: number, x: number, y: number) => {
    let best = -1;
    let bestD = Infinity;
    for (const n of nodes) {
      if (n.module !== m) continue;
      const d = Math.hypot(n.x - x, n.y - y);
      if (d < bestD) {
        bestD = d;
        best = n.index;
      }
    }
    return best;
  };
  const trunkEnds = new Set<number>();
  for (const [from, to] of TRUNKS) {
    const ma = moduleIndex(from);
    const mb = moduleIndex(to);
    const A = MODULE_SPECS[ma];
    const B = MODULE_SPECS[mb];
    const a = nearestNodeTo(ma, B.cx, B.cy);
    const b = nearestNodeTo(mb, A.cx, A.cy);
    trunkEnds.add(a);
    trunkEnds.add(b);
    edges.push({a, b, module: ma, trunk: true});
  }

  // Bugs: hidden in the modules that are never scanned.
  const bugFlags = new Set<number>();
  MODULE_SPECS.forEach((spec, m) => {
    if (spec.bugs === 0) return;
    const rand = createRandom(7919 * (m + 3));
    const candidates = nodes.filter((n) => n.module === m && !trunkEnds.has(n.index));
    let guard = 0;
    let placed = 0;
    while (placed < spec.bugs && guard++ < 500) {
      const pick = rand.pick(candidates);
      const tooClose = [...bugFlags].some((b) => Math.hypot(nodes[b].x - pick.x, nodes[b].y - pick.y) < 260);
      if (bugFlags.has(pick.index) || tooClose) continue;
      bugFlags.add(pick.index);
      placed++;
    }
  });

  // Targets for the closing ≠ glyph (screen space).
  const glyph = new Map<number, {x: number; y: number}>();
  const plain = nodes.filter((n) => !bugFlags.has(n.index));
  const byY = [...plain].sort((p, q) => p.y - q.y);
  const half = Math.ceil(byY.length / 2);
  const bars = [byY.slice(0, half), byY.slice(half)];
  bars.forEach((group, barIndex) => {
    const rows = GLYPH.rows;
    const cols = Math.max(2, Math.floor(group.length / rows));
    const step = GLYPH.barLength / (cols - 1);
    const barY = GLYPH.cy + (barIndex === 0 ? -1 : 1) * (GLYPH.barGap / 2);
    const slots: {x: number; y: number}[] = [];
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        slots.push({
          x: GLYPH.cx - GLYPH.barLength / 2 + c * step,
          y: barY + (r - (rows - 1) / 2) * step,
        });
      }
    }
    const sorted = [...group].sort((p, q) => p.x - q.x || p.y - q.y);
    sorted.forEach((n, k) => {
      // Column-major slot order follows the x order of the nodes, so nodes
      // flow sideways as little as possible. Leftovers double up invisibly.
      const slot = k < slots.length ? slots[k] : slots[Math.floor(((k * 7919) % slots.length))];
      glyph.set(n.index, slot);
    });
  });
  const bugs = nodes.filter((n) => bugFlags.has(n.index)).sort((p, q) => p.x - p.y - (q.x - q.y));
  bugs.forEach((n, k) => {
    const t = bugs.length === 1 ? 0.5 : k / (bugs.length - 1);
    glyph.set(n.index, {
      x: GLYPH.cx - GLYPH.slashDx + 2 * GLYPH.slashDx * t,
      y: GLYPH.cy + GLYPH.slashDy - 2 * GLYPH.slashDy * t,
    });
  });

  const maxDist = Math.max(...nodes.map((n) => n.dist));
  const finalNodes: NetNode[] = nodes.map((n) => {
    const target = glyph.get(n.index)!;
    return {
      ...n,
      bug: bugFlags.has(n.index),
      glyphX: target.x,
      glyphY: target.y,
      departure: Math.min(1, (n.dist / maxDist) * 0.75 + n.seed * 0.25),
    };
  });

  const scannedCount = finalNodes.filter((n) => n.scanned).length;
  return {
    modules,
    nodes: finalNodes,
    edges,
    stats: {
      scanned: scannedCount,
      total: finalNodes.length,
      bugs: bugFlags.size,
      coverage: Math.round((scannedCount / finalNodes.length) * 100),
    },
  };
};

export const NETWORK = build();
export type Network = typeof NETWORK;
