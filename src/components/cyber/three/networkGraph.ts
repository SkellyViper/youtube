import type {Vec3} from './rig';

/**
 * Graph model and layout helpers for <NetworkField>.
 *
 * Everything here is plain data and pure functions (no React, no three.js),
 * so a scene can build its network once at module scope:
 *
 *   const rand = createRandom(7);
 *   const graph: NetGraph = {nodes: [], edges: []};
 *   const a = appendCluster(graph, generateCluster(rand, {center: [0, 2, 0]}));
 *   const dist = graphDistances(graph, a.hubs[0]);
 *   const data = buildNetworkFieldData(graph, dist);
 *   ...
 *   <NetworkField data={data} wave={w} />
 */

export type NetRole = 'hub' | 'spoke' | 'leaf';

export type NetNode = {
  /** World position. */
  p: [number, number, number];
  /** World radius of the dot. */
  size: number;
  /** Hubs carry a thin ring. */
  ring?: boolean;
  role?: NetRole;
  /** Cluster id (free for the scene to use). */
  group?: number;
  /** Build-up clock value at which the node appears (unlit). Omit: always there. */
  born?: number;
  /** Build-up clock value at which the node lights. Omit: always lit. */
  lit?: number;
  /** Position (0..1) of the node along a comet's path: it ignites as the comet passes. Omit: not on the path. */
  hop?: number;
  /** Per-node colour multiplier (rgb). */
  tint?: readonly [number, number, number];
};

export type NetEdge = {
  a: number;
  b: number;
  kind?: 'spoke' | 'leaf' | 'bridge' | 'cross' | 'arc';
  /** Graph length the wave has to travel along this edge (default 1). */
  weight?: number;
  /** Build-up clock values between which the edge draws on, from `a` to `b`. Omit: always drawn. */
  grow?: [number, number];
  /** Brightness multiplier. */
  level?: number;
  /** Width multiplier. */
  width?: number;
  /** > 0 turns the edge into an arc bowed along +y (height of the Bezier control point above the chord). */
  lift?: number;
  /** Subdivisions of an arc (default 20). */
  segments?: number;
};

export type NetGraph = {nodes: NetNode[]; edges: NetEdge[]};

/** Distance value of nodes the wave can never reach. */
export const UNREACHED = 1e6;
/** Build-up value meaning "was always there". */
export const ALWAYS = -1e6;

type V3 = [number, number, number];
const sub = (a: Vec3, b: Vec3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: Vec3, b: Vec3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: Vec3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const len = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
const dist3 = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const norm = (a: Vec3): V3 => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

export type Random = {next: () => number; range: (min: number, max: number) => number};

/* ------------------------------------------------------------------ distances */

/**
 * Shortest graph distance from one or more sources to every node (Dijkstra;
 * with all weights 1 this is breadth-first order). The result drives the
 * wavefront: a node activates when `wave >= dist[i]`.
 */
export const graphDistances = (graph: NetGraph, sources: number | readonly number[]): Float32Array => {
  const n = graph.nodes.length;
  const adj: {to: number; w: number}[][] = Array.from({length: n}, () => []);
  for (const e of graph.edges) {
    const w = e.weight ?? 1;
    adj[e.a].push({to: e.b, w});
    adj[e.b].push({to: e.a, w});
  }
  const best = new Float64Array(n).fill(UNREACHED);
  // Binary min-heap of (distance, node).
  const hd: number[] = [];
  const hn: number[] = [];
  const push = (d: number, node: number) => {
    let i = hd.length;
    hd.push(d);
    hn.push(node);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (hd[p] <= hd[i]) break;
      [hd[p], hd[i]] = [hd[i], hd[p]];
      [hn[p], hn[i]] = [hn[i], hn[p]];
      i = p;
    }
  };
  const pop = (): [number, number] => {
    const top: [number, number] = [hd[0], hn[0]];
    const d = hd.pop() as number;
    const node = hn.pop() as number;
    if (hd.length > 0) {
      hd[0] = d;
      hn[0] = node;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < hd.length && hd[l] < hd[m]) m = l;
        if (r < hd.length && hd[r] < hd[m]) m = r;
        if (m === i) break;
        [hd[m], hd[i]] = [hd[i], hd[m]];
        [hn[m], hn[i]] = [hn[i], hn[m]];
        i = m;
      }
    }
    return top;
  };
  for (const s of typeof sources === 'number' ? [sources] : sources) {
    best[s] = 0;
    push(0, s);
  }
  while (hd.length > 0) {
    const [d, node] = pop();
    if (d > best[node]) continue;
    for (const {to, w} of adj[node]) {
      const nd = d + w;
      if (nd < best[to]) {
        best[to] = nd;
        push(nd, to);
      }
    }
  }
  return Float32Array.from(best);
};

