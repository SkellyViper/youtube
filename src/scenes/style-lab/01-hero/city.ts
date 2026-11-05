import * as THREE from 'three';
import {RouteCurve} from '../../../components/cyber/three/RouteCurve';

/**
 * The "city of compute": a deterministic field of dark monolith slabs in
 * ordered blocks, separated by avenues, with a square plaza cut out of the
 * middle. Pure data, built once at module scope: instance matrices for the
 * slab bodies and for their light seams, plus what the seams need to ignite
 * in order of distance.
 *
 * Layout rules (nothing is random):
 *   - blocks sit on a square grid; avenue centre lines are the multiples of PITCH,
 *     so two avenues cross in the middle of the plaza;
 *   - neighbouring blocks alternate the direction of their slabs (a weave);
 *   - heights follow a bowl (low around the plaza, tall far out), a slow
 *     district undulation and a four-step rhythm inside each block;
 *   - towers and long "blade" blocks fall on regular oblique lattices.
 */

export const PITCH = 14;
export const AVENUE = 4.4;
export const BLOCK = PITCH - AVENUE;
/** The two avenues through the plaza are boulevards: wider, so the opening shot has room. */
export const BOULEVARD = 8.4;
const B = (BOULEVARD - AVENUE) / 2;
/** Blocks per half axis. */
const RINGS = 9;
export const EXTENT = RINGS * PITCH + B;

/** Centre line of avenue k (0 = the boulevard through the plaza). */
export const avenue = (k: number): number => (k === 0 ? 0 : k * PITCH + Math.sign(k) * B);
/** Centre of block column / row i (i = -1 and 0 are the two beside the boulevard). */
export const blockCentre = (i: number): number => (i + 0.5) * PITCH + (i >= 0 ? B : -B);

