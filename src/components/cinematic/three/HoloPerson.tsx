import {useThree} from '@react-three/fiber';
import React, {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {cancelRender, continueRender, delayRender, staticFile, useRemotionEnvironment} from 'remotion';
import * as THREE from 'three';
import {GLTFLoader, type GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {clone as cloneSkinned} from 'three/addons/utils/SkeletonUtils.js';
import {useLook, useObjectOffset} from '../../../shot/runtime';
import {useTheme} from '../../../styles/ThemeContext';
import type {Vec3} from '../../cyber/three/rig';
import type {ChairEnvelope, HoloFigureProps, HoloPose} from './HoloFigure';

/**
 * John, a seated man made of light, built on a real human body: the CC0
 * Quaternius "Universal Base Characters" male (public/models/john, one
 * 65-bone rig, body + short side-parted hair, no eyes, no textures).
 * Same props as HoloFigure (pose, targets, chair envelope); a pure function
 * of them: no clocks, no randomness, no animation loop.
 *
 * The model, once at load (`buildPersonTemplate`):
 *   - re-proportioned in its bind pose, so the heroic base reads as an
 *     ordinary fit man in his thirties: every bone gets a scale in its own
 *     axes (slimmer chest, lats, neck, arms and thighs, narrower shoulders, a
 *     longer upper arm and smaller hands: the base's upper arm is ~5 cm short
 *     of a real man's), the vertices are re-skinned with those scales and the
 *     skeleton is re-bound; then he is stood back on the floor and scaled to
 *     1.78 m;
 *   - the bodybuilder's definition softened (Taubin smoothing, volume
 *     preserving, welded across UV seams; light on the face, none on the hands);
 *   - two twist bones per forearm (mid-forearm and wrist), with the forearm
 *     weights spread along them, so pronating the hand onto the keys rolls the
 *     whole forearm instead of wringing the wrist;
 *   - what is drawn is that mesh after one Loop subdivision (smooth silhouettes
 *     and contour lines); the solver's CPU probes skin the coarse mesh.
 *
 * The pose, every render (`solvePerson`): forward kinematics on plain arrays,
 * in the model's own space (facing +z; the group turns it to face -z):
 *   - torso: the pelvis tilted back as in sitting, the spine curving forward
 *     progressively until the trunk line has the lean's pitch; sitting back
 *     rolls the pelvis back, slides the hips forward and rounds the upper back
 *     (a relaxed slouch), so the trunk reclines while the hands still reach;
 *     the lean is limited when a hand could not reach what it holds;
 *   - seat: the buttocks rest on the cushion (their lowest vertices, skinned on
 *     the CPU, 2 mm above the cushion's rounded box), each thigh is lowered
 *     until its underside rests on it too, and the back stays in front of the
 *     backrest; solved once per lean (cached: breathing does not move it);
 *   - legs: shins to the floor, feet flat (the heel lifts a little when the
 *     floor is out of reach: the chair is high for a barefoot man);
 *   - arms: analytic two-bone IK, elbows hanging down and a little out, swung
 *     up just enough for the forearm to clear the desk edge, keyboard and
 *     mouse; the hand frame comes from the task (home row, Enter, a palm grip
 *     on the mouse, resting on the desk) and the palm is settled 2 mm above
 *     what is under it; the forearm twist is spread over the twist bones;
 *   - fingers: each finger curls (MCP / PIP / DIP coupled, with real joint
 *     limits) until its fingertip vertices touch what is under them (key tops,
 *     mouse shell, desk) with a small hover; typing presses a finger down to
 *     the key (never lifts); the thumb is aimed at a target and bent to reach.
 *
 * The look (`HOLO_VERT` / `HOLO_FRAG`): opaque (depth-writing, so the chair's
 * mesh back veils him), a dim emissive core with a soft form light, a bright
 * fresnel rim, fine horizontal contour lines in figure space (anti-aliased in
 * screen space, brighter toward the rim, denser on the hair), a few static
 * sparkles and a slow scan band from `time`. Only the rim and the lines near
 * it reach the bloom threshold.
 *
 * Loading: `staticFile('models/john/john.glb')` through one module-level
 * promise; the first frame is held with delayRender until the model is in the
 * scene and drawn, so headless renders never capture a frame without him.
 */

/* ------------------------------------------------------------------ math helpers */

type V = THREE.Vector3;
type Q = THREE.Quaternion;
const v3 = (x = 0, y = 0, z = 0): V => new THREE.Vector3(x, y, z);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const clamp01 = (x: number) => clamp(x, 0, 1);
const smooth = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
const finite = (x: number, fb = 0) => (Number.isFinite(x) ? x : fb);
const X = v3(1, 0, 0);
const Y = v3(0, 1, 0);
const Z = v3(0, 0, 1);
const ONE = v3(1, 1, 1);
const axisQ = (axis: V, a: number): Q => new THREE.Quaternion().setFromAxisAngle(axis, a);
const rx = (a: number) => axisQ(X, a);
const ry = (a: number) => axisQ(Y, a);
const rz = (a: number) => axisQ(Z, a);
const mulQ = (...qs: Q[]): Q => qs.reduce((acc, q) => acc.multiply(q), new THREE.Quaternion());
const anyPerp = (a: V): V => (Math.abs(a.y) < 0.9 ? new THREE.Vector3().crossVectors(a, Y) : new THREE.Vector3().crossVectors(a, X)).normalize();
/** Orthonormal basis (columns) whose x is `a` and whose y is `b` made perpendicular to it. */
const basis = (a: V, b: V): THREE.Matrix4 => {
  const x = a.clone().normalize();
  let z = new THREE.Vector3().crossVectors(x, b);
  if (z.lengthSq() < 1e-10) z = anyPerp(x);
  z.normalize();
  const y = new THREE.Vector3().crossVectors(z, x);
  return new THREE.Matrix4().makeBasis(x, y, z);
};
/** The rotation taking frame (a0, b0) to (a, b): a0 -> a exactly, b0 -> b as closely as possible. */
const frameQuat = (a0: V, b0: V, a: V, b: V): Q => new THREE.Quaternion().setFromRotationMatrix(basis(a, b).multiply(basis(a0, b0).transpose()));
/** Signed angle of the twist of `q` about the unit `axis` (swing-twist decomposition), in (-pi, pi]. */
const twistAngle = (q: Q, axis: V): number => {
  const p = q.x * axis.x + q.y * axis.y + q.z * axis.z;
  let a = 2 * Math.atan2(p, q.w);
  if (a > Math.PI) a -= 2 * Math.PI;
  if (a < -Math.PI) a += 2 * Math.PI;
  return a;
};
/** Minimal rotation taking unit `a` to unit `b`, limited to `max` radians. */
const swingQ = (a: V, b: V, max = Math.PI): Q => {
  const q = new THREE.Quaternion().setFromUnitVectors(a, b);
  const ang = 2 * Math.acos(clamp(q.w, -1, 1));
  if (ang <= max) return q;
  return new THREE.Quaternion().slerp(q, max / ang);
};

/* ------------------------------------------------------------------ the model */

const MODEL = 'models/john/john.glb';
/** Standing height, hair included (m). */
const STATURE = 1.78;
const SIDES = ['l', 'r'] as const;
type Side = (typeof SIDES)[number];
/** +1 = his left (+x in model space), -1 = his right (-x). */
const sgn = (s: Side) => (s === 'l' ? 1 : -1);
const FINGERS = ['index', 'middle', 'ring', 'pinky'] as const;

/**
 * Bone-local geometry scale (x, y = along the bone, z). The base is a comic
 * "superhero": a deep chest and wide lats, broad shoulders, a thick neck,
 * heavy arms, big hands and a short upper arm. These make it an ordinary fit
 * man; the vertices follow through their skin weights, so the changes blend.
 */
const SHAPE: Record<string, readonly [number, number, number]> = {
  pelvis: [0.92, 1, 0.96],
  spine_01: [0.97, 1, 0.94],
  spine_02: [0.92, 1, 0.88],
  spine_03: [0.86, 1, 0.85],
  neck_01: [0.82, 1.06, 0.88],
  Head: [1.06, 1.06, 1.06],
  clavicle: [0.84, 0.9, 0.82],
  upperarm: [0.8, 1.2, 0.8],
  lowerarm: [0.84, 1.07, 0.84],
  hand: [0.9, 0.9, 0.9],
  thigh: [0.86, 1.05, 0.86],
  calf: [0.92, 1.06, 0.92],
  foot: [0.95, 0.96, 0.95],
  ball: [0.95, 0.96, 0.95],
  ball_leaf: [0.95, 0.96, 0.95],
};
const FINGER_SHAPE = [0.86, 0.92, 0.86] as const;
const baseName = (n: string) => n.replace(/_(l|r)$/, '');
const shapeOf = (name: string): readonly [number, number, number] => {
  const b = baseName(name);
  if (SHAPE[b]) return SHAPE[b];
  if (/^(index|middle|ring|pinky|thumb)_/.test(b)) return FINGER_SHAPE;
  return [1, 1, 1];
};

export type PersonTemplate = {
  readonly scene: THREE.Group;
  readonly meshes: readonly THREE.SkinnedMesh[];
  readonly names: readonly string[];
  readonly index: ReadonlyMap<string, number>;
  readonly parent: readonly number[];
  readonly children: readonly (readonly number[])[];
  readonly order: readonly number[];
  readonly restPos: readonly V[];
  readonly restQuat: readonly Q[];
  readonly restWPos: readonly V[];
  readonly restWQuat: readonly Q[];
  readonly inverses: readonly THREE.Matrix4[];
  /** Body mesh: bind positions, skin indices / weights (the CPU probes skin these). */
  readonly bind: Float32Array;
  readonly si: Uint16Array;
  readonly sw: Float32Array;
  /** Vertex subsets of the body mesh. */
  readonly probes: {
    /** Buttocks (they carry him on the seat) and the backs of the thighs, per side. */
    readonly seat: Int32Array;
    readonly thigh: Readonly<Record<Side, Int32Array>>;
    readonly back: Int32Array;
    readonly palm: Readonly<Record<Side, Int32Array>>;
    /** The palm with the ball of the thumb (for a grip, where the thumb's base wraps the object). */
    readonly thenar: Readonly<Record<Side, Int32Array>>;
    readonly forearm: Readonly<Record<Side, Int32Array>>;
    readonly tips: Readonly<Record<string, Int32Array>>;
  };
};

/** Bones of a vertex set with total weight >= `min` on any of `bones`. */
const selectVerts = (si: Uint16Array, sw: Float32Array, n: number, bones: readonly number[], min: number, keep?: (i: number) => boolean): Int32Array => {
  const set = new Set(bones);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    let w = 0;
    for (let k = 0; k < 4; k++) if (set.has(si[i * 4 + k])) w += sw[i * 4 + k];
    if (w >= min && (!keep || keep(i))) out.push(i);
  }
  return Int32Array.from(out);
};

/** Weld a vertex soup by position (UV seams split vertices that are one point of the surface). */
const weld = (pos: Float32Array) => {
  const n = pos.length / 3;
  const canon = new Int32Array(n);
  const ids = new Map<string, number>();
  const rep: number[] = [];
  for (let i = 0; i < n; i++) {
    const key = `${Math.round(pos[i * 3] * 2e4)},${Math.round(pos[i * 3 + 1] * 2e4)},${Math.round(pos[i * 3 + 2] * 2e4)}`;
    let c = ids.get(key);
    if (c === undefined) {
      c = rep.length;
      ids.set(key, c);
      rep.push(i);
    }
    canon[i] = c;
  }
  return {canon, rep};
};

/**
 * Taubin smoothing (lambda / mu, volume preserving) of a bind-pose mesh, welded by position so UV
 * seams stay closed; `mask(i)` (0..1) scales the smoothing per vertex. Normals are rebuilt from the
 * welded faces.
 */
const smoothBind = (pos: Float32Array, nor: Float32Array, index: ArrayLike<number>, mask: (i: number) => number, iterations = 10) => {
  const n = pos.length / 3;
  const {canon, rep} = weld(pos);
  const m = rep.length;
  const nb: Set<number>[] = Array.from({length: m}, () => new Set<number>());
  for (let t = 0; t + 2 < index.length; t += 3) {
    const a = canon[index[t]];
    const b = canon[index[t + 1]];
    const c = canon[index[t + 2]];
    nb[a].add(b).add(c);
    nb[b].add(a).add(c);
    nb[c].add(a).add(b);
  }
  const P = new Float32Array(m * 3);
  const K = new Float32Array(m);
  rep.forEach((i, c) => {
    P.set([pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]], c * 3);
    K[c] = clamp01(mask(i));
  });
  const lists = nb.map((s) => Int32Array.from(s));
  const D = new Float32Array(m * 3);
  for (let it = 0; it < iterations; it++) {
    for (const f of [0.5, -0.53]) {
      for (let c = 0; c < m; c++) {
        const l = lists[c];
        if (!l.length || K[c] <= 0) {
          D[c * 3] = D[c * 3 + 1] = D[c * 3 + 2] = 0;
          continue;
        }
        let x = 0;
        let y = 0;
        let z = 0;
        for (let q = 0; q < l.length; q++) {
          x += P[l[q] * 3];
          y += P[l[q] * 3 + 1];
          z += P[l[q] * 3 + 2];
        }
        const w = (f * K[c]) / l.length;
        D[c * 3] = w * (x - l.length * P[c * 3]);
        D[c * 3 + 1] = w * (y - l.length * P[c * 3 + 1]);
        D[c * 3 + 2] = w * (z - l.length * P[c * 3 + 2]);
      }
      for (let q = 0; q < m * 3; q++) P[q] += D[q];
    }
  }
  // Normals from the welded faces (area weighted).
  const N = new Float32Array(m * 3);
  const e1 = v3();
  const e2 = v3();
  const fn = v3();
  for (let t = 0; t + 2 < index.length; t += 3) {
    const a = canon[index[t]];
    const b = canon[index[t + 1]];
    const c = canon[index[t + 2]];
    e1.set(P[b * 3] - P[a * 3], P[b * 3 + 1] - P[a * 3 + 1], P[b * 3 + 2] - P[a * 3 + 2]);
    e2.set(P[c * 3] - P[a * 3], P[c * 3 + 1] - P[a * 3 + 1], P[c * 3 + 2] - P[a * 3 + 2]);
    fn.crossVectors(e1, e2);
    for (const v of [a, b, c]) {
      N[v * 3] += fn.x;
      N[v * 3 + 1] += fn.y;
      N[v * 3 + 2] += fn.z;
    }
  }
  for (let i = 0; i < n; i++) {
    const c = canon[i];
    pos[i * 3] = P[c * 3];
    pos[i * 3 + 1] = P[c * 3 + 1];
    pos[i * 3 + 2] = P[c * 3 + 2];
    const l = Math.hypot(N[c * 3], N[c * 3 + 1], N[c * 3 + 2]);
    // Keep the original orientation convention (some exporters wind faces the other way).
    if (l > 1e-12) {
      const sgnN = N[c * 3] * nor[i * 3] + N[c * 3 + 1] * nor[i * 3 + 1] + N[c * 3 + 2] * nor[i * 3 + 2] < 0 ? -1 : 1;
      nor[i * 3] = (sgnN * N[c * 3]) / l;
      nor[i * 3 + 1] = (sgnN * N[c * 3 + 1]) / l;
      nor[i * 3 + 2] = (sgnN * N[c * 3 + 2]) / l;
    }
  }
};

