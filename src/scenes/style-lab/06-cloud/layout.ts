import * as THREE from 'three';
import type {Vec3} from '../../../components/cyber/three';
import {outlineU, plateOutline, rackFan, rackRows, type OutlineCurve, type PlateSpec, type RackSlot} from '../../../components/cyber/three/ComputeIsland';

/**
 * Static layout of sample 06: three islands of compute, the ports and gates
 * on their perimeter rings, and the two bridges between them. Everything
 * here is computed once at module scope.
 */

/** How far the perimeter ring stands off the plate, and how high it hovers above the plate's top. */
export const RING_MARGIN = 0.42;
export const RING_Y = 0.2;
/** Height at which a token rests over its dock. */
export const DOCK_Y = 0.14;
/** Width of an open gate (world units). */
export const GATE_WIDTH = 1.0;

export type Island = {
  readonly key: 'a' | 'b' | 'c';
  readonly plate: PlateSpec;
  readonly pos: Vec3;
  readonly yaw: number;
  readonly racks: readonly RackSlot[];
  readonly ring: OutlineCurve;
  /** Tallest rack. */
  readonly top: number;
};

const island = (key: Island['key'], plate: PlateSpec, pos: Vec3, yaw: number, racks: readonly RackSlot[]): Island => ({
  key,
  plate,
  pos,
  yaw,
  racks,
  ring: plateOutline(plate, RING_MARGIN, RING_Y),
  top: Math.max(...racks.map((r) => r.h)),
});

/** A: near and large. A hexagonal plate, three terraced rows with a centre aisle. */
export const A = island(
  'a',
  {kind: 'hex', r: 2.0, corner: 0.1},
  [-2.1, 0.45, 2.6],
  -0.55,
  rackRows(
    [
      {z: 0.95, from: -1.09, to: 1.09, h: 0.46, skip: [[-0.2, 0.2]]},
      {z: 0, from: -1.51, to: 1.51, h: 0.7, skip: [[-0.2, 0.2]]},
      {z: -0.95, from: -1.09, to: 1.09, h: 0.94, skip: [[-0.2, 0.2]]},
    ],
    {pitch: 0.21, w: 0.07, d: 0.52},
  ),
);

/** B: mid. A long rectangular plate, two rows of three clusters. */
export const B = island(
  'b',
  {kind: 'rect', w: 4.8, d: 2.3, corner: 0.16},
  [4.2, 1.0, -3.2],
  0.42,
  rackRows(
    [
      {z: 0.38, from: -1.89, to: 1.89, h: 0.56, skip: [[-0.9, -0.55], [0.55, 0.9]]},
      {z: -0.56, from: -1.89, to: 1.89, h: 0.86, skip: [[-0.9, -0.55], [0.55, 0.9]]},
    ],
    {pitch: 0.21, w: 0.07, d: 0.52},
  ),
);

/** C: far and small, on the horizon. A circular plate with a radial fan of racks. */
export const C = island('c', {kind: 'circle', r: 1.55}, [-3.3, 1.6, -12.6], 0, rackFan({radius: 0.8, count: 12, h: 0.95, w: 0.07, d: 0.62}));

export const ISLANDS = [A, B, C] as const;

/* ------------------------------------------------------------------ frames */

const V = (p: Vec3) => new THREE.Vector3(p[0], p[1], p[2]);

/** Island-local direction -> world direction. */
const dirToWorld = (isl: Island, d: THREE.Vector3): THREE.Vector3 => d.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), isl.yaw);
export const toWorld = (isl: Island, p: THREE.Vector3): THREE.Vector3 => dirToWorld(isl, p).add(V(isl.pos));
export const toLocal = (isl: Island, p: THREE.Vector3): THREE.Vector3 =>
  p.clone().sub(V(isl.pos)).applyAxisAngle(new THREE.Vector3(0, 1, 0), -isl.yaw);

/** Where on `isl`'s ring the direction towards a world point lies (fraction of the perimeter). */
const ringToward = (isl: Island, world: THREE.Vector3, bias = 0): number => {
  const l = toLocal(isl, world);
  return outlineU(isl.ring, Math.atan2(l.z, l.x) + bias);
};

const ringPoint = (isl: Island, u: number) => toWorld(isl, isl.ring.getPointAt(u));
/** Horizontal outward normal of the ring at `u`, in world space. */
const ringNormal = (isl: Island, u: number) => {
  const t = isl.ring.getTangentAt(u);
  return dirToWorld(isl, new THREE.Vector3(t.z, 0, -t.x).normalize());
};

