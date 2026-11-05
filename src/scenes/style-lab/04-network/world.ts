import * as THREE from 'three';
import {
  ALWAYS,
  appendCluster,
  buildNetworkFieldData,
  generateCluster,
  graphDistances,
  UNREACHED,
  type NetEdge,
  type NetGraph,
} from '../../../components/cyber/three/networkGraph';
import type {Vec3} from '../../../components/cyber/three';
import {createRandom} from '../../../components/random';

/**
 * The world of sample 04, built once, deterministically:
 *
 *   - one hero cluster at the origin (group 0), with build-up times so it
 *     forms from its first hub outward;
 *   - about sixty smaller clusters around it on a wide lens above the floor,
 *     joined by long-haul arcs between their hubs (groups 1..n);
 *   - BFS distances from the signal's destination over the whole graph, so
 *     one wave clock drives the cascade across the local cluster, along the
 *     arcs and into the far clusters;
 *   - the comet's path (4-5 hops to the destination) and the dive target
 *     (a far hub the wave reaches at a known distance).
 */

const rand = createRandom(0x4ae7);
const dist3 = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export const LOCAL_CENTER: Vec3 = [0, 2.7, 0];

const graph: NetGraph = {nodes: [], edges: []};

/* ------------------------------------------------------------------ local cluster */

const local = appendCluster(
  graph,
  generateCluster(rand, {
    center: LOCAL_CENTER,
    scale: 1,
    hubs: 4,
    spokes: [5, 7],
    leaves: 0.45,
    crossLinks: 2,
    extraBridges: 1,
    flatten: 0.72,
    minY: 1.0,
    group: 0,
    nodeSize: {hub: 0.13, spoke: 0.072, leaf: 0.05},
  }),
);
export const LOCAL_COUNT = local.count;

/* Build-up order: graph distance from the first hub, with a little jitter so spokes do not land in unison. */
{
  const d0 = graphDistances(graph, local.hubs[0]);
  const T = new Float32Array(local.count);
  for (let i = 0; i < local.count; i++) {
    const n = graph.nodes[i];
    T[i] = d0[i] + (n.role === 'hub' ? 0 : rand.range(0, 0.35));
  }
  const alwaysThere = new Set<number>(local.hubs);
  const spokeIds = graph.nodes.map((n, i) => (n.role === 'spoke' ? i : -1)).filter((i) => i >= 0);
  for (let k = 0; k < 4 && spokeIds.length > 0; k++) {
    alwaysThere.add(spokeIds.splice(Math.floor(rand.next() * spokeIds.length), 1)[0]);
  }
  for (let i = 0; i < local.count; i++) {
    const n = graph.nodes[i];
    n.lit = T[i];
    n.born = alwaysThere.has(i) ? ALWAYS : T[i] - 0.75;
  }
  for (const e of graph.edges) {
    if (T[e.a] > T[e.b]) [e.a, e.b] = [e.b, e.a];
    const t1 = T[e.b] > T[e.a] + 0.4 ? T[e.b] : T[e.a] + 0.8;
    e.grow = [T[e.a], t1];
    if (e.kind === 'bridge') e.width = 1.25;
    if (e.kind === 'cross') e.level = 0.8;
  }
}
/** Build-up clock value at which the local cluster is complete. */
export const LOCAL_GROW_END = Math.max(...graph.nodes.slice(0, local.count).map((n) => n.lit ?? 0)) + 0.9;

/* ------------------------------------------------------------------ the signal path */

const adjacency = (): number[][] => {
  const adj: number[][] = graph.nodes.map(() => []);
  for (const e of graph.edges) {
    adj[e.a].push(e.b);
    adj[e.b].push(e.a);
  }
  return adj;
};
const ADJ = adjacency();

