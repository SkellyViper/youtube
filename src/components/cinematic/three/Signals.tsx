import React, {useMemo} from 'react';
import * as THREE from 'three';
import {useTheme} from '../../../styles/ThemeContext';
import type {Vec3} from '../../cyber/three/rig';
import {Comet3D, GlowTube, curveThrough} from '../../cyber/three/Signal3D';
import {useStageQuality} from '../../cyber/three/Stage3D';

/**
 * Messages travel along real cables. A cable is a dark conduit that is always
 * there; while a message passes, a short bright pulse runs along it and the
 * conduit stays faintly lit behind it for a moment: the viewer can see the
 * route after the fact. Nothing travels through empty air.
 */

/** A cable with a little sag between anchor points (catenary-ish via extra control points). */
export const cableThrough = (points: readonly Vec3[], sag = 0.08): THREE.Curve<THREE.Vector3> => {
  const pts: Vec3[] = [];
  for (let i = 0; i < points.length; i++) {
    pts.push(points[i]);
    if (i < points.length - 1) {
      const a = points[i];
      const b = points[i + 1];
      const horizontal = Math.hypot(b[0] - a[0], b[2] - a[2]);
      if (horizontal > 0.6) pts.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - sag * Math.min(1, horizontal / 3), (a[2] + b[2]) / 2]);
    }
  }
  return curveThrough(pts, 0.35);
};

export const Cable: React.FC<{
  readonly curve: THREE.Curve<THREE.Vector3>;
  readonly radius?: number;
  /** 0..1 progress of a pulse along the cable (none when <= 0 or >= 1 unless `persist`). */
  readonly pulse?: number;
  readonly pulseColor?: string;
  /** Fraction of the run that stays lit behind the pulse. */
  readonly wake?: number;
  readonly intensity?: number;
  readonly segments?: number;
}> = ({curve, radius = 0.01, pulse = 0, pulseColor, wake = 1, intensity = 2.4, segments = 96}) => {
  const th = useTheme();
  const col = pulseColor ?? th.tone.mind.base;
  return (
    <group>
      <GlowTube curve={curve} radius={radius} color={th.color.steel} intensity={0.55} segments={segments} radial={5} />
      {pulse > 0 ? <GlowTube curve={curve} radius={radius * 0.8} color={col} intensity={1.2 * th.glow} from={Math.max(0, pulse - wake)} to={Math.min(1, pulse)} segments={segments} radial={5} /> : null}
      {pulse > 0 && pulse < 1 ? <Comet3D curve={curve} t={pulse / (1 + 0.1)} tail={0.1} color={col} radius={radius * 1.6} intensity={intensity * th.glow} head={2.6} /> : null}
    </group>
  );
};

/**
 * A spotlight with a real target. (R3F's `target-position` alone does not add
 * the target to the scene, so the light keeps pointing at the world origin.)
 * `position` and `target` are in the parent's frame.
 */
export const Spot: React.FC<{
  readonly position: Vec3;
  readonly target: Vec3;
  readonly intensity: number;
  readonly color?: string;
  readonly angle?: number;
  readonly penumbra?: number;
  readonly distance?: number;
  readonly castShadow?: boolean;
  readonly mapSize?: number;
  readonly bias?: number;
}> = ({position, target, intensity, color = '#ffffff', angle = 0.7, penumbra = 0.5, distance = 12, castShadow = false, mapSize, bias = -0.0008}) => {
  const obj = useMemo(() => new THREE.Object3D(), []);
  const quality = useStageQuality();
  const size = mapSize ?? Math.min(1024, quality.shadow);
  obj.position.set(target[0], target[1], target[2]);
  // Never unmount: a changing light count recompiles every shader in the scene (a visible stall).
  return (
    <>
      <spotLight position={[position[0], position[1], position[2]]} target={obj} intensity={Math.max(0, intensity)} color={color} angle={angle} penumbra={penumbra} distance={distance} decay={2} castShadow={castShadow} shadow-mapSize-width={size} shadow-mapSize-height={size} shadow-bias={bias} />
      <primitive object={obj} />
    </>
  );
};

/** A soft pool of coloured light on a surface: the spill of a screen or an LED strip. */
export const LightPool: React.FC<{readonly position: Vec3; readonly color: string; readonly intensity: number; readonly distance?: number}> = ({position, color, intensity, distance = 2.5}) => {
  // Always mounted (intensity 0 when off), for the same reason as Spot.
  return <pointLight position={[position[0], position[1], position[2]]} intensity={Math.max(0, intensity)} color={color} distance={distance} decay={2} />;
};

/** A straight corridor of points for cables along an edge. */
export const useCurve = (points: readonly Vec3[], sag?: number) => useMemo(() => cableThrough(points, sag), [points, sag]);
