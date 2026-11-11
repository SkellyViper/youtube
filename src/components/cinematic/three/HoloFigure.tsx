import React, {useEffect, useLayoutEffect, useMemo, useRef} from 'react';
import * as THREE from 'three';
import {useStageQuality} from '../../cyber/three/Stage3D';
import type {Vec3} from '../../cyber/three/rig';
import {useLook, useObjectOffset} from '../../../shot/runtime';
import {useTheme} from '../../../styles/ThemeContext';

/**
 * A seated man made of light: one smooth body (no visible primitives),
 * faceless, rendered as a luminous holographic surface. Deterministic: a pure
 * function of props.
 *
 * How it is drawn: a raymarched signed-distance body. About fifty soft
 * primitives (iq round cones for the limbs and fingers, ellipsoids for pelvis,
 * abdomen, ribcage, lats, shoulder girdle, shoulder blades, deltoids, skull,
 * ears, palms, calves, knees, toes, a rounded box for the jaw) are fused with
 * polynomial smooth-min, so the body reads as one continuous surface. The
 * fragment shader writes `gl_FragDepth` from the hit point, so the chair, the
 * desk and the keyboard occlude him exactly, and the body is opaque: nothing
 * shows through it. Silhouettes are anti-aliased analytically (closest
 * approach of the missed rays, and of rays that graze a near limb before
 * hitting the one behind it, which also draws the inner contours).
 *
 * Cost (Intel UHD / ANGLE D3D11 is the reference): the distance function is
 * instantiated once in the program (one loop does the march, the normal and
 * the occlusion samples; every loop has a uniform bound, so the D3D compiler
 * cannot unroll or duplicate it). Each pixel first tests its ray against the
 * group bounds (capsules around the limbs, boxes around torso and shanks),
 * skips the groups it never comes near and starts at the first one it meets.
 * Occlusion and the thin-part glow only run at full quality (exports and
 * ?quality=full); the live Player's default quality skips them. The
 * silhouette, depth and every other term are identical.
 *
 * The joints are solved on the CPU every render from the pose (a pure
 * function of props: no clocks, no randomness). The torso leans from the
 * pelvis, the arms are two-bone IK with the elbows close to the body, the
 * hands land on the home row / Enter / the mouse (a palm grip fitted to
 * SlimMouse) or rest by the desk's front edge when he sits back, and the lean
 * is limited so a hand can always reach what it holds. The back stays in front
 * of the backrest at every pose.
 */
export type HoloPose = {
  /** 0..1 fingers drum on the keys (driven by `time`). */
  readonly typing?: number;
  /** -1 leaning back (relaxed) .. 0 upright working posture .. 1 leaning into the screen. */
  readonly lean?: number;
  /** Head yaw, radians. + turns the face toward his left (-x), - toward his right (+x). */
  readonly headYaw?: number;
  /** Head pitch, radians. + looks down. */
  readonly headPitch?: number;
  /** 0..1 right hand goes from the keyboard to the mouse. */
  readonly reach?: number;
  /** 0..1 right hand lift above the Enter key (0 = resting on it, 1 = lifted ~4 cm). */
  readonly tap?: number;
  /** 0..1 right hand moves from the home row onto the Enter key. */
  readonly toEnter?: number;
};

/** The chair envelope the figure must stay inside (see scenes/cinematic/02-wrong-project/layout.ts CHAIR). */
export type ChairEnvelope = {
  readonly seat: {readonly top: number; readonly halfWidth: number; readonly zFront: number; readonly zBack: number};
  readonly back: {readonly bottom: number; readonly top: number; readonly zFront: number};
  readonly arms: {readonly x: number; readonly top: number};
};

export type HoloFigureProps = {
  /** World point under the seat centre (the chair's floor point). The figure faces -z. */
  readonly position: Vec3;
  readonly pose?: HoloPose;
  /** Active time in seconds (for typing / breathing / the scan). Never a clock. */
  readonly time?: number;
  /** World centre of the keyboard's key field (top surface). */
  readonly keyboard: Vec3;
  /** World top of the Enter key. */
  readonly enter: Vec3;
  /** World position of the mouse (its base on the desk). */
  readonly mouse: Vec3;
  readonly chair: ChairEnvelope;
  /** Strength of the fine horizontal contour lines (0 = off). Default 1. */
  readonly lines?: number;
  /** Strength of the sparse surface sparkles (0 = off). Default 1. */
  readonly sparkle?: number;
  /** Strength of the slow scan wave that climbs the body with `time` (0 = off). Default 1. */
  readonly scan?: number;
};

/* ------------------------------------------------------------------ math helpers */

type V = THREE.Vector3;
const v3 = (x = 0, y = 0, z = 0): V => new THREE.Vector3(x, y, z);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const clamp01 = (x: number) => clamp(x, 0, 1);
const smooth = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
const UP = v3(0, 1, 0);
/** Up / back axes of a frame pitched forward (toward -z) by `a` and turned by `tw` about y (+ = right shoulder forward). */
const upA = (a: number, tw = 0) => v3(0, Math.cos(a), -Math.sin(a)).applyAxisAngle(UP, tw);
const backA = (a: number, tw = 0) => v3(0, Math.sin(a), Math.cos(a)).applyAxisAngle(UP, tw);
const rightA = (tw = 0) => v3(1, 0, 0).applyAxisAngle(UP, tw);
/** World -> local rotation whose local axes (rows) are x, y, z. */
const rows = (x: V, y: V, z: V) => new THREE.Matrix3().set(x.x, x.y, x.z, y.x, y.y, y.z, z.x, z.y, z.z);
const pitchFrame = (a: number, tw = 0) => rows(rightA(tw), upA(a, tw), backA(a, tw));
/** Frame whose local z runs along `dir`, local x as horizontal as possible. */
const limbFrame = (dir: V): THREE.Matrix3 => {
  const z = dir.clone().normalize();
  let x = new THREE.Vector3().crossVectors(UP, z);
  if (x.lengthSq() < 1e-6) x = v3(1, 0, 0);
  x.normalize();
  const y = new THREE.Vector3().crossVectors(z, x).normalize();
  return rows(x, y, z);
};
/** Distance from a point to the segment a-b. */
const segDist = (q: V, a: V, b: V) => {
  const ab = b.clone().sub(a);
  const l2 = ab.lengthSq();
  const h = l2 > 1e-12 ? clamp01(q.clone().sub(a).dot(ab) / l2) : 0;
  return q.distanceTo(a.clone().addScaledVector(ab, h));
};

/* ------------------------------------------------------------------ primitive layout */

// Round cones (a, ra) -> (b, rb). Left / right pairs are adjacent (the shader loops over the two sides).
const C = {
  NECK: 0,
  TRAP_L: 1,
  TRAP_R: 2,
  UARM_L: 3,
  UARM_R: 4,
  FARM_L: 5,
  FARM_R: 6,
  FING_L: 7, // 4 fingers x 2 segments: 7..14
  THUMB_L: 15, // 2 segments: 15, 16
  FING_R: 17, // 17..24 (= FING_L + 10)
  THUMB_R: 25, // 25, 26 (= THUMB_L + 10)
  THIGH_L: 27,
  THIGH_R: 28,
  SHIN_L: 29,
  SHIN_R: 30,
  FOOT_L: 31,
  FOOT_R: 32,
  SPINE_LO: 33,
  SPINE_HI: 34,
} as const;
const NC = 35;

// Ellipsoids (centre, radii, world->local rotation). JAW is a rounded box (radii = half size, .w = rounding).
const E = {
  PELVIS: 0,
  BUTT_L: 1,
  BUTT_R: 2,
  ABDOMEN: 3,
  CHEST: 4,
  GIRDLE: 5,
  CRANIUM: 6,
  JAW: 7,
  DELT_L: 8,
  DELT_R: 9,
  FMUS_L: 10,
  FMUS_R: 11,
  PALM_L: 12,
  PALM_R: 13,
  CALF_L: 14,
  CALF_R: 15,
  TOES_L: 16,
  TOES_R: 17,
  KNEE_L: 18,
  KNEE_R: 19,
  EAR_L: 20,
  EAR_R: 21,
  SCAP_L: 22,
  SCAP_R: 23,
  LATS: 24,
} as const;
const NE = 25;

// Group bounds: capsules (limbs, head) or boxes (torso, shanks). Left / right pairs adjacent.
const B = {HEAD: 0, UARM_L: 1, UARM_R: 2, LARM_L: 3, LARM_R: 4, FING_L: 5, FING_R: 6, THIGH_L: 7, THIGH_R: 8, TORSO: 9, SHANK_L: 10, SHANK_R: 11} as const;
const NB = 12;

const range = (start: number, n: number) => Array.from({length: n}, (_, i) => start + i);
/** The primitives each bound must contain. */
const BOUND_PRIMS: readonly {readonly cones: readonly number[]; readonly ells: readonly number[]}[] = [
  {cones: [C.NECK], ells: [E.CRANIUM, E.JAW, E.EAR_L, E.EAR_R]},
  {cones: [C.UARM_L], ells: [E.DELT_L]},
  {cones: [C.UARM_R], ells: [E.DELT_R]},
  {cones: [C.FARM_L, ...range(C.FING_L, 10)], ells: [E.FMUS_L, E.PALM_L]},
  {cones: [C.FARM_R, ...range(C.FING_R, 10)], ells: [E.FMUS_R, E.PALM_R]},
  {cones: range(C.FING_L, 10), ells: []},
  {cones: range(C.FING_R, 10), ells: []},
  {cones: [C.THIGH_L], ells: [E.KNEE_L]},
  {cones: [C.THIGH_R], ells: [E.KNEE_R]},
  {cones: [C.TRAP_L, C.TRAP_R, C.SPINE_LO, C.SPINE_HI], ells: [E.PELVIS, E.BUTT_L, E.BUTT_R, E.ABDOMEN, E.CHEST, E.LATS, E.GIRDLE, E.SCAP_L, E.SCAP_R]},
  {cones: [C.SHIN_L, C.FOOT_L], ells: [E.CALF_L, E.TOES_L]},
  {cones: [C.SHIN_R, C.FOOT_R], ells: [E.CALF_R, E.TOES_R]},
];

