import {Easing} from 'remotion';

/** Small, pure helpers shared by the story primitives. Everything is a function of numbers in, numbers out. */
export const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
export const seg = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};
/** Rises 0 -> 1 -> 0 across [a, b]. */
export const bump = (t: number, a: number, b: number) => Math.sin(Math.PI * seg(t, a, b));
export const f2 = (n: number) => n.toFixed(2);

export const ease = {
  out: Easing.bezier(0.16, 1, 0.3, 1),
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  in: Easing.bezier(0.55, 0, 0.9, 0.4),
  camera: Easing.bezier(0.7, 0, 0.16, 1),
  /** Anticipation: dips below 0 before going to 1. */
  back: Easing.bezier(0.6, -0.35, 0.3, 1.25),
  overshoot: Easing.bezier(0.3, 1.45, 0.5, 1),
  linear: (t: number) => t,
} as const;

export type XY = {readonly x: number; readonly y: number};
export const mixXY = (a: XY, b: XY, t: number): XY => ({x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t)});

/** Log-space zoom interpolation (perceptually even). */
export const lerpZoom = (a: number, b: number, t: number) => Math.exp(lerp(Math.log(a), Math.log(b), t));

/** A deterministic flicker 0..1 for LEDs: depends only on (seed, time). */
export const blink = (seed: number, time: number, rate = 1, duty = 0.5) => {
  const v = Math.sin(seed * 12.9898 + Math.floor(time * rate * 6 + seed * 3.1) * 78.233) * 43758.5453;
  return v - Math.floor(v) < duty ? 1 : 0.25;
};