/* ------------------------------------------------------------------ bridges */

export type Bridge = {
  /** Port (on the source ring) -> over the gap -> through the gate -> dock. */
  readonly path: THREE.CurvePath<THREE.Vector3>;
  /** Fraction of the path at which it crosses the destination's ring. */
  readonly gateU: number;
  /** Fractions of the two rings. */
  readonly portAt: number;
  readonly gateAt: number;
  readonly port: THREE.Vector3;
  readonly gate: THREE.Vector3;
  readonly dock: THREE.Vector3;
  /** Port and dock in their islands' local frames. */
  readonly portLocal: THREE.Vector3;
  readonly dockLocal: THREE.Vector3;
};

const bridge = (from: Island, to: Island, lift: number, opts: {portBias?: number; gateBias?: number; inset?: number} = {}): Bridge => {
  const up = new THREE.Vector3(0, 1, 0);
  const portAt = ringToward(from, V(to.pos), opts.portBias ?? 0);
  const gateAt = ringToward(to, V(from.pos), opts.gateBias ?? 0);
  const port = ringPoint(from, portAt);
  const gate = ringPoint(to, gateAt);
  const span = port.distanceTo(gate);

  const leave = ringNormal(from, portAt);
  // Come in mostly square to the ring, leaning a little towards where it came from.
  const toSource = port.clone().sub(gate).setY(0).normalize();
  const approach = ringNormal(to, gateAt).multiplyScalar(0.62).add(toSource.multiplyScalar(0.38)).normalize();

  const c1 = port.clone().add(leave.clone().multiplyScalar(span * 0.26)).add(up.clone().multiplyScalar(lift * 1.7));
  // The last leg comes in level with the ring, so the token goes through the gate, not down onto it.
  const c2 = gate.clone().add(approach.clone().multiplyScalar(span * 0.46)).add(up.clone().multiplyScalar(0.22));
  const over = new THREE.CubicBezierCurve3(port, c1, c2, gate);

  const heading = gate.clone().sub(c2).normalize();
  const dock = gate.clone().add(approach.clone().multiplyScalar(-(opts.inset ?? 0.7)));
  dock.y = to.pos[1] + DOCK_Y;
  const inside = new THREE.QuadraticBezierCurve3(gate, gate.clone().add(heading.clone().multiplyScalar(0.3)), dock);

  const path = new THREE.CurvePath<THREE.Vector3>();
  path.add(over);
  path.add(inside);
  const lengths = path.getCurveLengths();
  return {
    path,
    gateU: lengths[0] / lengths[1],
    portAt,
    gateAt,
    port,
    gate,
    dock,
    portLocal: toLocal(from, port),
    dockLocal: toLocal(to, dock),
  };
};

export const BRIDGE_AB = bridge(A, B, 1.5);
export const BRIDGE_BC = bridge(B, C, 1.9);

/* ------------------------------------------------------------------ orderings */

/** Distance of every rack from a local point, normalised 0 (nearest) .. 1 (farthest). */
const order = (isl: Island, local: THREE.Vector3): number[] => {
  const d = isl.racks.map((r) => Math.hypot(r.x - local.x, r.z - local.z));
  const lo = Math.min(...d);
  const hi = Math.max(...d);
  return d.map((v) => (v - lo) / Math.max(1e-6, hi - lo));
};

/** A's racks by distance from the port its work leaves through. */
export const A_FROM_PORT = order(A, BRIDGE_AB.portLocal);
/** B's and C's racks by distance from the dock where access and work arrive. */
export const B_FROM_DOCK = order(B, BRIDGE_AB.dockLocal);
export const C_FROM_DOCK = order(C, BRIDGE_BC.dockLocal);

/** World-space sample points that bound an island (ring corners low and high), for the 2D brackets. */
export const boundsOf = (isl: Island): Vec3[] => {
  const pts: Vec3[] = [];
  for (let i = 0; i < 32; i++) {
    const p = ringPoint(isl, i / 32);
    pts.push([p.x, isl.pos[1] - 0.42, p.z], [p.x, isl.pos[1] + isl.top + 0.12, p.z]);
  }
  return pts;
};
export const BOUNDS = {a: boundsOf(A), b: boundsOf(B), c: boundsOf(C)} as const;