/** The solved body: packed primitive data (figure-local metres) plus its bounds. */
export type HoloRig = {
  readonly cones: Float32Array; // NC x (a.xyz, ra, b.xyz, rb)
  readonly ellC: Float32Array; // NE x (c.xyz, 0)
  readonly ellR: Float32Array; // NE x (r.xyz, rounding)
  readonly ellM: Float32Array; // NE x mat3 (column-major), world -> local
  readonly bounds: Float32Array; // NB x (a.xyz, r, b.xyz, 0) capsule | (centre.xyz, 0, half.xyz, 1) box
  readonly boxMin: Vec3;
  readonly boxMax: Vec3;
  /** A few named joints (figure-local), for tools and checks. */
  readonly joints: Readonly<Record<string, Vec3>>;
  /** The lean actually used (the requested one, limited by what a hand can reach). */
  readonly lean: number;
};

class Packer {
  readonly cones = new Float32Array(NC * 8);
  readonly ellC = new Float32Array(NE * 4);
  readonly ellR = new Float32Array(NE * 4);
  readonly ellM = new Float32Array(NE * 9);
  readonly isBox = new Array<boolean>(NE).fill(false);
  cone(i: number, a: V, ra: number, b: V, rb: number) {
    // The round cone needs |b - a| > |ra - rb| (otherwise one end swallows the other): keep a margin.
    const d = b.clone().sub(a);
    const len = d.length();
    const need = Math.abs(ra - rb) + 1e-3;
    let bb = b;
    if (len < need) bb = a.clone().add(len > 1e-6 ? d.multiplyScalar(need / len) : v3(0, need, 0));
    this.cones.set([a.x, a.y, a.z, ra, bb.x, bb.y, bb.z, rb], i * 8);
  }
  ell(i: number, c: V, r: V, m: THREE.Matrix3) {
    this.ellC.set([c.x, c.y, c.z, 0], i * 4);
    this.ellR.set([Math.max(1e-3, r.x), Math.max(1e-3, r.y), Math.max(1e-3, r.z), 0], i * 4);
    this.ellM.set(m.elements, i * 9);
    this.isBox[i] = false;
  }
  /** A rounded box in the ellipsoid slot `i`: `half` is its full half size (rounding included). */
  rbox(i: number, c: V, half: V, round: number, m: THREE.Matrix3) {
    this.ell(i, c, half, m);
    this.ellR[i * 4 + 3] = Math.min(round, half.x, half.y, half.z);
    this.isBox[i] = true;
  }
  /** Farthest point of an ellipsoid slot from its centre. */
  reach(i: number) {
    const r = [this.ellR[i * 4], this.ellR[i * 4 + 1], this.ellR[i * 4 + 2]];
    return this.isBox[i] ? Math.hypot(r[0], r[1], r[2]) : Math.max(r[0], r[1], r[2]);
  }
  /** World-axis-aligned box of one primitive. */
  extent(kind: 'cone' | 'ell', i: number, lo: number[], hi: number[]) {
    if (kind === 'cone') {
      const c = this.cones;
      for (const [o, r] of [
        [0, c[i * 8 + 3]],
        [4, c[i * 8 + 7]],
      ] as const)
        for (let k = 0; k < 3; k++) {
          lo[k] = Math.min(lo[k], c[i * 8 + o + k] - r);
          hi[k] = Math.max(hi[k], c[i * 8 + o + k] + r);
        }
    } else {
      const m = this.ellM; // column-major world->local: element (row j, col k) at k*3 + j
      for (let k = 0; k < 3; k++) {
        let s = 0;
        for (let j = 0; j < 3; j++) s += this.isBox[i] ? Math.abs(m[i * 9 + k * 3 + j] * this.ellR[i * 4 + j]) : (m[i * 9 + k * 3 + j] * this.ellR[i * 4 + j]) ** 2;
        const h = this.isBox[i] ? s : Math.sqrt(s);
        lo[k] = Math.min(lo[k], this.ellC[i * 4 + k] - h);
        hi[k] = Math.max(hi[k], this.ellC[i * 4 + k] + h);
      }
    }
  }
}

/* ------------------------------------------------------------------ anatomy (metres: a man of ~1.78 m, lean build) */

const UPPER_ARM = 0.3;
const FOREARM = 0.27;
const ARM = UPPER_ARM + FOREARM;
/** How straight an arm may get when it has to reach (fraction of its full length). */
const MAX_REACH = 0.985;
const THIGH = 0.43;
const SHIN = 0.458;
/** Shoulder joint half-spacing (biacromial breadth ~0.40 m with the acromion over the joint). */
const SHOULDER = 0.182;
/** Fingers (index .. pinky): offset across the knuckles (toward the pinky), segment lengths, radius. */
const FINGERS = [
  {o: -0.029, fwd: 0.0, l1: 0.047, l2: 0.04, r: 0.0097},
  {o: -0.0096, fwd: 0.004, l1: 0.052, l2: 0.043, r: 0.01},
  {o: 0.0102, fwd: 0.001, l1: 0.05, l2: 0.04, r: 0.0095},
  {o: 0.0285, fwd: -0.008, l1: 0.039, l2: 0.034, r: 0.0084},
] as const;
const KNUCKLE = 0.093;
/** SlimMouse (Workstation.tsx): centre height above its base, half sizes, yaw. The palm grip is fitted to it. */
const MOUSE_SHAPE = {lift: 0.016, half: [0.034, 0.018, 0.058] as const, yaw: -0.12} as const;

type HandFrame = {f: V; u: V; s: V};
const handFrame = (fwdH: V, pitch: number): HandFrame => {
  const h = v3(fwdH.x, 0, fwdH.z);
  if (h.lengthSq() < 1e-8) h.set(0, 0, -1);
  h.normalize();
  const f = h.clone().multiplyScalar(Math.cos(pitch)).addScaledVector(UP, -Math.sin(pitch)).normalize();
  const u = UP.clone().addScaledVector(f, -f.dot(UP)).normalize();
  const s = new THREE.Vector3().crossVectors(f, u).normalize(); // toward his right
  return {f, u, s};
};
const fingerDir = (fr: HandFrame, curl: number) => fr.f.clone().multiplyScalar(Math.cos(curl)).addScaledVector(fr.u, -Math.sin(curl));

/** One hand: wrist, frame, per-finger curls (knuckle, middle joint), thumb (joint + tip; absolute points). */
type HandPose = {W: V; fr: HandFrame; c1: number[]; c2: number[]; T1: V; T2: V};
/** Signed distance from a point to what the hand rests on (key tops, desk, mouse). */
type Surface = (q: V) => number;
const plane =
  (y: number): Surface =>
  (q) =>
    q.y - y;
const thumbBase = (W: V, fr: HandFrame, side: number) =>
  W.clone()
    .addScaledVector(fr.f, 0.024)
    .addScaledVector(fr.s, -side * 0.029)
    .addScaledVector(fr.u, -0.009);
const knuckle = (W: V, fr: HandFrame, side: number, i: number) =>
  W.clone()
    .addScaledVector(fr.f, KNUCKLE + FINGERS[i].fwd)
    .addScaledVector(fr.s, side * FINGERS[i].o)
    .addScaledVector(fr.u, 0.004);
const fingerTip = (K: V, fr: HandFrame, i: number, c1: number, c2: number) =>
  K.clone()
    .addScaledVector(fingerDir(fr, c1), FINGERS[i].l1)
    .addScaledVector(fingerDir(fr, c1 + c2), FINGERS[i].l2);
