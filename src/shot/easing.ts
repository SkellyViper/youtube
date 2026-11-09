import {Easing} from 'remotion';
import type {EasingName} from './types';

/**
 * Named easing presets for motions and camera moves. They are the curves the
 * existing samples already use (src/styles/cyber.ts `motion`, story `ease`),
 * so an edited beat moves with the same vocabulary as a hand-written one.
 */
export const EASINGS: Readonly<Record<EasingName, (t: number) => number>> = {
  linear: (t) => t,
  in: Easing.bezier(0.55, 0, 0.9, 0.4),
  out: Easing.bezier(0.16, 1, 0.3, 1),
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  arrive: Easing.bezier(0.16, 1, 0.3, 1),
  ignite: Easing.bezier(0.2, 0.9, 0.1, 1),
  glide: Easing.bezier(0.65, 0, 0.35, 1),
  camera: Easing.bezier(0.7, 0, 0.16, 1),
  signal: Easing.bezier(0.4, 0, 0.6, 1),
  overshoot: Easing.bezier(0.3, 1.45, 0.5, 1),
};

export const EASING_NAMES = Object.keys(EASINGS) as EasingName[];

export const EASING_HINTS: Readonly<Record<EasingName, string>> = {
  linear: 'constant speed',
  in: 'accelerates (exits)',
  out: 'decelerates (entrances)',
  inOut: 'symmetric',
  arrive: 'comes out of depth and settles',
  ignite: 'a light switching on',
  glide: 'move between two states',
  camera: 'heavy departure, long settle',
  signal: 'near-constant, for comets and sweeps',
  overshoot: 'passes the target and returns',
};

export const isEasing = (v: unknown): v is EasingName => typeof v === 'string' && v in EASINGS;
