import {Easing} from 'remotion';

/**
 * PROVISIONAL "obsidian neon" theme for the Style Lab experiments.
 *
 * Everything the ten samples share lives here: palette, colour semantics,
 * glow / bloom limits, line weights, type roles, timing and camera defaults.
 * Change a token here and every sample follows. Nothing in this file is final
 * channel branding; it is the shared vocabulary we are evaluating.
 *
 * Colour semantics (the one rule every sample obeys):
 *   blue   = systems, infrastructure, neutral computation
 *   purple = AI, intelligence, agents, inference
 *   red    = compromise, danger, uncontrolled behaviour
 */
export const cyber = {
  color: {
    /** Base: the frame is never flat black; it is a deep blue-black void. */
    void: '#04050A',
    abyss: '#070A14',
    charcoal: '#10131D',
    /** Unlit structure: slabs, plates, inactive nodes. */
    slate: '#1A2032',
    /** Hairlines on unlit structure. */
    steel: '#2B3654',
    /** Horizon haze band. */
    haze: '#16226A',

    blue: '#2E9BFF',
    blueHot: '#A6D6FF',
    blueDeep: '#0B3C9E',

    purple: '#8B3DFF',
    purpleHot: '#CDB2FF',
    purpleDeep: '#3B1290',

    red: '#FF2A3C',
    redHot: '#FF949C',
    redDeep: '#7C0F1B',

    /** Signal heads and the very centre of a core. Used in tiny amounts only. */
    white: '#EAF2FF',
    text: '#C4CFE6',
    dim: '#66718F',
  },

  /** Semantic roles -> palette triplets. Use `tone('mind')` rather than raw hexes. */
  tone: {
    system: {base: '#2E9BFF', hot: '#A6D6FF', deep: '#0B3C9E'},
    mind: {base: '#8B3DFF', hot: '#CDB2FF', deep: '#3B1290'},
    threat: {base: '#FF2A3C', hot: '#FF949C', deep: '#7C0F1B'},
    inert: {base: '#2B3654', hot: '#66718F', deep: '#1A2032'},
  },

  /**
   * Glow is a budget, not a default. In 3D only materials whose colour is
   * multiplied above 1.0 bloom at all (`emissive.*`); in 2D use `glow2d.*`
   * as drop-shadow / blur radii. If a frame has more than ~3 strongly
   * glowing things, something should be dimmed.
   */
  emissive: {
    /** Lit but not blooming: structure seams, idle nodes. */
    dim: 0.55,
    /** Standard lit element; faint halo. */
    base: 1.5,
    /** Active element. */
    strong: 2.6,
    /** Signal heads, the agent core centre. */
    hot: 4.5,
  },
  bloom: {strength: 0.85, radius: 0.72, threshold: 0.92},
  glow2d: {soft: 10, base: 18, strong: 34},

  /** Stroke widths in px at 1920x1080. */
  line: {hair: 1.25, thin: 2, medium: 3, heavy: 5},

  font: {
    /** Labels: wide grotesk, sentence case, used sparingly. */
    label: "'Archivo', 'Arial', sans-serif",
    /** Numeric readouts only (tabular figures). */
    mono: "'JetBrains Mono', ui-monospace, monospace",
  },
  /** Label style: Archivo at 118% width, medium weight. Nothing smaller than `size.label`. */
  labelStyle: {
    fontFamily: "'Archivo', 'Arial', sans-serif",
    fontStretch: '118%',
    fontWeight: 500,
    letterSpacing: '0.02em',
  },
  size: {label: 24, caption: 30, title: 64},
  /** Safe area (px) for anything that must stay readable. */
  safe: {x: 120, y: 96},
  space: {xs: 8, sm: 16, md: 32, lg: 64, xl: 120},

  /** Seconds. Samples should compose beats from these rather than inventing new speeds. */
  time: {
    /** A state flip: ignite, tick, snap. */
    quick: 0.35,
    /** One element moving / drawing. */
    move: 0.9,
    /** A group reveal. */
    reveal: 1.5,
    /** A camera move. */
    camera: 2.6,
    /** Default export hold. */
    hold: 1.1,
  },

  /** 3D camera + stage defaults. World units are metres-ish; the floor is y = 0. */
  camera: {fov: 34, near: 0.1, far: 600},
  fog: {color: '#05060D', density: 0.018},
  /** Screen-space fraction (0 top .. 1 bottom) where 2D scenes put their horizon haze. */
  horizon: 0.64,
} as const;

export type Tone = keyof typeof cyber.tone;
export const tone = (t: Tone) => cyber.tone[t];

/**
 * Motion vocabulary (shared with src/styles/motion.ts, plus cyber-specific curves).
 *   arrive  things come out of depth/fog and settle        (default entrance)
 *   ignite  a light switching on: fast attack, tiny overshoot handled by callers
 *   glide   symmetric move between two states
 *   camera  slow, weighty departure and long settle; the only curve for camera moves
 *   leave   exits and gathers
 *   signal  near-constant velocity for comets and scan sweeps
 */
export const motion = {
  arrive: Easing.bezier(0.16, 1, 0.3, 1),
  ignite: Easing.bezier(0.2, 0.9, 0.1, 1),
  glide: Easing.bezier(0.65, 0, 0.35, 1),
  camera: Easing.bezier(0.7, 0, 0.16, 1),
  leave: Easing.bezier(0.55, 0, 0.9, 0.4),
  signal: Easing.bezier(0.4, 0, 0.6, 1),
  linear: Easing.linear,
} as const;

/* ------------------------------------------------------------------ colour helpers */

const parseHex = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Blend two hex colours (t = 0 -> a, 1 -> b). Returns `rgb(...)`. */
export const mix = (a: string, b: string, t: number): string => {
  const A = parseHex(a);
  const B = parseHex(b);
  const k = Math.min(1, Math.max(0, t));
  return `rgb(${Math.round(A[0] + (B[0] - A[0]) * k)}, ${Math.round(A[1] + (B[1] - A[1]) * k)}, ${Math.round(A[2] + (B[2] - A[2]) * k)})`;
};

/** Hex colour with alpha. */
export const alpha = (hex: string, a: number): string => {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.min(1, Math.max(0, a)).toFixed(3)})`;
};

/**
 * The control-loss ramp: 0 = blue (system), 1 = purple (intelligence),
 * 2 = red (threat). Fractions blend between neighbours.
 */
export const ramp = (v: number): string => {
  const x = Math.min(2, Math.max(0, v));
  return x <= 1 ? mix(cyber.color.blue, cyber.color.purple, x) : mix(cyber.color.purple, cyber.color.red, x - 1);
};