/* ------------------------------------------------------------------ cluster layout */

export type ClusterOptions = {
  readonly center: Vec3;
  /** Overall size. 1 = hubs about 2 units apart, spokes about 1 unit long. */
  readonly scale?: number;
  /** Number of hubs, or explicit hub positions relative to `center`. */
  readonly hubs?: number | readonly Vec3[];
  /** Explicit hub-to-hub bridges (pairs of hub indices). Default: spanning tree + `extraBridges`. */
  readonly bridges?: readonly (readonly [number, number])[];
  readonly extraBridges?: number;
  /** Spokes per hub: [min, max]. */
  readonly spokes?: readonly [number, number];
  /** Chance that a spoke grows one or two leaves. */
  readonly leaves?: number;
  /** Spoke-to-spoke links between neighbouring sub-groups. */
  readonly crossLinks?: number;
  /** Vertical squash (1 = round, 0.6 = lens). */
  readonly flatten?: number;
  /** Nothing is placed below this world height. */
  readonly minY?: number;
  /** Keep-out test for candidate positions (e.g. around a camera). */
  readonly accept?: (p: Vec3) => boolean;
  readonly group?: number;
  readonly nodeSize?: {readonly hub: number; readonly spoke: number; readonly leaf: number};
};

export type Cluster = NetGraph & {
  /** Indices of the hub nodes. */
  hubs: number[];
};

const unitVector = (rand: Random, flatten: number): V3 => {
  const y = rand.range(-1, 1);
  const a = rand.range(0, Math.PI * 2);
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  return norm([Math.cos(a) * r, y * flatten, Math.sin(a) * r]);
};

/**
 * One designed-looking cluster: a few hubs, spokes around each hub, leaves
 * on some spokes, bridges between the hubs and a few cross links.
 *
 * Positions come from best-candidate sampling (every new node takes the
 * roomiest of several tries, with a minimum distance), and a few relaxation
 * passes push apart whatever still crowds. Deterministic for a given `rand`.
 */