/** Bisection on a monotone scalar: the x in [lo, hi] where g(x) crosses 0 (g(lo) > 0 > g(hi)). */
const solve = (g: (x: number) => number, lo: number, hi: number) => {
  if (g(lo) <= 0) return lo;
  if (g(hi) >= 0) return hi;
  for (let k = 0; k < 14; k++) {
    const m = (lo + hi) / 2;
    if (g(m) > 0) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
};
/** Curl each finger just until its tip rests on the surface (`ratio` couples the middle joint to the knuckle). */
const curlsOn = (W: V, fr: HandFrame, side: number, ratio: number, surf: Surface) => {
  const c1: number[] = [];
  const c2: number[] = [];
  FINGERS.forEach((fg, i) => {
    const K = knuckle(W, fr, side, i);
    const c = solve((x) => surf(fingerTip(K, fr, i, x, x * ratio)) - fg.r * 0.85, -0.1, 0.62);
    c1.push(c);
    c2.push(c * ratio);
  });
  return {c1, c2};
};
/** The thumb along the side of the index, lowered until its tip rests on the surface. */
const thumbOn = (W: V, fr: HandFrame, side: number, surf: Surface): {T1: V; T2: V} => {
  const th = -side; // the thumb is on the inner side: -x for the right hand, +x for the left
  const {f, u, s} = fr;
  const T0 = thumbBase(W, fr, side);
  const at = (q: number) => {
    const T1 = T0.clone().add(f.clone().multiplyScalar(0.72).addScaledVector(s, th * 0.34).addScaledVector(u, -0.5 * q).normalize().multiplyScalar(0.05));
    const T2 = T1.clone().add(f.clone().multiplyScalar(0.86).addScaledVector(s, th * 0.06).addScaledVector(u, -0.42 * q).normalize().multiplyScalar(0.036));
    return {T1, T2};
  };
  return at(solve((q) => surf(at(q).T2) - 0.008, 0.2, 3));
};
const blendHand = (a: HandPose, b: HandPose, t: number): HandPose => {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const f = a.fr.f.clone().lerp(b.fr.f, t).normalize();
  const u = a.fr.u.clone().lerp(b.fr.u, t);
  u.addScaledVector(f, -u.dot(f)).normalize();
  const s = new THREE.Vector3().crossVectors(f, u).normalize();
  return {
    W: a.W.clone().lerp(b.W, t),
    fr: {f, u, s},
    c1: a.c1.map((x, i) => lerp(x, b.c1[i], t)),
    c2: a.c2.map((x, i) => lerp(x, b.c2[i], t)),
    T1: a.T1.clone().lerp(b.T1, t),
    T2: a.T2.clone().lerp(b.T2, t),
  };
};
/**
 * A hand over a flat surface (key tops, the desk): the wrist at `wristY`, the fingertips reaching
 * `tip` (in plan), pointing away from the shoulder turned in by `yawIn`; the fingers curl down
 * until they touch the surface at `surfY`.
 */
const flatHand = (side: number, S: V, tip: V, wristY: number, surfY: number, pitch: number, yawIn: number, ratio: number): HandPose => {
  const toward = tip.clone().sub(S);
  const fr = handFrame(v3(toward.x, 0, toward.z).applyAxisAngle(UP, yawIn), pitch);
  const fh = v3(fr.f.x, 0, fr.f.z).normalize();
  const W = tip.clone().addScaledVector(fh, -0.15);
  W.y = wristY;
  const surf = plane(surfY);
  return {W, fr, ...curlsOn(W, fr, side, ratio, surf), ...thumbOn(W, fr, side, surf)};
};
/** The right hand in a palm grip on the mouse: palm on its back, fingers over the buttons, thumb on its left side, wrist low. */
const mouseHand = (mouse: V, deskY: number): HandPose => {
  const {lift, half, yaw} = MOUSE_SHAPE;
  const c = mouse.clone().add(v3(0, lift, 0));
  const fM = v3(-Math.sin(yaw), 0, -Math.cos(yaw)); // the mouse's forward (its buttons)
  const rM = v3(Math.cos(yaw), 0, -Math.sin(yaw)); // its right side
  const W = c
    .clone()
    .addScaledVector(fM, -(half[2] + 0.052))
    .addScaledVector(rM, 0.005)
    .add(v3(0, 0.02, 0));
  const fr = handFrame(fM, -0.22); // the palm rises from the low wrist over the mouse's back
  // The mouse as a distance (iq's ellipsoid bound), with the desk under it.
  const surf: Surface = (q) => {
    const d = q.clone().sub(c);
    const lx = d.dot(rM) / half[0];
    const ly = d.y / half[1];
    const lz = -d.dot(fM) / half[2];
    const k0 = Math.hypot(lx, ly, lz);
    const k1 = Math.max(Math.hypot(lx / half[0], ly / half[1], lz / half[2]), 1e-6);
    return Math.min((k0 * (k0 - 1)) / k1, q.y - deskY);
  };
  const T2 = c
    .clone()
    .addScaledVector(rM, -(half[0] + 0.0085))
    .addScaledVector(fM, 0.004)
    .add(v3(0, -0.002, 0));
  const T1 = c
    .clone()
    .addScaledVector(rM, -(half[0] + 0.012))
    .addScaledVector(fM, -0.036)
    .add(v3(0, 0.003, 0));
  return {W, fr, ...curlsOn(W, fr, 1, 1.15, surf), T1, T2};
};

/** Two-bone IK: the elbow for a shoulder and a wrist, bending toward `pole`. */
const solveElbow = (S: V, W: V, pole: V): V => {
  const dir = W.clone().sub(S);
  const d = Math.max(1e-4, dir.length());
  dir.divideScalar(d);
  const dd = Math.min(d, ARM * 0.9995);
  const a = UPPER_ARM;
  const b = FOREARM;
  const x = (a * a - b * b + dd * dd) / (2 * dd);
  const h = Math.sqrt(Math.max(0, a * a - x * x));
  const P = pole.clone().addScaledVector(dir, -pole.dot(dir));
  if (P.lengthSq() < 1e-8) P.set(0, -1, 0);
  P.normalize();
  return S.clone().addScaledVector(dir, x).addScaledVector(P, h);
};

type RigInput = {
  readonly pose: HoloPose;
  readonly time: number;
  /** Targets in figure-local space (metres from the chair's floor point). */
  readonly keyboard: Vec3;
  readonly enter: Vec3;
  readonly mouse: Vec3;
  readonly chair: ChairEnvelope;
};

/** The torso for one lean: pelvis, spine points, frames. */
const torsoFor = (lean: number, twist: number, chair: ChairEnvelope, breath: number) => {
  const ax = lean >= 0 ? lerp(0.24, 0.5, lean) : lerp(0.24, -0.3, -lean); // torso pitch (+ forward)
  // Working: sitting toward the front of the seat. Sitting back: hips at the back of the seat.
  const zHip = lean >= 0 ? lerp(0.035, 0.0, lean) : lerp(0.035, 0.085, -lean);
  const a1 = ax * 0.62; // lumbar
  const a2 = ax * 1.12; // thorax (a slight forward curve of the upper back)
  const ap = ax * 0.25; // pelvis tilt
  const tw1 = twist * 0.45;
  const R = v3(0, chair.seat.top + 0.0875, zHip); // between the hip joints
  const Sb = R.clone().add(v3(0, 0.055, 0.022));
  const L = Sb.clone().addScaledVector(upA(a1, tw1), 0.175);
  const N = L.clone().addScaledVector(upA(a2, twist), 0.33 + 0.002 * breath);
  return {ax, zHip, a1, a2, ap, tw1, R, Sb, L, N};
};
type Torso = ReturnType<typeof torsoFor>;

/** Shoulder joint: relaxed (a little low) and a little forward; `prot` brings it further forward for a reach. */
const shoulderOf = (t: Torso, side: number, twist: number, prot: number, lift: number) =>
  t.N.clone()
    .addScaledVector(rightA(twist), side * SHOULDER)
    .addScaledVector(upA(t.a2, twist), -0.06 + lift)
    .addScaledVector(backA(t.a2, twist), 0.004 - prot);

/** Body back surface vs the backrest: the most a torso ellipsoid crosses the backrest's front plane (m, > 0 = inside). */
const backrestPenetration = (p: Packer, chair: ChairEnvelope, tilt: number): number => {
  // Backrest front plane through (y = bottom, z = zFront), leaning back by `tilt`; normal points back (+z), a little down.
  const n = v3(0, -Math.sin(tilt), Math.cos(tilt));
  const p0 = v3(0, chair.back.bottom, chair.back.zFront);
  let worst = -1;
  for (const i of [E.ABDOMEN, E.CHEST, E.LATS, E.GIRDLE, E.SCAP_L, E.SCAP_R, E.DELT_L, E.DELT_R]) {
    const c = v3(p.ellC[i * 4], p.ellC[i * 4 + 1], p.ellC[i * 4 + 2]);
    // Support of the ellipsoid along n: c.n + |diag(r) M n|.
    const m = new THREE.Matrix3().fromArray(p.ellM, i * 9);
    const ln = n.clone().applyMatrix3(m);
    const h = Math.hypot(ln.x * p.ellR[i * 4], ln.y * p.ellR[i * 4 + 1], ln.z * p.ellR[i * 4 + 2]);
    // Where that support point is (to know whether it faces the backrest at all).
    const sp = v3(ln.x * p.ellR[i * 4] ** 2, ln.y * p.ellR[i * 4 + 1] ** 2, ln.z * p.ellR[i * 4 + 2] ** 2)
      .divideScalar(Math.max(1e-6, h))
      .applyMatrix3(m.clone().transpose())
      .add(c);
    if (sp.y < chair.back.bottom - 0.03 || sp.y > chair.back.top + 0.06) continue;
    // + 1 cm: the smooth blends swell the surface a little beyond the ellipsoids.
    worst = Math.max(worst, c.dot(n) + h + 0.01 - p0.dot(n));
  }
  return worst;
};

/** The body for one set of props, in figure-local metres. Pure. */
export const holoFigureRig = (input: RigInput): HoloRig => {
  const {pose, time, chair} = input;
  const kbL = v3(...input.keyboard);
  const enterL = v3(...input.enter);
  const mouseL = v3(...input.mouse);
  const typing = clamp01(pose.typing ?? 0);
  const leanIn = clamp(pose.lean ?? 0, -1, 1);
  const yaw = clamp(pose.headYaw ?? 0, -1.2, 1.2);
  const nod = clamp(pose.headPitch ?? 0, -0.6, 0.8);
  const reach = smooth(pose.reach ?? 0);
  const tap = clamp01(pose.tap ?? 0);
  const toEnter = smooth(pose.toEnter ?? 0);
  const breath = Math.sin((time * Math.PI * 2) / 4.4);
  const tilt = (8 * Math.PI) / 180;
  const deskY = kbL.y - 0.022; // the keyboard's key tops sit 22 mm above the desk

  // Sitting back: a hand that is not on the mouse leaves the keys and rests on the desk by its front edge.
  const relax = smooth((-leanIn - 0.25) / 0.35);
  // Reaching for the mouse (more so while sitting back) turns the chest a little toward it.
  const twist = 0.06 * reach + 0.28 * reach * clamp01(-leanIn);

  // ---- hands ----------------------------------------------------------------------------
  const drum = (hand: number, finger: number) => {
    if (typing <= 0) return 0;
    const ph = hand * 1.93 + finger * 2.41;
    const w = 10.5 + finger * 1.7 + hand * 0.9;
    return typing * Math.pow(Math.max(0, Math.sin(time * w + ph)), 6);
  };
  const handBob = (hand: number) => typing * 0.0025 * Math.sin(time * 7.1 + hand * 2.2);
  const handFor = (side: number, S: V): HandPose => {
    // Home row: fingertips on the key tops, wrists ~2 cm above the desk.
    const keyTop = kbL.y;
    const home = kbL.clone().add(v3(side < 0 ? -0.104 : 0.074, 0, 0.004));
    let hand = flatHand(side, S, home, deskY + 0.04 + handBob(side), keyTop, 0.03, -side * 0.08, 1.6);
    if (side > 0) {
      // Onto Enter (the hand hops over the keys, it does not drag across them), lifted by `tap`.
      const onEnter = flatHand(side, S, enterL.clone().add(v3(-0.004, 0, 0.004)), deskY + 0.05, keyTop, 0.03, -0.05, 1.6);
      onEnter.W.y += 0.04 * tap;
      onEnter.T1.y += 0.04 * tap;
      onEnter.T2.y += 0.04 * tap;
      hand = blendHand(hand, onEnter, toEnter);
      hand.W.y += 0.012 * Math.sin(Math.PI * toEnter);
      hand = blendHand(hand, mouseHand(mouseL, deskY), reach);
      hand.W.y += 0.03 * Math.sin(Math.PI * reach);
    }
    // Resting on the desk by its front edge, beside the keyboard: wrist low, fingers on the desk.
    const restTip = v3(kbL.x + (side < 0 ? -0.26 : 0.24), deskY, kbL.z + 0.13);
    const rest = flatHand(side, S, restTip, deskY + 0.032, deskY, 0.06, side * 0.16, 1.4);
    const rw = side > 0 ? relax * (1 - reach) : relax;
    const out = blendHand(hand, rest, rw);
    out.W.y += 0.015 * Math.sin(Math.PI * rw);
    return out;
  };

  // ---- the lean actually used: never so far back that a hand cannot reach what it holds ----
  const protFor = (S: V, W: V) => 0.012 + smooth((W.distanceTo(S) - 0.46) / 0.12) * 0.03;
  const feasible = (lean: number) => {
    const t = torsoFor(lean, twist, chair, breath);
    let worst = -1;
    for (const side of [-1, 1]) {
      const S0 = shoulderOf(t, side, twist, 0, 0);
      const h0 = handFor(side, S0);
      const S = shoulderOf(t, side, twist, protFor(S0, h0.W), 0);
      worst = Math.max(worst, handFor(side, S).W.distanceTo(S) - ARM * MAX_REACH);
    }
    return worst;
  };
  let lean = leanIn;
  if (feasible(lean) > 0) {
    let lo = leanIn;
    let hi = 1;
    for (let k = 0; k < 16; k++) {
      const mid = (lo + hi) / 2;
      if (feasible(mid) > 0) lo = mid;
      else hi = mid;
    }
    lean = hi;
  }

  const t = torsoFor(lean, twist, chair, breath);
  const p = new Packer();
  /** Segments the limb bounds are built around (filled below). */
  const seg: Record<string, [V, V]> = {};
  const joints: Record<string, Vec3> = {};
  const J = (name: string, x: V) => {
    joints[name] = [x.x, x.y, x.z];
    return x;
  };

  // ---- torso: a man's: broad shoulders, deep chest, lats tapering gently into the waist, narrow hips ----
  const {R, Sb, L, N, a1, a2, ap, tw1} = t;
  const br = 1 + 0.012 * breath;
  p.ell(E.PELVIS, R.clone().addScaledVector(upA(ap), 0.03).addScaledVector(backA(ap), 0.01), v3(0.137, 0.095, 0.1), pitchFrame(ap));
  for (const side of [-1, 1]) {
    p.ell(side < 0 ? E.BUTT_L : E.BUTT_R, R.clone().add(v3(side * 0.056, -0.0035, 0.036)), v3(0.07, 0.079, 0.07), pitchFrame(ap * 0.5));
  }
  p.ell(E.ABDOMEN, Sb.clone().addScaledVector(upA(a1, tw1), 0.08).addScaledVector(backA(a1, tw1), -0.03), v3(0.146, 0.12, 0.104), pitchFrame(a1, tw1));
  p.ell(E.CHEST, L.clone().addScaledVector(upA(a2, twist), 0.15).addScaledVector(backA(a2, twist), -0.008), v3(0.152 * br, 0.168, 0.112 * br), pitchFrame(a2, twist));
  p.ell(E.LATS, L.clone().addScaledVector(upA(a2, twist), 0.168).addScaledVector(backA(a2, twist), 0.026), v3(0.156, 0.116, 0.08), pitchFrame(a2, twist));
  p.ell(E.GIRDLE, N.clone().addScaledVector(upA(a2, twist), -0.066).addScaledVector(backA(a2, twist), 0.008), v3(0.174, 0.058, 0.084), pitchFrame(a2, twist));
  // Shoulder blades: two flat swellings on the upper back.
  for (const side of [-1, 1]) {
    const sc = N.clone()
      .addScaledVector(rightA(twist), side * 0.084)
      .addScaledVector(upA(a2, twist), -0.12)
      .addScaledVector(backA(a2, twist), 0.068);
    const m = new THREE.Matrix4().makeRotationZ(side * 0.2).premultiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-a2, twist, 0, 'YXZ')));
    p.ell(side < 0 ? E.SCAP_L : E.SCAP_R, sc, v3(0.052, 0.066, 0.022), new THREE.Matrix3().setFromMatrix4(m).transpose());
  }
  // The spine: a shallow groove down the middle of the back (carved, see the shader).
  {
    const g = 0.018; // groove radius (wide and shallow: a soft dip, not a seam)
    const P1 = Sb.clone().addScaledVector(upA(a1, tw1), 0.07).addScaledVector(backA(a1, tw1), 0.076 + g - 0.0025);
    const P2 = L.clone().addScaledVector(upA(a2, twist), 0.15).addScaledVector(backA(a2, twist), 0.118 + g - 0.003);
    const P3 = N.clone().addScaledVector(upA(a2, twist), -0.04).addScaledVector(backA(a2, twist), 0.097 + g - 0.0025);
    p.cone(C.SPINE_LO, P1, g * 0.9, P2, g);
    p.cone(C.SPINE_HI, P2, g, P3, g * 0.8);
  }
  J('pelvis', R);
  J('neck', N);

  // ---- head: a man's head, faceless; square jaw, ears ------------------------------------------
  const an = t.ax * 0.45 + 0.05;
  const H0 = N.clone().addScaledVector(upA(an, twist * 0.5), 0.09);
  const headRot = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-(0.04 + nod), yaw, 0, 'YXZ'));
  const toWorld = (x: number, y: number, z: number) => v3(x, y, z).applyMatrix4(headRot);
  const headM = new THREE.Matrix3().setFromMatrix4(headRot).transpose();
  p.ell(E.CRANIUM, H0.clone().add(toWorld(0, 0.074, 0.012)), v3(0.078, 0.092, 0.101), headM);
  p.rbox(E.JAW, H0.clone().add(toWorld(0, -0.012, -0.034)), v3(0.056, 0.05, 0.054), 0.03, headM);
  // Ears: small flat shells that break the egg silhouette from behind (no face, but a human head).
  for (const side of [-1, 1]) {
    const earRot = new THREE.Matrix4().makeRotationY(side * 0.35).premultiply(headRot);
    p.ell(side < 0 ? E.EAR_L : E.EAR_R, H0.clone().add(toWorld(side * 0.071, 0.044, 0.01)), v3(0.011, 0.025, 0.016), new THREE.Matrix3().setFromMatrix4(earRot).transpose());
  }
  // A man's neck (~0.125 m wide) carrying the head.
  p.cone(C.NECK, N.clone().addScaledVector(upA(a2, twist), -0.02).addScaledVector(backA(a2, twist), 0.008), 0.064, H0.clone().add(toWorld(0, 0.02, 0.016)), 0.055);
  J('head', H0.clone().add(toWorld(0, 0.074, 0.012)));
  seg.head = [N.clone(), H0.clone().add(toWorld(0, 0.074, 0.0))];

  // ---- arms ----------------------------------------------------------------------
  for (const side of [-1, 1]) {
    const Lf = side < 0;
    const S0 = shoulderOf(t, side, twist, 0, 0);
    const h0 = handFor(side, S0);
    const S = shoulderOf(t, side, twist, protFor(S0, h0.W), 0.004 * breath);
    const hand = handFor(side, S);
    let W = hand.W;
    // Still out of reach (only at extreme props): slide the hand back toward the shoulder.
    const d = W.distanceTo(S);
    if (d > ARM * MAX_REACH) W = S.clone().lerp(W, (ARM * MAX_REACH) / d);
    // Elbows close to the body, hanging down; the mouse arm opens a little to the side.
    const pole = v3(side * lerp(0.22, 0.45, side > 0 ? reach : 0), -1, 0.3);
    const El = solveElbow(S, W, pole);
    J(Lf ? 'shoulderL' : 'shoulderR', S);
    J(Lf ? 'elbowL' : 'elbowR', El);
    J(Lf ? 'wristL' : 'wristR', W);
    // Trapezius slope from the neck to the shoulder.
    p.cone(Lf ? C.TRAP_L : C.TRAP_R, N.clone().addScaledVector(upA(a2, twist), 0.03).addScaledVector(backA(a2, twist), 0.024), 0.05, S.clone().addScaledVector(upA(a2, twist), 0.014).addScaledVector(backA(a2, twist), 0.012), 0.038);
    p.ell(Lf ? E.DELT_L : E.DELT_R, S.clone().addScaledVector(rightA(twist), side * 0.012).addScaledVector(upA(a2, twist), -0.012), v3(0.047, 0.047, 0.052), pitchFrame(a2, twist));
    p.cone(Lf ? C.UARM_L : C.UARM_R, S, 0.05, El, 0.039);
    p.cone(Lf ? C.FARM_L : C.FARM_R, El, 0.041, W, 0.029);
    const fdir = W.clone().sub(El).normalize();
    p.ell(Lf ? E.FMUS_L : E.FMUS_R, El.clone().addScaledVector(fdir, 0.08), v3(0.043, 0.037, 0.09), limbFrame(fdir));
    // Hand: palm, four fingers (two segments each), thumb.
    const {fr} = hand;
    const {f, u, s} = fr;
    p.ell(Lf ? E.PALM_L : E.PALM_R, W.clone().addScaledVector(f, 0.054).addScaledVector(u, 0.001), v3(0.045, 0.0175, 0.054), rows(s, u, f));
    const base = Lf ? C.FING_L : C.FING_R;
    FINGERS.forEach((fg, i) => {
      // Small presses, not lifts: from behind, big uncurls read as raised claws.
      const lift = 0.12 * drum(side, i);
      const c1 = hand.c1[i] - lift;
      const c2 = hand.c2[i] - lift * 0.5;
      const K = W.clone()
        .addScaledVector(f, KNUCKLE + fg.fwd)
        .addScaledVector(s, side * fg.o)
        .addScaledVector(u, 0.004);
      const M = K.clone().addScaledVector(fingerDir(fr, c1), fg.l1);
      const T = M.clone().addScaledVector(fingerDir(fr, c1 + c2), fg.l2);
      p.cone(base + i * 2, K, fg.r, M, fg.r * 0.9);
      p.cone(base + i * 2 + 1, M, fg.r * 0.9, T, fg.r * 0.78);
      if (i === 1) J(Lf ? 'tipL' : 'tipR', T);
    });
    const knuckles = W.clone().addScaledVector(f, KNUCKLE);
    seg[Lf ? 'uarmL' : 'uarmR'] = [S.clone(), El.clone()];
    seg[Lf ? 'larmL' : 'larmR'] = [El.clone(), knuckles.clone()];
    seg[Lf ? 'fingL' : 'fingR'] = [knuckles.clone(), v3(...joints[Lf ? 'tipL' : 'tipR'])];
    const tb = Lf ? C.THUMB_L : C.THUMB_R;
    const T0 = thumbBase(W, fr, side);
    p.cone(tb, T0, 0.0135, hand.T1, 0.0112);
    p.cone(tb + 1, hand.T1, 0.0112, hand.T2, 0.0092);
  }

  // ---- legs (thighs rest on the cushion, shins down, feet flat) -----------------------
  for (const side of [-1, 1]) {
    const Lf = side < 0;
    const hip = R.clone().add(v3(side * 0.088, 0, 0));
    const K = hip.clone().add(v3(side * 0.019, -0.028, -THIGH));
    const A = K.clone().add(v3(side * 0.014, -SHIN, -0.05));
    J(Lf ? 'kneeL' : 'kneeR', K);
    seg[Lf ? 'thighL' : 'thighR'] = [hip.clone(), K.clone()];
    J(Lf ? 'ankleL' : 'ankleR', A);
    p.cone(Lf ? C.THIGH_L : C.THIGH_R, hip, 0.074, K, 0.052);
    p.ell(Lf ? E.KNEE_L : E.KNEE_R, K.clone().add(v3(0, 0.003, -0.006)), v3(0.047, 0.046, 0.048), pitchFrame(0));
    p.cone(Lf ? C.SHIN_L : C.SHIN_R, K, 0.048, A, 0.032);
    const sdir = A.clone().sub(K).normalize();
    const calfM = limbFrame(sdir);
    p.ell(Lf ? E.CALF_L : E.CALF_R, K.clone().addScaledVector(sdir, 0.15).add(v3(0, 0, 0.016)), v3(0.046, 0.048, 0.11), calfM);
    // Foot: heel to the ball, toes turned out a little.
    const out = side * 0.14;
    const fwd = v3(Math.sin(out), 0, -Math.cos(out));
    const heel = v3(A.x, 0.0385, A.z + 0.03);
    const ball = v3(A.x, 0.0275, A.z).addScaledVector(fwd, 0.155);
    p.cone(Lf ? C.FOOT_L : C.FOOT_R, heel, 0.034, ball, 0.024);
    const toe = v3(A.x, 0.0235, A.z).addScaledVector(fwd, 0.19);
    const side3 = new THREE.Vector3().crossVectors(fwd, UP).normalize();
    p.ell(Lf ? E.TOES_L : E.TOES_R, toe, v3(0.042, 0.02, 0.043), rows(side3, UP.clone(), fwd.clone().negate()));
  }

  // ---- stay in front of the backrest at every pose ---------------------------------------
  const pen = backrestPenetration(p, chair, tilt) + 0.008;
  if (pen > 0) {
    // Safety net (the pose numbers keep it from triggering): move the upper body forward by the overlap.
    const dz = pen / Math.cos(tilt);
    const shift = (arr: Float32Array, stride: number, offsets: readonly number[], idx: readonly number[]) => {
      for (const i of idx) for (const o of offsets) arr[i * stride + o + 2] -= dz;
    };
    const upperCones = [C.NECK, C.TRAP_L, C.TRAP_R, C.UARM_L, C.UARM_R, C.SPINE_HI];
    const upperElls = [E.CHEST, E.LATS, E.GIRDLE, E.SCAP_L, E.SCAP_R, E.CRANIUM, E.JAW, E.EAR_L, E.EAR_R, E.DELT_L, E.DELT_R];
    shift(p.cones, 8, [0, 4], upperCones);
    shift(p.ellC, 4, [0], upperElls);
    // The upper arms' elbow ends moved: the forearm starts follow them.
    for (const c of [C.FARM_L, C.FARM_R]) p.cones[c * 8 + 2] -= dz;
    for (const e of [E.FMUS_L, E.FMUS_R]) p.ellC[e * 4 + 2] -= dz * 0.7;
  }

  // ---- bounds: capsules around the limbs, boxes around the torso and the shanks ----------------
  const bounds = new Float32Array(NB * 8);
  const capsule = (k: number, [a, b]: [V, V]) => {
    let r = 0;
    for (const i of BOUND_PRIMS[k].cones) r = Math.max(r, segDist(v3(p.cones[i * 8], p.cones[i * 8 + 1], p.cones[i * 8 + 2]), a, b) + p.cones[i * 8 + 3], segDist(v3(p.cones[i * 8 + 4], p.cones[i * 8 + 5], p.cones[i * 8 + 6]), a, b) + p.cones[i * 8 + 7]);
    for (const i of BOUND_PRIMS[k].ells) r = Math.max(r, segDist(v3(p.ellC[i * 4], p.ellC[i * 4 + 1], p.ellC[i * 4 + 2]), a, b) + p.reach(i));
    bounds.set([a.x, a.y, a.z, r + 0.004, b.x, b.y, b.z, 0], k * 8);
  };
  const box = (k: number) => {
    const lo = [Infinity, Infinity, Infinity];
    const hi = [-Infinity, -Infinity, -Infinity];
    BOUND_PRIMS[k].cones.forEach((i) => p.extent('cone', i, lo, hi));
    BOUND_PRIMS[k].ells.forEach((i) => p.extent('ell', i, lo, hi));
    const pad = 0.004;
    bounds.set([(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2, 0, (hi[0] - lo[0]) / 2 + pad, (hi[1] - lo[1]) / 2 + pad, (hi[2] - lo[2]) / 2 + pad, 1], k * 8);
  };
  capsule(B.HEAD, seg.head);
  capsule(B.UARM_L, seg.uarmL);
  capsule(B.UARM_R, seg.uarmR);
  capsule(B.LARM_L, seg.larmL);
  capsule(B.LARM_R, seg.larmR);
  capsule(B.FING_L, seg.fingL);
  capsule(B.FING_R, seg.fingR);
  capsule(B.THIGH_L, seg.thighL);
  capsule(B.THIGH_R, seg.thighR);
  box(B.TORSO);
  box(B.SHANK_L);
  box(B.SHANK_R);
  const all = {lo: [Infinity, Infinity, Infinity], hi: [-Infinity, -Infinity, -Infinity]};
  for (let i = 0; i < NC; i++) p.extent('cone', i, all.lo, all.hi);
  for (let i = 0; i < NE; i++) p.extent('ell', i, all.lo, all.hi);
  const PAD = 0.03; // room for the anti-aliased halo
  return {
    cones: p.cones,
    ellC: p.ellC,
    ellR: p.ellR,
    ellM: p.ellM,
    bounds,
    boxMin: [all.lo[0] - PAD, all.lo[1] - PAD, all.lo[2] - PAD],
    boxMax: [all.hi[0] + PAD, all.hi[1] + PAD, all.hi[2] + PAD],
    joints,
    lean,
  };
};

