import React, {useLayoutEffect, useMemo, useRef} from 'react';
import * as THREE from 'three';
import {cyber} from '../../../styles/cyber';
import {hdr, hdrRamp, structureProps} from './materials';
import type {Vec3} from './rig';

/**
 * "Islands of compute": the look's picture of an infrastructure environment
 * (a cloud region, a provider, a cluster). A dark plate that floats above the
 * mirror floor, carrying rows of thin upright rack slabs whose front seams
 * work as level meters, and a hairline perimeter ring: the boundary of what
 * is allowed in.
 *
 *   plateOutline(spec, grow, y)   closed outline of a plate (also the ring path)
 *   rackRows / rackFan            rack layouts
 *   <ComputeIsland>               plate + racks; load level and tone per rack
 *   <PerimeterRing>               hairline boundary with openable gates
 *
 * Everything is a pure function of props. Geometry is built once; per frame
 * only instance matrices, instance colours and a few uniforms change.
 */

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const smooth = (t: number) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};
const wrap01 = (t: number) => ((t % 1) + 1) % 1;

/* ------------------------------------------------------------------ outlines */

/** A provider is told apart by the silhouette of its plate. */
export type PlateSpec =
  | {readonly kind: 'hex'; readonly r: number; readonly corner?: number}
  | {readonly kind: 'rect'; readonly w: number; readonly d: number; readonly corner?: number}
  | {readonly kind: 'circle'; readonly r: number};

type P2 = readonly [number, number];

const roundedPolygon = (verts: readonly P2[], radius: number, steps = 6): P2[] => {
  const n = verts.length;
  const out: P2[] = [];
  for (let i = 0; i < n; i++) {
    const v = verts[i];
    if (radius <= 1e-4) {
      out.push(v);
      continue;
    }
    const p = verts[(i + n - 1) % n];
    const q = verts[(i + 1) % n];
    const l1 = Math.hypot(p[0] - v[0], p[1] - v[1]);
    const l2 = Math.hypot(q[0] - v[0], q[1] - v[1]);
    const d1: P2 = [(p[0] - v[0]) / l1, (p[1] - v[1]) / l1];
    const d2: P2 = [(q[0] - v[0]) / l2, (q[1] - v[1]) / l2];
    const half = Math.acos(Math.min(1, Math.max(-1, d1[0] * d2[0] + d1[1] * d2[1]))) / 2;
    const t = radius / Math.tan(half);
    const c = radius / Math.sin(half);
    const bl = Math.hypot(d1[0] + d2[0], d1[1] + d2[1]);
    const cx = v[0] + ((d1[0] + d2[0]) / bl) * c;
    const cz = v[1] + ((d1[1] + d2[1]) / bl) * c;
    const a1 = Math.atan2(v[1] + d1[1] * t - cz, v[0] + d1[0] * t - cx);
    const a2 = Math.atan2(v[1] + d2[1] * t - cz, v[0] + d2[0] * t - cx);
    let da = a2 - a1;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    for (let k = 0; k <= steps; k++) {
      const a = a1 + (da * k) / steps;
      out.push([cx + Math.cos(a) * radius, cz + Math.sin(a) * radius]);
    }
  }
  return out;
};

/** Outline of a plate in its local x/z plane, grown outwards by `grow` (negative shrinks). Polar angle increases along it. */
const outline2D = (spec: PlateSpec, grow = 0): P2[] => {
  if (spec.kind === 'circle') {
    const r = Math.max(0.01, spec.r + grow);
    return Array.from({length: 128}, (_, i) => {
      const a = (i / 128) * Math.PI * 2;
      return [Math.cos(a) * r, Math.sin(a) * r] as const;
    });
  }
  const corner = Math.max(0, (spec.corner ?? 0) + grow);
  if (spec.kind === 'hex') {
    const r = Math.max(0.01, spec.r + grow / Math.cos(Math.PI / 6));
    const verts = Array.from({length: 6}, (_, i) => [Math.cos((i * Math.PI) / 3) * r, Math.sin((i * Math.PI) / 3) * r] as const);
    return roundedPolygon(verts, corner);
  }
  const hw = Math.max(0.01, spec.w / 2 + grow);
  const hd = Math.max(0.01, spec.d / 2 + grow);
  return roundedPolygon(
    [
      [hw, -hd],
      [hw, hd],
      [-hw, hd],
      [-hw, -hd],
    ],
    Math.min(corner, hw, hd),
  );
};

