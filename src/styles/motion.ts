import {Easing} from 'remotion';

/**
 * Shared easing vocabulary. Using a small, consistent set of curves is what
 * makes a sequence feel "designed" rather than assembled.
 */
export const ease = {
  /** Default entrance: fast start, long soft landing. */
  out: Easing.bezier(0.16, 1, 0.3, 1),
  /** Strong exponential landing for big type. */
  outExpo: Easing.bezier(0.19, 1, 0.22, 1),
  /** Symmetric move between two states. */
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  /** Camera: slow, weighty departure and long settle. */
  camera: Easing.bezier(0.7, 0, 0.16, 1),
  /** Exit / gather. */
  in: Easing.bezier(0.55, 0, 0.9, 0.4),
  /** Constant velocity (scanners, sweeps). */
  linear: Easing.linear,
  /** Scanning sweep: brief acceleration, steady middle, brief deceleration. */
  sweep: Easing.bezier(0.4, 0, 0.6, 1),
} as const;

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
/** Map t from [a, b] to [0, 1] with clamping. */
export const remap = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