/* ------------------------------------------------------------------ shader */

/** Fixed (constant-index) primitive calls, for the torso and the head. */
const cn = (i: number) => `sdRC(p, uC[${i * 2}], uC[${i * 2 + 1}])`;
const el = (i: number) => `sdEl(uEM[${i}] * (p - uEC[${i}].xyz), uER[${i}].xyz)`;

/** Ray-march budget (same at every quality: the silhouette never depends on it). */
const STEPS = 64;

const VERT = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const FRAG = /* glsl */ `
  // Groups nearer than MARGIN to a point are evaluated exactly; farther ones enter the same smooth
  // union with their bound distance (a lower bound, so the march stays safe; MARGIN >= every join's
  // blend radius, so the surface is exactly the full evaluation's).
  #define MARGIN 0.05
  // A ray must pass this close to a group's bound for the group to exist for that pixel at all.
  #define RAYPAD 0.05
  uniform vec4 uC[${NC * 2}];
  uniform vec4 uEC[${NE}];
  uniform vec4 uER[${NE}];
  uniform mat3 uEM[${NE}];
  uniform vec4 uB[${NB * 2}];
  uniform mat4 uInvModel;
  uniform mat4 uModel;
  uniform mat4 uProj;
  uniform vec3 uBoxMin;
  uniform vec3 uBoxMax;
  uniform vec2 uPix;
  uniform vec3 uCore;
  uniform vec3 uRim;
  uniform float uOpacity;
  uniform float uTime;
  uniform float uLines;
  uniform float uSparkle;
  uniform float uScan;
  // Loop bounds come from uniforms so the D3D compiler cannot unroll them (uZero = 0, uSteps = ${STEPS}).
  uniform int uZero;
  uniform int uSteps;
  uniform bool uAO;
  #ifdef USE_FOG
    uniform vec3 fogColor;
    uniform float fogDensity;
    uniform float fogNear;
    uniform float fogFar;
  #endif
  varying vec3 vWorld;

  float smin(float a, float b, float k) {
    float h = max(k - abs(a - b), 0.0) / k;
    return min(a, b) - h * h * k * 0.25;
  }
  // Round cone (iq): sphere A.w at A.xyz to sphere B.w at B.xyz.
  float sdRC(vec3 p, vec4 A, vec4 B) {
    vec3 ba = B.xyz - A.xyz;
    float l2 = max(dot(ba, ba), 1e-8);
    float rr = A.w - B.w;
    float a2 = max(l2 - rr * rr, 1e-8);
    float il2 = 1.0 / l2;
    vec3 pa = p - A.xyz;
    float y = dot(pa, ba);
    float z = y - l2;
    vec3 xv = pa * l2 - ba * y;
    float x2 = dot(xv, xv);
    float y2 = y * y * l2;
    float z2 = z * z * l2;
    float k = sign(rr) * rr * rr * x2;
    if (sign(z) * a2 * z2 > k) return sqrt(x2 + z2) * il2 - B.w;
    if (sign(y) * a2 * y2 < k) return sqrt(x2 + y2) * il2 - A.w;
    return (sqrt(x2 * a2 * il2) + y * rr) * il2 - A.w;
  }
  float sdEl(vec3 q, vec3 r) {
    float k0 = length(q / r);
    float k1 = max(length(q / (r * r)), 1e-6);
    return k0 * (k0 - 1.0) / k1;
  }
  float sdRBox(vec3 q, vec3 h, float r) {
    vec3 d = abs(q) - (h - r);
    return length(max(d, 0.0)) + min(max(d.x, max(d.y, d.z)), 0.0) - r;
  }
  float sdSeg(vec3 p, vec3 a, vec3 b) {
    vec3 pa = p - a;
    vec3 ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-8), 0.0, 1.0);
    return length(pa - ba * h);
  }
  // Indexed primitives (the side loops).
  float cone(int i, vec3 p) { return sdRC(p, uC[i * 2], uC[i * 2 + 1]); }
  float ell(int i, vec3 p) { return sdEl(uEM[i] * (p - uEC[i].xyz), uER[i].xyz); }
  // Distance to a group's bound (a lower bound of the distance to the group).
  float bnd(int k, vec3 p) {
    vec4 a = uB[k * 2];
    vec4 b = uB[k * 2 + 1];
    if (b.w > 0.5) {
      vec3 q = abs(p - a.xyz) - b.xyz;
      return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
    }
    return sdSeg(p, a.xyz, b.xyz) - a.w;
  }

  // Which groups this pixel's ray comes near (set once per pixel in main): the others do not exist for it.
  bool gA[${NB}];

  float sdTorso(vec3 p) {
    // pelvis, seat, abdomen, ribcage, lats, shoulder girdle, trapezius, shoulder blades, spine
    float t = ${el(E.PELVIS)};
    t = smin(t, ${el(E.BUTT_L)}, 0.04);
    t = smin(t, ${el(E.BUTT_R)}, 0.04);
    t = smin(t, ${el(E.ABDOMEN)}, 0.07);
    t = smin(t, ${el(E.CHEST)}, 0.07);
    t = smin(t, ${el(E.LATS)}, 0.06);
    t = smin(t, ${el(E.GIRDLE)}, 0.06);
    t = smin(t, ${cn(C.TRAP_L)}, 0.05);
    t = smin(t, ${cn(C.TRAP_R)}, 0.05);
    t = smin(t, ${el(E.SCAP_L)}, 0.045);
    t = smin(t, ${el(E.SCAP_R)}, 0.045);
    // the spine groove: a smooth subtraction
    t = -smin(-t, min(${cn(C.SPINE_LO)}, ${cn(C.SPINE_HI)}), 0.02);
    return t;
  }

  float sdHead(vec3 p) {
    float h = smin(${el(E.CRANIUM)}, sdRBox(uEM[${E.JAW}] * (p - uEC[${E.JAW}].xyz), uER[${E.JAW}].xyz, uER[${E.JAW}].w), 0.04);
    h = smin(h, min(${el(E.EAR_L)}, ${el(E.EAR_R)}), 0.016);
    return smin(h, ${cn(C.NECK)}, 0.04);
  }

  float sdBody(vec3 p) {
    float t = 1e3;
    if (gA[${B.TORSO}]) {
      float b = bnd(${B.TORSO}, p);
      t = b < MARGIN ? sdTorso(p) : b;
    }
    if (gA[${B.HEAD}]) {
      float b = bnd(${B.HEAD}, p);
      if (b < MARGIN) t = smin(t, sdHead(p), 0.045);
      else t = smin(t, b, 0.045);
    }
    // legs: thigh + knee, shank (shin, calf, foot, toes); the thigh joins the hip
    for (int s = uZero; s < 2; s++) {
      bool aT = gA[${B.THIGH_L} + s];
      bool aS = gA[${B.SHANK_L} + s];
      if (!aT && !aS) continue;
      float bt = aT ? bnd(${B.THIGH_L} + s, p) : 1e3;
      float bs = aS ? bnd(${B.SHANK_L} + s, p) : 1e3;
      float th = bt < MARGIN ? smin(cone(${C.THIGH_L} + s, p), ell(${E.KNEE_L} + s, p), 0.035) : bt;
      float sh = bs;
      if (bs < MARGIN) {
        sh = smin(cone(${C.SHIN_L} + s, p), ell(${E.CALF_L} + s, p), 0.04);
        sh = smin(sh, smin(cone(${C.FOOT_L} + s, p), ell(${E.TOES_L} + s, p), 0.02), 0.03);
      }
      t = smin(t, smin(th, sh, 0.03), 0.05);
    }
    // arms: the upper arm blends into the shoulder; forearm + hand join it at the elbow and are a
    // hard union with everything else (a hand on the desk or the mouse stays crisp)
    float arms = 1e3;
    for (int s = uZero; s < 2; s++) {
      float ub = gA[${B.UARM_L} + s] ? bnd(${B.UARM_L} + s, p) : 1e3;
      float lb = gA[${B.LARM_L} + s] ? bnd(${B.LARM_L} + s, p) : 1e3;
      if (ub >= 1e2 && lb >= 1e2) continue;
      float u = ub;
      if (ub < MARGIN) {
        u = smin(ell(${E.DELT_L} + s, p), cone(${C.UARM_L} + s, p), 0.03);
        t = smin(t, u, 0.045);
      } else {
        t = smin(t, ub, 0.045);
      }
      float a = smin(u, lb, 0.025);
      if (lb < MARGIN) {
        float f = smin(cone(${C.FARM_L} + s, p), ell(${E.FMUS_L} + s, p), 0.03);
        float h = ell(${E.PALM_L} + s, p);
        float fb = gA[${B.FING_L} + s] ? bnd(${B.FING_L} + s, p) : 1e3;
        if (fb < 0.02) {
          int fi = ${C.FING_L} + s * 10;
          float g = 1e3;
          for (int i = uZero; i < 4; i++) g = smin(g, smin(cone(fi + i * 2, p), cone(fi + i * 2 + 1, p), 0.006), 0.003);
          int ti = ${C.THUMB_L} + s * 10;
          h = smin(h, g, 0.011);
          h = smin(h, smin(cone(ti, p), cone(ti + 1, p), 0.006), 0.012);
        } else {
          h = smin(h, fb, 0.012);
        }
        a = smin(u, smin(f, h, 0.02), 0.025);
      }
      arms = min(arms, a);
    }
    return min(t, arms);
  }

  float hash13(vec3 p3) {
    p3 = fract(p3 * 0.1031);
    p3 += dot(p3, p3.zyx + 31.32);
    return fract((p3.x + p3.y) * p3.z);
  }
  vec3 hash33(vec3 p3) {
    p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yxz + 33.33);
    return fract((p3.xxy + p3.yxx) * p3.zyx);
  }
  // Ray vs capsule (iq): distance to the first hit, or -1.
  float capHit(vec3 ro, vec3 rd, vec3 pa, vec3 pb, float r) {
    vec3 ba = pb - pa;
    vec3 oa = ro - pa;
    float baba = dot(ba, ba);
    float bard = dot(ba, rd);
    float baoa = dot(ba, oa);
    float rdoa = dot(rd, oa);
    float oaoa = dot(oa, oa);
    float a = max(baba - bard * bard, 1e-9);
    float b = baba * rdoa - baoa * bard;
    float c = baba * oaoa - baoa * baoa - r * r * baba;
    float h = b * b - a * c;
    if (h >= 0.0) {
      float t = (-b - sqrt(h)) / a;
      float y = baoa + t * bard;
      if (y > 0.0 && y < baba) return t;
      vec3 oc = y <= 0.0 ? oa : ro - pb;
      b = dot(rd, oc);
      c = dot(oc, oc) - r * r;
      h = b * b - c;
      if (h > 0.0) return -b - sqrt(h);
    }
    return -1.0;
  }

  void main() {
    // Ray in figure space (handles perspective and orthographic cameras).
    vec3 rdW = isOrthographic ? normalize(-vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2])) : normalize(vWorld - cameraPosition);
    vec3 roW = isOrthographic ? vWorld - rdW * 20.0 : cameraPosition;
    vec3 ro = (uInvModel * vec4(roW, 1.0)).xyz;
    vec3 rd = (uInvModel * vec4(rdW, 0.0)).xyz;
    float sc = max(length(rd), 1e-6); // local units per world unit
    rd /= sc;
    vec3 rs = vec3(abs(rd.x) < 1e-6 ? 1e-6 : rd.x, abs(rd.y) < 1e-6 ? 1e-6 : rd.y, abs(rd.z) < 1e-6 ? 1e-6 : rd.z);
    vec3 ta = (uBoxMin - ro) / rs;
    vec3 tb = (uBoxMax - ro) / rs;
    float tf = min(min(max(ta.x, tb.x), max(ta.y, tb.y)), max(ta.z, tb.z));

    // Which groups does this ray come near (activation, grown by RAYPAD), where does the march start
    // (just outside the first bound it really enters, or the grown one) and where can it stop?
    float tn = 1e9;
    float tx = -1.0;
    for (int k = uZero; k < ${NB}; k++) {
      vec4 a = uB[k * 2];
      vec4 b = uB[k * 2 + 1];
      float e = -1.0;
      float x = -1.0;
      if (b.w > 0.5) {
        vec3 t0 = (a.xyz - b.xyz - RAYPAD - ro) / rs;
        vec3 t1 = (a.xyz + b.xyz + RAYPAD - ro) / rs;
        vec3 mn = min(t0, t1);
        vec3 mx = max(t0, t1);
        float en = max(max(mn.x, mn.y), mn.z);
        float ex = min(min(mx.x, mx.y), mx.z);
        if (ex > max(en, 0.0)) {
          x = ex;
          e = max(en, 0.0);
          vec3 u0 = (a.xyz - b.xyz - 0.02 - ro) / rs;
          vec3 u1 = (a.xyz + b.xyz + 0.02 - ro) / rs;
          vec3 un = min(u0, u1);
          vec3 ux = max(u0, u1);
          float ue = max(max(un.x, un.y), un.z);
          if (min(min(ux.x, ux.y), ux.z) > max(ue, 0.0)) e = max(ue, 0.0);
        }
      } else {
        // closest approach of the ray to the bound's segment
        vec3 ba = b.xyz - a.xyz;
        vec3 oa = ro - a.xyz;
        float bb = dot(ba, ba);
        float bd = dot(ba, rd);
        float den = max(bb - bd * bd, 1e-9);
        float u = clamp((dot(oa, ba) - dot(oa, rd) * bd) / den, 0.0, 1.0);
        float sr = max(dot(a.xyz + ba * u - ro, rd), 0.0);
        u = clamp(dot(ro + rd * sr - a.xyz, ba) / max(bb, 1e-9), 0.0, 1.0);
        vec3 cp = a.xyz + ba * u;
        float tc = max(dot(cp - ro, rd), 0.0);
        float dmin = length(ro + rd * tc - cp);
        float R = a.w + RAYPAD;
        if (dmin < R) {
          // exit: leaving the sphere around the grown capsule
          vec3 c = a.xyz + ba * 0.5;
          float Rs = 0.5 * sqrt(bb) + R;
          vec3 v = c - ro;
          float tcs = dot(v, rd);
          float sq = sqrt(max(Rs * Rs - (dot(v, v) - tcs * tcs), 0.0));
          x = tcs + sq;
          float th = sdSeg(ro, a.xyz, b.xyz) < a.w + 0.02 ? 0.0 : capHit(ro, rd, a.xyz, b.xyz, a.w + 0.02);
          e = th >= 0.0 ? th : max(tcs - sq, 0.0);
        }
      }
      gA[k] = e >= 0.0;
      if (e >= 0.0) {
        tn = min(tn, e);
        tx = max(tx, x);
      }
    }
    tf = min(tf, tx);
    if (tn >= tf) discard;

    // One loop, one distance function: the march (over-relaxed sphere tracing, Keinert et al. 2014),
    // then 3 forward-difference normal samples, then (full quality) 4 occlusion / thickness samples.
    int phase = 0;
    int sub = 0;
    int steps = 0;
    float t = tn;
    bool hit = false;
    float dPrev = 1e5;
    float fpPrev = 1.0;
    bool falling = false;
    float graze = 1e5;
    float missPx = 1e5;
    float tMiss = tn;
    float omega = 1.6;
    float stepLen = 0.0;
    float prevR = 0.0;
    vec3 hp = vec3(0.0);
    float hN = 0.001;
    vec3 nAcc = vec3(0.0);
    float d0 = 0.0;
    vec3 n = vec3(0.0, 1.0, 0.0);
    float occ = 0.0;
    float thin = 0.0;
    int total = uSteps + 10;
    for (int i = uZero; i < total; i++) {
      vec3 e = vec3(sub == 0 ? 1.0 : 0.0, sub == 1 ? 1.0 : 0.0, sub == 2 ? 1.0 : 0.0);
      float ah = sub == 0 ? 0.012 : (sub == 1 ? 0.03 : (sub == 2 ? 0.06 : -0.024));
      vec3 q = phase == 0 ? ro + rd * t : (phase == 1 ? hp + e * hN : hp + n * ah);
      float d = sdBody(q);
      if (phase == 0) {
        steps++;
        float fp = uPix.x * t + uPix.y * sc;
        if (omega > 1.0 && abs(d) + prevR < stepLen) {
          // the long step overshot: go back to a safe point, and stop relaxing
          t += stepLen * (1.0 - omega);
          stepLen = 0.0;
          prevR = 0.0;
          omega = 1.0;
          continue;
        }
        if (d < 0.5 * fp) {
          hit = true;
          hp = q;
          hN = max(0.0007, fp * 0.5);
          d0 = d;
          phase = 1;
          continue;
        }
        float px = d / fp;
        if (px < missPx) {
          missPx = px;
          tMiss = t;
        }
        if (d > dPrev) {
          if (falling) graze = min(graze, dPrev / fpPrev);
          falling = false;
        } else {
          falling = true;
        }
        dPrev = d;
        fpPrev = fp;
        // Near the surface the relaxation is dropped (grazing rays along a silhouette stay exact).
        if (px < 4.0) omega = 1.0;
        stepLen = max(d * omega, 0.4 * fp);
        prevR = d;
        t += stepLen;
        if (t > tf || steps >= uSteps) break;
      } else if (phase == 1) {
        nAcc += e * (d - d0);
        sub++;
        if (sub == 3) {
          float l = length(nAcc);
          n = l > 1e-9 ? nAcc / l : vec3(0.0, 1.0, 0.0);
          if (!uAO) break;
          phase = 2;
          sub = 0;
        }
      } else {
        float w = sub == 0 ? 1.0 : (sub == 1 ? 0.6 : 0.35);
        if (sub < 3) occ += (ah - d) * (w / ah);
        else thin = 1.0 - clamp(-d / 0.024, 0.0, 1.0);
        sub++;
        if (sub == 4) break;
      }
    }

    vec3 p = hit ? hp : ro + rd * tMiss;
    float tt = hit ? t : tMiss;
    float fp = uPix.x * tt + uPix.y * sc;
    float fade = mix(0.42, 1.0, smoothstep(0.06, 0.72, p.y));
    vec3 col;
    float alpha;
    if (hit) {
      float ndv = clamp(dot(n, -rd), 0.0, 1.0);
      float fr = 1.0 - ndv;
      float fres = fr * fr;
      // Soft form light from above / the screen side, so the body has volume without scene lights.
      float key = 0.5 + 0.5 * dot(n, normalize(vec3(0.15, 0.85, -0.5)));
      // Occlusion from the distance field (creases, armpits, the lap, between the fingers go darker)
      // and light through thin parts (fingers, ears, wrists): full quality only.
      float ao = uAO ? clamp(1.0 - 0.55 * occ, 0.0, 1.0) : 1.0;
      float body = (0.07 + 0.2 * key * key) * mix(0.3, 1.0, ao) + 0.6 * fres * mix(0.6, 1.0, ao) + 0.22 * thin;
      col = uCore * body;
      // Silhouette light.
      col += uRim * (0.9 * fres * fres * fr + 0.05 * fres);
      // Contour lines: thin horizontal slices in body space, brighter toward the rim.
      float pitch = 0.013;
      float w = fp * sqrt(max(1.0 - n.y * n.y, 0.0)) / max(ndv, 0.12) + 1e-5;
      float dl = abs(fract(p.y / pitch + 0.5) - 0.5) * pitch;
      float hw = 0.0005;
      float ln = clamp((hw - dl) / w + 0.5, 0.0, 1.0) * min(1.0, 2.0 * hw / w + 0.35);
      ln *= clamp(1.7 - 2.4 * w / pitch, 0.0, 1.0);
      // A slow scan wave climbs the body and lights the contour lines as it passes.
      float yb = -0.15 + 1.75 * fract(uTime * 0.055);
      // Square by multiplication: pow() of a negative base is undefined in GLSL (on D3D it lit everything below the band).
      float dy = (p.y - yb) / 0.07;
      float wave = exp(-dy * dy) * uScan;
      col += uRim * ln * uLines * (0.055 + 0.5 * fres + 0.5 * wave);
      col += uCore * wave * 0.18;
      // Sparse static sparkles (a lattice in body space), twinkling slowly with time.
      vec3 g = p / 0.009;
      vec3 ci = floor(g);
      float hs = hash13(ci + 17.0);
      if (hs > 0.9) {
        vec3 c = ci + 0.25 + 0.5 * hash33(ci);
        float dd = length(g - c) * 0.009;
        float r0 = 0.0009;
        float r = max(r0, fp * 0.7);
        float sp = (r0 * r0) / (r * r) * (1.0 - smoothstep(0.0, r, dd));
        sp *= 0.55 + 0.45 * sin(uTime * 1.7 + hs * 97.0);
        col += uRim * sp * 2.4 * uSparkle;
      }
      // Inner contour where a near limb passes in front of the body behind it.
      float edge = 1.0 - smoothstep(0.3, 1.6, graze);
      col += uRim * edge * 0.75;
      alpha = 1.0;
    } else {
      // Missed: a one-pixel anti-aliased halo of silhouette light.
      alpha = clamp(1.0 - (missPx - 0.25) / 1.1, 0.0, 1.0);
      alpha *= alpha;
      if (alpha < 0.004) discard;
      col = uRim * 0.8;
    }
    col *= fade;

    vec3 hw = (uModel * vec4(p, 1.0)).xyz;
    #ifdef USE_FOG
      float fogDepth = length(hw - cameraPosition);
      #ifdef FOG_EXP2
        float fogFactor = 1.0 - exp(-fogDensity * fogDensity * fogDepth * fogDepth);
      #else
        float fogFactor = smoothstep(fogNear, fogFar, fogDepth);
      #endif
      col = mix(col, fogColor, fogFactor);
    #endif

    vec4 clip = uProj * viewMatrix * vec4(hw, 1.0);
    gl_FragDepth = clamp(clip.z / clip.w * 0.5 + 0.5, 0.0, 1.0);
    gl_FragColor = vec4(col, alpha * uOpacity);
  }
`;