/**
 * A closed polyline as a THREE.Curve, parametrised by exact arc length
 * (so `t`, `u` and "fraction of the perimeter" are the same thing).
 */
export class OutlineCurve extends THREE.Curve<THREE.Vector3> {
  private readonly pts: THREE.Vector3[];
  private readonly cum: number[];
  readonly total: number;

  constructor(points: readonly THREE.Vector3[]) {
    super();
    this.pts = points.map((p) => p.clone());
    this.cum = [0];
    for (let i = 0; i < this.pts.length; i++) {
      const next = this.pts[(i + 1) % this.pts.length];
      this.cum.push(this.cum[i] + this.pts[i].distanceTo(next));
    }
    this.total = this.cum[this.cum.length - 1];
  }

  getPoint(t: number, target = new THREE.Vector3()): THREE.Vector3 {
    const s = wrap01(t) * this.total;
    let lo = 0;
    let hi = this.pts.length;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (this.cum[mid] <= s) lo = mid;
      else hi = mid;
    }
    const seg = this.cum[lo + 1] - this.cum[lo];
    const k = seg > 1e-9 ? (s - this.cum[lo]) / seg : 0;
    return target.copy(this.pts[lo]).lerp(this.pts[(lo + 1) % this.pts.length], k);
  }

  getPointAt(u: number, target?: THREE.Vector3): THREE.Vector3 {
    return this.getPoint(u, target);
  }

  getTangent(t: number, target = new THREE.Vector3()): THREE.Vector3 {
    const d = 0.0005;
    return target.copy(this.getPoint(t + d)).sub(this.getPoint(t - d)).normalize();
  }

  getTangentAt(u: number, target?: THREE.Vector3): THREE.Vector3 {
    return this.getTangent(u, target);
  }

  getLength(): number {
    return this.total;
  }
}

/** The closed outline of a plate as a curve at local height `y`, grown outwards by `grow`. */
export const plateOutline = (spec: PlateSpec, grow = 0, y = 0): OutlineCurve =>
  new OutlineCurve(outline2D(spec, grow).map(([x, z]) => new THREE.Vector3(x, y, z)));

/** Fraction of an outline (0..1) that lies in the local direction `angle` = atan2(z, x). */
export const outlineU = (curve: THREE.Curve<THREE.Vector3>, angle: number): number => {
  const p = new THREE.Vector3();
  let best = 0;
  let bestD = Infinity;
  const n = 4096;
  for (let i = 0; i < n; i++) {
    curve.getPointAt(i / n, p);
    let d = Math.abs(Math.atan2(p.z, p.x) - angle) % (Math.PI * 2);
    if (d > Math.PI) d = Math.PI * 2 - d;
    if (d < bestD) {
      bestD = d;
      best = i / n;
    }
  }
  return best;
};

/* ------------------------------------------------------------------ rack layouts */

/** One rack: a thin upright slab. Its lit seam (the level meter) is on the local +z edge. */
export type RackSlot = {
  readonly x: number;
  readonly z: number;
  /** Rotation about y. */
  readonly yaw: number;
  /** Thickness (across the row), depth and height. */
  readonly w: number;
  readonly d: number;
  readonly h: number;
  /** Row index and position 0..1 along the row: use them to order rhythms. */
  readonly row: number;
  readonly along: number;
};

/** Straight rows along x. `skip` leaves aisles: [from, to] intervals of x with no racks, which splits a row into clusters. */
export const rackRows = (
  rows: readonly {readonly z: number; readonly from: number; readonly to: number; readonly h: number; readonly skip?: readonly P2[]}[],
  opts: {readonly pitch?: number; readonly w?: number; readonly d?: number} = {},
): RackSlot[] => {
  const {pitch = 0.21, w = 0.075, d = 0.5} = opts;
  const out: RackSlot[] = [];
  rows.forEach((row, r) => {
    const count = Math.floor((row.to - row.from) / pitch + 1e-6) + 1;
    const span = (count - 1) * pitch;
    const x0 = (row.from + row.to) / 2 - span / 2;
    for (let i = 0; i < count; i++) {
      const x = x0 + i * pitch;
      if (row.skip?.some(([a, b]) => x > a && x < b)) continue;
      out.push({x, z: row.z, yaw: 0, w, d, h: row.h, row: r, along: count > 1 ? i / (count - 1) : 0.5});
    }
  });
  return out;
};

