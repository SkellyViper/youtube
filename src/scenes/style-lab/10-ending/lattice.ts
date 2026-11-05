import * as THREE from 'three';
import type {Vec3} from '../../../components/cyber/three';

/**
 * The foreground system of sample 10: a small space-frame around one agent.
 *
 * In plan every site sits on a square grid (cell = G) and every link runs
 * along an axis or a 45 degree diagonal, so it reads as built infrastructure
 * rather than a network graph:
 *
 *   - four ports around the agent, at its height (the agent's spokes, purple);
 *   - an eight-sided rail lower down, joined to the ports by struts;
 *   - outside it two slabs on the rail's level and two tall pylons whose
 *     wires come down to the rail.
 *
 * Four sites are slabs standing on the floor and two are pylons: they carry
 * the silhouette once the lights are out.
 */
const G = 1.7;
/** Height of the eight-sided rail. */
const RAIL = 1.05;

export const AGENT: Vec3 = [0, 2.0, 0];

export type SlabDef = {readonly w: number; readonly h: number; readonly t: number; readonly yaw: number};

export type Site = {
  readonly id: string;
  readonly kind: 'node' | 'slab' | 'pylon';
  /** Where links attach (and where a node's light sits). */
  readonly pos: Vec3;
  readonly slab?: SlabDef;
  /** 0 = at the agent, 1 = the farthest site. Drives the shut-down order. */
  readonly far: number;
  /** Inner ring: the agent's own ports. */
  readonly port: boolean;
};

type RawSite = readonly [id: string, X: number, Z: number, y: number, kind?: 'slab' | 'pylon', slab?: SlabDef];

const RAW: readonly RawSite[] = [
  // The four ports the agent talks through.
  ['i0', -1, 0, AGENT[1]],
  ['i1', 1, 0, AGENT[1]],
  ['i2', 0, -1, AGENT[1]],
  ['i3', 0, 1, AGENT[1]],
  // The rail.
  ['m0', -2, -1, RAIL],
  ['m1', -1, -2, RAIL, 'slab', {w: 1.2, h: 2.7, t: 0.12, yaw: 0.16}],
  ['m2', 1, -2, RAIL],
  ['m3', 2, -1, RAIL],
  ['m4', 2, 1, RAIL],
  ['m5', 1, 2, RAIL, 'slab', {w: 1.1, h: 1.38, t: 0.12, yaw: -0.1}],
  ['m6', -1, 2, RAIL],
  ['m7', -2, 1, RAIL],
  // Outside the rail.
  ['o0', -3, 0, RAIL, 'slab', {w: 1.0, h: 3.1, t: 0.12, yaw: 0.5}],
  ['o1', -3, -2, 5.0, 'pylon'],
  ['o2', 3, -2, 4.0, 'pylon'],
  ['o3', 3, 0, RAIL, 'slab', {w: 0.95, h: 1.75, t: 0.12, yaw: -0.45}],
];

const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

const positions = RAW.map((r): Vec3 => [r[1] * G, r[3], r[2] * G]);
const maxDist = Math.max(...positions.map((p) => dist(p, AGENT)));

export const SITES: readonly Site[] = RAW.map((r, i) => ({
  id: r[0],
  kind: r[4] ?? 'node',
  pos: positions[i],
  slab: r[5],
  far: dist(positions[i], AGENT) / maxDist,
  port: r[0].startsWith('i'),
}));

const siteIndex = new Map(SITES.map((s, i) => [s.id, i]));
const at = (id: string): Vec3 => (id === 'a' ? AGENT : SITES[siteIndex.get(id)!].pos);
const v3 = (p: Vec3) => new THREE.Vector3(p[0], p[1], p[2]);

export type Link = {
  readonly a: string;
  readonly b: string;
  readonly curve: THREE.Curve<THREE.Vector3>;
  /** A spoke is the agent's own reach (purple); a wire is infrastructure (blue). */
  readonly spoke: boolean;
  /** `far` of the outer end: the link fades just before that site does. */
  readonly far: number;
};

