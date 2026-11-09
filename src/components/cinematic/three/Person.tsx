import React, {useLayoutEffect, useMemo} from 'react';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {useTheme} from '../../../styles/ThemeContext';
import {useLook, useObjectOffset, useVariant, type LookProps} from '../../../shot/runtime';
import {createRandom} from '../../random';
import {getHaloTexture} from '../../cyber/three/materials';
import type {Vec3} from '../../cyber/three/rig';
import {JOHN, KEYBOARD} from '../world';
import {cineMaterials} from './materials';

/**
 * John, the developer: a stylised figure, seen mostly from behind and three
 * quarter. No face: a head of dark hair under headphones, a hoodie, jeans,
 * forearms reaching to the keyboard. The silhouette says "someone working at
 * a computer, late" before any light reaches him.
 *
 * Pose is a pure function of props:
 *   typing  0..1  hands drum on the keyboard (driven by `time`)
 *   lean    -1..1 back in the chair .. leaning into the screen
 *   turn    head yaw toward the agent monitor (+) or the game (-), radians
 *   reach   0..1 the right hand goes to the mouse instead of the keyboard
 *   slump   0..1 shoulders drop, head bows (tired, done for the night)
 *
 * Variants (shot editor: object variant):
 *   figure    matte stylised figure (hoodie, jeans, skin, hair, headphones)
 *   hologram  the same body as a dark silhouette covered in light dots: the
 *             legacy look's "luminous figure", readable as a person from any
 *             angle without facial detail
 *
 * Material slots (useLook): hoodie, jeans, skin, hair, headphones (figure);
 * body, dots (hologram: dots colour, emissive intensity = dot brightness).
 */
export type Pose = {
  readonly typing?: number;
  readonly lean?: number;
  readonly turn?: number;
  readonly reach?: number;
  readonly slump?: number;
};

const V = (v: Vec3): [number, number, number] => [v[0], v[1], v[2]];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Chair geometry the figure sits on (shared by the figure and the chair object). */
export const SEAT = {y: 0.47, hipZ: 0.02} as const;

/** Upper arm and forearm lengths for the refined (IK) arms, metres. */
const UPPER_ARM = 0.3;
const FOREARM = 0.28;

/**
 * Two-bone IK: the elbow for a shoulder and a hand, with the elbow bending
 * toward `pole`. If the hand is out of reach the bones stretch evenly (better
 * than a hand floating short of the keyboard).
 */
const solveElbow = (sh: Vec3, hand: Vec3, pole: Vec3): Vec3 => {
  const S = new THREE.Vector3(...sh);
  const H = new THREE.Vector3(...hand);
  const dir = H.clone().sub(S);
  const d = Math.max(1e-4, dir.length());
  dir.divideScalar(d);
  const k = Math.max(1, d / ((UPPER_ARM + FOREARM) * 0.999));
  const a = UPPER_ARM * k;
  const b = FOREARM * k;
  const x = (a * a - b * b + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, a * a - x * x));
  const P = new THREE.Vector3(...pole);
  P.sub(dir.clone().multiplyScalar(P.dot(dir))).normalize();
  const E = S.addScaledVector(dir, x).addScaledVector(P, h);
  return [E.x, E.y, E.z];
};

/**
 * Every joint of the seated pose, relative to the chair's floor point.
 * `reachFrom` is where the body really is (its position plus any offset the
 * shot applied), so the hands still find the keyboard when the figure moves.
 * `refined` uses IK arms with real proportions, thighs resting on the seat
 * and a hood that clears the chair back; the original scenes keep the
 * original construction.
 */
