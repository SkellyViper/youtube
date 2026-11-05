import React, {useEffect, useMemo} from 'react';
import * as THREE from 'three';
import {cyber} from '../../../styles/cyber';
import {hdr} from './materials';
import type {Vec3} from './rig';

/**
 * A scan: a thin vertical sheet of light that travels in a straight line over
 * a surface, with a bright leading edge where it touches that surface.
 *
 * The geometry of a scan is a plain value (`ScanFieldSpec`), so the picture
 * and the logic share it: `<ScanField>` draws the sheet at `progress`, and
 * `scanCoord` / `scanPassed` / `scanSince` tell you whether and when any world
 * position is reached. Things *outside* the sheet's width, height or travel
 * are never reached, which is the whole point of the device: what a scan does
 * not cover stays exactly as it was.
 */
export type ScanFieldSpec = {
  /** Centre of the sheet's base line at progress 0 (world). */
  readonly from: Vec3;
  /** Centre of the sheet's base line at progress 1. The sheet stays vertical; `to[1]` is ignored. */
  readonly to: Vec3;
  /** Extent of the sheet across its direction of travel. */
  readonly width: number;
  /** Height of the sheet above its base line. */
  readonly height: number;
};

/** An axis-aligned box standing on the scanned surface; the leading edge climbs over it. */
export type ScanBox = {
  /** Footprint centre (x, z). */
  readonly center: readonly [number, number];
  /** Footprint size (x, z). */
  readonly size: readonly [number, number];
  /** Height above the scan's base plane (`field.from[1]`). */
  readonly height: number;
};

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const smooth = (t: number) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

/** Travel direction and the sheet's lateral axis, both unit vectors in (x, z). */
const axesOf = (field: ScanFieldSpec) => {
  const dx = field.to[0] - field.from[0];
  const dz = field.to[2] - field.from[2];
  const length = Math.hypot(dx, dz) || 1e-6;
  const dir: readonly [number, number] = [dx / length, dz / length];
  const across: readonly [number, number] = [-dir[1], dir[0]];
  return {length, dir, across};
};

/**
 * Where a world point sits in a scan.
 *   along   fraction of the travel at which the sheet reaches the point (0 = start, 1 = end; unclamped)
 *   across  lateral position, -1..1 inside the sheet's width
 *   up      height as a fraction of the sheet's height
 *   inside  true if the sheet actually sweeps through the point
 */
export const scanCoord = (field: ScanFieldSpec, point: Vec3): {along: number; across: number; up: number; inside: boolean} => {
  const {length, dir, across} = axesOf(field);
  const rx = point[0] - field.from[0];
  const rz = point[2] - field.from[2];
  const along = (rx * dir[0] + rz * dir[1]) / length;
  const lateral = (rx * across[0] + rz * across[1]) / (field.width / 2);
  const up = (point[1] - field.from[1]) / field.height;
  const eps = 1e-4;
  return {along, across: lateral, up, inside: along >= -eps && along <= 1 + eps && Math.abs(lateral) <= 1 + eps && up >= -eps && up <= 1 + eps};
};

/** Has the sheet, at `progress` (0..1), already swept through this point? Never true for points outside the field. */
export const scanPassed = (field: ScanFieldSpec, progress: number, point: Vec3): boolean => {
  const c = scanCoord(field, point);
  return c.inside && progress > 0 && progress >= c.along;
};

/**
 * Seconds since the sheet passed the point, for a sweep that covers the whole
 * travel in `sweepSeconds`. Negative: seconds until it arrives. -Infinity:
 * the point is outside the field and will never be reached.
 */
export const scanSince = (field: ScanFieldSpec, progress: number, point: Vec3, sweepSeconds = 1): number => {
  const c = scanCoord(field, point);
  return c.inside ? (progress - c.along) * sweepSeconds : -Infinity;
};

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
/** Unit plane with its origin on the middle of the bottom edge: x -0.5..0.5, y 0..1. */
const SHEET_PLANE = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);

const sheetVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const sheetFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uGain;
  uniform float uRise;
  varying vec2 vUv;
  void main() {
    // Multisampling can extrapolate uv a hair outside 0..1 on the edges; keep every base non-negative (pow of a negative is NaN, and bloom smears NaN over the whole frame).
    float y = clamp(vUv.y, 0.0, 1.0);
    float x = clamp(abs(vUv.x - 0.5) * 2.0, 0.0, 1.0);
    // Body: densest at the foot, thinning to nothing at the top.
    float body = 0.085 * pow(1.0 - y, 1.7) + 0.012;
    // A short breath of light just above the leading edge.
    float foot = 0.2 * exp(-y / 0.035);
    // Hairline posts on the two ends, a hairline cap along the top.
    float post = smoothstep(0.986, 0.994, x) * (0.3 * (1.0 - y) + 0.06);
    float cap = smoothstep(uRise - 0.012, uRise - 0.006, y) * 0.07;
    // The sheet grows upward with uRise; its top is always soft.
    float cut = 1.0 - smoothstep(uRise - 0.004, uRise, y);
    float a = (body + foot + post + cap) * cut * uGain;
    gl_FragColor = vec4(uColor, a);
  }
