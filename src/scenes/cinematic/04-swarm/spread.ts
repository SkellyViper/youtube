import * as THREE from 'three';
import {HERO_RACK} from '../../../components/cinematic/route';
import {buildingFacePoint, CAMPUS_BUILDINGS, CAMPUS_GROUND_Y} from '../../../components/cinematic/three/Campus';
import {rackTop} from '../../../components/cinematic/three/DataHall';
import {cableThrough} from '../../../components/cinematic/three/Signals';
import {HALL, rackAt, rackYaw} from '../../../components/cinematic/world';
import {createRandom} from '../../../components/random';
import type {Vec3} from '../../../components/cyber/three/rig';
import {seg, smooth} from '../../../components/story/math';

/**
 * The geography and the timetable of the spread, computed once at module
 * load. Everything a pulse travels along is a real cable:
 *
 *   riser       a patch cable from the open bay's mouth to the rack's front
 *               rail, up the rail, over the top and back to the bundle under
 *               the tray (the hero racks; the copy is seen leaving and arriving)
 *   tray        each row's cable bundle, lying along its overhead tray
 *   crossover   a cable slung from one row's tray to the next, at three columns
 *   drop        the bundle from the tray into each rack's top
 *   trunk       the row-1 bundle leaving the hall: down the end wall and out
 *   fibre       ground conduits from a junction outside to the other buildings
 *
 * The spread is a shortest-path tree from the two seeded racks over the
 * tray/crossover graph; each rack's arrival time is its graph distance times
 * STEP (plus a little seeded jitter), on the "spread clock" S that starts
 * with beat sw-waves.
 */

export const ORIGIN = HERO_RACK;
export const NEXT = {row: 1, i: 4} as const;
export const CROSSOVER_COLUMNS: readonly number[] = [1, 4, 7];
/** Seconds per step of graph distance (one rack along a tray). */
export const STEP = 0.42;
const CROSS_COST = 1.35;
/** When the seeded racks start emitting on the spread clock. */
const SEED_T = 0.1;
/** Seconds a rack takes to change hands once its copy has landed. */
export const RAMP = 0.5;

export const keyOf = (row: number, i: number) => row * HALL.perRow + i;

/** Rack-local point -> hall point (rows alternate facing). */
export const rackLocal = (row: number, i: number, local: Vec3): Vec3 => {
  const p = rackAt(row, i);
  const yaw = rackYaw(row);
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return [p[0] + local[0] * c + local[2] * s, p[1] + local[1], p[2] - local[0] * s + local[2] * c];
};

/** Where a rack's cable bundle leaves its top, behind the centre line, under the tray. */
export const rackRearTop = (row: number, i: number): Vec3 => rackLocal(row, i, [0, HALL.rack.height + 0.04, -0.3]);

/** The gimbal iris sits in the mouth of the open 2U bay (Rack's BAY_UNIT), just proud of the faceplates. */
export const IRIS_LOCAL: Vec3 = [0, 0.84, 0.47];
export const irisAt = (row: number, i: number): Vec3 => rackLocal(row, i, IRIS_LOCAL);

/** The riser cable of a hero rack. `side` picks the front rail (rack-local x). */
export const riserPoints = (row: number, i: number, side: 1 | -1): Vec3[] => {
  const x = side * 0.282;
  return [
    rackLocal(row, i, IRIS_LOCAL),
    rackLocal(row, i, [x * 0.5, 0.84, 0.53]),
    rackLocal(row, i, [x, 0.84, 0.535]),
    rackLocal(row, i, [x, 1.5, 0.535]),
    rackLocal(row, i, [x, 2.02, 0.535]),
    rackLocal(row, i, [x, 2.1, 0.42]),
    rackLocal(row, i, [x * 0.5, 2.12, 0.0]),
    rackLocal(row, i, [0.04, 2.1, -0.3]),
    rackTop(row, i),
  ];
};

/** Arc-length fraction of the point on `curve` closest to `p`. */
export const fractionAt = (curve: THREE.Curve<THREE.Vector3>, p: Vec3, samples = 400): number => {
  const v = new THREE.Vector3(p[0], p[1], p[2]);
  const lengths = curve.getLengths(samples);
  const total = lengths[samples];
  let best = 0;
  let bestD = Infinity;
  for (let k = 0; k <= samples; k++) {
    const d = curve.getPoint(k / samples).distanceTo(v);
    if (d < bestD) {
      bestD = d;
      best = k;
    }
  }
  return lengths[best] / total;
};