/** Racks standing radially on a circle, seams facing outwards. */
export const rackFan = (opts: {
  readonly radius: number;
  readonly count: number;
  readonly h: number;
  readonly w?: number;
  readonly d?: number;
  /** First rack's direction and total sweep (radians). */
  readonly start?: number;
  readonly sweep?: number;
  readonly row?: number;
  /** Keep only these indices (to cut aisles into the fan). */
  readonly keep?: (i: number) => boolean;
}): RackSlot[] => {
  const {radius, count, h, w = 0.075, d = 0.5, start = 0, sweep = Math.PI * 2, row = 0, keep} = opts;
  const full = Math.abs(sweep - Math.PI * 2) < 1e-6;
  const out: RackSlot[] = [];
  for (let i = 0; i < count; i++) {
    if (keep && !keep(i)) continue;
    const along = full ? i / count : count > 1 ? i / (count - 1) : 0.5;
    const a = start + along * sweep;
    out.push({x: Math.cos(a) * radius, z: Math.sin(a) * radius, yaw: Math.PI / 2 - a, w, d, h, row, along});
  }
  return out;
};

/* ------------------------------------------------------------------ island */

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const dummy = new THREE.Object3D();
const scratch = new THREE.Color();

type PerRack = number | ((i: number, slot: RackSlot) => number);
const perRack = (v: PerRack, i: number, slot: RackSlot) => (typeof v === 'number' ? v : v(i, slot));

const flat = (points: readonly P2[], thickness: number, bevel: number): THREE.ExtrudeGeometry => {
  const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, z)));
  const g = new THREE.ExtrudeGeometry(shape, {depth: Math.max(0.001, thickness - 2 * bevel), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 1});
  // Shape (x, y) -> world (x, z); extrusion runs downwards from y = 0.
  g.rotateX(Math.PI / 2);
  g.translate(0, -bevel, 0);
  return g;
};

/**
 * A floating compute platform. Local frame: y = 0 is the top of the plate,
 * racks stand on it. `children` are rendered in the same frame (put the
 * `PerimeterRing`, docks and ports there).
 *
 *   presence  0..1  how far the dark structure has come out of the void
 *   seam      0..1  seams and edges switched on
 *   level     per rack 0..1: height of the lit meter on the rack's front seam
 *   ramp      per rack: 0 blue (system load), 1 purple (an agent's workload), 2 red
 *   boost     per rack brightness multiplier (flashes, ripples)
 *   under     0..1.5  brightness of the seam under the keel (what the floor reflects)
 */