type SkinSoup = {pos: Float32Array; nor: Float32Array; si: Uint16Array; sw: Float32Array; index: Uint32Array};

/**
 * One step of Loop subdivision of a skinned triangle mesh (welded first; boundaries and
 * non-manifold edges kept as creases). New edge vertices take the mean of their endpoints' skin
 * weights. Smooth normals come from the subdivided faces.
 */
const loopSubdivide = (pos: Float32Array, nor: Float32Array, si: ArrayLike<number>, sw: ArrayLike<number>, index: ArrayLike<number>): SkinSoup => {
  const {canon, rep} = weld(pos);
  const m = rep.length;
  const F: number[] = [];
  for (let t = 0; t + 2 < index.length; t += 3) {
    const a = canon[index[t]];
    const b = canon[index[t + 1]];
    const c = canon[index[t + 2]];
    if (a !== b && b !== c && a !== c) F.push(a, b, c);
  }
  type Edge = {a: number; b: number; opp: number[]; id: number};
  const edges = new Map<number, Edge>();
  const key = (a: number, b: number) => (a < b ? a * m + b : b * m + a);
  const edgeOf = (a: number, b: number): Edge => {
    const k = key(a, b);
    let e = edges.get(k);
    if (!e) {
      e = {a: Math.min(a, b), b: Math.max(a, b), opp: [], id: edges.size};
      edges.set(k, e);
    }
    return e;
  };
  for (let f = 0; f < F.length; f += 3) {
    const [a, b, c] = [F[f], F[f + 1], F[f + 2]];
    edgeOf(a, b).opp.push(c);
    edgeOf(b, c).opp.push(a);
    edgeOf(c, a).opp.push(b);
  }
  const nb: Set<number>[] = Array.from({length: m}, () => new Set<number>());
  const crease: number[][] = Array.from({length: m}, () => []);
  for (const e of edges.values()) {
    nb[e.a].add(e.b);
    nb[e.b].add(e.a);
    if (e.opp.length !== 2) {
      crease[e.a].push(e.b);
      crease[e.b].push(e.a);
    }
  }
  const nv = m + edges.size;
  const P = new Float32Array(nv * 3);
  const at = (v: number, k: number) => pos[rep[v] * 3 + k];
  for (let v = 0; v < m; v++) {
    for (let k = 0; k < 3; k++) {
      if (crease[v].length >= 2) {
        P[v * 3 + k] = 0.75 * at(v, k) + 0.125 * (at(crease[v][0], k) + at(crease[v][1], k));
      } else if (crease[v].length === 1) {
        P[v * 3 + k] = at(v, k);
      } else {
        const n = nb[v].size;
        const beta = n === 3 ? 3 / 16 : 3 / (8 * n);
        let s = 0;
        for (const u of nb[v]) s += at(u, k);
        P[v * 3 + k] = (1 - n * beta) * at(v, k) + beta * s;
      }
    }
  }
  for (const e of edges.values()) {
    const o = (m + e.id) * 3;
    for (let k = 0; k < 3; k++)
      P[o + k] = e.opp.length === 2 ? 0.375 * (at(e.a, k) + at(e.b, k)) + 0.125 * (at(e.opp[0], k) + at(e.opp[1], k)) : 0.5 * (at(e.a, k) + at(e.b, k));
  }
  // Skin: even vertices keep theirs, edge vertices blend their endpoints'.
  const SI = new Uint16Array(nv * 4);
  const SW = new Float32Array(nv * 4);
  for (let v = 0; v < m; v++)
    for (let k = 0; k < 4; k++) {
      SI[v * 4 + k] = si[rep[v] * 4 + k];
      SW[v * 4 + k] = sw[rep[v] * 4 + k];
    }
  for (const e of edges.values()) {
    const ws = new Map<number, number>();
    for (const v of [e.a, e.b])
      for (let k = 0; k < 4; k++) {
        const w = sw[rep[v] * 4 + k];
        if (w > 0) ws.set(si[rep[v] * 4 + k], (ws.get(si[rep[v] * 4 + k]) ?? 0) + 0.5 * w);
      }
    const top = [...ws.entries()].sort((x, y) => y[1] - x[1]).slice(0, 4);
    const sum = top.reduce((acc, [, w]) => acc + w, 0) || 1;
    const o = (m + e.id) * 4;
    top.forEach(([j, w], k) => {
      SI[o + k] = j;
      SW[o + k] = w / sum;
    });
  }
  const I2 = new Uint32Array((F.length / 3) * 12);
  let q = 0;
  for (let f = 0; f < F.length; f += 3) {
    const [a, b, c] = [F[f], F[f + 1], F[f + 2]];
    const ab = m + edges.get(key(a, b))!.id;
    const bc = m + edges.get(key(b, c))!.id;
    const ca = m + edges.get(key(c, a))!.id;
    I2.set([a, ab, ca, b, bc, ab, c, ca, bc, ab, bc, ca], q);
    q += 12;
  }
  // Area-weighted normals, oriented like the source mesh.
  const N = new Float32Array(nv * 3);
  const e1 = v3();
  const e2 = v3();
  const fn = v3();
  for (let t = 0; t < I2.length; t += 3) {
    const [a, b, c] = [I2[t], I2[t + 1], I2[t + 2]];
    e1.set(P[b * 3] - P[a * 3], P[b * 3 + 1] - P[a * 3 + 1], P[b * 3 + 2] - P[a * 3 + 2]);
    e2.set(P[c * 3] - P[a * 3], P[c * 3 + 1] - P[a * 3 + 1], P[c * 3 + 2] - P[a * 3 + 2]);
    fn.crossVectors(e1, e2);
    for (const v of [a, b, c]) {
      N[v * 3] += fn.x;
      N[v * 3 + 1] += fn.y;
      N[v * 3 + 2] += fn.z;
    }
  }
  let agree = 0;
  for (let v = 0; v < m; v++) agree += N[v * 3] * nor[rep[v] * 3] + N[v * 3 + 1] * nor[rep[v] * 3 + 1] + N[v * 3 + 2] * nor[rep[v] * 3 + 2];
  const flip = agree < 0 ? -1 : 1;
  for (let v = 0; v < nv; v++) {
    const l = Math.hypot(N[v * 3], N[v * 3 + 1], N[v * 3 + 2]) || 1;
    N[v * 3] = (flip * N[v * 3]) / l;
    N[v * 3 + 1] = (flip * N[v * 3 + 1]) / l;
    N[v * 3 + 2] = (flip * N[v * 3 + 2]) / l;
  }
  return {pos: P, nor: N, si: SI, sw: SW, index: I2};
};