`;

/**
 * The moving sheet. A pure function of its props:
 *
 *   progress  0..1 position along `field.from` -> `field.to` (drive it at constant speed)
 *   appear    0..1 the leading edge draws out from its centre, then the sheet rises from it
 *   retire    0..1 the sheet sinks back and the leading edge closes and fades
 *   obstacles boxes on the surface; the leading edge is draped over the ones it is crossing
 *
 * The sheet itself is additive and nearly transparent (it never blooms); the
 * leading edge is the hot part. To mirror it in a `<MirrorFloor>`, mount a
 * second copy in a `scale={[1, -1, 1]}` group with `gain` multiplied by
 * (1 - floor opacity): additive light drawn after the floor at that level is
 * identical to light drawn before it and dimmed.
 */
export const ScanField: React.FC<{
  readonly field: ScanFieldSpec;
  readonly progress: number;
  readonly appear?: number;
  readonly retire?: number;
  /** Sheet colour (the body of the light). */
  readonly color?: string;
  /** Leading-edge colour. */
  readonly hot?: string;
  /** Sheet brightness multiplier. */
  readonly gain?: number;
  /** HDR level of the leading edge; see cyber.emissive. */
  readonly edge?: number;
  /** Half-thickness of the leading-edge line, world units. */
  readonly edgeRadius?: number;
  readonly obstacles?: readonly ScanBox[];
}> = ({
  field,
  progress,
  appear = 1,
  retire = 0,
  color = cyber.color.blue,
  hot = cyber.color.blueHot,
  gain = 1,
  edge = 3.2,
  edgeRadius = 0.013,
  obstacles,
}) => {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {uColor: {value: new THREE.Color(color)}, uGain: {value: 1}, uRise: {value: 1}},
        vertexShader: sheetVertex,
        fragmentShader: sheetFragment,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        fog: false,
      }),
    // Created once; uniforms are updated below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const lineMaterial = useMemo(() => new THREE.MeshBasicMaterial({fog: false}), []);
  useEffect(
    () => () => {
      material.dispose();
      lineMaterial.dispose();
    },
    [material, lineMaterial],
  );

  const present = clamp01(appear) * (1 - clamp01(retire));
  if (present <= 0.0005) return null;

  const {length, dir, across} = axesOf(field);
  const p = clamp01(progress);
  const bx = field.from[0] + dir[0] * length * p;
  const bz = field.from[2] + dir[1] * length * p;
  const by = field.from[1];
  const half = field.width / 2;

  // Entrance: line first, then the sheet. Exit: the sheet first, then the line.
  const lineIn = smooth(appear / 0.55);
  const rise = smooth((appear - 0.3) / 0.7) * (1 - smooth(retire / 0.7));
  const lineOut = smooth((retire - 0.35) / 0.65);
  const lineSpan = lineIn * (1 - lineOut);
  const lineLevel = edge * (0.25 + 0.75 * lineIn) * (1 - lineOut);

  material.uniforms.uColor.value.set(color);
  material.uniforms.uGain.value = Math.max(0, gain);
  material.uniforms.uRise.value = rise;
  lineMaterial.color.copy(hdr(hot, lineLevel));

  const d = edgeRadius * 2;
  // Local frame: x runs along the sheet, y is up, the sheet travels along -z.
  const rotationY = Math.atan2(-dir[0], -dir[1]);

  // Where the sheet currently cuts each obstacle: an interval [u0, u1] along the sheet.
  const drapes: {u0: number; u1: number; h: number; open0: boolean; open1: boolean}[] = [];
  if (obstacles && lineSpan > 0.999) {
    for (const box of obstacles) {
      let u0 = -half;
      let u1 = half;
      let hit = true;
      const axes: readonly [number, number, number, number][] = [
        [bx, across[0], box.center[0], box.size[0] / 2],
        [bz, across[1], box.center[1], box.size[1] / 2],
      ];
      for (const [origin, slope, centre, extent] of axes) {
        if (Math.abs(slope) < 1e-6) {
          if (Math.abs(origin - centre) > extent) hit = false;
        } else {
          const a = (centre - extent - origin) / slope;
          const b = (centre + extent - origin) / slope;
          u0 = Math.max(u0, Math.min(a, b));
          u1 = Math.min(u1, Math.max(a, b));
        }
      }
      if (!hit || u1 - u0 < 1e-4) continue;
      drapes.push({u0, u1, h: box.height, open0: u0 <= -half + 1e-4, open1: u1 >= half - 1e-4});
    }
  }

  return (
    <group position={[bx, by, bz]} rotation={[0, rotationY, 0]}>
      {rise > 0.001 ? <mesh geometry={SHEET_PLANE} material={material} scale={[field.width, field.height, 1]} renderOrder={1} /> : null}

      {/* Leading edge on the surface. */}
      <mesh geometry={UNIT_BOX} material={lineMaterial} position={[0, edgeRadius * 0.6, 0]} scale={[field.width * lineSpan, d, d]} />

      {/* ...and climbing over whatever stands in the sheet right now. */}
      {drapes.map((s, i) => (
        <group key={i}>
          <mesh geometry={UNIT_BOX} material={lineMaterial} position={[(s.u0 + s.u1) / 2, s.h, 0]} scale={[s.u1 - s.u0 + d, d, d]} />
          {s.open0 ? null : <mesh geometry={UNIT_BOX} material={lineMaterial} position={[s.u0, s.h / 2, 0]} scale={[d, s.h, d]} />}
          {s.open1 ? null : <mesh geometry={UNIT_BOX} material={lineMaterial} position={[s.u1, s.h / 2, 0]} scale={[d, s.h, d]} />}
        </group>
      ))}
    </group>
  );
};