const lines = (ks: readonly number[]): THREE.BufferGeometry => {
  const pts: number[] = [];
  for (const k of ks) {
    const a = avenue(k);
    pts.push(a, 0, -EXTENT, a, 0, EXTENT, -EXTENT, 0, a, EXTENT, 0, a);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return g;
};
/** Hairline grid on the floor: one line down the centre of every avenue (the boulevards are drawn separately). */
export const AVENUE_GRID = lines(Array.from({length: 2 * RINGS + 1}, (_, i) => i - RINGS).filter((k) => k !== 0));
/** The two boulevards through the plaza. */
export const BOULEVARD_GRID = lines([0]);

/** Floor position of the camera at frame 0. Seams ignite by distance to it, far first. */
export const WAKE_ORIGIN: readonly [number, number] = [0.9, 46];
/** Everything further than this ignites together (it is deep in the fog). */
export const WAKE_REACH = 128;

export const SEAM_SLIT = 0;
export const SEAM_BAND = 1;
export const SEAM_SKIRT = 2;

/** Physical thickness of a seam. The seam shader keeps it at least a hairline wide on screen. */
const THIN = 0.022;
/** How far a seam stands proud of the slab face. */
const PROUD = 0.035;
/** Width of the light gap around a slab's foot (the plan outline). */
const SKIRT = 0.1;

type Slab = {readonly x: number; readonly z: number; readonly w: number; readonly d: number; readonly h: number};

const mod = (n: number, m: number) => ((n % m) + m) % m;
const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const quant = (v: number, step: number) => Math.round(v / step) * step;

export type City = {
  readonly slabCount: number;
  readonly slabMatrix: Float32Array;
  readonly seamCount: number;
  readonly seamMatrix: Float32Array;
  readonly seamKind: Uint8Array;
  /** Distance from WAKE_ORIGIN, clamped to WAKE_REACH. */
  readonly seamDist: Float32Array;
  readonly seamGain: Float32Array;
};

const buildCity = (): City => {
  const slabs: Slab[] = [];
  const seamMatrix: number[] = [];
  const seamKind: number[] = [];
  const seamDist: number[] = [];
  const seamGain: number[] = [];

  const m4 = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const qId = new THREE.Quaternion();
  // Seams are unit boxes whose local x axis is the thin one.
  const qThinZ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
  const qThinY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);

  const pushSeam = (kind: number, gain: number, x: number, y: number, z: number, q: THREE.Quaternion, t: number, a: number, b: number) => {
    pos.set(x, y, z);
    scl.set(t, a, b);
    m4.compose(pos, q, scl);
    for (let i = 0; i < 16; i++) seamMatrix.push(m4.elements[i]);
    seamKind.push(kind);
    seamDist.push(Math.min(WAKE_REACH, Math.hypot(x - WAKE_ORIGIN[0], z - WAKE_ORIGIN[1])));
    // Light concentrates around the plaza; the outskirts are dimmer (and taller), so the
    // high shot has a centre instead of an even texture.
    seamGain.push(kind === SEAM_SKIRT ? gain : gain * (0.5 + 0.5 * (1 - smoothstep(22, 112, Math.hypot(x, z)))));
  };

  /** A vertical slit of light on all four faces: two thin boxes that pass right through the slab. */
  const slit = (s: Slab, gain: number, lo = 0.14, hi = 0.86) => {
    const y = ((lo + hi) / 2) * s.h;
    const len = (hi - lo) * s.h;
    pushSeam(SEAM_SLIT, gain, s.x, y, s.z, qId, THIN, len, s.d + 2 * PROUD);
    pushSeam(SEAM_SLIT, gain, s.x, y, s.z, qThinZ, THIN, len, s.w + 2 * PROUD);
  };
  /** A horizontal line of light running round the slab at height y. */
  const band = (s: Slab, gain: number, y: number) => {
    pushSeam(SEAM_BAND, gain, s.x, y, s.z, qThinY, THIN * 1.25, s.w + 2 * PROUD, s.d + 2 * PROUD);
  };
  /** The light gap under the slab: a hairline at its foot, and its outline when seen in plan. */
  const skirt = (s: Slab) => {
    pushSeam(SEAM_SKIRT, 1, s.x, 0.011, s.z, qThinY, 0.02, s.w + 2 * SKIRT, s.d + 2 * SKIRT);
  };

  for (let bz = -RINGS; bz < RINGS; bz++) {
    for (let bx = -RINGS; bx < RINGS; bx++) {
      // The plaza: the four blocks around the origin are left out.
      if ((bx === -1 || bx === 0) && (bz === -1 || bz === 0)) continue;
      const cx = blockCentre(bx);
      const cz = blockCentre(bz);
      const r = Math.hypot(cx, cz);
      const ring = Math.max(Math.abs(bx + 0.5), Math.abs(bz + 0.5));
      const bowl = 0.5 + 0.5 * smoothstep(14, 68, r);
      const district = 0.8 + 0.2 * Math.cos(cx * 0.043 + 1.1) * Math.cos(cz * 0.051 - 0.6);
      const H = 8.6 * bowl * district;
      const alongX = mod(bx + bz, 2) === 0;
      const key = mod(bx * 3 + bz * 5, 11);
      const type = key === 0 && ring >= 2 ? 'tower' : key === 4 || key === 8 ? 'blades' : 'bank';
      const place = (along: number, across: number, length: number, thick: number, h: number): Slab => {
        const s: Slab = alongX
          ? {x: cx + along, z: cz + across, w: length, d: thick, h}
          : {x: cx + across, z: cz + along, w: thick, d: length, h};
        slabs.push(s);
        return s;
      };

      if (type === 'bank') {
        // Two columns of four slabs; the heights step in a four-beat rhythm.
        const up = mod(bx - bz, 4) < 2;
        const rhythm = up ? [1, 0.6, 0.82, 0.48] : [0.48, 0.82, 0.6, 1];
        for (let row = 0; row < 4; row++) {
          for (let col = 0; col < 2; col++) {
            const h = quant(Math.max(1.4, H * rhythm[row]), 0.4);
            const s = place(col === 0 ? -2.5 : 2.5, -3.9 + row * 2.6, 4.2, 1.0, h);
            skirt(s);
            const tall = rhythm[row] === 1;
            if (tall && mod(bx + 2 * bz, 3) === 0) {
              // A few of the tallest carry a lit top edge as well.
              slit(s, 1, 0.14, 0.8);
              band(s, 1.25, h - 0.34);
            } else if (rhythm[row] === 0.48) {
              band(s, 0.85, h - 0.34);
            } else {
              slit(s, tall ? 1 : 0.85);
            }
          }
        }
      } else if (type === 'blades') {
        // Three long, lower fins with a single horizontal line each.
        const steps = [0.46, 0.62, 0.46];
        for (let i = 0; i < 3; i++) {
          const h = quant(Math.max(1.4, H * steps[i]), 0.4);
          const s = place(0, -3.4 + i * 3.4, 9.2, 1.2, h);
          skirt(s);
          band(s, 0.9, h * 0.62);
        }
      } else {
        // A plinth and one tall monolith: the accents of the skyline.
        const plinth = place(0, 0, 9.2, 9.2, 0.5);
        skirt(plinth);
        const h = quant(H * 1.7, 0.4);
        const s = place(0, 0, 3.6, 1.4, h);
        slit(s, 1.15, 0.1, 0.84);
        band(s, 1.35, h - 0.4);
      }
    }
  }

  const slabMatrix = new Float32Array(slabs.length * 16);
  slabs.forEach((s, i) => {
    pos.set(s.x, s.h / 2, s.z);
    scl.set(s.w, s.h, s.d);
    m4.compose(pos, qId, scl);
    slabMatrix.set(m4.elements, i * 16);
  });

  return {
    slabCount: slabs.length,
    slabMatrix,
    seamCount: seamKind.length,
    seamMatrix: new Float32Array(seamMatrix),
    seamKind: new Uint8Array(seamKind),
    seamDist: new Float32Array(seamDist),
    seamGain: new Float32Array(seamGain),
  };
};

export const CITY = buildCity();

/* ------------------------------------------------------------------ signal routes */

/** Radius of the ring inlaid in the plaza floor where every route ends. */
export const NODE_RING = 4.4;
export const PLAZA_RING = 9.2;

const quarterTurn = (p: readonly [number, number], n: number): [number, number] => {
  let [x, z] = p;
  for (let i = 0; i < n; i++) [x, z] = [-z, x];
  return [x, z];
};

const FAR = EXTENT - 2;
const DIAG = NODE_RING * Math.SQRT1_2;
/** Straight down a boulevard into the node. */
const AXIAL: readonly (readonly [number, number])[] = [
  [0, -FAR],
  [0, -NODE_RING],
];
/** Along a side avenue, one jog, to the plaza corner, then a 45 degree run into the node. */
const DOGLEG: readonly (readonly [number, number])[] = [
  [-FAR, avenue(-2)],
  [avenue(-3), avenue(-2)],
  [avenue(-3), avenue(-1)],
  [avenue(-1), avenue(-1)],
  [-DIAG, -DIAG],
];

/** Eight routes in a pinwheel: four axial, four dog-legs, each a quarter turn from the last. */
export const ROUTES: readonly RouteCurve[] = [0, 1, 2, 3].flatMap((n) => [
  RouteCurve.onFloor(AXIAL.map((p) => quarterTurn(p, n))),
  RouteCurve.onFloor(DOGLEG.map((p) => quarterTurn(p, n))),
]);