/** Shortest path (node ids) from `from` to `dest` given `dest`'s distance field, taking the hop that heads most directly there. */
const pathTo = (dist: Float32Array, from: number, dest: number): number[] => {
  const path = [from];
  let cur = from;
  while (cur !== dest) {
    const next = ADJ[cur]
      .filter((n) => dist[n] === dist[cur] - 1)
      .reduce((b, n) => (b < 0 || dist3(graph.nodes[n].p, graph.nodes[dest].p) < dist3(graph.nodes[b].p, graph.nodes[dest].p) ? n : b), -1);
    path.push(next);
    cur = next;
  }
  return path;
};
/* The signal is judged as the camera sees it: it looks almost straight down -z, so screen space is about the XY plane. */
const distXY = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const pathLength = (path: number[]) => path.reduce((sum, id, i) => (i === 0 ? 0 : sum + distXY(graph.nodes[path[i - 1]].p, graph.nodes[id].p)), 0);
/** 1 = every hop continues the previous one's direction on screen, 0 = a hop turns straight back. The sharpest turn counts. */
const pathSmoothness = (path: number[]) => {
  let worst = 1;
  for (let i = 1; i < path.length - 1; i++) {
    const a = graph.nodes[path[i - 1]].p;
    const b = graph.nodes[path[i]].p;
    const c = graph.nodes[path[i + 1]].p;
    const u = [b[0] - a[0], b[1] - a[1]];
    const v = [c[0] - b[0], c[1] - b[1]];
    const cos = (u[0] * v[0] + u[1] * v[1]) / Math.max(1e-6, Math.hypot(u[0], u[1]) * Math.hypot(v[0], v[1]));
    worst = Math.min(worst, 0.5 + 0.5 * cos);
  }
  return worst;
};

/**
 * The signal: destination = a hub (the cascade starts there), source = a node
 * 4-5 hops away. Over all hubs, take the pair whose path is long and sweeps
 * across the cluster rather than doubling back.
 */
const SIGNAL = (() => {
  let best = {dest: local.hubs[0], source: -1, score: -1};
  for (const h of local.hubs) {
    const dh = graphDistances(graph, h);
    for (let i = 0; i < local.count; i++) {
      if (dh[i] < 4 || dh[i] > 5) continue;
      const path = pathTo(dh, i, h);
      const straight = distXY(graph.nodes[i].p, graph.nodes[h].p);
      const ratio = straight / Math.max(1e-6, pathLength(path));
      const s = straight * ratio * ratio * (0.25 + 0.75 * pathSmoothness(path)) + (dh[i] === 5 ? 0.6 : 0);
      if (s > best.score) best = {dest: h, source: i, score: s};
    }
  }
  if (best.source < 0) {
    const dh = graphDistances(graph, best.dest);
    for (let i = 0; i < local.count; i++) if (dh[i] < UNREACHED && (best.source < 0 || dh[i] > dh[best.source])) best.source = i;
  }
  return best;
})();
export const DEST = SIGNAL.dest;
const dD = graphDistances(graph, DEST);

/** Node ids from source to destination. */
export const PATH: number[] = pathTo(dD, SIGNAL.source, DEST);

/** Comet curve: through the path's nodes and the middle of each hop, so it hugs the straight edges with soft corners. */
export const PATH_CURVE: THREE.Curve<THREE.Vector3> = (() => {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < PATH.length; i++) {
    const p = graph.nodes[PATH[i]].p;
    pts.push(new THREE.Vector3(p[0], p[1], p[2]));
    if (i < PATH.length - 1) {
      const q = graph.nodes[PATH[i + 1]].p;
      pts.push(new THREE.Vector3((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2));
    }
  }
  const c = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
  c.arcLengthDivisions = 400;
  return c;
})();

/* Hop positions: arc-length fraction of each path node along the curve. */
{
  let total = 0;
  const cum = [0];
  for (let i = 1; i < PATH.length; i++) {
    total += dist3(graph.nodes[PATH[i - 1]].p, graph.nodes[PATH[i]].p);
    cum.push(total);
  }
  PATH.forEach((id, i) => {
    graph.nodes[id].hop = cum[i] / total;
  });
}

/* ------------------------------------------------------------------ the far web */

type ClusterInfo = {center: Vec3; hubs: number[]; offset: number; count: number};
const clusters: ClusterInfo[] = [{center: LOCAL_CENTER, hubs: local.hubs, offset: 0, count: local.count}];