export const ComputeIsland: React.FC<{
  readonly plate: PlateSpec;
  readonly racks: readonly RackSlot[];
  readonly position?: Vec3;
  readonly yaw?: number;
  readonly scale?: number;
  readonly thickness?: number;
  readonly presence?: number;
  readonly seam?: number;
  readonly level?: PerRack;
  readonly ramp?: PerRack;
  readonly boost?: PerRack;
  readonly under?: number;
  /** Tone of the plate's own edge seams on the ramp (defaults to the mean rack tone). */
  readonly tone?: number;
  readonly seamIntensity?: number;
  readonly meterIntensity?: number;
  readonly children?: React.ReactNode;
}> = ({
  plate,
  racks,
  position = [0, 0, 0],
  yaw = 0,
  scale = 1,
  thickness = 0.13,
  presence = 1,
  seam = 1,
  level = 0,
  ramp = 0,
  boost = 1,
  under = 0.6,
  tone,
  seamIntensity = cyber.emissive.dim + 0.2,
  meterIntensity = 1.7,
  children,
}) => {
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const seamRef = useRef<THREE.InstancedMesh>(null);
  const topRef = useRef<THREE.InstancedMesh>(null);
  const barRef = useRef<THREE.InstancedMesh>(null);
  const count = racks.length;
  const instArgs = useMemo(() => [undefined, undefined, count] as [undefined, undefined, number], [count]);

  const geo = useMemo(() => {
    const keelInset = plate.kind === 'rect' ? Math.min(plate.w, plate.d) * 0.22 : plate.r * 0.34;
    const keelDepth = thickness * 2.1;
    const edge = plateOutline(plate, 0.004, 0.004);
    const inner = plateOutline(plate, -0.16, 0.003);
    const keelEdge = plateOutline(plate, -keelInset + 0.004, -(thickness + keelDepth));
    // Unlit undersides: what the mirror floor shows must stay dark.
    const belly = (points: readonly P2[], y: number) =>
      new THREE.ShapeGeometry(new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, z)))).rotateX(Math.PI / 2).translate(0, y, 0);
    return {
      plate: flat(outline2D(plate), thickness, 0.018),
      keel: flat(outline2D(plate, -keelInset), keelDepth, 0.018).translate(0, -thickness, 0),
      plateBelly: belly(outline2D(plate, -0.004), -thickness - 0.002),
      keelBelly: belly(outline2D(plate, -keelInset - 0.004), -(thickness + keelDepth) - 0.002),
      edge: new THREE.TubeGeometry(edge, 256, 0.0075, 5, true),
      inner: new THREE.TubeGeometry(inner, 192, 0.004, 4, true),
      keelEdge: new THREE.TubeGeometry(keelEdge, 192, 0.0075, 5, true),
    };
  }, [plate, thickness]);
  useLayoutEffect(
    () => () => {
      Object.values(geo).forEach((g) => g.dispose());
    },
    [geo],
  );

  // Static placement: rack bodies, front seams, top edges.
  useLayoutEffect(() => {
    const body = bodyRef.current;
    const seamMesh = seamRef.current;
    const top = topRef.current;
    if (!body || !seamMesh || !top) return;
    racks.forEach((s, i) => {
      const sin = Math.sin(s.yaw);
      const cos = Math.cos(s.yaw);
      dummy.rotation.set(0, s.yaw, 0);
      dummy.position.set(s.x, s.h / 2, s.z);
      dummy.scale.set(s.w, s.h, s.d);
      dummy.updateMatrix();
      body.setMatrixAt(i, dummy.matrix);
      // Front seam: a hairline standing just proud of the +z edge.
      const fz = s.d / 2 + 0.003;
      dummy.position.set(s.x + sin * fz, s.h / 2, s.z + cos * fz);
      dummy.scale.set(s.w * 0.36, s.h, 0.004);
      dummy.updateMatrix();
      seamMesh.setMatrixAt(i, dummy.matrix);
      // Top edge: a hairline along the slab's spine.
      dummy.position.set(s.x, s.h + 0.003, s.z);
      dummy.scale.set(s.w * 0.36, 0.004, s.d);
      dummy.updateMatrix();
      top.setMatrixAt(i, dummy.matrix);
    });
    body.instanceMatrix.needsUpdate = true;
    seamMesh.instanceMatrix.needsUpdate = true;
    top.instanceMatrix.needsUpdate = true;
  }, [racks]);

  // Per frame: meter heights and every lit colour.
  let toneSum = 0;
  let levelSum = 0;
  racks.forEach((s, i) => {
    toneSum += perRack(ramp, i, s);
    levelSum += clamp01(perRack(level, i, s));
  });
  const meanTone = tone ?? (count > 0 ? toneSum / count : 0);
  const meanLevel = count > 0 ? levelSum / count : 0;

  useLayoutEffect(() => {
    const seamMesh = seamRef.current;
    const top = topRef.current;
    const bar = barRef.current;
    if (!seamMesh || !top || !bar) return;
    const unlit = hdr(cyber.color.steel, 0.42);
    racks.forEach((s, i) => {
      const lvl = clamp01(perRack(level, i, s));
      const rp = perRack(ramp, i, s);
      const gain = Math.max(0, perRack(boost, i, s));

      scratch.copy(unlit).lerp(hdrRamp(rp, seamIntensity * gain), seam);
      seamMesh.setColorAt(i, scratch);
      scratch.copy(unlit).lerp(hdrRamp(rp, (seamIntensity + (meterIntensity * 0.75 - seamIntensity) * smooth(lvl * 1.15)) * gain), seam);
      top.setColorAt(i, scratch);

      const sin = Math.sin(s.yaw);
      const cos = Math.cos(s.yaw);
      const fz = s.d / 2 + 0.006;
      const hgt = Math.max(1e-4, lvl * s.h);
      dummy.rotation.set(0, s.yaw, 0);
      dummy.position.set(s.x + sin * fz, hgt / 2, s.z + cos * fz);
      dummy.scale.set(s.w, hgt, 0.008);
      dummy.updateMatrix();
      bar.setMatrixAt(i, dummy.matrix);
      bar.setColorAt(i, hdrRamp(rp, meterIntensity * (0.7 + 0.3 * lvl) * gain * seam));
    });
    bar.instanceMatrix.needsUpdate = true;
    if (seamMesh.instanceColor) seamMesh.instanceColor.needsUpdate = true;
    if (top.instanceColor) top.instanceColor.needsUpdate = true;
    if (bar.instanceColor) bar.instanceColor.needsUpdate = true;
  });

  const structure = new THREE.Color(cyber.color.void).lerp(new THREE.Color(structureProps.color), clamp01(presence));
  const edgeColor = hdr(cyber.color.steel, 0.5 * presence).lerp(hdrRamp(meanTone, 0.4 + 0.35 * meanLevel), seam);
  const innerColor = hdr(cyber.color.steel, 0.35 * presence);
  const bellyColor = new THREE.Color(cyber.color.void).lerp(new THREE.Color(cyber.color.abyss), clamp01(presence));
  const underColor = hdr(cyber.color.steel, 0.3 * presence).lerp(hdrRamp(meanTone, 0.5 + under * (0.5 + 1.1 * meanLevel)), seam);

  return (
    <group position={position as [number, number, number]} rotation={[0, yaw, 0]} scale={scale}>
      <mesh geometry={geo.plate}>
        <meshStandardMaterial {...structureProps} color={structure} />
      </mesh>
      <mesh geometry={geo.keel}>
        <meshStandardMaterial {...structureProps} color={structure} />
      </mesh>
      <mesh geometry={geo.plateBelly}>
        <meshBasicMaterial color={bellyColor} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={geo.keelBelly}>
        <meshBasicMaterial color={bellyColor} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={geo.edge}>
        <meshBasicMaterial color={edgeColor} />
      </mesh>
      <mesh geometry={geo.inner}>
        <meshBasicMaterial color={innerColor} />
      </mesh>
      <mesh geometry={geo.keelEdge}>
        <meshBasicMaterial color={underColor} />
      </mesh>

      <instancedMesh ref={bodyRef} args={instArgs} geometry={UNIT_BOX} frustumCulled={false}>
        <meshStandardMaterial {...structureProps} color={structure} />
      </instancedMesh>
      <instancedMesh ref={seamRef} args={instArgs} geometry={UNIT_BOX} frustumCulled={false}>
        <meshBasicMaterial color="#ffffff" />
      </instancedMesh>
      <instancedMesh ref={topRef} args={instArgs} geometry={UNIT_BOX} frustumCulled={false}>
        <meshBasicMaterial color="#ffffff" />
      </instancedMesh>
      <instancedMesh ref={barRef} args={instArgs} geometry={UNIT_BOX} frustumCulled={false}>
        <meshBasicMaterial color="#ffffff" />
      </instancedMesh>

      {children}
    </group>
  );
};

