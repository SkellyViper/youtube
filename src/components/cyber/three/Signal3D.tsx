import React, {useLayoutEffect, useMemo, useRef} from 'react';
import * as THREE from 'three';
import {cyber} from '../../../styles/cyber';
import {hdr} from './materials';
import type {Vec3} from './rig';

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/** Build a smooth curve through points (or a straight segment for two points). */
export const curveThrough = (points: readonly Vec3[], tension = 0.5): THREE.Curve<THREE.Vector3> => {
  const v = points.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
  if (v.length === 2) return new THREE.LineCurve3(v[0], v[1]);
  return new THREE.CatmullRomCurve3(v, false, 'catmullrom', tension);
};

/** An arc between two points that bows upward (or along `lift`) by `height`. */
export const arcBetween = (a: Vec3, b: Vec3, height = 1, lift: Vec3 = [0, 1, 0]): THREE.Curve<THREE.Vector3> => {
  const A = new THREE.Vector3(a[0], a[1], a[2]);
  const B = new THREE.Vector3(b[0], b[1], b[2]);
  const mid = A.clone().add(B).multiplyScalar(0.5).add(new THREE.Vector3(lift[0], lift[1], lift[2]).multiplyScalar(height));
  return new THREE.QuadraticBezierCurve3(A, mid, B);
};

/**
 * A glowing line with real thickness (a thin tube), drawn between two
 * fractions of its curve. `from`/`to` make it a draw-on line, a retracting
 * line, or a travelling dash. Geometry is built once; per frame only the
 * draw range changes.
 */
export const GlowTube: React.FC<{
  readonly curve: THREE.Curve<THREE.Vector3>;
  readonly radius?: number;
  readonly color?: string;
  /** HDR multiplier; see cyber.emissive. */
  readonly intensity?: number;
  /** Visible part of the curve, 0..1. */
  readonly from?: number;
  readonly to?: number;
  readonly opacity?: number;
  readonly segments?: number;
  readonly radial?: number;
}> = ({curve, radius = 0.012, color = cyber.color.blue, intensity = cyber.emissive.base, from = 0, to = 1, opacity = 1, segments = 96, radial = 6}) => {
  const ref = useRef<THREE.Mesh>(null);
  const geometry = useMemo(() => new THREE.TubeGeometry(curve, segments, radius, radial, false), [curve, segments, radius, radial]);
  const a = clamp01(Math.min(from, to));
  const b = clamp01(Math.max(from, to));
  const first = Math.floor(a * segments);
  const last = Math.ceil(b * segments);

  useLayoutEffect(() => {
    geometry.setDrawRange(first * radial * 6, Math.max(0, last - first) * radial * 6);
  }, [geometry, first, last, radial]);
  useLayoutEffect(() => () => geometry.dispose(), [geometry]);

  if (b - a <= 0.0005 || opacity <= 0.001 || intensity <= 0) return null;
  return (
    <mesh ref={ref} geometry={geometry} frustumCulled={false}>
      <meshBasicMaterial color={hdr(color, intensity)} transparent={opacity < 1} opacity={opacity} depthWrite={opacity >= 1} />
    </mesh>
  );
};

/**
 * The look's signal: a comet. A white-hot head with a tapering coloured tail
 * that travels along a curve.
 *
 * `t` is the progress of the whole pass, 0..1: at 0 nothing is visible, the
 * head reaches the end of the curve at t = 1 / (1 + tail) (about 0.82 with
 * the default tail), and by t = 1 the tail has drained into the target, so a
 * finished comet leaves nothing behind. Use `cometArrival(tail)` if you need
 * the exact moment the head lands. With `persist` the head stays at the end.
 */
export const Comet3D: React.FC<{
  readonly curve: THREE.Curve<THREE.Vector3>;
  readonly t: number;
  /** Tail length as a fraction of the curve. */
  readonly tail?: number;
  readonly color?: string;
  readonly radius?: number;
  readonly intensity?: number;
  /** Head size relative to `radius`. */
  readonly head?: number;
  /** Keep the head visible when t >= 1 (a signal that "lands and stays"). */
  readonly persist?: boolean;
}> = ({curve, t: pass, tail = 0.22, color = cyber.color.purple, radius = 0.02, intensity = cyber.emissive.strong, head = 3.2, persist = false}) => {
  // Head position along the curve; runs past 1 so the tail can drain.
  const t = pass * (1 + tail);
  if (t <= 0 || (t >= 1 + tail && !persist)) return null;
  const headT = clamp01(t);
  const p = curve.getPointAt(headT);
  const showHead = t < 1 || persist;
  // Tail in three overlapping pieces, brightest and thickest near the head.
  const pieces = [
    {len: 1, r: 0.45, k: 0.35},
    {len: 0.55, r: 0.75, k: 0.7},
    {len: 0.22, r: 1, k: 1.25},
  ];
  return (
    <group>
      {pieces.map((piece, i) => (
        <GlowTube
          key={i}
          curve={curve}
          radius={radius * piece.r}
          color={color}
          intensity={intensity * piece.k}
          from={t - tail * piece.len}
          to={t}
          segments={160}
        />
      ))}
      {showHead ? (
        <mesh position={p} scale={radius * head}>
          <sphereGeometry args={[1, 16, 12]} />
          <meshBasicMaterial color={hdr(cyber.color.white, cyber.emissive.hot)} />
        </mesh>
      ) : null}
    </group>
  );
};

/** A network node: small lit sphere with an optional thin ring, brightness driven by `level`. */
export const NetworkNode3D: React.FC<{
  readonly position: Vec3;
  readonly size?: number;
  readonly color?: string;
  /** 0 = unlit structure, 1 = lit, >1 = active / pulsing. */
  readonly level?: number;
  readonly ring?: boolean;
  /** 0..1 entrance scale. */
  readonly appear?: number;
}> = ({position, size = 0.09, color = cyber.color.blue, level = 1, ring = false, appear = 1}) => {
  if (appear <= 0.001) return null;
  const lit = clamp01(level);
  const col = new THREE.Color(cyber.color.steel).lerp(new THREE.Color(color), lit).multiplyScalar(0.6 + level * 1.6);
  return (
    <group position={position as [number, number, number]} scale={appear}>
      <mesh scale={size}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshBasicMaterial color={col} />
      </mesh>
      {ring ? (
        <mesh scale={size * 2.4}>
          <torusGeometry args={[1, 0.035, 6, 40]} />
          <meshBasicMaterial color={hdr(color, 0.5 + level)} transparent opacity={0.85} />
        </mesh>
      ) : null}
    </group>
  );
};

/** The value of a comet's `t` at which its head lands on the end of the curve. */
export const cometArrival = (tail = 0.22) => 1 / (1 + tail);