{
  /* Cluster centres on a lens around the origin, best-candidate spaced. */
  const centres: Vec3[] = [LOCAL_CENTER];
  // A lens around the origin, minus a keep-out around the hero cluster and the close-shot camera.
  const inside = (x: number, z: number) => {
    const ex = x / 50;
    const ez = (z + 13) / 37;
    return ex * ex + ez * ez < 1 && Math.hypot(x, z - 3) > 15;
  };
  for (let i = 0; i < 64; i++) {
    let best: Vec3 | null = null;
    let bestRoom = 9.2;
    for (let c = 0; c < 18; c++) {
      const x = rand.range(-50, 50);
      const z = rand.range(-50, 24);
      if (!inside(x, z)) continue;
      const y = 2.3 + rand.range(0, 3.8) + 0.9 * Math.max(0, 1 - Math.hypot(x, z + 13) / 40);
      const p: Vec3 = [x, y, z];
      const room = Math.min(...centres.map((q) => Math.hypot(q[0] - p[0], q[2] - p[2])));
      if (room > bestRoom) {
        bestRoom = room;
        best = p;
      }
    }
    if (!best) continue;
    centres.push(best);
  }

  centres.slice(1).forEach((center, k) => {
    const far = Math.hypot(center[0], center[2]);
    const scale = rand.range(0.5, 0.82) * (far < 20 ? 1.05 : 1);
    const brightness = rand.range(0.8, 1.1);
    const c = generateCluster(rand, {
      center,
      scale,
      hubs: rand.next() < 0.45 ? 4 : 3,
      spokes: [4, 6],
      leaves: 0.3,
      crossLinks: 1,
      flatten: 0.7,
      minY: 1.2,
      group: k + 1,
      nodeSize: {hub: 0.14, spoke: 0.08, leaf: 0.058},
    });
    for (const n of c.nodes) n.tint = [brightness, brightness, brightness];
    const added = appendCluster(graph, c);
    clusters.push({center, hubs: added.hubs, offset: added.offset, count: added.count});
  });

  /* Long-haul arcs: nearest neighbours per cluster, then whatever is needed for connectivity. */
  const pairKey = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`);
  const links = new Set<string>();
  const addArc = (i: number, j: number) => {
    const key = pairKey(i, j);
    if (links.has(key)) return;
    links.add(key);
    let bestA = -1;
    let bestB = -1;
    let bestD = Infinity;
    for (const a of clusters[i].hubs) {
      for (const b of clusters[j].hubs) {
        const d = dist3(graph.nodes[a].p, graph.nodes[b].p);
        if (d < bestD) {
          bestD = d;
          bestA = a;
          bestB = b;
        }
      }
    }
    graph.edges.push({a: bestA, b: bestB, kind: 'arc', weight: bestD / 3.4, lift: 0.5 + bestD * 0.14, segments: 18, width: 1.3, level: 1.1});
  };
  const near = (i: number) =>
    clusters
      .map((c, j) => ({j, d: j === i ? Infinity : Math.hypot(c.center[0] - clusters[i].center[0], c.center[2] - clusters[i].center[2])}))
      .sort((x, y) => x.d - y.d);
  clusters.forEach((_, i) => {
    const n = near(i);
    const want = i === 0 ? 3 : 2;
    for (let k = 0; k < want && k < n.length; k++) addArc(i, n[k].j);
  });
  // Connectivity (union-find over clusters); add the shortest missing links.
  const set = clusters.map((_, i) => i);
  const find = (i: number): number => (set[i] === i ? i : (set[i] = find(set[i])));
  for (const key of links) {
    const [a, b] = key.split(':').map(Number);
    set[find(a)] = find(b);
  }
  const all: {i: number; j: number; d: number}[] = [];
  for (let i = 0; i < clusters.length; i++) {
    for (let j = i + 1; j < clusters.length; j++) {
      all.push({i, j, d: Math.hypot(clusters[i].center[0] - clusters[j].center[0], clusters[i].center[2] - clusters[j].center[2])});
    }
  }
  all.sort((x, y) => x.d - y.d);
  for (const p of all) {
    if (find(p.i) === find(p.j)) continue;
    set[find(p.i)] = find(p.j);
    addArc(p.i, p.j);
  }

  /* Far web build-up: by distance from the origin, so it expands outward as the camera pulls back. */
  const R = (p: Vec3) => Math.hypot(p[0], p[2]);
  for (let i = local.count; i < graph.nodes.length; i++) {
    const n = graph.nodes[i];
    n.born = ALWAYS;
    n.lit = R(n.p);
  }
  for (const e of graph.edges) {
    if (e.a < local.count && e.b < local.count) continue;
    const ra = R(graph.nodes[e.a].p);
    const rb = R(graph.nodes[e.b].p);
    if (ra > rb) [e.a, e.b] = [e.b, e.a];
    e.grow = [Math.min(ra, rb), Math.max(ra, rb) + 0.5];
  }
}

export const NODE_COUNT = graph.nodes.length;
export const EDGE_COUNT = graph.edges.length;
export const CLUSTER_COUNT = clusters.length;

/* ------------------------------------------------------------------ wave distances and the dive target */

/** Graph distance of every node from the signal's destination. */
export const DIST = graphDistances(graph, DEST);
/** Wave value at which the whole local cluster has been reached. */
export const LOCAL_WAVE_END = Math.max(...Array.from(DIST.slice(0, local.count)).filter((d) => d < UNREACHED));

/** Wave travelled during the pull-back. */
export const SCALE_WAVE = 11;
const WANT = LOCAL_WAVE_END + SCALE_WAVE + 8.5;

/**
 * The far hub the camera dives to: on the web's left flank, so the flight
 * from the wide position crosses dense web rather than the keep-out around
 * the hero cluster; reached by the wave at about WANT.
 */
export const TARGET = (() => {
  let best = -1;
  let score = Infinity;
  clusters.forEach((c, k) => {
    if (k === 0) return;
    const far = Math.hypot(c.center[0], c.center[2]);
    if (far < 28 || c.center[2] > -4 || c.center[2] < -36 || c.center[0] > -22) return;
    for (const h of c.hubs) {
      if (DIST[h] >= UNREACHED) continue;
      const s = Math.abs(DIST[h] - WANT) + Math.max(0, 34 - far) * 0.2;
      if (s < score) {
        score = s;
        best = h;
      }
    }
  });
  if (best < 0) {
    for (let i = local.count; i < graph.nodes.length; i++) {
      if (graph.nodes[i].ring && DIST[i] < UNREACHED && Math.abs(DIST[i] - WANT) < score) {
        score = Math.abs(DIST[i] - WANT);
        best = i;
      }
    }
  }
  return best;
})();
export const TARGET_POS: Vec3 = graph.nodes[TARGET].p;
export const TARGET_DIST = DIST[TARGET];
export const TARGET_SIZE = graph.nodes[TARGET].size;

/**
 * Where the camera lands, relative to the target: the azimuth with the most
 * room from other nodes (no neighbour sitting on the lens) that still looks
 * back across the web, so the target's neighbours sit behind it in the fog.
 */
export const LAND_OFFSET: Vec3 = (() => {
  const radius = 4.1;
  const height = 0.95;
  let best: Vec3 = [radius, height, 0];
  let score = -Infinity;
  for (let k = 0; k < 36; k++) {
    const az = (k / 36) * Math.PI * 2;
    const off: Vec3 = [Math.cos(az) * radius, height, Math.sin(az) * radius];
    const cam: Vec3 = [TARGET_POS[0] + off[0], TARGET_POS[1] + off[1], TARGET_POS[2] + off[2]];
    let clearance = Infinity;
    graph.nodes.forEach((n, i) => {
      if (i !== TARGET) clearance = Math.min(clearance, dist3(cam, n.p));
    });
    // Looking from the camera through the target: how much of that direction points at the web's centre.
    const view = [-off[0], -off[2]];
    const toCentre = [-TARGET_POS[0], -TARGET_POS[2]];
    const facing = (view[0] * toCentre[0] + view[1] * toCentre[1]) / (Math.hypot(view[0], view[1]) * Math.max(1e-6, Math.hypot(toCentre[0], toCentre[1])));
    const s = Math.min(clearance, 3.5) + 1.4 * facing;
    if (s > score) {
      score = s;
      best = off;
    }
  }
  return best;
})();

export const nodePos = (id: number): Vec3 => graph.nodes[id].p;

/* ------------------------------------------------------------------ GPU data */

const isLocalEdge = (e: NetEdge) => e.a < local.count && e.b < local.count;
export const LOCAL_FIELD = buildNetworkFieldData(graph, DIST, {nodes: (_, i) => i < local.count, edges: isLocalEdge});
export const FAR_FIELD = buildNetworkFieldData(graph, DIST, {nodes: (_, i) => i >= local.count, edges: (e) => !isLocalEdge(e)});