/* ------------------------------------------------------------------ perimeter ring */

/** A gate in a perimeter ring. */
export type RingGate = {
  /** Centre of the gate as a fraction of the perimeter (see `outlineU`). */
  readonly at: number;
  /** 0 closed .. 1 fully open. */
  readonly open: number;
  /** Width of the fully open gap, in world units. */
  readonly width?: number;
  /** 0..1: how hot the two ring ends (and the jamb marks) are. */
  readonly heat?: number;
  /** Draw the two short jamb ticks that mark where the gate is. Default true. */
  readonly mark?: boolean;
};

const MAX_GATES = 4;

const makeRingMaterial = () => {
  const uniforms = {
    uDrawFrom: {value: 0},
    uDraw: {value: 1},
    uGates: {value: Array.from({length: MAX_GATES}, () => new THREE.Vector3())},
    uHot: {value: new THREE.Color()},
    uHeatWidth: {value: 0.02},
  };
  const material = new THREE.MeshBasicMaterial();
  material.defines = {USE_UV: ''};
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        uniform float uDrawFrom;
        uniform float uDraw;
        uniform vec3 uGates[${MAX_GATES}];
        uniform vec3 uHot;
        uniform float uHeatWidth;
        float ringDist(float a, float b) { return abs(fract(a - b + 0.5) - 0.5); }`,
      )
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
        if (ringDist(vUv.x, uDrawFrom) > uDraw * 0.5) discard;
        float gateHeat = 0.0;
        for (int i = 0; i < ${MAX_GATES}; i++) {
          float d = ringDist(vUv.x, uGates[i].x) - uGates[i].y;
          if (d < 0.0) discard;
          gateHeat = max(gateHeat, uGates[i].z * exp(-d / uHeatWidth));
        }
        diffuseColor.rgb = mix(diffuseColor.rgb, uHot, clamp(gateHeat, 0.0, 1.0));`,
      );
  };
  return {material, uniforms};
};