/** Re-proportion, scale and re-rig the loaded model (once). Mutates `gltf.scene`. */
export const buildPersonTemplate = (gltf: GLTF): PersonTemplate => {
  const scene = gltf.scene;
  for (const n of ['Eyes', 'Eyebrows']) scene.getObjectByName(n)?.removeFromParent();
  scene.updateMatrixWorld(true);
  const meshes: THREE.SkinnedMesh[] = [];
  scene.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) meshes.push(o as THREE.SkinnedMesh);
  });
  const body = meshes.find((m) => m.name === 'SuperHero_Male') ?? meshes[0];
  if (!body) throw new Error('[HoloPerson] no skinned mesh in john.glb');
  const bones = body.skeleton.bones.slice();
  const isOurs = (o: THREE.Object3D | null): o is THREE.Bone => Boolean(o && (o as THREE.Bone).isBone && bones.includes(o as THREE.Bone));

  // 1. New rest: each child joint moves with its parent's scale (rotations are kept).
  const oldInv = bones.map((b) => b.matrixWorld.clone().invert());
  for (const b of bones) {
    if (!isOurs(b.parent)) continue;
    const g = shapeOf(b.parent.name);
    b.position.set(b.position.x * g[0], b.position.y * g[1], b.position.z * g[2]);
  }
  scene.updateMatrixWorld(true);
  const deform = bones.map((b, i) => {
    const g = shapeOf(b.name);
    return b.matrixWorld.clone().multiply(new THREE.Matrix4().makeScale(g[0], g[1], g[2])).multiply(oldInv[i]);
  });
  const deformN = deform.map((m) => new THREE.Matrix3().getNormalMatrix(m));

  // 2. Re-skin every mesh's bind pose with those deformations (linear blend, as the skinning does).
  type Raw = {mesh: THREE.SkinnedMesh; pos: Float32Array; nor: Float32Array; si: number[]; sw: number[]};
  const raws: Raw[] = meshes.map((mesh) => {
    const g = mesh.geometry;
    const P = g.getAttribute('position');
    const N = g.getAttribute('normal');
    const SI = g.getAttribute('skinIndex');
    const SW = g.getAttribute('skinWeight');
    const remap = mesh.skeleton.bones.map((b) => bones.indexOf(b));
    const n = P.count;
    const pos = new Float32Array(n * 3);
    const nor = new Float32Array(n * 3);
    const si: number[] = new Array(n * 4).fill(0);
    const sw: number[] = new Array(n * 4).fill(0);
    const p = v3();
    const q = v3();
    const acc = v3();
    const accN = v3();
    for (let i = 0; i < n; i++) {
      p.set(P.getX(i), P.getY(i), P.getZ(i));
      const nn = v3(N.getX(i), N.getY(i), N.getZ(i));
      acc.set(0, 0, 0);
      accN.set(0, 0, 0);
      let wsum = 0;
      for (let k = 0; k < 4; k++) {
        const w = SW.getComponent(i, k);
        const j = remap[SI.getComponent(i, k)] ?? -1;
        si[i * 4 + k] = Math.max(0, j);
        sw[i * 4 + k] = j >= 0 ? w : 0;
        if (w <= 0 || j < 0) continue;
        wsum += w;
        acc.addScaledVector(q.copy(p).applyMatrix4(deform[j]), w);
        accN.addScaledVector(q.copy(nn).applyMatrix3(deformN[j]), w);
      }
      if (wsum <= 0) acc.copy(p);
      else acc.divideScalar(wsum);
      if (accN.lengthSq() < 1e-12) accN.copy(nn);
      accN.normalize();
      pos.set([acc.x, acc.y, acc.z], i * 3);
      nor.set([accN.x, accN.y, accN.z], i * 3);
    }
    return {mesh, pos, nor, si, sw};
  });

  // 3. Stand him back on the floor (longer legs pushed the soles below it), then scale to the stature (hair included).
  const bodyRaw0 = raws.find((r) => r.mesh === body)!;
  let floor = Infinity;
  for (let i = 1; i < bodyRaw0.pos.length; i += 3) floor = Math.min(floor, bodyRaw0.pos[i]);
  for (const r of raws) for (let i = 1; i < r.pos.length; i += 3) r.pos[i] -= floor;
  for (const b of bones) if (!isOurs(b.parent)) b.position.y -= floor;
  let top = 0;
  for (const r of raws) for (let i = 1; i < r.pos.length; i += 3) top = Math.max(top, r.pos[i]);
  const k = STATURE / top;
  for (const r of raws) for (let i = 0; i < r.pos.length; i++) r.pos[i] *= k;
  for (const b of bones) b.position.multiplyScalar(k);
  scene.updateMatrixWorld(true);

  // 3b. Soften the bodybuilder's definition (Taubin smoothing keeps the volume): full on the body,
  // light on the face, none on the hands. The mesh is welded across its UV seams first.
  {
    const r = bodyRaw0;
    const idx = r.mesh.geometry.getIndex();
    if (idx) {
      const handBones = new Set(bones.flatMap((b, i) => (/^(hand|index|middle|ring|pinky|thumb)_/.test(b.name) ? [i] : [])));
      const headBone = bones.findIndex((b) => b.name === 'Head');
      const footBones = new Set(bones.flatMap((b, i) => (/^(foot|ball)/.test(b.name) ? [i] : [])));
      smoothBind(r.pos, r.nor, idx.array as ArrayLike<number>, (i) => {
        let wh = 0;
        let wf = 0;
        let wHead = 0;
        for (let kk = 0; kk < 4; kk++) {
          const j = r.si[i * 4 + kk];
          const w = r.sw[i * 4 + kk];
          if (handBones.has(j)) wh += w;
          if (footBones.has(j)) wf += w;
          if (j === headBone) wHead += w;
        }
        return clamp01(1 - wh * 1.5) * (1 - 0.7 * wHead) * (1 - 0.6 * wf);
      });
    }
  }

  // 4. Twist bones along each forearm (half way, and at the wrist); the forearm weights are spread over them.
  const byName = (n: string) => bones.find((b) => b.name === n)!;
  const twist: THREE.Bone[] = [];
  const twistOf: Record<string, {lower: number; t1: number; t2: number; axis: V; len: number; inv: THREE.Matrix4}> = {};
  for (const s of SIDES) {
    const lower = byName(`lowerarm_${s}`);
    const hand = byName(`hand_${s}`);
    const t1 = new THREE.Bone();
    t1.name = `forearm_twist_01_${s}`;
    t1.position.copy(hand.position).multiplyScalar(0.5);
    const t2 = new THREE.Bone();
    t2.name = `forearm_twist_02_${s}`;
    t2.position.copy(hand.position);
    lower.add(t1, t2);
    twist.push(t1, t2);
    twistOf[s] = {lower: bones.indexOf(lower), t1: bones.length + twist.length - 2, t2: bones.length + twist.length - 1, axis: hand.position.clone().normalize(), len: hand.position.length(), inv: lower.matrixWorld.clone().invert()};
  }
  const all = [...bones, ...twist];
  scene.updateMatrixWorld(true);
  const lp = v3();
  for (const r of raws) {
    const n = r.pos.length / 3;
    for (let i = 0; i < n; i++) {
      const ws = new Map<number, number>();
      for (let kk = 0; kk < 4; kk++) {
        const w = r.sw[i * 4 + kk];
        if (w > 0) ws.set(r.si[i * 4 + kk], (ws.get(r.si[i * 4 + kk]) ?? 0) + w);
      }
      for (const s of SIDES) {
        const t = twistOf[s];
        const wl = ws.get(t.lower);
        if (!wl) continue;
        lp.set(r.pos[i * 3], r.pos[i * 3 + 1], r.pos[i * 3 + 2]).applyMatrix4(t.inv);
        const u = clamp01(lp.dot(t.axis) / t.len);
        const w0 = wl * Math.max(0, 1 - 2 * u);
        const w1 = wl * (u <= 0.5 ? 2 * u : 2 - 2 * u);
        const w2 = wl * Math.max(0, 2 * u - 1);
        ws.set(t.lower, w0);
        ws.set(t.t1, (ws.get(t.t1) ?? 0) + w1);
        ws.set(t.t2, (ws.get(t.t2) ?? 0) + w2);
      }
      const top4 = [...ws.entries()].filter(([, w]) => w > 1e-5).sort((a, b) => b[1] - a[1]).slice(0, 4);
      const sum = top4.reduce((acc, [, w]) => acc + w, 0) || 1;
      for (let kk = 0; kk < 4; kk++) {
        r.si[i * 4 + kk] = top4[kk]?.[0] ?? 0;
        r.sw[i * 4 + kk] = (top4[kk]?.[1] ?? 0) / sum;
      }
    }
  }

  // 5. One skeleton for body and hair, bound in the new rest. What is drawn is the mesh subdivided
  // once (smooth silhouettes and contour lines); the solver's probes use the coarse mesh.
  const skeleton = new THREE.Skeleton(all);
  for (const r of raws) {
    const g = new THREE.BufferGeometry();
    const idx = r.mesh.geometry.getIndex();
    if (idx) {
      const sub = loopSubdivide(r.pos, r.nor, r.si, r.sw, idx.array as ArrayLike<number>);
      g.setAttribute('position', new THREE.Float32BufferAttribute(sub.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(sub.nor, 3));
      g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(sub.si, 4));
      g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sub.sw, 4));
      g.setIndex(new THREE.BufferAttribute(sub.index, 1));
    } else {
      g.setAttribute('position', new THREE.Float32BufferAttribute(r.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(r.nor, 3));
      g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(Uint16Array.from(r.si), 4));
      g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(Float32Array.from(r.sw), 4));
    }
    g.computeBoundingBox();
    g.computeBoundingSphere();
    r.mesh.geometry.dispose();
    (Array.isArray(r.mesh.material) ? r.mesh.material : [r.mesh.material]).forEach((m) => m.dispose());
    r.mesh.geometry = g;
    r.mesh.bind(skeleton, new THREE.Matrix4());
  }

  // 6. Solver data.
  const names = all.map((b) => b.name);
  const index = new Map(names.map((n, i) => [n, i]));
  const parent = all.map((b) => (b.parent && all.includes(b.parent as THREE.Bone) ? all.indexOf(b.parent as THREE.Bone) : -1));
  const children = all.map((_, i) => parent.flatMap((p, j) => (p === i ? [j] : [])));
  const order: number[] = [];
  const visit = (i: number) => {
    order.push(i);
    children[i].forEach(visit);
  };
  parent.forEach((p, i) => p < 0 && visit(i));
  const restWPos = all.map((b) => new THREE.Vector3().setFromMatrixPosition(b.matrixWorld));
  const restWQuat = all.map((b) => {
    const q = new THREE.Quaternion();
    b.matrixWorld.decompose(new THREE.Vector3(), q, new THREE.Vector3());
    return q;
  });

  const bodyRaw = raws.find((r) => r.mesh === body)!;
  const si = Uint16Array.from(bodyRaw.si);
  const sw = Float32Array.from(bodyRaw.sw);
  const bind = bodyRaw.pos;
  const nv = bind.length / 3;
  const I = (n: string) => index.get(n)!;
  const spineZ = restWPos[I('spine_02')].z;
  const hipY = restWPos[I('thigh_l')].y;
  const hipZ = restWPos[I('thigh_l')].z;
  /** Vertices on the back of the body (behind the hip joints). */
  const posterior = (i: number) => bind[i * 3 + 2] < hipZ + 0.01;
  const tips: Record<string, Int32Array> = {};
  for (const s of SIDES) {
    for (const f of FINGERS) tips[`${f}_${s}`] = selectVerts(si, sw, nv, [I(`${f}_03_${s}`), I(`${f}_04_leaf_${s}`)], 0.5);
    tips[`thumb_${s}`] = selectVerts(si, sw, nv, [I(`thumb_03_${s}`), I(`thumb_04_leaf_${s}`)], 0.5);
  }
  return {
    scene,
    meshes,
    names,
    index,
    parent,
    children,
    order,
    restPos: all.map((b) => b.position.clone()),
    restQuat: all.map((b) => b.quaternion.clone()),
    restWPos,
    restWQuat,
    inverses: skeleton.boneInverses.map((m) => m.clone()),
    bind,
    si,
    sw,
    probes: {
      seat: selectVerts(si, sw, nv, [I('pelvis'), I('thigh_l'), I('thigh_r')], 0.5, (i) => posterior(i) && bind[i * 3 + 1] > hipY - 0.1),
      thigh: {
        l: selectVerts(si, sw, nv, [I('thigh_l'), I('calf_l')], 0.6, (i) => bind[i * 3 + 2] < hipZ - 0.025 && bind[i * 3 + 1] <= hipY - 0.1 && bind[i * 3 + 1] > hipY - 0.5 && bind[i * 3] > 0),
        r: selectVerts(si, sw, nv, [I('thigh_r'), I('calf_r')], 0.6, (i) => bind[i * 3 + 2] < hipZ - 0.025 && bind[i * 3 + 1] <= hipY - 0.1 && bind[i * 3 + 1] > hipY - 0.5 && bind[i * 3] < 0),
      },
      back: selectVerts(si, sw, nv, [I('spine_01'), I('spine_02'), I('spine_03'), I('clavicle_l'), I('clavicle_r'), I('neck_01')], 0.5, (i) => bind[i * 3 + 2] < spineZ - 0.04),
      palm: {l: selectVerts(si, sw, nv, [I('hand_l')], 0.6), r: selectVerts(si, sw, nv, [I('hand_r')], 0.6)},
      thenar: {l: selectVerts(si, sw, nv, [I('hand_l'), I('thumb_01_l')], 0.6), r: selectVerts(si, sw, nv, [I('hand_r'), I('thumb_01_r')], 0.6)},
      forearm: {
        l: selectVerts(si, sw, nv, [I('lowerarm_l'), I('forearm_twist_01_l'), I('forearm_twist_02_l')], 0.5),
        r: selectVerts(si, sw, nv, [I('lowerarm_r'), I('forearm_twist_01_r'), I('forearm_twist_02_r')], 0.5),
      },
      tips,
    },
  };
};