const skeleton = (position: Vec3, pose: Pose, time: number, refined = false, reachFrom: Vec3 = position) => {
  const typing = pose.typing ?? 0;
  const lean = pose.lean ?? 0.15;
  const turn = pose.turn ?? 0;
  const reach = pose.reach ?? 0;
  const slump = pose.slump ?? 0;
  const seatY = SEAT.y;
  const hipZ = SEAT.hipZ;
  const pivot: Vec3 = [0, seatY + 0.05, hipZ];
  const leanAngle = -0.12 - 0.22 * lean + 0.18 * slump; // negative = toward -z (the desk)
  const torsoH = 0.56 - 0.03 * slump;
  const shoulderY = pivot[1] + torsoH * Math.cos(leanAngle);
  const shoulderZ = pivot[2] + torsoH * Math.sin(leanAngle);
  const shoulderW = 0.2;
  const headY = shoulderY + 0.19 - 0.04 * slump;
  const headZ = shoulderZ - 0.03 - 0.05 * slump;
  const kb: Vec3 = [KEYBOARD.position[0] - reachFrom[0], KEYBOARD.position[1] - reachFrom[1] + 0.035, KEYBOARD.position[2] - reachFrom[2]];
  const drum = (phase: number) => (typing > 0 ? Math.max(0, Math.sin(time * 11 + phase)) * 0.012 * typing : 0);
  const leftHand: Vec3 = [kb[0] - 0.1, kb[1] + drum(0), kb[2] + 0.02];
  const mouse: Vec3 = [0.34 - reachFrom[0], 0.775 - reachFrom[1], 0.16 - reachFrom[2]];
  const rightHand: Vec3 = [lerp(kb[0] + 0.1, mouse[0], reach), lerp(kb[1] + drum(1.7), mouse[1] + 0.02, reach), lerp(kb[2] + 0.02, mouse[2], reach)];
  const leftShoulder: Vec3 = [-shoulderW, shoulderY - 0.02, shoulderZ];
  const rightShoulder: Vec3 = [shoulderW, shoulderY - 0.02, shoulderZ];
  const elbow = refined
    ? (sh: Vec3, hand: Vec3, side: number): Vec3 => solveElbow(sh, hand, [side * 0.55, -1, 0.35])
    : (sh: Vec3, hand: Vec3, side: number): Vec3 => [lerp(sh[0], hand[0], 0.45) + side * 0.08, lerp(sh[1], hand[1], 0.55) - 0.02, lerp(sh[2], hand[2], 0.42) + 0.06];
  const headRot: Vec3 = [0.12 + 0.3 * slump, turn, 0];
  // Refined: thighs rest on the seat cushion (top at seatY + 0.02) instead of sinking into it.
  const thighY = refined ? seatY + 0.085 : seatY + 0.03;
  const kneeY = refined ? seatY + 0.075 : seatY + 0.02;
  return {
    seatY,
    hipZ,
    pivot,
    leanAngle,
    torsoH,
    shoulderY,
    shoulderZ,
    head: [0, headY, headZ] as Vec3,
    headRot,
    neckA: [0, shoulderY - 0.02, shoulderZ] as Vec3,
    neckB: [0, headY - 0.1, headZ] as Vec3,
    leftHand,
    rightHand,
    leftShoulder,
    rightShoulder,
    leftElbow: elbow(leftShoulder, leftHand, -1),
    rightElbow: elbow(rightShoulder, rightHand, 1),
    thighs: [
      [[-0.09, thighY, hipZ], [-0.1, kneeY, hipZ - 0.44]],
      [[0.09, thighY, hipZ], [0.1, kneeY, hipZ - 0.44]],
    ] as [Vec3, Vec3][],
    shins: [
      [[-0.1, kneeY, hipZ - 0.44], [-0.1, 0.06, hipZ - 0.5]],
      [[0.1, kneeY, hipZ - 0.44], [0.1, 0.06, hipZ - 0.5]],
    ] as [Vec3, Vec3][],
    hood: refined ? ([0, -0.035, 0.07, 0.1] as const) : ([0, -0.02, 0.1, 0.11] as const),
    feet: [[-0.1, 0.03, hipZ - 0.56], [0.1, 0.03, hipZ - 0.56]] as Vec3[],
  };
};
type Skeleton = ReturnType<typeof skeleton>;

