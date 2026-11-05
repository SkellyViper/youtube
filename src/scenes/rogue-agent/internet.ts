import {createRandom} from '../../components/random';
import {AGENT, FINAL_CAMERA, FRAME, JOHN_NODE, WIDE} from './layout';

/**
 * Deterministic "internet" for the spread sequence: clusters of hosts
 * (data centres, networks) plus scattered lone machines, linked by a
 * backbone. Generated once at import time from fixed seeds, so the Player
 * and the renderer always see identical geometry.
 *
 * Rendering strategy: the static geometry is turned into a few dozen world-
 * space path strings ONCE. Per frame, only opacities, stroke widths and one
 * camera transform change, which keeps thousands of nodes cheap to draw.
 */

export type INode = {
  readonly index: number;
  readonly x: number;
  readonly y: number;
  /** Cluster index; -1 for lone hosts. */
  readonly cluster: number;
  readonly home: boolean;
  /** Infection time on the SPREAD_TRACK scale; Infinity if never infected. */
  readonly tau: number;
  /** 0 = first copy. -1 if never infected (or the agent itself). */
  readonly rank: number;
  /** Who infected this node (agent = 0). -1 if never infected. */
  readonly infector: number;
  /** Darkness cascade group, 0..DARK_GROUPS-1. */
  readonly dark: number;
};

export const DARK_GROUPS = 10;
/** Ranks below this are animated individually (probe lines, pulses). */
export const EARLY_RANKS = 34;

type Cluster = {x: number; y: number; rx: number; ry: number; home: boolean};

const FIELD = {
  x0: WIDE.x - FRAME.width / 2 / WIDE.zoom + 300,
  x1: WIDE.x + FRAME.width / 2 / WIDE.zoom - 300,
  y0: WIDE.y - FRAME.height / 2 / WIDE.zoom + 300,
  y1: WIDE.y + FRAME.height / 2 / WIDE.zoom - 300,
};

const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);

/** Rank → infection time. Early ranks are spaced out so each copy is visible. */
const earlyTau = (k: number): number => {
  if (k < 6) return 0.006 + (k / 5) * 0.04;
  return 0.056 + ((k - 6) / (EARLY_RANKS - 7)) * 0.088;
};