let templatePromise: Promise<PersonTemplate> | null = null;
let templateReady: PersonTemplate | null = null;
/** The prepared model (one load per page; deterministic). */
export const loadPersonTemplate = (): Promise<PersonTemplate> => {
  templatePromise ??= new GLTFLoader().loadAsync(staticFile(MODEL)).then((g) => {
    templateReady = buildPersonTemplate(g);
    return templateReady;
  });
  return templatePromise;
};

/* ------------------------------------------------------------------ forward kinematics on arrays */

class Rig {
  readonly lp: V[];
  readonly lq: Q[];
  readonly wp: V[];
  readonly wq: Q[];
  readonly mats: THREE.Matrix4[];
  constructor(readonly T: PersonTemplate) {
    this.lp = T.restPos.map((p) => p.clone());
    this.lq = T.restQuat.map((q) => q.clone());
    this.wp = T.restWPos.map((p) => p.clone());
    this.wq = T.restWQuat.map((q) => q.clone());
    this.mats = T.inverses.map(() => new THREE.Matrix4());
  }
  i(name: string): number {
    const i = this.T.index.get(name);
    if (i === undefined) throw new Error(`[HoloPerson] no bone ${name}`);
    return i;
  }
  private node(i: number) {
    const p = this.T.parent[i];
    if (p < 0) {
      this.wq[i].copy(this.lq[i]);
      this.wp[i].copy(this.lp[i]);
    } else {
      this.wq[i].copy(this.wq[p]).multiply(this.lq[i]);
      this.wp[i].copy(this.lp[i]).applyQuaternion(this.wq[p]).add(this.wp[p]);
    }
  }
  /** World transforms of `i` and everything under it (the parent's must be current). */
  fk(i: number) {
    this.node(i);
    for (const c of this.T.children[i]) this.fk(c);
  }
  fkAll() {
    for (const i of this.T.order) this.node(i);
  }
  /** Give bone `i` a world rotation (keeps its children's local rotations; call fk after). */
  setWorld(i: number, q: Q) {
    const p = this.T.parent[i];
    this.lq[i].copy(p < 0 ? q : this.wq[p].clone().invert().multiply(q));
    this.wq[i].copy(q);
  }
  /** World rotation = delta * rest world rotation. */
  setDelta(i: number, delta: Q) {
    this.setWorld(i, delta.clone().multiply(this.T.restWQuat[i]));
  }
  /** Skinning matrices of the given bones (all if omitted). */
  updateMats(list?: readonly number[]) {
    const s = list ?? this.T.order;
    for (const i of s) this.mats[i].compose(this.wp[i], this.wq[i], ONE).multiply(this.T.inverses[i]);
  }
  /** Skinned position of body vertex `vi` (model space). */
  skin(vi: number, out: V): V {
    const {bind, si, sw} = this.T;
    out.set(0, 0, 0);
    const b = TMP_B.set(bind[vi * 3], bind[vi * 3 + 1], bind[vi * 3 + 2]);
    for (let k = 0; k < 4; k++) {
      const w = sw[vi * 4 + k];
      if (w <= 0) continue;
      out.addScaledVector(TMP_C.copy(b).applyMatrix4(this.mats[si[vi * 4 + k]]), w);
    }
    return out;
  }
  /** Minimum of `f` over the skinned positions of a vertex set. */
  minOver(set: Int32Array, f: (p: V) => number): number {
    let m = Infinity;
    const p = v3();
    for (let n = 0; n < set.length; n++) m = Math.min(m, f(this.skin(set[n], p)));
    return m;
  }
}
const TMP_B = v3();
const TMP_C = v3();

/* ------------------------------------------------------------------ the scene, in model space */

