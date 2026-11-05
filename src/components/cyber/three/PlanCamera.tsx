import {useThree} from '@react-three/fiber';
import React, {useLayoutEffect} from 'react';
import type * as THREE from 'three';
import type {Rig, Vec3} from './rig';

/**
 * The "3D becomes a diagram" camera move.
 *
 * `flattenRig(from, plan, swing, lens)` takes any perspective rig and returns
 * a rig part-way to a straight top-down plan view:
 *
 *   swing 0..1  orbits the camera up over the target (azimuth, elevation and
 *               look-at point), keeping its distance;
 *   lens  0..1  is a dolly-zoom: the field of view narrows towards `plan.fov`
 *               while the camera backs away so that the framing follows
 *               `plan.frame`. At a few degrees of fov the picture is
 *               effectively orthographic and the world reads as a drawing.
 *
 * Drive both from one beat (lens slightly behind swing looks best). The
 * result is an ordinary `Rig`, so `Stage3D` and `projectPoint` work with it
 * and a 2D overlay stays pinned through the whole move.
 *
 * The far end is tens of times further away than a normal shot: pair it with
 * <CameraClip> and scale any fog with `rigDistance`.
 */
export type PlanView = {
  /** Point on the floor that ends up in the centre of the frame. */
  readonly center: Vec3;
  /** World units visible from the top to the bottom of the frame in the plan. */
  readonly frame: number;
  /** Final field of view in degrees. Small = nearly orthographic. Default 3. */
  readonly fov?: number;
  /** Final compass heading in degrees. 0 puts world -z at the top of the screen. */
  readonly azimuth?: number;
};

const RAD = Math.PI / 180;
/** Not quite 90 degrees, so that "up" on screen stays defined. */
const TOP = 89.9 * RAD;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Distance from the camera to its look-at point. */
export const rigDistance = (rig: Rig): number =>
  Math.hypot(rig.position[0] - rig.target[0], rig.position[1] - rig.target[1], rig.position[2] - rig.target[2]);

export const flattenRig = (from: Rig, plan: PlanView, swing: number, lens: number = swing): Rig => {
  if (swing <= 0 && lens <= 0) return from;
  const dx = from.position[0] - from.target[0];
  const dy = from.position[1] - from.target[1];
  const dz = from.position[2] - from.target[2];
  const dist0 = Math.max(1e-6, Math.hypot(dx, dy, dz));
  const az0 = Math.atan2(dx, dz);
  const el0 = Math.asin(dy / dist0);
  const frame0 = 2 * dist0 * Math.tan((from.fov * RAD) / 2);

  // Turn the short way round.
  const turn = (plan.azimuth ?? 0) * RAD - az0;
  const az = az0 + Math.atan2(Math.sin(turn), Math.cos(turn)) * swing;
  const el = lerp(el0, TOP, swing);
  const target: Vec3 = [
    lerp(from.target[0], plan.center[0], swing),
    lerp(from.target[1], plan.center[1], swing),
    lerp(from.target[2], plan.center[2], swing),
  ];

  const fov = lerp(from.fov, plan.fov ?? 3, lens);
  const frame = lerp(frame0, plan.frame, lens);
  const dist = frame / (2 * Math.tan((fov * RAD) / 2));
  const flat = Math.cos(el);
  return {
    position: [target[0] + dist * flat * Math.sin(az), target[1] + dist * Math.sin(el), target[2] + dist * flat * Math.cos(az)],
    target,
    fov,
    roll: from.roll ?? 0,
  };
};

/**
 * Sets the clip planes of the stage camera. `Stage3D` keeps them fixed
 * (cyber.camera.near .. far), which is right for normal shots; a dolly-zoom
 * to a plan view puts the camera over a kilometre up, so the planes have to
 * follow it. Mount inside <Stage3D>.
 */
export const CameraClip: React.FC<{readonly near: number; readonly far: number}> = ({near, far}) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useLayoutEffect(() => {
    if (camera.near !== near || camera.far !== far) {
      camera.near = near;
      camera.far = far;
      camera.updateProjectionMatrix();
    }
  });
  return null;
};