// ---- the first copy: origin bay -> riser -> tray -> riser -> next bay ------------------------------
export const RISER_ORIGIN = cableThrough(riserPoints(ORIGIN.row, ORIGIN.i, 1), 0.02);
export const RISER_NEXT = cableThrough(riserPoints(NEXT.row, NEXT.i, -1), 0.02);
export const COPY_CURVE = cableThrough([...riserPoints(ORIGIN.row, ORIGIN.i, 1), ...riserPoints(NEXT.row, NEXT.i, -1).reverse()], 0.04);
/** Fraction of COPY_CURVE at which the copy reaches the tray above the origin. */
export const COPY_U_TRAY = fractionAt(COPY_CURVE, rackTop(ORIGIN.row, ORIGIN.i));

// ---- static conduits ----------------------------------------------------------------------------------
const trayY = HALL.trayY - 0.05;
const trayHalf = (HALL.perRow * HALL.pitch + 6 - 2) / 2;

/** Each row's cable bundle along its tray, the full length of the tray. */
export const TRAY_BUNDLES: readonly THREE.Curve<THREE.Vector3>[] = Array.from({length: HALL.rows}, (_, r) => {
  const z = rackAt(r, 0)[2];
  const pts: Vec3[] = [[-trayHalf, trayY, z]];
  for (let i = 0; i < HALL.perRow; i++) pts.push(rackTop(r, i));
  pts.push([trayHalf, trayY, z]);
  return cableThrough(pts, 0.03);
});

const crossoverPoints = (row: number, col: number): Vec3[] => {
  const x = rackAt(row, col)[0];
  const za = rackAt(row, 0)[2];
  const zb = rackAt(row + 1, 0)[2];
  return [
    [x, HALL.trayY + 0.08, za],
    [x, HALL.trayY + 0.02, (za + zb) / 2],
    [x, HALL.trayY + 0.08, zb],
  ];
};

/** Cables slung between neighbouring rows' trays at the crossover columns. */
export const CROSSOVERS: readonly THREE.Curve<THREE.Vector3>[] = Array.from({length: HALL.rows - 1}, (_, r) => CROSSOVER_COLUMNS.map((c) => cableThrough(crossoverPoints(r, c), 0))).flat();

/** The bundle from the tray into every rack's top. */
export const DROPS: readonly THREE.Curve<THREE.Vector3>[] = Array.from({length: HALL.rows * HALL.perRow}, (_, k) => {
  const r = Math.floor(k / HALL.perRow);
  const i = k % HALL.perRow;
  return cableThrough([rackTop(r, i), rackRearTop(r, i)], 0);
});

// ---- the spread tree ------------------------------------------------------------------------------------
export type Edge = {
  readonly from: number;
  readonly to: number;
  readonly depart: number;
  readonly arrive: number;
  readonly curve: THREE.Curve<THREE.Vector3>;
};

const edgeCurve = (p: number, k: number): THREE.Curve<THREE.Vector3> => {
  const pr = Math.floor(p / HALL.perRow);
  const pi = p % HALL.perRow;
  const kr = Math.floor(k / HALL.perRow);
  const ki = k % HALL.perRow;
  const pts: Vec3[] = [rackRearTop(pr, pi), rackTop(pr, pi)];
  if (pr !== kr) {
    const lo = Math.min(pr, kr);
    const cross = crossoverPoints(lo, pi);
    if (pr > kr) cross.reverse();
    pts.push(...cross);
  }
  pts.push(rackTop(kr, ki), rackRearTop(kr, ki));
  return cableThrough(pts, 0.02);
};