/** Signed distance to a box with rounded edges (centre c, half sizes h, radius r). */
const sdRoundBox = (p: V, c: V, h: V, r: number) => {
  const qx = Math.abs(p.x - c.x) - (h.x - r);
  const qy = Math.abs(p.y - c.y) - (h.y - r);
  const qz = Math.abs(p.z - c.z) - (h.z - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r;
};

/** SlimMouse (Workstation.tsx): centre height above its base, half sizes (x, y, z), yaw (world). */
const MOUSE_SHAPE = {lift: 0.016, half: [0.034, 0.018, 0.058] as const, yaw: -0.12} as const;
/** The seat cushion of MeshChair: thickness, edge radius. The backrest's tilt (degrees). */
const CUSHION = {thickness: 0.07, radius: 0.028} as const;
const BACK_TILT = (8 * Math.PI) / 180;
/** Desk front edge, from the keyboard centre (world z): the keyboard sits 0.19 m behind it (layout.ts). */
const DESK_FRONT_FROM_KEYBOARD = 0.19;

type Surface = (p: V) => number;

type Scene = {
  readonly kb: V;
  readonly enter: V;
  readonly mouseC: V;
  readonly mouseF: V;
  readonly mouseR: V;
  readonly deskY: number;
  readonly keyTop: number;
  readonly deskFront: number;
  readonly keys: Surface;
  readonly desk: Surface;
  readonly mouse: Surface;
  readonly all: Surface;
  readonly cushion: Surface;
  /** Distance in front of the backrest's face (> 0 = in front), for points at its height. */
  readonly backGap: (p: V) => number;
  readonly chair: ChairEnvelope;
};

/** World -> model space (the figure faces -z in the world, +z in the model). */
const toModel = (l: Vec3): V => v3(-l[0], l[1], -l[2]);

const sceneFor = (keyboard: Vec3, enter: Vec3, mouse: Vec3, chair: ChairEnvelope): Scene => {
  const kb = toModel(keyboard);
  const ent = toModel(enter);
  const m = toModel(mouse);
  const deskY = m.y;
  const keyTop = kb.y;
  const deskFront = kb.z - DESK_FRONT_FROM_KEYBOARD;
  const {lift, half, yaw} = MOUSE_SHAPE;
  const mouseC = m.clone().add(v3(0, lift, 0));
  // The mouse's axes in model space (the world yaw is kept; x and z flip).
  const mouseR = v3(-Math.cos(yaw), 0, Math.sin(yaw));
  const mouseF = v3(Math.sin(yaw), 0, Math.cos(yaw));
  const desk: Surface = (p) => (p.z >= deskFront ? p.y - deskY : Math.hypot(Math.max(0, p.y - deskY), deskFront - p.z));
  const keys: Surface = (p) => (Math.abs(p.x - kb.x) < 0.2 && Math.abs(p.z - kb.z) < 0.065 ? p.y - keyTop : desk(p));
  const mouseS: Surface = (p) => {
    const d = p.clone().sub(mouseC);
    const lx = d.dot(mouseR) / half[0];
    const ly = d.y / half[1];
    const lz = d.dot(mouseF) / half[2];
    const k0 = Math.hypot(lx, ly, lz);
    const k1 = Math.max(Math.hypot(lx / half[0], ly / half[1], lz / half[2]), 1e-6);
    return Math.min((k0 * (k0 - 1)) / k1, desk(p));
  };
  const seat = chair.seat;
  const cc = v3(0, seat.top - CUSHION.thickness / 2, -(seat.zFront + seat.zBack) / 2);
  const ch = v3(seat.halfWidth, CUSHION.thickness / 2, (seat.zBack - seat.zFront) / 2);
  const n = v3(0, Math.sin(BACK_TILT), Math.cos(BACK_TILT));
  const p0 = v3(0, chair.back.bottom, -chair.back.zFront);
  return {
    kb,
    enter: ent,
    mouseC,
    mouseF,
    mouseR,
    deskY,
    keyTop,
    deskFront,
    keys,
    desk,
    mouse: mouseS,
    all: (p) => Math.min(keys(p), mouseS(p)),
    cushion: (p) => sdRoundBox(p, cc, ch, CUSHION.radius),
    backGap: (p) => p.clone().sub(p0).dot(n),
    chair,
  };
};

/* ------------------------------------------------------------------ the pose */

export type PersonSolveInput = {
  readonly pose: HoloPose;
  readonly time: number;
  /** Targets relative to the figure's position (world axes). */
  readonly keyboard: Vec3;
  readonly enter: Vec3;
  readonly mouse: Vec3;
  readonly chair: ChairEnvelope;
};
export type PersonPose = {
  /** Local positions / rotations per bone (template order). */
  readonly lp: readonly V[];
  readonly lq: readonly Q[];
  /** The lean actually used (the requested one, limited by what the hands can reach). */
  readonly lean: number;
  /** A few joints in model space, for tools and checks. */
  readonly joints: Readonly<Record<string, V>>;
};

/** Finger joint coupling per unit of curl (MCP, PIP, DIP) and joint limits (rad). */
const CURL = [0.55, 1.0, 0.62] as const;
const LIMIT = [
  [-0.25, 1.45],
  [0, 1.75],
  [0, 1.25],
] as const;

type HandGoal = {
  /** Wrist (hand bone origin) and hand world rotation. */
  W: V;
  q: Q;
  /** Per finger: the most it curls, the hover above what it touches; how MCP / PIP / DIP share a curl. */
  cMax: number[];
  ratio: readonly [number, number, number];
  hover: number[];
  /** Thumb tip target, in the hand's frame (relative to W, rotated by q^-1). */
  thumb: V;
  surf: Surface;
};

const blendGoal = (a: HandGoal, b: HandGoal, t: number): HandGoal => {
  if (t <= 0) return a;
  if (t >= 1) return b;
  return {
    W: a.W.clone().lerp(b.W, t),
    q: a.q.clone().slerp(b.q, t),
    cMax: a.cMax.map((x, i) => lerp(x, b.cMax[i], t)),
    ratio: [lerp(a.ratio[0], b.ratio[0], t), lerp(a.ratio[1], b.ratio[1], t), lerp(a.ratio[2], b.ratio[2], t)],
    hover: a.hover.map((x, i) => lerp(x, b.hover[i], t)),
    thumb: a.thumb.clone().lerp(b.thumb, t),
    surf: (p) => Math.min(a.surf(p), b.surf(p)),
  };
};

/** Torso posture for a lean: trunk pitch (+ forward), hip midpoint z, pelvis tilt back (rad). */
const postureFor = (lean: number) => {
  const fwd = Math.max(0, lean);
  const back = Math.max(0, -lean);
  const slouch = smooth(back / 0.8);
  return {
    pitch: 0.2 + 0.32 * fwd - 0.42 * back,
    hipZ: -0.1 + 0.02 * fwd + 0.11 * slouch,
    pelvisBack: 0.2 + 0.14 * back,
    /** Where the spine bends (lumbar, lower thorax, upper thorax): sitting back rounds the upper back. */
    bend: [lerp(0.3, 0.28, slouch), lerp(0.68, 0.7, slouch), lerp(1.0, 1.12, slouch)] as const,
  };
};

/** Solved seat placements (hip height and depth, leg rotations) per lean: they do not change with time. */
const SEAT_CACHE = new Map<string, {hipY: number; hipZ: number; legs: Q[]}>();

export const solvePerson = (T: PersonTemplate, input: PersonSolveInput): PersonPose => {
  const R = new Rig(T);
  const I = (n: string) => R.i(n);
  const S = sceneFor(input.keyboard, input.enter, input.mouse, input.chair);
  const pose = input.pose;
  const time = finite(input.time);
  const typing = clamp01(pose.typing ?? 0);
  const leanIn = clamp(finite(pose.lean ?? 0), -1, 1);
  const yaw = clamp(finite(pose.headYaw ?? 0), -1.2, 1.2);
  const nod = clamp(finite(pose.headPitch ?? 0), -0.6, 0.8);
  const reach = smooth(pose.reach ?? 0);
  const tap = clamp01(pose.tap ?? 0);
  const toEnter = smooth(pose.toEnter ?? 0);
  const relax = smooth((-leanIn - 0.15) / 0.4);
  const breath = Math.sin((time * Math.PI * 2) / 4.6);

  const L = {
    upper: T.restPos[I('lowerarm_l')].length(),
    fore: T.restPos[I('hand_l')].length(),
    thigh: T.restPos[I('calf_l')].length(),
    shin: T.restPos[I('foot_l')].length(),
    hand: T.restWPos[I('middle_04_leaf_l')].distanceTo(T.restWPos[I('hand_l')]),
  };
  const arm = L.upper + L.fore;
  const ankleY = T.restWPos[I('foot_l')].y;
  const ballY = T.restWPos[I('ball_l')].y;

  /* ---- hand goals (they do not depend on the torso) ---- */

  const restHand = (s: Side) => {
    const h = T.restWPos[I(`hand_${s}`)];
    const d0 = T.restWPos[I(`middle_01_${s}`)].clone().sub(h).normalize();
    const n0 = v3(0, -1, 0).addScaledVector(d0, d0.y).normalize();
    return {d0, n0};
  };
  const REST_HAND = {l: restHand('l'), r: restHand('r')};
  /** Hand rotation: fingers along `d`, palm down, rolled so the thumb side rises by `roll`. */
  const handQ = (s: Side, d: V, roll: number): Q => {
    const dn = d.clone().normalize();
    const t = new THREE.Vector3().crossVectors(Y, dn).normalize().multiplyScalar(-sgn(s));
    const n = Y.clone().multiplyScalar(-Math.cos(roll)).addScaledVector(t, Math.sin(roll));
    n.addScaledVector(dn, -n.dot(dn)).normalize();
    return frameQuat(REST_HAND[s].d0, REST_HAND[s].n0, dn, n).multiply(T.restWQuat[I(`hand_${s}`)]);
  };
  const dirOf = (yawA: number, pitch: number) => v3(Math.sin(yawA) * Math.cos(pitch), Math.sin(pitch), Math.cos(yawA) * Math.cos(pitch));
  /** Thumb target in the hand frame. */
  const local = (W: V, q: Q, p: V) => p.clone().sub(W).applyQuaternion(q.clone().invert());
  /** Raise a goal until its palm clears the surface by 2 mm (palm vertices skinned by the hand bone alone). */
  const clearPalm = (s: Side, g: HandGoal, thenar = false): HandGoal => {
    const hi = I(`hand_${s}`);
    const m = new THREE.Matrix4();
    const p = v3();
    const set = (thenar ? T.probes.thenar : T.probes.palm)[s];
    const gapAt = (lift: number) => {
      m.compose(g.W.clone().add(v3(0, lift, 0)), g.q, ONE).multiply(T.inverses[hi]);
      let worst = Infinity;
      for (let n = 0; n < set.length; n++) {
        const vi = set[n];
        p.set(T.bind[vi * 3], T.bind[vi * 3 + 1], T.bind[vi * 3 + 2]).applyMatrix4(m);
        worst = Math.min(worst, g.surf(p));
      }
      return worst;
    };
    // The distance bounds are only exact near the surface: bisect the lift instead of stepping by them.
    if (gapAt(0) >= 0.002) return g;
    let lo = 0;
    let up = 0.12;
    for (let it = 0; it < 14; it++) {
      const mid = (lo + up) / 2;
      if (gapAt(mid) < 0.002) lo = mid;
      else up = mid;
    }
    g.W.y += up;
    return g;
  };

  // Home row: middle fingertips on D and K-ish; wrists low over the desk, palms turned a little toward each other.
  const keysGoal = (s: Side, fwdYaw: number): HandGoal => {
    const tip = S.kb.clone().add(v3(s === 'l' ? 0.1 : -0.025, 0, -0.003));
    const d = dirOf(fwdYaw, 0.06);
    const dh = v3(d.x, 0, d.z).normalize();
    const W = tip.clone().addScaledVector(dh, -0.7 * L.hand);
    W.y = S.deskY + 0.043;
    const q = handQ(s, d, 0.3);
    const t = new THREE.Vector3().crossVectors(Y, dh).normalize().multiplyScalar(-sgn(s));
    const thumb = W.clone().addScaledVector(dh, 0.6 * L.hand).addScaledVector(t, 0.012);
    thumb.y = S.keyTop + 0.012;
    return clearPalm(s, {W, q, ratio: CURL, cMax: [1.1, 1.1, 1.1, 1.1], hover: [0.004, 0.004, 0.004, 0.004], thumb: local(W, q, thumb), surf: S.keys});
  };
  // Right hand on Enter (middle fingertip), turned out a little; `tap` lifts it.
  const enterGoal = (fwdYaw: number): HandGoal => {
    const d = dirOf(fwdYaw - 0.12, 0.06);
    const dh = v3(d.x, 0, d.z).normalize();
    const tip = S.enter.clone().add(v3(0.004, 0, -0.004));
    const W = tip.clone().addScaledVector(dh, -0.72 * L.hand);
    W.y = S.deskY + 0.045 + 0.036 * tap;
    const q = handQ('r', d, 0.3);
    const t = new THREE.Vector3().crossVectors(Y, dh).normalize();
    const thumb = W.clone().addScaledVector(dh, 0.6 * L.hand).addScaledVector(t, 0.012);
    thumb.y = S.keyTop + 0.012 + 0.036 * tap;
    const hover = [0.006, 0.002, 0.006, 0.008].map((h) => h + 0.03 * tap);
    return clearPalm('r', {W, q, ratio: CURL, cMax: [1.1, 1.1, 1.1, 1.1], hover, thumb: local(W, q, thumb), surf: S.keys});
  };
  // Palm grip on the mouse: palm on its back, fingers over the buttons, thumb on its left side, wrist low.
  const mouseGoal = (): HandGoal => {
    const {half} = MOUSE_SHAPE;
    const f = S.mouseF;
    const W = S.mouseC.clone().addScaledVector(f, -(half[2] + 0.026)).addScaledVector(S.mouseR, 0.006);
    W.y = S.deskY + 0.026;
    const d = f.clone().multiplyScalar(Math.cos(0.06)).addScaledVector(Y, Math.sin(0.06));
    const q = handQ('r', d, 0.1);
    const thumb = S.mouseC.clone().addScaledVector(S.mouseR, -(half[0] + 0.008)).addScaledVector(f, -0.002).add(v3(0, -0.004, 0));
    return clearPalm('r', {W, q, ratio: [0.9, 0.55, 0.3], cMax: [0.75, 0.75, 1.05, 1.15], hover: [0.0015, 0.0015, 0.002, 0.002], thumb: local(W, q, thumb), surf: S.mouse}, true);
  };
  // Resting on the desk by its front edge beside the keyboard: wrist low, fingers relaxed on the desk.
  const deskGoal = (s: Side): HandGoal => {
    const tip = S.kb.clone().add(v3(s === 'l' ? 0.265 : -0.3, 0, -0.085));
    tip.y = S.deskY;
    const yawA = -sgn(s) * 0.38;
    const d = dirOf(yawA, -0.06);
    const dh = v3(d.x, 0, d.z).normalize();
    const W = tip.clone().addScaledVector(dh, -0.76 * L.hand);
    W.y = S.deskY + 0.012;
    const q = handQ(s, d, 0.22);
    const t = new THREE.Vector3().crossVectors(Y, dh).normalize().multiplyScalar(-sgn(s));
    const thumb = W.clone().addScaledVector(dh, 0.5 * L.hand).addScaledVector(t, 0.03);
    thumb.y = S.deskY + 0.01;
    return clearPalm(s, {W, q, ratio: [0.45, 0.85, 0.5], cMax: [0.85, 0.9, 0.95, 1.0], hover: [0.0015, 0.0015, 0.0015, 0.0015], thumb: local(W, q, thumb), surf: S.desk});
  };

  /** Goals that do not depend on the forearm's direction are built once per solve (and copied, since blending edits them). */
  const once = (f: () => HandGoal) => {
    let g: HandGoal | null = null;
    return (): HandGoal => {
      g ??= f();
      return {...g, W: g.W.clone(), q: g.q.clone(), thumb: g.thumb.clone()};
    };
  };
  const mouseOnce = once(mouseGoal);
  const deskOnce = {l: once(() => deskGoal('l')), r: once(() => deskGoal('r'))};

  /** The goal of each hand for the pose (forearm yaw `fy` per side, from the last IK pass). */
  const goalsFor = (fy: Record<Side, number>): Record<Side, HandGoal> => {
    // Fingers point a little outward from the converging forearms (ulnar deviation), mostly ahead.
    const handYaw = (s: Side) => fy[s] * 0.45;
    // Only the goals that take part are built (each settles its palm with a small search).
    const blend = (a: () => HandGoal, b: () => HandGoal, t: number, arc: number) => {
      const g = t <= 0 ? a() : t >= 1 ? b() : blendGoal(a(), b(), t);
      g.W.y += arc * Math.sin(Math.PI * clamp01(t));
      return g;
    };
    const onKeys = () => blend(() => keysGoal('r', handYaw('r')), () => enterGoal(handYaw('r')), toEnter, 0.012);
    const working = () => blend(onKeys, mouseOnce, reach, 0.03);
    const right = blend(working, deskOnce.r, relax * (1 - reach), 0.02);
    const left = blend(() => keysGoal('l', handYaw('l')), deskOnce.l, relax, 0.02);
    // Typing: the hands bob and drift a few millimetres.
    left.W.y += typing * 0.0022 * Math.sin(time * 7.3 + 0.7);
    left.W.x += typing * 0.004 * Math.sin(time * 1.9 + 0.3);
    right.W.y += typing * 0.0022 * Math.sin(time * 6.7 + 2.1) * (1 - toEnter);
    right.W.x += typing * 0.004 * Math.sin(time * 2.3 + 1.1) * (1 - toEnter);
    return {l: left, r: right};
  };

  /* ---- torso ---- */

  const iPelvis = I('pelvis');
  const iRoot = T.parent[iPelvis];
  const spine = [I('spine_01'), I('spine_02'), I('spine_03')];
  const iNeck = I('neck_01');
  const iHead = I('Head');
  const hipOff = T.restPos[I('thigh_l')].clone().add(T.restPos[I('thigh_r')]).multiplyScalar(0.5);
  // Reaching for the mouse brings the right shoulder forward (the chest turns a little toward his left).
  const twist = 0.03 + 0.08 * reach;

  const placeTorso = (lean: number, hipY: number, hipZ?: number, breath = 0) => {
    const P = postureFor(lean);
    const zHip = hipZ ?? P.hipZ;
    const dPel = rx(-P.pelvisBack);
    R.setDelta(iPelvis, dPel);
    // Pelvis origin so that the hip joints' midpoint is where the seat puts it.
    const Hm = v3(0, hipY, zHip);
    const off = hipOff.clone().applyQuaternion(R.wq[iPelvis]);
    const Pw = Hm.clone().sub(off);
    const rootInv = iRoot >= 0 ? R.wq[iRoot].clone().invert() : new THREE.Quaternion();
    R.lp[iPelvis].copy(Pw.sub(iRoot >= 0 ? R.wp[iRoot] : v3()).applyQuaternion(rootInv));
    R.fk(iPelvis);
    const bendTo = (c: number) => {
      const w = P.bend;
      spine.forEach((b, k) => R.setDelta(b, mulQ(ry(twist * [0.25, 0.6, 1][k]), rx(-P.pelvisBack + c * w[k] + (k === 2 ? -0.012 * breath : 0)))));
      R.fk(spine[0]);
    };
    // Bend the spine until the trunk line (hips -> neck) has the posture's pitch.
    const pitchOf = () => {
      const d = R.wp[iNeck].clone().sub(Hm);
      return Math.atan2(d.z, d.y);
    };
    let lo = -1;
    let hi = 1.6;
    for (let k = 0; k < 18; k++) {
      const mid = (lo + hi) / 2;
      bendTo(mid);
      if (pitchOf() < P.pitch) lo = mid;
      else hi = mid;
    }
    bendTo((lo + hi) / 2);
    // Head: the gaze's yaw and pitch; the neck takes half of the turn from the chest.
    const dHead = mulQ(ry(yaw), rx(nod));
    const dChest = R.wq[spine[2]].clone().multiply(T.restWQuat[spine[2]].clone().invert());
    R.setDelta(iNeck, dChest.clone().slerp(dHead, 0.5));
    R.fk(iNeck);
    R.setDelta(iHead, dHead);
    R.fk(iHead);
    // Shoulders relaxed (lowered) and a little forward; the mouse arm's comes forward a little more.
    for (const s of SIDES) {
      const ic = I(`clavicle_${s}`);
      const prot = 0.1 + (s === 'r' ? 0.15 * reach : 0.04 * relax);
      const dep = 0.1 - 0.008 * breath;
      R.setDelta(ic, mulQ(dChest, ry(-sgn(s) * prot), rz(-sgn(s) * dep)));
      R.fk(ic);
    }
  };

  /* ---- lean: never so far back that a hand cannot reach what it holds ---- */

  const fy0 = {l: -0.18, r: 0.18};
  const goals0 = goalsFor(fy0);
  const reachOver = (lean: number) => {
    placeTorso(lean, input.chair.seat.top + 0.09);
    let worst = -1;
    for (const s of SIDES) worst = Math.max(worst, goals0[s].W.distanceTo(R.wp[I(`upperarm_${s}`)]) - arm * 0.955);
    return worst;
  };
  let lean = leanIn;
  if (reachOver(lean) > 0) {
    let lo = leanIn;
    let hi = 1;
    for (let k = 0; k < 14; k++) {
      const mid = (lo + hi) / 2;
      if (reachOver(mid) > 0) lo = mid;
      else hi = mid;
    }
    lean = hi;
  }

  /* ---- legs ---- */

  const placeLegs = () => {
    for (const s of SIDES) {
      const it = I(`thigh_${s}`);
      const ic = I(`calf_${s}`);
      const ifo = I(`foot_${s}`);
      const ib = I(`ball_${s}`);
      const splay = sgn(s) * 0.075;
      // Thigh forward, lowered until its underside rests on the cushion (2 mm).
      const restT = T.restWPos[ic].clone().sub(T.restWPos[it]).normalize();
      const setThigh = (beta: number) => {
        const dT = v3(Math.sin(splay) * Math.cos(beta), -Math.sin(beta), Math.cos(splay) * Math.cos(beta));
        R.setWorld(it, swingQ(restT, dT).multiply(T.restWQuat[it]));
        R.fk(it);
        R.updateMats([it, ic]);
      };
      const gapAt = (beta: number) => {
        setThigh(beta);
        return R.minOver(T.probes.thigh[s], S.cushion);
      };
      let beta: number;
      let lo = -0.2;
      let hi = 0.3;
      if (gapAt(lo) <= 0.002) beta = lo;
      else if (gapAt(hi) >= 0.002) beta = hi;
      else {
        for (let k = 0; k < 14; k++) {
          const mid = (lo + hi) / 2;
          if (gapAt(mid) > 0.002) lo = mid;
          else hi = mid;
        }
        beta = lo;
      }
      setThigh(beta);
      const K = R.wp[ic].clone();
      // Shin down to the floor (vertical reach permitting), the feet a little apart.
      const drop = K.y - ankleY;
      const phi = drop < L.shin ? Math.acos(clamp(drop / L.shin, -1, 1)) : 0;
      const dS = v3(sgn(s) * 0.03, -Math.cos(phi), Math.sin(phi)).normalize();
      const restS = T.restWPos[ifo].clone().sub(T.restWPos[ic]).normalize();
      R.setWorld(ic, swingQ(restS, dS).multiply(T.restWQuat[ic]));
      R.fk(ic);
      // Foot flat, toes turned out; if the floor is out of reach the heel lifts (ball of the foot down).
      const A = R.wp[ifo];
      const toe = ry(sgn(s) * 0.12);
      const restB = T.restWPos[ib].clone().sub(T.restWPos[ifo]);
      let plantar = 0;
      if (A.y > ankleY + 0.001) {
        let lo = 0;
        let hi = 0.9;
        for (let k = 0; k < 16; k++) {
          const mid = (lo + hi) / 2;
          const by = A.y + restB.clone().applyQuaternion(rx(mid)).y;
          if (by > ballY + 0.001) lo = mid;
          else hi = mid;
        }
        plantar = (lo + hi) / 2;
      }
      R.setDelta(ifo, mulQ(toe, rx(plantar)));
      R.fk(ifo);
      R.setDelta(ib, toe);
      R.fk(ib);
    }
  };

  /* ---- seat: rest on the cushion, in front of the backrest ---- */

  const legBones = SIDES.flatMap((s) => [I(`thigh_${s}`), I(`calf_${s}`), I(`foot_${s}`), I(`ball_${s}`)]);
  const seatKey = `${lean.toFixed(5)}|${JSON.stringify(input.chair)}`;
  let seat = SEAT_CACHE.get(seatKey);
  if (!seat) {
    const post = postureFor(lean);
    let hipY = input.chair.seat.top + 0.085;
    let hipZ = post.hipZ;
    for (let it = 0; it < 5; it++) {
      placeTorso(lean, hipY, hipZ);
      placeLegs();
      R.updateMats();
    // The buttocks carry him: lowest of them 2 mm above the cushion.
      const gap = R.minOver(T.probes.seat, S.cushion);
      const back = R.minOver(T.probes.back, (p) => (p.y > input.chair.back.bottom - 0.03 && p.y < input.chair.back.top + 0.05 ? S.backGap(p) : Infinity));
      let moved = false;
      if (Math.abs(gap - 0.002) > 0.0005) {
        hipY += 0.002 - gap;
        moved = true;
      }
      if (back < 0.008) {
        hipZ += (0.008 - back) / Math.cos(BACK_TILT);
        moved = true;
      }
      if (!moved) break;
    }
    placeTorso(lean, hipY, hipZ);
    placeLegs();
    seat = {hipY, hipZ, legs: legBones.map((i) => R.lq[i].clone())};
    if (SEAT_CACHE.size > 32) SEAT_CACHE.delete(SEAT_CACHE.keys().next().value!);
    SEAT_CACHE.set(seatKey, seat);
  }
  const {hipY, hipZ} = seat;
  // Breathing moves only the chest and shoulders, so the seat and the legs are reused as solved.
  placeTorso(lean, hipY, hipZ, breath);
  legBones.forEach((i, k) => R.lq[i].copy(seat.legs[k]));
  R.fk(iPelvis);

  /* ---- arms ---- */

  const fy = {...fy0};
  let goals = goals0;
  const solveArm = (s: Side, g: HandGoal) => {
    const iu = I(`upperarm_${s}`);
    const il = I(`lowerarm_${s}`);
    const ih = I(`hand_${s}`);
    const i1 = I(`forearm_twist_01_${s}`);
    const i2 = I(`forearm_twist_02_${s}`);
    const Sh = R.wp[iu].clone();
    let W = g.W.clone();
    const dist = W.distanceTo(Sh);
    if (dist > arm * 0.985) W = Sh.clone().lerp(W, (arm * 0.985) / dist);
    // Two-bone IK, the elbow hanging down, a little out and back (the mouse arm opens a little more).
    const side = sgn(s);
    const pole = v3(side * lerp(0.42, 0.6, s === 'r' ? reach : relax), -1, -0.25).normalize();
    const dir = W.clone().sub(Sh);
    const dd = Math.max(1e-4, dir.length());
    dir.divideScalar(dd);
    const a = L.upper;
    const b = L.fore;
    const dc = Math.min(dd, (a + b) * 0.9995);
    const x = (a * a - b * b + dc * dc) / (2 * dc);
    const h = Math.sqrt(Math.max(0, a * a - x * x));
    const P0 = pole.clone().addScaledVector(dir, -pole.dot(dir));
    if (P0.lengthSq() < 1e-8) P0.set(0, -1, 0);
    P0.normalize();
    const u0 = T.restWPos[il].clone().sub(T.restWPos[iu]).normalize();
    const f0 = T.restWPos[ih].clone().sub(T.restWPos[il]).normalize();
    const h0 = v3(0, -side, 0);
    /** Pose the arm with the elbow swung by `sw` about the shoulder-wrist axis (+ = up and out). */
    const pose = (sw: number) => {
      const P = P0.clone().applyAxisAngle(dir, sw * swSign);
      const E = Sh.clone().addScaledVector(dir, x).addScaledVector(P, h);
      const u = E.clone().sub(Sh).normalize();
      const f = W.clone().sub(E).normalize();
      let hinge = new THREE.Vector3().crossVectors(u, f);
      if (hinge.lengthSq() < 1e-8) hinge = new THREE.Vector3().crossVectors(u, P);
      hinge.normalize();
      const qU = frameQuat(u0, h0, u, hinge);
      const qF = frameQuat(f0, h0, f, hinge);
      R.setWorld(iu, qU.multiply(T.restWQuat[iu]));
      R.fk(iu);
      const qL = qF.clone().multiply(T.restWQuat[il]);
      R.setWorld(il, qL);
      R.fk(il);
      // The forearm's share of the hand's roll, spread along it (twist bones at half way and at the wrist).
      const follow = qF.clone().multiply(T.restWQuat[ih]);
      const delta = g.q.clone().multiply(follow.invert());
      const tw = twistAngle(delta, f);
      R.setWorld(i1, axisQ(f, tw * 0.5).multiply(qL));
      R.setWorld(i2, axisQ(f, tw).multiply(qL));
      R.setWorld(ih, g.q.clone());
      R.fk(il);
      fy[s] = Math.atan2(f.x, f.z);
      return E;
    };
    // Which way of swinging the elbow raises it.
    const swSign = P0.clone().applyAxisAngle(dir, 0.3).y > P0.clone().applyAxisAngle(dir, -0.3).y ? 1 : -1;
    // The forearm must clear the desk edge, the keyboard and the mouse: swing the elbow up just enough.
    const armBones = [iu, il, i1, i2, ih];
    const clearance = (sw: number) => {
      pose(sw);
      R.updateMats(armBones);
      return R.minOver(T.probes.forearm[s], S.all);
    };
    let sw = 0;
    if (clearance(0) < 0.002) {
      let lo = 0;
      let hi = 0.8;
      if (clearance(hi) < 0.002) sw = hi;
      else {
        for (let it = 0; it < 12; it++) {
          const mid = (lo + hi) / 2;
          if (clearance(mid) < 0.002) lo = mid;
          else hi = mid;
        }
        sw = hi;
      }
    }
    const E = pose(sw);
    return {S: Sh, E, W};
  };
  const armJ: Record<string, {S: V; E: V; W: V}> = {};
  for (let pass = 0; pass < 2; pass++) {
    goals = goalsFor(fy);
    for (const s of SIDES) armJ[s] = solveArm(s, goals[s]);
  }
  R.updateMats();

  /* ---- fingers ---- */

  const flexAxis = (s: Side) => new THREE.Vector3().crossVectors(REST_HAND[s].d0, REST_HAND[s].n0).normalize();
  const press = (s: Side, k: number) => {
    if (typing <= 0) return 0;
    const ph = (s === 'l' ? 0 : 1.93) + k * 2.41;
    const w = 10.5 + k * 1.7 + (s === 'l' ? 0 : 0.9);
    return typing * Math.pow(Math.max(0, Math.sin(time * w + ph)), 8);
  };
  for (const s of SIDES) {
    const g = goals[s];
    const ih = I(`hand_${s}`);
    const fa = flexAxis(s);
    FINGERS.forEach((fname, k) => {
      const chain = [I(`${fname}_01_${s}`), I(`${fname}_02_${s}`), I(`${fname}_03_${s}`)];
      const leaf = I(`${fname}_04_leaf_${s}`);
      const axes = chain.map((b) => fa.clone().applyQuaternion(T.restWQuat[b].clone().invert()).normalize());
      const mats = [ih, ...chain, leaf];
      const probe = T.probes.tips[`${fname}_${s}`];
      const set = (c: number) => {
        chain.forEach((b, j) => R.lq[b].copy(T.restQuat[b]).multiply(axisQ(axes[j], clamp(c * g.ratio[j], LIMIT[j][0], LIMIT[j][1]))));
        R.fk(chain[0]);
        R.updateMats(mats);
      };
      const gap = (c: number) => {
        set(c);
        return R.minOver(probe, g.surf);
      };
      /** The curl at which the fingertip comes down to `hover` (cMax if it never does). */
      const contact = (hover: number, cMax: number) => {
        const N = 7;
        let prev = 0;
        if (gap(0) <= hover) return 0;
        for (let n = 1; n <= N; n++) {
          const c = (cMax * n) / N;
          if (gap(c) <= hover) {
            let lo = prev;
            let hi = c;
            for (let it = 0; it < 9; it++) {
              const mid = (lo + hi) / 2;
              if (gap(mid) > hover) lo = mid;
              else hi = mid;
            }
            return lo;
          }
          prev = c;
        }
        return cMax;
      };
      const rest = contact(g.hover[k], g.cMax[k]);
      const pk = press(s, k) * (s === 'r' ? 1 - toEnter : 1);
      let c = rest;
      if (pk > 0.001) c = Math.min(rest + 0.14 * pk, contact(0.0005, rest + 0.14 * pk));
      set(c);
    });
    // Thumb: aim the chain at its target, bending it to the target's distance.
    {
      const t1 = I(`thumb_01_${s}`);
      const t2 = I(`thumb_02_${s}`);
      const t3 = I(`thumb_03_${s}`);
      const tl = I(`thumb_04_leaf_${s}`);
      const target = g.thumb.clone().applyQuaternion(g.q).add(R.wp[ih]);
      const tdir = T.restWPos[tl].clone().sub(T.restWPos[t2]).normalize();
      const ta = new THREE.Vector3().crossVectors(tdir, REST_HAND[s].n0).normalize();
      const ax2 = ta.clone().applyQuaternion(T.restWQuat[t2].clone().invert());
      const ax3 = ta.clone().applyQuaternion(T.restWQuat[t3].clone().invert());
      const bend = (bv: number) => {
        R.lq[t1].copy(T.restQuat[t1]);
        R.lq[t2].copy(T.restQuat[t2]).multiply(axisQ(ax2, bv * 0.55));
        R.lq[t3].copy(T.restQuat[t3]).multiply(axisQ(ax3, bv));
        R.fk(t1);
      };
      const base = R.wp[t1].clone();
      const aimAt = (tg: V) => {
        const want = tg.distanceTo(base);
        let lo = 0;
        let hi = 1.2;
        for (let it = 0; it < 14; it++) {
          const mid = (lo + hi) / 2;
          bend(mid);
          if (R.wp[tl].distanceTo(base) > want) lo = mid;
          else hi = mid;
        }
        bend((lo + hi) / 2);
        const cur = R.wp[tl].clone().sub(base).normalize();
        const aim = tg.clone().sub(base).normalize();
        R.setWorld(t1, swingQ(cur, aim, 0.9).multiply(R.wq[t1]));
        R.fk(t1);
        R.updateMats([t1, t2, t3, tl]);
      };
      // Aim, then lift the target until the thumb's pad clears what is under it.
      for (let it = 0; it < 6; it++) {
        aimAt(target);
        const gap = R.minOver(T.probes.tips[`thumb_${s}`], g.surf);
        if (gap >= 0.0025) break;
        target.y += 1.5 * (0.0025 - gap);
      }
    }
  }
  R.fkAll();

  const joints: Record<string, V> = {
    hips: v3(0, hipY, hipZ),
    neck: R.wp[iNeck].clone(),
    head: R.wp[iHead].clone(),
  };
  for (const s of SIDES) {
    joints[`shoulder_${s}`] = armJ[s].S;
    joints[`elbow_${s}`] = armJ[s].E;
    joints[`wrist_${s}`] = armJ[s].W;
    joints[`knee_${s}`] = R.wp[I(`calf_${s}`)].clone();
    joints[`ankle_${s}`] = R.wp[I(`foot_${s}`)].clone();
  }
  return {lp: R.lp, lq: R.lq, lean, joints};
};

/* ------------------------------------------------------------------ the look */

export const HOLO_VERT = /* glsl */ `
  #include <common>
  #include <skinning_pars_vertex>
  #include <fog_pars_vertex>
  varying vec3 vNormalV;
  varying vec3 vViewPos;
  varying vec3 vFig;
  varying vec3 vFigN;
  varying vec3 vBind;
  void main() {
    #include <beginnormal_vertex>
    #include <skinbase_vertex>
    #include <skinnormal_vertex>
    vFigN = objectNormal;
    #include <defaultnormal_vertex>
    #include <begin_vertex>
    vBind = position;
    #include <skinning_vertex>
    vFig = transformed;
    #include <project_vertex>
    vNormalV = transformedNormal;
    vViewPos = mvPosition.xyz;
    #include <fog_vertex>
  }
`;

export const HOLO_FRAG = /* glsl */ `
  uniform vec3 uCore;
  uniform vec3 uRim;
  uniform float uOpacity;
  uniform float uTime;
  uniform float uLines;
  uniform float uSparkle;
  uniform float uScan;
  uniform float uHair;
  #include <common>
  #include <fog_pars_fragment>
  varying vec3 vNormalV;
  varying vec3 vViewPos;
  varying vec3 vFig;
  varying vec3 vFigN;
  varying vec3 vBind;

  float hash13(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.zyx + 31.32);
    return fract((p.x + p.y) * p.z);
  }
  vec3 hash33(vec3 p) {
    p = fract(p * vec3(0.1031, 0.1030, 0.0973));
    p += dot(p, p.yxz + 33.33);
    return fract((p.xxy + p.yxx) * p.zyx);
  }

  void main() {
    vec3 n = normalize(vNormalV);
    vec3 v = normalize(-vViewPos);
    float ndv = clamp(dot(n, v), 0.0, 1.0);
    float fr = 1.0 - ndv;
    float f2 = fr * fr;
    float f4 = f2 * f2;
    // Soft form light from above and from the screen (+z in figure space): volume without scene lights.
    vec3 nf = normalize(vFigN);
    float key = 0.5 + 0.5 * dot(nf, vec3(0.0, 0.62, 0.78));
    float hair = uHair;
    vec3 col = uCore * ((0.05 + 0.15 * key * key) * mix(1.0, 0.75, hair) + 0.22 * f2);
    // The silhouette: a thin, bright rim.
    col += uRim * (1.3 * f4 * fr + 0.03 * f2);

    // Contour lines: thin horizontal slices in figure space, a constant fraction of a pixel wide at
    // most, faded where they crowd (grazing angles), brighter toward the rim. Denser on the hair.
    float pitch = mix(0.0165, 0.0075, hair);
    float y = vFig.y / pitch;
    float fw = max(fwidth(y), 1e-5);
    float d = 0.5 - abs(fract(y) - 0.5);
    float hw = mix(0.0006, 0.00045, hair) / pitch;
    float wpx = max(hw / fw, 0.55);
    float line = clamp(wpx + 0.5 - d / fw, 0.0, 1.0) * min(1.0, 2.0 * hw / fw + 0.25);
    line *= 1.0 - smoothstep(0.16, 0.34, fw);
    // On near-horizontal surfaces the slices open into wide loops (tops of the shoulders, the elbow): let them go.
    line *= 1.0 - smoothstep(0.88, 0.985, abs(nf.y));
    // A slow scan band climbs the body and lights the lines as it passes.
    float yb = -0.15 + 2.0 * fract(uTime / 14.0);
    float sb = (vFig.y - yb) / 0.07;
    float wave = exp(-sb * sb) * uScan;
    col += uRim * line * uLines * (mix(0.045, 0.04, hair) + 0.4 * f2 + 0.4 * wave);
    col += uCore * wave * 0.07;

    // Very sparse static sparkles, attached to the body (bind space), twinkling slowly.
    vec3 g = vBind / 0.011;
    vec3 ci = floor(g);
    float hs = hash13(ci + 11.0);
    if (hs > 0.988 && uSparkle > 0.0) {
      vec3 c = ci + 0.2 + 0.6 * hash33(ci);
      float dd = length(g - c) * 0.011;
      float px = length(fwidth(vBind)) * 0.8;
      float r0 = 0.0008;
      float r = max(r0, px);
      float sp = (r0 * r0) / (r * r) * (1.0 - smoothstep(0.0, r, dd));
      sp *= 0.5 + 0.5 * sin(uTime * 1.3 + hs * 211.0);
      col += uRim * sp * 2.2 * uSparkle;
    }

    // The light thins out toward the floor.
    col *= mix(0.5, 1.0, smoothstep(0.04, 0.62, vFig.y));

    gl_FragColor = vec4(col, uOpacity);
    #include <fog_fragment>
  }
`;

type Uniforms = {
  uCore: {value: THREE.Color};
  uRim: {value: THREE.Color};
  uOpacity: {value: number};
  uTime: {value: number};
  uLines: {value: number};
  uSparkle: {value: number};
  uScan: {value: number};
};
const makeMaterial = (shared: Uniforms, hair: boolean) =>
  new THREE.ShaderMaterial({
    uniforms: {...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), ...shared, uHair: {value: hair ? 1 : 0}},
    vertexShader: HOLO_VERT,
    fragmentShader: HOLO_FRAG,
    fog: true,
    depthWrite: true,
    depthTest: true,
    transparent: false,
  });