const makeMaterial = () =>
  new THREE.ShaderMaterial({
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uC: {value: new Float32Array(NC * 8)},
      uEC: {value: new Float32Array(NE * 4)},
      uER: {value: new Float32Array(NE * 4).fill(0.01)},
      uEM: {value: new Float32Array(NE * 9)},
      uB: {value: new Float32Array(NB * 8)},
      uInvModel: {value: new THREE.Matrix4()},
      uModel: {value: new THREE.Matrix4()},
      uProj: {value: new THREE.Matrix4()},
      uBoxMin: {value: new THREE.Vector3()},
      uBoxMax: {value: new THREE.Vector3()},
      uPix: {value: new THREE.Vector2(0.001, 0)},
      uCore: {value: new THREE.Color()},
      uRim: {value: new THREE.Color()},
      uOpacity: {value: 1},
      uTime: {value: 0},
      uLines: {value: 1},
      uSparkle: {value: 1},
      uScan: {value: 1},
      uZero: {value: 0},
      uSteps: {value: STEPS},
      uAO: {value: true},
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: true,
    depthTest: true,
    side: THREE.BackSide,
    fog: true,
  });

/* ------------------------------------------------------------------ component */

const local = (w: Vec3, origin: readonly number[]): Vec3 => [w[0] - origin[0], w[1] - origin[1], w[2] - origin[2]];
const finite = (x: number, fb = 0) => (Number.isFinite(x) ? x : fb);