/** A capsule between two points. */
const Limb: React.FC<{readonly a: Vec3; readonly b: Vec3; readonly r: number; readonly look: LookProps}> = ({a, b, r, look}) => {
  const {position, quaternion, length} = useMemo(() => {
    const A = new THREE.Vector3(...a);
    const B = new THREE.Vector3(...b);
    const dir = B.clone().sub(A);
    const length = dir.length();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    return {position: A.clone().add(B).multiplyScalar(0.5), quaternion: q, length};
  }, [a, b]);
  return (
    <mesh position={position} quaternion={quaternion} castShadow>
      <capsuleGeometry args={[r, Math.max(0.01, length - r * 0.6), 6, 14]} />
      <meshStandardMaterial {...look} />
    </mesh>
  );
};

/** The office chair John sits in. A separate object so a shot can place it on its own. */
export const OfficeChair: React.FC<{readonly position?: Vec3}> = ({position = JOHN.position}) => {
  const th = useTheme();
  const m = useMemo(() => cineMaterials(th), [th]);
  const shell = useLook('shell', {color: m.plasticDark, roughness: 0.75});
  const base = useLook('base', {color: m.steelDark, roughness: 0.4, metalness: 0.7});
  const seatGeo = useMemo(() => new RoundedBoxGeometry(0.5, 0.08, 0.5, 3, 0.03), []);
  const backGeo = useMemo(() => new RoundedBoxGeometry(0.46, 0.58, 0.07, 3, 0.03), []);
  const {y: seatY, hipZ} = SEAT;
  return (
    <group position={V(position)}>
      {Array.from({length: 5}, (_, i) => (
        <mesh key={i} position={[Math.cos((i / 5) * Math.PI * 2) * 0.17, 0.03, Math.sin((i / 5) * Math.PI * 2) * 0.17]} rotation={[0, -(i / 5) * Math.PI * 2, 0]} castShadow>
          <boxGeometry args={[0.34, 0.03, 0.04]} />
          <meshStandardMaterial {...shell} roughness={0.5} metalness={0.3} />
        </mesh>
      ))}
      <mesh position={[0, 0.25, 0]} castShadow>
        <cylinderGeometry args={[0.025, 0.03, 0.42, 16]} />
        <meshStandardMaterial {...base} />
      </mesh>
      <mesh geometry={seatGeo} position={[0, seatY - 0.02, hipZ]} castShadow receiveShadow>
        <meshStandardMaterial {...shell} />
      </mesh>
      <mesh geometry={backGeo} position={[0, seatY + 0.36, hipZ + 0.26]} rotation={[0.12, 0, 0]} castShadow>
        <meshStandardMaterial {...shell} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * 0.27, seatY + 0.1, hipZ + 0.04]} castShadow>
            <boxGeometry args={[0.03, 0.22, 0.03]} />
            <meshStandardMaterial {...shell} roughness={0.6} />
          </mesh>
          <mesh position={[s * 0.27, seatY + 0.22, hipZ]} castShadow>
            <boxGeometry args={[0.06, 0.025, 0.26]} />
            <meshStandardMaterial {...shell} roughness={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

type FigureLooks = {readonly hoodie: LookProps; readonly jeans: LookProps; readonly skin: LookProps; readonly hair: LookProps; readonly headphones: LookProps; readonly shoes: LookProps};

/** The body as meshes (the matte figure, or the hologram's dark occluding silhouette). */
const FigureMeshes: React.FC<{readonly s: Skeleton; readonly looks: FigureLooks}> = ({s, looks}) => {
  const torsoGeo = useMemo(() => new RoundedBoxGeometry(0.4, s.torsoH, 0.22, 4, 0.08), [s.torsoH]);
  return (
    <>
      {/* ---- legs: thighs forward under the desk, shins down ---- */}
      {s.thighs.map(([a, b], i) => (
        <Limb key={`t${i}`} a={a} b={b} r={0.065} look={looks.jeans} />
      ))}
      {s.shins.map(([a, b], i) => (
        <Limb key={`s${i}`} a={a} b={b} r={0.05} look={looks.jeans} />
      ))}
      {s.feet.map((f, i) => (
        <mesh key={i} position={V(f)} castShadow>
          <boxGeometry args={[0.09, 0.06, 0.22]} />
          <meshStandardMaterial {...looks.shoes} />
        </mesh>
      ))}

      {/* ---- torso (hoodie), leaning from the hips ---- */}
      <group position={V(s.pivot)} rotation={[s.leanAngle, 0, 0]}>
        <mesh geometry={torsoGeo} position={[0, s.torsoH / 2, 0]} castShadow receiveShadow>
          <meshStandardMaterial {...looks.hoodie} />
        </mesh>
        {/* hood, bunched behind the neck */}
        <mesh position={[0, s.torsoH + s.hood[1], s.hood[2]]} rotation={[0.5, 0, 0]} castShadow>
          <torusGeometry args={[s.hood[3], 0.045, 8, 18, Math.PI * 1.25]} />
          <meshStandardMaterial {...looks.hoodie} />
        </mesh>
        {/* kangaroo pocket seam */}
        <mesh position={[0, s.torsoH * 0.35, -0.112]} userData={{noEdges: true}}>
          <boxGeometry args={[0.22, 0.01, 0.004]} />
          <meshStandardMaterial {...looks.jeans} />
        </mesh>
      </group>

      {/* ---- head: neck, hair, headphones ---- */}
      <Limb a={s.neckA} b={s.neckB} r={0.035} look={looks.skin} />
      <group position={V(s.head)} rotation={V(s.headRot)}>
        <mesh castShadow>
          <sphereGeometry args={[0.105, 28, 20]} />
          <meshStandardMaterial {...looks.skin} />
        </mesh>
        {/* hair: a cap and a back volume */}
        <mesh position={[0, 0.02, 0.012]} scale={[1.02, 0.95, 1.04]} castShadow>
          <sphereGeometry args={[0.108, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
          <meshStandardMaterial {...looks.hair} />
        </mesh>
        {/* headphones: band and two cups */}
        <mesh position={[0, 0.03, 0]}>
          <torusGeometry args={[0.118, 0.011, 8, 28, Math.PI]} />
          <meshStandardMaterial {...looks.headphones} />
        </mesh>
        {[-1, 1].map((k) => (
          <mesh key={k} position={[k * 0.118, -0.005, 0.005]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.04, 0.04, 0.028, 20]} />
            <meshStandardMaterial {...looks.headphones} />
          </mesh>
        ))}
      </group>

      {/* ---- arms ---- */}
      <Limb a={s.leftShoulder} b={s.leftElbow} r={0.055} look={looks.hoodie} />
      <Limb a={s.rightShoulder} b={s.rightElbow} r={0.055} look={looks.hoodie} />
      <Limb a={s.leftElbow} b={s.leftHand} r={0.042} look={looks.hoodie} />
      <Limb a={s.rightElbow} b={s.rightHand} r={0.042} look={looks.hoodie} />
      {[s.leftHand, s.rightHand].map((h, i) => (
        <mesh key={i} position={V(h)} scale={[1.1, 0.6, 1.3]} castShadow>
          <sphereGeometry args={[0.045, 16, 12]} />
          <meshStandardMaterial {...looks.skin} />
        </mesh>
      ))}
    </>
  );
};

export const Developer: React.FC<{
  readonly position?: Vec3;
  readonly pose?: Pose;
  readonly time?: number;
  /** Draw the chair too (default). Shots that edit the chair separately render <OfficeChair> and pass false. */
  readonly chair?: boolean;
  readonly variant?: 'figure' | 'hologram';
  /** Corrected proportions (IK arms, seated thighs, hood clear of the chair). */
  readonly refined?: boolean;
}> = ({position = JOHN.position, pose = {}, time = 0, chair = true, variant, refined = false}) => {
  const th = useTheme();
  const m = useMemo(() => cineMaterials(th), [th]);
  const v = useVariant(variant ?? 'figure');
  const off = useObjectOffset();
  const s = skeleton(position, pose, time, refined, [position[0] + off[0], position[1] + off[1], position[2] + off[2]]);
  const hologram = v === 'hologram';

  const hoodie = useLook('hoodie', {color: m.fabric, roughness: 0.92});
  const jeans = useLook('jeans', {color: m.denim, roughness: 0.85});
  const skin = useLook('skin', {color: m.skin, roughness: 0.9});
  const hair = useLook('hair', {color: m.hair, roughness: 0.95});
  const headphones = useLook('headphones', {color: '#15171E', roughness: 0.5});
  const shoes = useLook('shoes', {color: '#14161C', roughness: 0.6});
  const body = useLook('body', {color: '#000000', roughness: 1});
  const dots = useLook('dots', {color: th.tone.system.hot, emissiveIntensity: 2.6});
  const looks: FigureLooks = hologram ? {hoodie: body, jeans: body, skin: body, hair: body, headphones: body, shoes: body} : {hoodie, jeans, skin, hair, headphones, shoes};

  return (
    <group position={V(position)}>
      {chair ? <OfficeChair position={[0, 0, 0]} /> : null}
      <FigureMeshes s={s} looks={looks} />
      {hologram ? <HoloDots s={s} color={dots.color} intensity={dots.emissiveIntensity} opacity={dots.opacity} /> : null}
    </group>
  );
};

/* ------------------------------------------------------------------ hologram */

/**
 * Surface samples of the body, generated once (deterministic seed) in each
 * part's own parameter space, then placed on the current pose every frame.
 */
type Part =
  | {readonly kind: 'capsule'; readonly n: number; readonly get: (s: Skeleton) => {a: Vec3; b: Vec3; r: number}}
  | {readonly kind: 'ellipsoid'; readonly n: number; readonly get: (s: Skeleton) => {c: Vec3; r: Vec3; m: THREE.Matrix4}};

const PARTS: readonly Part[] = [
  {kind: 'capsule', n: 416, get: (s) => ({a: s.thighs[0][0], b: s.thighs[0][1], r: 0.065})},
  {kind: 'capsule', n: 416, get: (s) => ({a: s.thighs[1][0], b: s.thighs[1][1], r: 0.065})},
  {kind: 'capsule', n: 320, get: (s) => ({a: s.shins[0][0], b: s.shins[0][1], r: 0.05})},
  {kind: 'capsule', n: 320, get: (s) => ({a: s.shins[1][0], b: s.shins[1][1], r: 0.05})},
  {kind: 'capsule', n: 112, get: (s) => ({a: [s.feet[0][0], 0.04, s.feet[0][2] + 0.08], b: [s.feet[0][0], 0.04, s.feet[0][2] - 0.08], r: 0.04})},
  {kind: 'capsule', n: 112, get: (s) => ({a: [s.feet[1][0], 0.04, s.feet[1][2] + 0.08], b: [s.feet[1][0], 0.04, s.feet[1][2] - 0.08], r: 0.04})},
  {kind: 'capsule', n: 96, get: (s) => ({a: s.neckA, b: s.neckB, r: 0.035})},
  {kind: 'capsule', n: 320, get: (s) => ({a: s.leftShoulder, b: s.leftElbow, r: 0.055})},
  {kind: 'capsule', n: 320, get: (s) => ({a: s.rightShoulder, b: s.rightElbow, r: 0.055})},
  {kind: 'capsule', n: 272, get: (s) => ({a: s.leftElbow, b: s.leftHand, r: 0.042})},
  {kind: 'capsule', n: 272, get: (s) => ({a: s.rightElbow, b: s.rightHand, r: 0.042})},
  {kind: 'ellipsoid', n: 96, get: (s) => ({c: s.leftHand, r: [0.05, 0.028, 0.06], m: new THREE.Matrix4()})},
  {kind: 'ellipsoid', n: 96, get: (s) => ({c: s.rightHand, r: [0.05, 0.028, 0.06], m: new THREE.Matrix4()})},
  // Torso: a rounded box leaning from the hips.
  {
    kind: 'ellipsoid',
    n: 2080,
    get: (s) => ({c: [s.pivot[0], s.pivot[1], s.pivot[2]], r: [0.2, s.torsoH / 2, 0.11], m: new THREE.Matrix4().makeRotationX(s.leanAngle).multiply(new THREE.Matrix4().makeTranslation(0, s.torsoH / 2, 0))}),
  },
  // Head (dense: it is what reads as "a person").
  {kind: 'ellipsoid', n: 992, get: (s) => ({c: s.head, r: [0.11, 0.112, 0.112], m: new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...V(s.headRot)))})},
];