type Instance = {
  readonly root: THREE.Group;
  readonly bones: readonly THREE.Bone[];
  readonly materials: readonly THREE.ShaderMaterial[];
  readonly uniforms: Uniforms;
  dispose(): void;
};
const instantiate = (T: PersonTemplate): Instance => {
  const model = cloneSkinned(T.scene) as THREE.Group;
  const root = new THREE.Group();
  root.rotation.y = Math.PI; // the model faces +z; the figure faces -z
  root.add(model);
  const uniforms: Uniforms = {
    uCore: {value: new THREE.Color()},
    uRim: {value: new THREE.Color()},
    uOpacity: {value: 1},
    uTime: {value: 0},
    uLines: {value: 1},
    uSparkle: {value: 1},
    uScan: {value: 1},
  };
  const materials: THREE.ShaderMaterial[] = [];
  let bones: readonly THREE.Bone[] = [];
  const skeletons: THREE.Skeleton[] = [];
  model.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (!m.isSkinnedMesh) return;
    const mat = makeMaterial(uniforms, m.name === 'Hair');
    materials.push(mat);
    m.material = mat;
    m.frustumCulled = false;
    m.castShadow = false;
    m.receiveShadow = false;
    m.userData.noEdges = true;
    skeletons.push(m.skeleton);
    if (!bones.length) bones = m.skeleton.bones;
  });
  return {
    root,
    bones,
    materials,
    uniforms,
    dispose() {
      materials.forEach((m) => m.dispose());
      skeletons.forEach((s) => s.dispose());
    },
  };
};

