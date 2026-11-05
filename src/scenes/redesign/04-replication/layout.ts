import {createRandom} from '../../../components/random';

/**
 * The floor of machines the agent spreads across, and the order it reaches them.
 *
 *   - 36 machines of four recognisable kinds, on a loose grid with jitter.
 *   - machine 0 is the ORIGIN rack (where S02 left the agent).
 *   - machine 1 is the FIRST DESTINATION (the copy the camera follows).
 *   - every machine except the origin has a `parent`: the machine its copy
 *     came from. Cables are drawn parent -> child, so the whole network is a
 *     tree the viewer can follow outward from the origin.
 *   - `arrival` is when a machine's copy lands, in spread-seconds. It is a
 *     breadth-first distance from the two roots (origin + first destination)
 *     plus jitter, so waves overlap instead of marching in lockstep.
 */
export type MachineKind = 'rack' | 'tower' | 'gpu' | 'laptop';

export type MachineSpec = {
  readonly id: number;
  readonly kind: MachineKind;
  readonly x: number;
  readonly z: number;
  /** Facing angle around y. */
  readonly yaw: number;
  readonly parent: number | null;
  /** Graph depth from the roots (origin and first destination are 0). */
  readonly depth: number;
  /** Spread-seconds at which its copy lands. Infinity for the roots. */
  readonly arrival: number;
  /** Where a process is shown inside the machine, in local units (y up, z toward the viewer). */
  readonly bay: readonly [number, number, number];
};

export const BAY: Record<MachineKind, readonly [number, number, number]> = {
  rack: [0, 1.42, 0.47],
  tower: [0, 0.62, 0.27],
  gpu: [0.3, 0.3, 0.47],
  laptop: [0, 0.62, -0.12],
};

const dist = (a: {x: number; z: number}, b: {x: number; z: number}) => Math.hypot(a.x - b.x, a.z - b.z);

export const buildFloor = (seed = 41): MachineSpec[] => {
  const rnd = createRandom(seed);
  type Raw = {x: number; z: number; kind: MachineKind; yaw: number};
  const raws: Raw[] = [];
  // Fixed roots so the camera choreography is stable.
  raws.push({x: 0, z: 0, kind: 'rack', yaw: 0});
  raws.push({x: 5.6, z: -1.4, kind: 'gpu', yaw: -0.35});
  // A loose grid of the rest, avoiding the roots and each other.
  const kinds: MachineKind[] = ['rack', 'tower', 'gpu', 'laptop', 'rack', 'tower', 'laptop'];
  const cols = 8;
  const rows = 5;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (raws.length >= 36) break;
      const x = (c - (cols - 1) / 2) * 4.4 + rnd.range(-1.1, 1.1);
      const z = -r * 4.0 + 2.2 + rnd.range(-0.9, 0.9);
      const p = {x, z};
      if (raws.some((q) => dist(p, q) < 2.6)) continue;
      raws.push({x, z, kind: rnd.pick(kinds), yaw: rnd.range(-0.45, 0.45)});
    }
  }
  // Multi-source BFS over a nearest-neighbour graph: each machine's parent is
  // the nearest already-reached machine among its 4 nearest neighbours.
  const n = raws.length;
  const reached = new Array<boolean>(n).fill(false);
  const depth = new Array<number>(n).fill(Infinity);
  const parent = new Array<number | null>(n).fill(null);
  const arrival = new Array<number>(n).fill(Infinity);
  reached[0] = reached[1] = true;
  depth[0] = depth[1] = 0;
  arrival[0] = arrival[1] = -Infinity;
  const frontier = [0, 1];
  while (frontier.length) {
    const cur = frontier.shift()!;
    // Candidates: unreached machines for which `cur` is among the 3 nearest reached... keep it simple:
    const near = raws
      .map((q, i) => ({i, d: dist(raws[cur], q)}))
      .filter((o) => !reached[o.i] && o.d < 7.5)
      .sort((a, b) => a.d - b.d)
      .slice(0, 3);
    for (const o of near) {
      if (reached[o.i]) continue;
      reached[o.i] = true;
      depth[o.i] = depth[cur] + 1;
      parent[o.i] = cur;
      arrival[o.i] = depth[o.i] - 1 + rnd.range(0.05, 0.7) + (o.d / 7.5) * 0.3;
      frontier.push(o.i);
    }
  }
  // Anything unreachable (isolated) attaches to its nearest reached machine.
  for (let i = 0; i < n; i++) {
    if (reached[i]) continue;
    let best = 0;
    for (let j = 0; j < n; j++) if (reached[j] && dist(raws[i], raws[j]) < dist(raws[i], raws[best])) best = j;
    parent[i] = best;
    depth[i] = depth[best] + 1;
    arrival[i] = depth[i] - 1 + rnd.range(0.1, 0.6);
    reached[i] = true;
  }
  // The first destination's copy came from the origin (beat 2), so it has a cable, but it spawns as a root in beat 3.
  parent[1] = 0;
  return raws.map((r, id) => ({id, ...r, parent: parent[id], depth: depth[id], arrival: arrival[id], bay: BAY[r.kind]}));
};

export const FLOOR = buildFloor();
export const ORIGIN = FLOOR[0];
export const FIRST = FLOOR[1];
export const MAX_ARRIVAL = Math.max(...FLOOR.filter((m) => Number.isFinite(m.arrival)).map((m) => m.arrival));