export const generateCluster = (rand: Random, options: ClusterOptions): Cluster => {
  const s = options.scale ?? 1;
  const flatten = options.flatten ?? 0.72;
  const minY = options.minY ?? 0.7;
  const accept = options.accept ?? (() => true);
  const [spokeMin, spokeMax] = options.spokes ?? [5, 8];
  const leafChance = options.leaves ?? 0.4;
  const sizes = options.nodeSize ?? {hub: 0.16, spoke: 0.085, leaf: 0.06};
  const group = options.group;
  const nodes: NetNode[] = [];
  const edges: NetEdge[] = [];
  const owner: number[] = [];

  /* Hubs. */
  const hubs: number[] = [];
  if (typeof options.hubs === 'object') {
    for (const h of options.hubs) {
      hubs.push(nodes.length);
      owner.push(nodes.length);
      nodes.push({p: add(options.center, h), size: sizes.hub, ring: true, role: 'hub', group});
    }
  } else {
    const count = options.hubs ?? 4;
    const base = rand.range(0, Math.PI * 2);
    for (let i = 0; i < count; i++) {
      let p: V3 = [options.center[0], options.center[1], options.center[2]];
      for (let attempt = 0; attempt < 24; attempt++) {
        const a = base + ((i + rand.range(-0.22, 0.22)) / count) * Math.PI * 2;
        const r = count >= 5 && i === 0 ? s * rand.range(0, 0.4) : s * rand.range(1.45, 2.25);
        const y = Math.max(minY + 0.5 * s, options.center[1] + s * rand.range(-1, 1) * flatten);
        p = [options.center[0] + Math.cos(a) * r, y, options.center[2] + Math.sin(a) * r];
        if (hubs.every((h) => dist3(nodes[h].p, p) >= 1.7 * s)) break;
      }
      hubs.push(nodes.length);
      owner.push(nodes.length);
      nodes.push({p, size: sizes.hub * rand.range(0.92, 1.12), ring: true, role: 'hub', group});
    }
  }

  const roomAt = (p: Vec3) => {
    let room = Infinity;
    for (const n of nodes) room = Math.min(room, dist3(n.p, p));
    return room;
  };
  const ownedBy = (p: Vec3, hub: number) => {
    const own = dist3(nodes[hub].p, p);
    return hubs.every((h) => h === hub || dist3(nodes[h].p, p) > own * 1.12);
  };

  /* Spokes: each takes the roomiest of several candidate positions. */
  const spokes: number[] = [];
  for (const hub of hubs) {
    const count = Math.round(rand.range(spokeMin, spokeMax));
    for (let j = 0; j < count; j++) {
      let best: V3 | null = null;
      let bestRoom = 0.5 * s;
      for (let c = 0; c < 16; c++) {
        const p = add(nodes[hub].p, mul(unitVector(rand, flatten), s * rand.range(0.85, 1.3)));
        if (p[1] < minY || !ownedBy(p, hub) || !accept(p)) continue;
        const room = roomAt(p);
        if (room > bestRoom) {
          bestRoom = room;
          best = p;
        }
      }
      if (!best) continue;
      edges.push({a: hub, b: nodes.length, kind: 'spoke'});
      spokes.push(nodes.length);
      owner.push(hub);
      nodes.push({p: best, size: sizes.spoke * rand.range(0.88, 1.14), role: 'spoke', group});
    }
  }

  /* Leaves: continue outward from some spokes. */
  for (const spoke of spokes) {
    if (rand.next() >= leafChance) continue;
    const count = rand.next() < 0.3 ? 2 : 1;
    const hub = owner[spoke];
    const out = norm(sub(nodes[spoke].p, nodes[hub].p));
    for (let j = 0; j < count; j++) {
      let best: V3 | null = null;
      let bestRoom = 0.44 * s;
      for (let c = 0; c < 12; c++) {
        const dir = norm(add(out, mul(unitVector(rand, flatten), 0.8)));
        const p = add(nodes[spoke].p, mul(dir, s * rand.range(0.58, 0.9)));
        if (p[1] < minY || !ownedBy(p, hub) || !accept(p)) continue;
        const room = roomAt(p);
        if (room > bestRoom) {
          bestRoom = room;
          best = p;
        }
      }
      if (!best) continue;
      edges.push({a: spoke, b: nodes.length, kind: 'leaf'});
      owner.push(hub);
      nodes.push({p: best, size: sizes.leaf * rand.range(0.88, 1.14), role: 'leaf', group});
    }
  }

  /* Bridges between hubs: spanning tree (shortest first), then a few extra. */
  if (options.bridges) {
    for (const [i, j] of options.bridges) edges.push({a: hubs[i], b: hubs[j], kind: 'bridge'});
  } else if (hubs.length > 1) {
    const pairs: {i: number; j: number; d: number}[] = [];
    for (let i = 0; i < hubs.length; i++) {
      for (let j = i + 1; j < hubs.length; j++) pairs.push({i, j, d: dist3(nodes[hubs[i]].p, nodes[hubs[j]].p)});
    }
    pairs.sort((x, y) => x.d - y.d);
    const set = hubs.map((_, i) => i);
    const find = (i: number): number => (set[i] === i ? i : (set[i] = find(set[i])));
    let extra = options.extraBridges ?? (hubs.length >= 4 ? 1 : 0);
    for (const pair of pairs) {
      const a = find(pair.i);
      const b = find(pair.j);
      if (a !== b) {
        set[a] = b;
        edges.push({a: hubs[pair.i], b: hubs[pair.j], kind: 'bridge'});
      } else if (extra > 0 && pair.d < 4.6 * s) {
        extra--;
        edges.push({a: hubs[pair.i], b: hubs[pair.j], kind: 'bridge'});
      }
    }
  }

  /* Cross links: the closest spoke pairs of different sub-groups. */
  const crossCount = options.crossLinks ?? 2;
  if (crossCount > 0) {
    const pairs: {a: number; b: number; d: number}[] = [];
    for (let i = 0; i < spokes.length; i++) {
      for (let j = i + 1; j < spokes.length; j++) {
        const a = spokes[i];
        const b = spokes[j];
        if (owner[a] === owner[b]) continue;
        const d = dist3(nodes[a].p, nodes[b].p);
        if (d < 1.5 * s) pairs.push({a, b, d});
      }
    }
    pairs.sort((x, y) => x.d - y.d);
    const used = new Set<number>();
    let left = crossCount;
    for (const pair of pairs) {
      if (left <= 0) break;
      if (used.has(pair.a) || used.has(pair.b)) continue;
      used.add(pair.a);
      used.add(pair.b);
      edges.push({a: pair.a, b: pair.b, kind: 'cross'});
      left--;
    }
  }

  /* Relaxation: push apart whatever is still closer than the minimum distance. Hubs stay put. */
  const minDist = 0.52 * s;
  for (let pass = 0; pass < 5; pass++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const d = dist3(a.p, b.p);
        if (d >= minDist || d < 1e-6) continue;
        const push = mul(norm(sub(b.p, a.p)), minDist - d);
        const aFixed = a.role === 'hub';
        const bFixed = b.role === 'hub';
        if (aFixed && bFixed) continue;
        const ka = aFixed ? 0 : bFixed ? 1 : 0.5;
        const pa = add(a.p, mul(push, -ka));
        const pb = add(b.p, mul(push, 1 - ka));
        if (!aFixed && pa[1] >= minY && accept(pa)) a.p = pa;
        if (!bFixed && pb[1] >= minY && accept(pb)) b.p = pb;
      }
    }
  }

  return {nodes, edges, hubs};
};