export const SPREAD = (() => {
  const n = HALL.rows * HALL.perRow;
  const dist: number[] = new Array(n).fill(Infinity);
  const parent: number[] = new Array(n).fill(-1);
  const done: boolean[] = new Array(n).fill(false);
  const seeds = [keyOf(ORIGIN.row, ORIGIN.i), keyOf(NEXT.row, NEXT.i)];
  for (const s of seeds) dist[s] = 0;
  for (let iter = 0; iter < n; iter++) {
    let u = -1;
    for (let k = 0; k < n; k++) if (!done[k] && dist[k] < Infinity && (u < 0 || dist[k] < dist[u])) u = k;
    if (u < 0) break;
    done[u] = true;
    const row = Math.floor(u / HALL.perRow);
    const i = u % HALL.perRow;
    const relax = (r2: number, i2: number, cost: number) => {
      if (r2 < 0 || r2 >= HALL.rows || i2 < 0 || i2 >= HALL.perRow) return;
      const v = keyOf(r2, i2);
      if (dist[u] + cost < dist[v]) {
        dist[v] = dist[u] + cost;
        parent[v] = u;
      }
    };
    relax(row, i - 1, 1);
    relax(row, i + 1, 1);
    if (CROSSOVER_COLUMNS.includes(i)) {
      relax(row - 1, i, CROSS_COST);
      relax(row + 1, i, CROSS_COST);
    }
  }
  const rnd = createRandom(404);
  const t = dist.map((d, k) => (seeds.includes(k) ? SEED_T : SEED_T + d * STEP + rnd.range(0, 0.1)));
  const edges: Edge[] = [];
  for (let k = 0; k < n; k++) {
    if (parent[k] < 0) continue;
    edges.push({from: parent[k], to: k, depart: t[parent[k]] + 0.06, arrive: t[k], curve: edgeCurve(parent[k], k)});
  }
  return {dist, parent, t, edges, seeds, last: Math.max(...t)};
})();

/** 0..1 how far rack (row, i) has changed hands at spread time S. */
export const infectionAt = (row: number, i: number, S: number): number => {
  const k = keyOf(row, i);
  return smooth(seg(S, SPREAD.t[k], SPREAD.t[k] + RAMP));
};

// ---- out of the hall: trunk and fibres --------------------------------------------------------------------
const G = CAMPUS_GROUND_Y + 0.06;
const z1 = rackAt(1, 0)[2];
export const JUNCTION: Vec3 = [-9.5, G, z1];
/** The row-1 bundle leaving the hall: along the tray end, down the end wall, through it at floor level, out to the junction. */
export const TRUNK_CURVE = cableThrough(
  [
    [-trayHalf, trayY, z1],
    [-6.3, 2.42, z1],
    [-6.5, 1.9, z1],
    [-6.5, 0.14, z1],
    [-6.8, 0.08, z1],
    [-7.3, -0.2, z1],
    [-8.0, G, z1],
    JUNCTION,
  ],
  0.02,
);
/** Spread-clock times: the trunk pulse leaves as the hall finishes turning, and reaches the junction. */
export const TRUNK_D = 3.45;
export const TRUNK_A = 4.15;

const [EAST, NORTH, WEST, SOUTH] = CAMPUS_BUILDINGS;
const FIBRE_POINTS: readonly Vec3[][] = [
  [JUNCTION, [-11, G, 6], [-13.5, G, 12], buildingFacePoint(WEST, 0.25, 0.06)],
  [JUNCTION, [-9.5, G, -11], [4, G, -14], buildingFacePoint(NORTH, -0.5, 0.06)],
  [JUNCTION, [-9.5, G, 11], [5, G, 11.5], [13, G, 7], buildingFacePoint(EAST, 0.3, 0.06)],
  [JUNCTION, [-9.5, G, 11], [0, G, 13], [7, G, 15.5], buildingFacePoint(SOUTH, 0.35, 0.06)],
];
/** Index of the CAMPUS_BUILDINGS entry each fibre feeds. */
export const FIBRE_BUILDING: readonly number[] = [2, 1, 0, 3];
const FIBRE_SPEED = 22;

export type Fibre = {readonly curve: THREE.Curve<THREE.Vector3>; readonly depart: number; readonly arrive: number; readonly building: number};
export const FIBRES: readonly Fibre[] = FIBRE_POINTS.map((pts, j) => {
  const curve = cableThrough(pts, 0);
  const depart = TRUNK_A + 0.12 * j;
  return {curve, depart, arrive: depart + curve.getLength() / FIBRE_SPEED, building: FIBRE_BUILDING[j]};
});

/** How many status lights of campus building `b` have turned at spread time S (fractional while the next one turns). */
export const buildingTakenAt = (b: number, S: number): number => {
  const f = FIBRES.find((x) => x.building === b);
  if (!f) return 0;
  return Math.max(0, (S - f.arrive) / 0.12);
};