/* ------------------------------------------------------------------ component */

const relTo = (w: Vec3, o: readonly number[]): Vec3 => [w[0] - o[0], w[1] - o[1], w[2] - o[2]];

/**
 * Material slots (shot editor, via useLook):
 *   core  colour of the body's light; emissive intensity = body brightness
 *   rim   colour of the silhouette / contour light; emissive intensity = rim brightness
 */
export const HoloPerson: React.FC<HoloFigureProps> = ({position, pose = {}, time = 0, keyboard, enter, mouse, chair, lines = 1, sparkle = 1, scan = 1}) => {
  const th = useTheme();
  const core = useLook('core', {color: th.tone.system.base, emissiveIntensity: 0.4});
  const rim = useLook('rim', {color: th.tone.system.hot, emissiveIntensity: 2.0});
  const off = useObjectOffset();
  const {isRendering} = useRemotionEnvironment();
  const advance = useThree((s) => s.advance);
  const invalidate = useThree((s) => s.invalidate);
  const [template, setTemplate] = useState<PersonTemplate | null>(() => templateReady);

  // Hold the render until the model is in the scene and drawn (exports never capture a frame without him).
  const hold = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (templateReady) {
      if (!template) setTemplate(templateReady);
      return undefined;
    }
    let live = true;
    const handle = delayRender('HoloPerson: loading models/john/john.glb');
    hold.current = handle;
    loadPersonTemplate().then(
      (t) => {
        if (live) setTemplate(t);
      },
      (e: unknown) => cancelRender(e instanceof Error ? e : new Error(String(e))),
    );
    return () => {
      live = false;
      if (hold.current === handle) {
        continueRender(handle);
        hold.current = null;
      }
    };
    // Mount only: the template is module-level.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inst = useMemo(() => (template ? instantiate(template) : null), [template]);
  useEffect(() => () => inst?.dispose(), [inst]);

  useEffect(() => {
    if (!inst || hold.current === null) return;
    if (isRendering) advance(performance.now());
    else invalidate();
    continueRender(hold.current);
    hold.current = null;
  }, [inst, isRendering, advance, invalidate]);

  if (inst && template) {
    // Where the body really is (its position plus any offset the shot applied), so the hands still land.
    const origin = [position[0] + off[0], position[1] + off[1], position[2] + off[2]];
    const solved = solvePerson(template, {pose, time: finite(time), keyboard: relTo(keyboard, origin), enter: relTo(enter, origin), mouse: relTo(mouse, origin), chair});
    inst.bones.forEach((b, i) => {
      b.position.copy(solved.lp[i]);
      b.quaternion.copy(solved.lq[i]);
    });
    const u = inst.uniforms;
    u.uCore.value.set(core.color).multiplyScalar(Math.max(0, core.emissiveIntensity));
    u.uRim.value.set(rim.color).multiplyScalar(Math.max(0, rim.emissiveIntensity));
    u.uOpacity.value = clamp01(core.opacity);
    u.uTime.value = finite(time);
    u.uLines.value = Math.max(0, lines);
    u.uSparkle.value = Math.max(0, sparkle);
    u.uScan.value = Math.max(0, scan);
    const opaque = core.opacity >= 0.999;
    for (const m of inst.materials) {
      m.transparent = !opaque;
      m.depthWrite = opaque;
    }
  }

  return <group position={[position[0], position[1], position[2]]}>{inst ? <primitive object={inst.root} /> : null}</group>;
};