const PAIRS: readonly (readonly [string, string])[] = [
  // Spokes.
  ['a', 'i0'],
  ['a', 'i1'],
  ['a', 'i2'],
  ['a', 'i3'],
  // Struts: each port stands on two corners of the rail.
  ['i0', 'm0'],
  ['i0', 'm7'],
  ['i1', 'm3'],
  ['i1', 'm4'],
  ['i2', 'm1'],
  ['i2', 'm2'],
  ['i3', 'm5'],
  ['i3', 'm6'],
  // The rail.
  ['m0', 'm1'],
  ['m1', 'm2'],
  ['m2', 'm3'],
  ['m3', 'm4'],
  ['m4', 'm5'],
  ['m5', 'm6'],
  ['m6', 'm7'],
  ['m7', 'm0'],
  // Outside.
  ['o0', 'm0'],
  ['o0', 'm7'],
  ['o3', 'm3'],
  ['o3', 'm4'],
  ['o1', 'm0'],
  ['o1', 'm1'],
  ['o2', 'm2'],
  ['o2', 'm3'],
];

const farOf = (id: string) => (id === 'a' ? 0 : SITES[siteIndex.get(id)!].far);

export const LINKS: readonly Link[] = PAIRS.map(([a, b]) => ({
  a,
  b,
  curve: new THREE.LineCurve3(v3(at(a)), v3(at(b))),
  spoke: a === 'a' || b === 'a',
  far: Math.max(farOf(a), farOf(b)),
}));

export type Journey = {
  readonly curve: THREE.Curve<THREE.Vector3>;
  /** Where the comet is on its path in the first frame. */
  readonly t0: number;
  /** Seconds into the wind-down beat by which head and tail have fully arrived. */
  readonly arrive: number;
  readonly tail: number;
  readonly mind: boolean;
  /** Site id (or 'a') where it lands. */
  readonly end: string;
};

const path = (ids: readonly string[]): THREE.Curve<THREE.Vector3> => {
  const p = new THREE.CurvePath<THREE.Vector3>();
  for (let i = 0; i < ids.length - 1; i++) p.add(new THREE.LineCurve3(v3(at(ids[i])), v3(at(ids[i + 1]))));
  return p;
};

/** The last signals still travelling when we arrive. Nothing follows them. */
export const JOURNEYS: readonly Journey[] = [
  {curve: path(['o3', 'm3', 'i1', 'a']), t0: 0.46, arrive: 1.45, tail: 0.14, mind: true, end: 'a'},
  {curve: path(['o0', 'm0', 'i0', 'a']), t0: 0.22, arrive: 1.7, tail: 0.14, mind: true, end: 'a'},
  {curve: path(['m6', 'i3', 'a']), t0: 0.5, arrive: 1.05, tail: 0.2, mind: true, end: 'a'},
  {curve: path(['o2', 'm2', 'm1']), t0: 0.34, arrive: 1.35, tail: 0.16, mind: false, end: 'm1'},
];

export const siteIndexOf = (id: string) => siteIndex.get(id) ?? -1;

/* ------------------------------------------------------------------ the ember */

const emberSlab = SITES[siteIndex.get('m5')!];
/** Local position of the one indicator that stays on: low on the slab's front face. */
export const EMBER_LOCAL: Vec3 = [-0.3, 0.33, emberSlab.slab!.t / 2 + 0.004];

const yaw = emberSlab.slab!.yaw;
const rotY = (p: Vec3, a: number): Vec3 => [p[0] * Math.cos(a) + p[2] * Math.sin(a), p[1], -p[0] * Math.sin(a) + p[2] * Math.cos(a)];
const emberOffset = rotY(EMBER_LOCAL, yaw);

export const EMBER_SITE = emberSlab.id;
/** World position of the ember. */
export const EMBER: Vec3 = [emberSlab.pos[0] + emberOffset[0], emberOffset[1], emberSlab.pos[2] + emberOffset[2]];
/** Unit normal of the slab face it sits on (pointing out of the face). */
export const EMBER_NORMAL: Vec3 = rotY([0, 0, 1], yaw);