/** Rounded-box exponent for ellipsoid parts (1 = ellipsoid, < 1 squarer). */
const SQUARE = 0.62;
const DOTS = PARTS.reduce((n, p) => n + p.n, 0);
/** Push dots off the occluding surface so they never z-fight with it. */
const LIFT = 0.006;

const samples = (() => {
  const rnd = createRandom(4211);
  return PARTS.map((p) =>
    Array.from({length: p.n}, () => {
      // A direction on the unit sphere and an axial position.
      const z = rnd.range(-1, 1);
      const t = rnd.range(0, Math.PI * 2);
      const q = Math.sqrt(1 - z * z);
      return {d: [q * Math.cos(t), q * Math.sin(t), z] as Vec3, u: rnd.next(), th: rnd.range(0, Math.PI * 2), cap: rnd.next(), glow: rnd.range(0.5, 1)};
    }),
  );
})();

const HoloDots: React.FC<{readonly s: Skeleton; readonly color: string; readonly intensity: number; readonly opacity: number}> = ({s, color, intensity, opacity}) => {
  const {geometry, material} = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(DOTS * 3), 3));
    const tint = new Float32Array(DOTS * 3);
    let k = 0;
    samples.forEach((list) => list.forEach((p) => tint.set([p.glow, p.glow, p.glow], 3 * k++)));
    g.setAttribute('color', new THREE.BufferAttribute(tint, 3));
    const mat = new THREE.PointsMaterial({size: 0.016, sizeAttenuation: true, map: getHaloTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending});
    return {geometry: g, material: mat};
  }, []);

  material.color.set(color).multiplyScalar(intensity);
  material.opacity = opacity;

  useLayoutEffect(() => {
    const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
    const out = pos.array as Float32Array;
    const A = new THREE.Vector3();
    const B = new THREE.Vector3();
    const axis = new THREE.Vector3();
    const e1 = new THREE.Vector3();
    const e2 = new THREE.Vector3();
    const p = new THREE.Vector3();
    let k = 0;
    PARTS.forEach((part, pi) => {
      const list = samples[pi];
      if (part.kind === 'capsule') {
        const {a, b, r} = part.get(s);
        A.set(...V(a));
        B.set(...V(b));
        axis.subVectors(B, A);
        const len = axis.length();
        axis.normalize();
        e1.set(Math.abs(axis.y) < 0.9 ? 0 : 1, Math.abs(axis.y) < 0.9 ? 1 : 0, 0).cross(axis).normalize();
        e2.crossVectors(axis, e1);
        // Share of samples on the end caps, by area.
        const capShare = (2 * r) / (2 * r + len);
        const rr = r + LIFT;
        for (const sm of list) {
          if (sm.cap < capShare) {
            const [dx, dy, dz] = sm.d;
            const along = dx * axis.x + dy * axis.y + dz * axis.z;
            p.copy(along >= 0 ? B : A).add(new THREE.Vector3(dx, dy, dz).multiplyScalar(rr));
          } else {
            p.copy(A)
              .addScaledVector(axis, sm.u * len)
              .addScaledVector(e1, Math.cos(sm.th) * rr)
              .addScaledVector(e2, Math.sin(sm.th) * rr);
          }
          out[3 * k] = p.x;
          out[3 * k + 1] = p.y;
          out[3 * k + 2] = p.z;
          k++;
        }
      } else {
        const {c, r, m} = part.get(s);
        for (const sm of list) {
          const sq = (v: number) => Math.sign(v) * Math.pow(Math.abs(v), SQUARE);
          p.set(sq(sm.d[0]) * (r[0] + LIFT), sq(sm.d[1]) * (r[1] + LIFT), sq(sm.d[2]) * (r[2] + LIFT)).applyMatrix4(m);
          out[3 * k] = c[0] + p.x;
          out[3 * k + 1] = c[1] + p.y;
          out[3 * k + 2] = c[2] + p.z;
          k++;
        }
      }
    });
    pos.needsUpdate = true;
    geometry.computeBoundingSphere();
  });

  return <points geometry={geometry} material={material} renderOrder={2} frustumCulled={false} />;
};