/**
 * The boundary of an environment: a hairline along a closed curve (usually
 * `plateOutline(spec, margin, y)`), with up to four gates. A gate is a gap
 * that opens symmetrically around `at`; the ring's two ends glow while it is
 * hot and two short jamb ticks ride on them, so the eye finds the door
 * before it opens. `draw` draws the ring on, both ways from `drawFrom`.
 *
 * The gap is cut in the fragment shader, so it is exact at any opening and
 * nothing is rebuilt per frame.
 */
export const PerimeterRing: React.FC<{
  readonly curve: THREE.Curve<THREE.Vector3>;
  readonly radius?: number;
  readonly color?: string;
  /** HDR multiplier; see cyber.emissive. */
  readonly intensity?: number;
  readonly draw?: number;
  readonly drawFrom?: number;
  readonly gates?: readonly RingGate[];
  /** Colour and intensity of a hot gate. */
  readonly hot?: string;
  readonly hotIntensity?: number;
  /** How far the heat reaches along the ring from the gap, in world units. */
  readonly heatReach?: number;
  /** Height of the jamb ticks, in world units. */
  readonly markSize?: number;
  readonly segments?: number;
}> = ({
  curve,
  radius = 0.011,
  color = cyber.color.blue,
  intensity = cyber.emissive.base,
  draw = 1,
  drawFrom = 0,
  gates = [],
  hot = cyber.color.blueHot,
  hotIntensity = cyber.emissive.strong,
  heatReach = 0.5,
  markSize = 0.15,
  segments = 320,
}) => {
  const geometry = useMemo(() => new THREE.TubeGeometry(curve, segments, radius, 5, true), [curve, segments, radius]);
  const length = useMemo(() => curve.getLength(), [curve]);
  const ring = useMemo(makeRingMaterial, []);
  useLayoutEffect(() => () => geometry.dispose(), [geometry]);
  useLayoutEffect(() => () => ring.material.dispose(), [ring]);

  const base = hdr(color, intensity);
  const hotColor = hdr(hot, hotIntensity);
  ring.material.color.copy(base);
  ring.uniforms.uDraw.value = clamp01(draw);
  ring.uniforms.uDrawFrom.value = drawFrom;
  ring.uniforms.uHot.value.copy(hotColor);
  ring.uniforms.uHeatWidth.value = Math.max(1e-4, heatReach / length);
  const halves = gates.slice(0, MAX_GATES).map((g) => (clamp01(g.open) * (g.width ?? 0.7)) / 2 / length);
  for (let i = 0; i < MAX_GATES; i++) {
    const g = gates[i];
    if (g) ring.uniforms.uGates.value[i].set(g.at, halves[i], clamp01(g.heat ?? 0));
    else ring.uniforms.uGates.value[i].set(0, 0, 0);
  }

  if (draw <= 0.001 || intensity <= 0) return null;
  return (
    <group>
      <mesh geometry={geometry} material={ring.material} frustumCulled={false} />
      {gates.slice(0, MAX_GATES).map((g, i) => {
        if (g.mark === false) return null;
        // The jamb ticks only exist once the ring has been drawn past them.
        let d = Math.abs(wrap01(g.at - drawFrom));
        if (d > 0.5) d = 1 - d;
        if (d > draw * 0.5) return null;
        const heat = clamp01(g.heat ?? 0);
        const tick = base.clone().lerp(hotColor, heat);
        return [-1, 1].map((side) => {
          const p = curve.getPointAt(wrap01(g.at + side * halves[i]));
          return (
            <mesh key={`${i}:${side}`} position={p} scale={[radius * 2.6, markSize * (0.75 + 0.5 * heat), radius * 2.6]} geometry={UNIT_BOX}>
              <meshBasicMaterial color={tick} />
            </mesh>
          );
        });
      })}
    </group>
  );
};