/** Add a cluster (or any sub-graph) to a graph. Returns the node offset and the remapped hub indices. */
export const appendCluster = (graph: NetGraph, cluster: Cluster): {offset: number; count: number; hubs: number[]} => {
  const offset = graph.nodes.length;
  for (const n of cluster.nodes) graph.nodes.push(n);
  for (const e of cluster.edges) graph.edges.push({...e, a: e.a + offset, b: e.b + offset});
  return {offset, count: cluster.nodes.length, hubs: cluster.hubs.map((h) => h + offset)};
};

/** Point on an edge at fraction `t` (follows the bow of an arc). */
export const edgePoint = (graph: NetGraph, edge: NetEdge, t: number): V3 => {
  const a = graph.nodes[edge.a].p;
  const b = graph.nodes[edge.b].p;
  const lift = edge.lift ?? 0;
  if (lift <= 0) return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const k = 2 * t * (1 - t);
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + lift * k, a[2] + (b[2] - a[2]) * t];
};

/* ------------------------------------------------------------------ GPU buffers */

/** Typed arrays in the layout <NetworkField> uploads. Build once with `buildNetworkFieldData`. */
export type NetworkFieldData = {
  readonly nodeCount: number;
  /** xyz per node. */
  readonly nodePosition: Float32Array;
  /** World radius per node (0 = not drawn). */
  readonly nodeSize: Float32Array;
  /** Per node: wave distance, born, lit, ring (0 or 1). */
  readonly nodeTimes: Float32Array;
  /** Per node: comet-path position (UNREACHED if not on the path). */
  readonly nodeHop: Float32Array;
  /** rgb per node. */
  readonly nodeTint: Float32Array;
  readonly segCount: number;
  /** xyz per segment end. */
  readonly segStart: Float32Array;
  readonly segEnd: Float32Array;
  /** Per segment: wave distance at its start and end, build-up value at its start and end. */
  readonly segTimes: Float32Array;
  /** Per segment: graph length, brightness, width multiplier. */
  readonly segStyle: Float32Array;
};