/**
 * Material slots (shot editor, via useLook):
 *   core  colour of the body's light; emissive intensity = body brightness
 *   rim   colour of the silhouette / contour light; emissive intensity = rim brightness
 */
export const HoloFigure: React.FC<HoloFigureProps> = ({position, pose = {}, time = 0, keyboard, enter, mouse, chair, lines = 1, sparkle = 1, scan = 1}) => {
  const th = useTheme();
  const core = useLook('core', {color: th.tone.system.base, emissiveIntensity: 0.4});
  const rim = useLook('rim', {color: th.tone.system.hot, emissiveIntensity: 2.0});
  const off = useObjectOffset();
  // Occlusion / thin-part glow only at full quality (exports, ?quality=full); identical silhouette at every quality.
  const fullQuality = useStageQuality().name === 'full';
  const material = useMemo(makeMaterial, []);
  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  useEffect(
    () => () => {
      material.dispose();
      geometry.dispose();
    },
    [material, geometry],
  );
  const mesh = useRef<THREE.Mesh>(null);

  // Where the body really is (its position plus any offset the shot applied), so the hands still land.
  const origin = [position[0] + off[0], position[1] + off[1], position[2] + off[2]];
  const rig = holoFigureRig({
    pose,
    time: finite(time),
    keyboard: local(keyboard, origin),
    enter: local(enter, origin),
    mouse: local(mouse, origin),
    chair,
  });

  const u = material.uniforms;
  (u.uC.value as Float32Array).set(rig.cones);
  (u.uEC.value as Float32Array).set(rig.ellC);
  (u.uER.value as Float32Array).set(rig.ellR);
  (u.uEM.value as Float32Array).set(rig.ellM);
  (u.uB.value as Float32Array).set(rig.bounds);
  (u.uBoxMin.value as THREE.Vector3).set(...rig.boxMin);
  (u.uBoxMax.value as THREE.Vector3).set(...rig.boxMax);
  (u.uCore.value as THREE.Color).set(core.color).multiplyScalar(Math.max(0, core.emissiveIntensity));
  (u.uRim.value as THREE.Color).set(rim.color).multiplyScalar(Math.max(0, rim.emissiveIntensity));
  u.uOpacity.value = clamp01(core.opacity);
  u.uTime.value = finite(time);
  u.uLines.value = Math.max(0, lines);
  u.uSparkle.value = Math.max(0, sparkle);
  u.uScan.value = Math.max(0, scan);
  u.uAO.value = fullQuality;
  material.depthWrite = core.opacity >= 0.999;

  // Camera-dependent uniforms are set per draw (the editor may draw with another camera).
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const size = new THREE.Vector2();
    m.onBeforeRender = (renderer, _scene, camera) => {
      const parent = m.parent;
      if (!parent) return;
      (u.uModel.value as THREE.Matrix4).copy(parent.matrixWorld);
      (u.uInvModel.value as THREE.Matrix4).copy(parent.matrixWorld).invert();
      (u.uProj.value as THREE.Matrix4).copy(camera.projectionMatrix);
      const rt = renderer.getRenderTarget();
      const h = rt ? rt.height : renderer.getDrawingBufferSize(size).y;
      const px = u.uPix.value as THREE.Vector2;
      const cam = camera as THREE.PerspectiveCamera & THREE.OrthographicCamera;
      if (cam.isOrthographicCamera) px.set(0, (cam.top - cam.bottom) / Math.max(1e-6, cam.zoom) / Math.max(1, h));
      else px.set((2 * Math.tan(((cam.fov ?? 30) * Math.PI) / 360)) / Math.max(1, cam.zoom ?? 1) / Math.max(1, h), 0);
    };
    return () => {
      m.onBeforeRender = () => undefined;
    };
  }, [u]);

  const c: [number, number, number] = [(rig.boxMin[0] + rig.boxMax[0]) / 2, (rig.boxMin[1] + rig.boxMax[1]) / 2, (rig.boxMin[2] + rig.boxMax[2]) / 2];
  const s: [number, number, number] = [rig.boxMax[0] - rig.boxMin[0], rig.boxMax[1] - rig.boxMin[1], rig.boxMax[2] - rig.boxMin[2]];
  return (
    <group position={[position[0], position[1], position[2]]}>
      <mesh ref={mesh} geometry={geometry} material={material} position={c} scale={s} userData={{noEdges: true}} castShadow={false} receiveShadow={false} renderOrder={-1} />
    </group>
  );
};
