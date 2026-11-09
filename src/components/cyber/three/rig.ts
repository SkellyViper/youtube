import * as THREE from 'three';
import {useEpisodeFrame, useTimeline} from '../../../engine/context';
import {evaluateTrack, type TrackSegment} from '../../../engine/track';
import type {Timeline} from '../../../engine/types';
import {cyber, motion} from '../../../styles/cyber';

export type Vec3 = readonly [number, number, number];

/** A 3D camera pose. `target` is the look-at point; `roll` is in radians. */
export type Rig = {
  readonly position: Vec3;
  readonly target: Vec3;
  readonly fov: number;
  readonly roll?: number;
  /** Default perspective. Orthographic shows `orthoHeight` world units vertically (fov is ignored). */
  readonly projection?: 'perspective' | 'orthographic';
  readonly orthoHeight?: number;
};

export type RigKey = Partial<Rig>;

const pack = (r: Rig): number[] => [...r.position, ...r.target, r.fov, r.roll ?? 0];
const unpack = (v: number[]): Rig => ({
  position: [v[0], v[1], v[2]],
  target: [v[3], v[4], v[5]],
  fov: v[6],
  roll: v[7],
});

/**
 * Camera keyframes bound to beats, exactly like the engine's 2D `useCamera`.
 * Each segment moves from wherever the camera is to `to` during its beat
 * (optionally only between `from` and `until` seconds). Omitted fields keep
 * their current value. Default easing is the heavy camera curve.
 *
 *   const rig = useCameraRig(
 *     {position: [0, 2, 14], target: [0, 1, 0], fov: 34},
 *     [
 *       {beat: 'approach', to: {position: [0, 1.4, 7]}},
 *       {beat: 'reveal', to: {position: [0, 9, 26], target: [0, 0, -8]}, from: 0.2},
 *     ],
 *   );
 */
export const evaluateRig = (
  timeline: Timeline,
  frame: number,
  initial: Rig,
  segments: readonly TrackSegment<RigKey>[],
): Rig => {
  // Resolve partial keys against the previous key so untouched fields persist.
  let current = initial;
  const resolved = segments.map((s) => {
    current = {
      position: s.to.position ?? current.position,
      target: s.to.target ?? current.target,
      fov: s.to.fov ?? current.fov,
      roll: s.to.roll ?? current.roll ?? 0,
    };
    return {...s, easing: s.easing ?? motion.camera, to: pack(current)};
  });
  return unpack(evaluateTrack(timeline, frame, pack(initial), resolved));
};

export const useCameraRig = (initial: Rig, segments: readonly TrackSegment<RigKey>[]): Rig => {
  const timeline = useTimeline();
  const frame = useEpisodeFrame();
  return evaluateRig(timeline, frame, initial, segments);
};

const projector = new THREE.PerspectiveCamera();
const scratch = new THREE.Vector3();

/**
 * World point -> screen pixels for a given rig. Use it to pin 2D overlays
 * (SVG reticles, labels, panels) to things in the 3D scene: hybrid shots stay
 * locked together because both layers derive from the same rig and frame.
 */
export const projectPoint = (
  rig: Rig,
  point: Vec3,
  width = 1920,
  height = 1080,
): {x: number; y: number; depth: number; visible: boolean; scale: number} => {
  const roll = rig.roll ?? 0;
  projector.fov = rig.fov;
  projector.aspect = width / height;
  projector.near = cyber.camera.near;
  projector.far = cyber.camera.far;
  projector.position.set(rig.position[0], rig.position[1], rig.position[2]);
  projector.up.set(Math.sin(roll), Math.cos(roll), 0);
  projector.lookAt(rig.target[0], rig.target[1], rig.target[2]);
  projector.updateProjectionMatrix();
  projector.updateMatrixWorld();
  scratch.set(point[0], point[1], point[2]);
  const depth = scratch.distanceTo(projector.position);
  scratch.project(projector);
  // Pixels per world unit at this depth (for sizing overlays).
  const scale = height / (2 * Math.tan((rig.fov * Math.PI) / 360) * Math.max(depth, 1e-4));
  return {
    x: (scratch.x * 0.5 + 0.5) * width,
    y: (1 - (scratch.y * 0.5 + 0.5)) * height,
    depth,
    visible: scratch.z > -1 && scratch.z < 1,
    scale,
  };
};