export type FieldDataOptions = {
  /** Keep only these nodes / edges (to split one graph over several fields). */
  readonly nodes?: (node: NetNode, index: number) => boolean;
  readonly edges?: (edge: NetEdge, index: number) => boolean;
  /** Nodes that stay in the graph but are drawn by the scene itself (hero nodes). */
  readonly hidden?: ReadonlySet<number>;
};

/**
 * Flatten a graph and its distance field into instance buffers. Arcs are cut
 * into straight pieces; every piece knows when the wave enters it from either
 * side, so pulses travel along edges at constant graph speed and meet in the
 * middle of an edge whose two ends are reached at the same time.
 */
export const buildNetworkFieldData = (graph: NetGraph, dist: Float32Array, options: FieldDataOptions = {}): NetworkFieldData => {
  const nodeIds: number[] = [];
  graph.nodes.forEach((n, i) => {
    if (!options.nodes || options.nodes(n, i)) nodeIds.push(i);
  });
  const nodePosition = new Float32Array(nodeIds.length * 3);
  const nodeSize = new Float32Array(nodeIds.length);
  const nodeTimes = new Float32Array(nodeIds.length * 4);
  const nodeHop = new Float32Array(nodeIds.length);
  const nodeTint = new Float32Array(nodeIds.length * 3);
  nodeIds.forEach((id, k) => {
    const n = graph.nodes[id];
    nodePosition.set(n.p, k * 3);
    nodeSize[k] = options.hidden?.has(id) ? 0 : n.size;
    const born = n.born ?? ALWAYS;
    nodeTimes.set([dist[id], born, n.lit ?? born, n.ring ? 1 : 0], k * 4);
    nodeHop[k] = n.hop ?? UNREACHED;
    nodeTint.set(n.tint ?? [1, 1, 1], k * 3);
  });

  const start: number[] = [];
  const end: number[] = [];
  const times: number[] = [];
  const style: number[] = [];
  graph.edges.forEach((e, i) => {
    if (options.edges && !options.edges(e, i)) return;
    const weight = e.weight ?? 1;
    const dA = dist[e.a];
    const dB = dist[e.b];
    const g0 = e.grow ? e.grow[0] : ALWAYS;
    const g1 = e.grow ? e.grow[1] : ALWAYS;
    const pieces = (e.lift ?? 0) > 0 ? Math.max(2, e.segments ?? 20) : 1;
    for (let k = 0; k < pieces; k++) {
      const t0 = k / pieces;
      const t1 = (k + 1) / pieces;
      start.push(...edgePoint(graph, e, t0));
      end.push(...edgePoint(graph, e, t1));
      times.push(dA + t0 * weight, dB + (1 - t1) * weight, g0 + (g1 - g0) * t0, g0 + (g1 - g0) * t1);
      style.push((t1 - t0) * weight, e.level ?? 1, e.width ?? 1);
    }
  });

  return {
    nodeCount: nodeIds.length,
    nodePosition,
    nodeSize,
    nodeTimes,
    nodeHop,
    nodeTint,
    segCount: style.length / 3,
    segStart: Float32Array.from(start),
    segEnd: Float32Array.from(end),
    segTimes: Float32Array.from(times),
    segStyle: Float32Array.from(style),
  };
};

/* ------------------------------------------------------------------ envelopes (CPU twins of the shader) */

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Brightness of the wavefront `x` distance units after it arrived: fast attack, exponential tail. */
export const waveHead = (x: number, rise = 0.1, decay = 1.6): number =>
  x <= 0 ? 0 : smooth(0, rise, x) * Math.exp(-Math.max(0, x - rise) * decay);

/** 0 -> 1 once the wave has passed (the "touched" state that stays). */
export const waveVisited = (x: number, settle = 0.5): number => smooth(0, settle, x);