const build = () => {
  const rand = createRandom(20261103);

  // ── Clusters ──────────────────────────────────────────────────────────
  const clusters: Cluster[] = [{x: AGENT.x, y: AGENT.y, rx: 1550, ry: 900, home: true}];
  let attempts = 0;
  while (clusters.length < 60 && attempts++ < 6000) {
    const rx = rand.range(380, 1050);
    const ry = rx * rand.range(0.55, 0.95);
    const x = rand.range(FIELD.x0 + rx, FIELD.x1 - rx);
    const y = rand.range(FIELD.y0 + ry, FIELD.y1 - ry);
    const separated = clusters.every((c) => Math.hypot((c.x - x) / (c.rx + rx), (c.y - y) / (c.ry + ry)) > 1.3);
    const clearOfJohn = dist(x, y, JOHN_NODE.x, JOHN_NODE.y) > Math.max(rx, ry) + 650;
    if (separated && clearOfJohn) clusters.push({x, y, rx, ry, home: false});
  }

  // ── Hosts ─────────────────────────────────────────────────────────────
  type Raw = {x: number; y: number; cluster: number; home: boolean; seed: number};
  const raw: Raw[] = [{x: AGENT.x, y: AGENT.y, cluster: 0, home: true, seed: 0}];

  clusters.forEach((c, ci) => {
    const spacing = c.home ? 172 : 205;
    const members: Raw[] = ci === 0 ? [raw[0]] : [];
    const expected = (Math.PI * c.rx * c.ry) / (spacing * spacing);
    const tries = Math.ceil(expected * 30);
    for (let t = 0; t < tries; t++) {
      const a = rand.next() * Math.PI * 2;
      const r = Math.sqrt(rand.next());
      const x = c.x + Math.cos(a) * r * c.rx;
      const y = c.y + Math.sin(a) * r * c.ry;
      if (members.some((m) => dist(m.x, m.y, x, y) < spacing)) continue;
      if (c.home && dist(x, y, AGENT.x, AGENT.y) < 250) continue;
      const node = {x, y, cluster: ci, home: c.home, seed: rand.next()};
      members.push(node);
      raw.push(node);
    }
  });

  // Lone hosts scattered between clusters.
  const lone: Raw[] = [];
  attempts = 0;
  while (lone.length < 240 && attempts++ < 8000) {
    const x = rand.range(FIELD.x0, FIELD.x1);
    const y = rand.range(FIELD.y0, FIELD.y1);
    const inCluster = clusters.some((c) => Math.hypot((x - c.x) / (c.rx + 260), (y - c.y) / (c.ry + 260)) < 1);
    const crowded = lone.some((l) => dist(l.x, l.y, x, y) < 520);
    const nearJohn = dist(x, y, JOHN_NODE.x, JOHN_NODE.y) < 420;
    if (inCluster || crowded || nearJohn) continue;
    const node = {x, y, cluster: -1, home: false, seed: rand.next()};
    lone.push(node);
    raw.push(node);
  }

  // John's laptop: on the internet, never infected, drawn specially.
  const johnIndex = raw.length;
  raw.push({x: JOHN_NODE.x, y: JOHN_NODE.y, cluster: -1, home: false, seed: 0.5});

  const N = raw.length;

  // ── Links ─────────────────────────────────────────────────────────────
  const edgeKeys = new Set<string>();
  const edges: [number, number][] = [];
  const addEdge = (a: number, b: number) => {
    if (a === b) return;
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);
    edges.push([a, b]);
  };
  const nearest = (i: number, candidates: readonly number[], count: number): number[] =>
    candidates
      .filter((j) => j !== i)
      .map((j) => ({j, d: dist(raw[i].x, raw[i].y, raw[j].x, raw[j].y)}))
      .sort((p, q) => p.d - q.d)
      .slice(0, count)
      .map((e) => e.j);

  const byCluster = clusters.map((_, ci) => raw.map((n, i) => (n.cluster === ci ? i : -1)).filter((i) => i >= 0));
  byCluster.forEach((members) => {
    for (const i of members) for (const j of nearest(i, members, 2)) addEdge(i, j);
  });
  const all = raw.map((_, i) => i);
  for (let i = 0; i < N; i++) {
    if (raw[i].cluster === -1) for (const j of nearest(i, all, 2)) addEdge(i, j);
  }
  // Backbone: each cluster to its two nearest clusters.
  clusters.forEach((c, ci) => {
    const others = clusters
      .map((o, oi) => ({oi, d: dist(c.x, c.y, o.x, o.y)}))
      .filter((o) => o.oi !== ci)
      .sort((p, q) => p.d - q.d)
      .slice(0, 2);
    for (const {oi} of others) {
      const o = clusters[oi];
      const a = byCluster[ci].reduce((best, i) => (dist(raw[i].x, raw[i].y, o.x, o.y) < dist(raw[best].x, raw[best].y, o.x, o.y) ? i : best));
      const b = byCluster[oi].reduce((best, i) => (dist(raw[i].x, raw[i].y, c.x, c.y) < dist(raw[best].x, raw[best].y, c.x, c.y) ? i : best));
      addEdge(a, b);
    }
  });

  // ── Spread: shortest-path arrival time from the agent ─────────────────
  const adj: {j: number; w: number}[][] = raw.map(() => []);
  const wrand = createRandom(77);
  for (const [a, b] of edges) {
    const w = dist(raw[a].x, raw[a].y, raw[b].x, raw[b].y) * (0.7 + 0.6 * wrand.next());
    adj[a].push({j: b, w});
    adj[b].push({j: a, w});
  }
  const arrival = new Array<number>(N).fill(Infinity);
  const visited = new Array<boolean>(N).fill(false);
  arrival[0] = 0;
  for (let step = 0; step < N; step++) {
    let u = -1;
    for (let i = 0; i < N; i++) if (!visited[i] && (u === -1 || arrival[i] < arrival[u])) u = i;
    if (u === -1 || arrival[u] === Infinity) break;
    visited[u] = true;
    for (const {j, w} of adj[u]) if (arrival[u] + w < arrival[j]) arrival[j] = arrival[u] + w;
  }

  // Hidden agent for the closing shot: a host near a chosen screen point.
  const hx = FINAL_CAMERA.x + (1500 - FRAME.width / 2) / FINAL_CAMERA.zoom;
  const hy = FINAL_CAMERA.y + (850 - FRAME.height / 2) / FINAL_CAMERA.zoom;
  const hiddenIndex = raw.reduce(
    (best, n, i) => (n.cluster > 0 && dist(n.x, n.y, hx, hy) < dist(raw[best].x, raw[best].y, hx, hy) ? i : best),
    1,
  );

  const vrand = createRandom(4242);
  const vulnerable = raw.map((n, i) => {
    const roll = vrand.next();
    if (i === 0 || i === johnIndex || i === hiddenIndex) return false;
    return roll < (n.home ? 0.48 : n.cluster === -1 ? 0.3 : 0.37);
  });
  const infected = raw
    .map((_, i) => i)
    .filter((i) => vulnerable[i] && arrival[i] < Infinity)
    .sort((a, b) => arrival[a] - arrival[b]);

  const tau = new Array<number>(N).fill(Infinity);
  const rank = new Array<number>(N).fill(-1);
  const infector = new Array<number>(N).fill(-1);
  tau[0] = 0;
  const tLate0 = arrival[infected[Math.min(EARLY_RANKS, infected.length - 1)]];
  const tLate1 = arrival[infected[infected.length - 1]];
  infected.forEach((i, k) => {
    rank[i] = k;
    tau[i] = k < EARLY_RANKS ? earlyTau(k) : 0.16 + 0.83 * Math.pow((arrival[i] - tLate0) / Math.max(1, tLate1 - tLate0), 0.85);
    // Infector: the nearest host that already carries a copy.
    let best = 0;
    for (let m = 0; m < k; m++) {
      const c = infected[m];
      if (dist(raw[c].x, raw[c].y, raw[i].x, raw[i].y) < dist(raw[best].x, raw[best].y, raw[i].x, raw[i].y)) best = c;
    }
    infector[i] = best;
  });

  const maxD = Math.max(...raw.map((n) => dist(n.x, n.y, AGENT.x, AGENT.y)));
  const nodes: INode[] = raw.map((n, i) => ({
    index: i,
    x: n.x,
    y: n.y,
    cluster: n.cluster,
    home: n.home,
    tau: tau[i],
    rank: rank[i],
    infector: infector[i],
    dark: Math.min(DARK_GROUPS - 1, Math.floor((0.6 * (dist(n.x, n.y, AGENT.x, AGENT.y) / maxD) + 0.4 * n.seed) * DARK_GROUPS)),
  }));

  // ── Static world-space paths ──────────────────────────────────────────
  // Dots are zero-length subpaths with round caps + non-scaling strokes, so a
  // dot keeps its on-screen size no matter how far the camera zooms out.
  const dot = (n: {x: number; y: number}) => `M${n.x.toFixed(1)} ${n.y.toFixed(1)}h0.01`;
  const special = (i: number) => i === 0 || i === johnIndex;

  const ringsByDark: string[] = Array.from({length: DARK_GROUPS}, () => '');
  let inner = '';
  for (const n of nodes) {
    if (special(n.index)) continue;
    ringsByDark[n.dark] += dot(n);
    inner += dot(n);
  }

  const edgesByDark: string[] = Array.from({length: DARK_GROUPS}, () => '');
  for (const [a, b] of edges) {
    const A = nodes[a];
    const B = nodes[b];
    edgesByDark[Math.min(A.dark, B.dark)] += `M${A.x.toFixed(1)} ${A.y.toFixed(1)}L${B.x.toFixed(1)} ${B.y.toFixed(1)}`;
  }

  // Infection groups: early ranks individually, the rest by time slice.
  const groupMap = new Map<string, {tau: number; window: number; d: string; count: number}>();
  for (const n of nodes) {
    if (n.rank < 0) continue;
    const key = n.rank < EARLY_RANKS ? `e${n.rank}` : `q${Math.floor(((n.tau - 0.16) / 0.84) * 36)}`;
    const g = groupMap.get(key) ?? {tau: n.tau, window: n.rank < EARLY_RANKS ? 0.006 : 0.025, d: '', count: 0};
    g.tau = Math.min(g.tau, n.tau);
    g.d += dot(n);
    g.count++;
    groupMap.set(key, g);
  }
  const infectGroups = [...groupMap.values()].sort((a, b) => a.tau - b.tau);

  const early = nodes.filter((n) => n.rank >= 0 && n.rank < EARLY_RANKS);
  // The agent's failed probes: nearby hosts it tries and cannot get into.
  const failedProbes = nodes
    .filter((n) => n.home && n.index !== 0 && n.rank === -1)
    .sort((a, b) => dist(a.x, a.y, AGENT.x, AGENT.y) - dist(b.x, b.y, AGENT.x, AGENT.y))
    .slice(0, 9);

  const tauSorted = nodes.filter((n) => n.rank >= 0).map((n) => n.tau).sort((a, b) => a - b);

  return {
    nodes,
    clusters,
    agent: nodes[0],
    john: nodes[johnIndex],
    hidden: nodes[hiddenIndex],
    paths: {ringsByDark, inner, edgesByDark},
    infectGroups,
    early,
    failedProbes,
    /** Sorted infection times, for counting copies at a given spread value. */
    tauSorted,
    stats: {hosts: N, infected: infected.length, clusters: clusters.length},
  };
};

export const INTERNET = build();

/** Number of infected hosts (including the original agent) at a spread value. */
export const infectedAt = (spread: number): number => {
  const t = INTERNET.tauSorted;
  let lo = 0;
  let hi = t.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (t[mid] <= spread) lo = mid + 1;
    else hi = mid;
  }
  return 1 + lo;
};
