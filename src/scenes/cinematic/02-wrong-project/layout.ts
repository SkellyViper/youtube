import type {Vec3} from '../../../components/cyber/three/rig';

/**
 * X02 · The wrong project: the one set, in metres (y up, floor at 0).
 *
 * John sits at +z facing -z. Everything a component needs to agree on lives
 * here: the desk surface, the monitor, where the hands land, the chair's
 * envelope (the figure must stay inside it, never inside the chair).
 *
 *            -z  (monitor side)
 *   ┌──────────── desk 1.60 × 0.72, top y 0.74 ────────────┐
 *   │            ╭──── curved 21:9 monitor ────╮            │
 *   │                 keyboard    mouse                     │
 *   └──────────────────── front edge z 0.31 ────────────────┘
 *                         chair  (floor point z 0.63, pulled in to the desk)
 *            +z  (camera side, behind his right shoulder)
 */

export const DESK = {
  /** Centre of the desk top surface. */
  top: [0, 0.74, -0.05] as Vec3,
  width: 1.6,
  depth: 0.72,
  thickness: 0.03,
} as const;
/** z of the desk's front edge (the side John sits at). */
export const DESK_FRONT = DESK.top[2] + DESK.depth / 2;

/**
 * The monitor: a curved 21:9 ultrawide (45"), centred on John.
 * `width` is the arc length of the picture; the panel bends around a
 * vertical axis `radius` metres in front of it (toward John).
 */
export const MONITOR = {
  /** Centre of the picture. */
  center: [0, 1.075, -0.26] as Vec3,
  width: 1.04,
  height: 0.447,
  /** Curvature radius (1500R). */
  radius: 1.5,
  /** Canvas resolution of the picture (same aspect as width/height): exports use the high one (sharp in the insert), the live Player the lighter one. */
  px: [3072, 1320] as const,
  pxPreview: [2048, 880] as const,
} as const;

export const KEYBOARD = {
  /** Centre of the keyboard's base, on the desk. */
  position: [-0.04, DESK.top[1], 0.12] as Vec3,
  width: 0.4,
  depth: 0.13,
  /** Height of the key tops above the desk. */
  keyTop: 0.022,
  /** World position of the Enter key's top (the right hand taps it to send). */
  enter: [0.115, DESK.top[1] + 0.022, 0.115] as Vec3,
} as const;

export const MOUSE = {
  position: [0.28, DESK.top[1], 0.13] as Vec3,
} as const;

/**
 * The chair. `floor` is the point under the seat centre; all chair numbers
 * below are relative to it. The figure (also placed at `floor`) must stay
 * inside the envelope: on top of the seat, in front of the backrest, between
 * the armrests, elbows above the arm pads.
 */
export const CHAIR = {
  floor: [0, 0, 0.63] as Vec3,
  seat: {
    /** Top of the cushion. */
    top: 0.48,
    /** Half width (x) and the cushion's z range (local). */
    halfWidth: 0.245,
    zFront: -0.23,
    zBack: 0.23,
    thickness: 0.07,
  },
  back: {
    /** Bottom and top of the backrest frame (y), its front face at z (local), tilt back in degrees. */
    bottom: 0.6,
    top: 0.98,
    halfWidth: 0.225,
    zFront: 0.255,
    tilt: 8,
  },
  arms: {
    /** Armrest pad centre x (±), top y, z range (local). */
    x: 0.285,
    top: 0.685,
    zFront: -0.13,
    zBack: 0.13,
    padWidth: 0.07,
  },
} as const;

/** Shot A, the main shot: a still three-quarter from behind his right shoulder (developer + whole monitor). */
export const SHOT_A = {
  position: [1.85, 1.5, 1.85] as Vec3,
  target: [-0.05, 0.92, -0.15] as Vec3,
  fov: 28,
} as const;

/**
 * Shot B, the insert: nearly frontal on the terminal half of the monitor,
 * from just above and right of his shoulder (clear of his head and arm), so
 * the tab names, the path and the prompt are readable. Used only for the
 * send beat; `pushTo` is where a very slight push-in ends.
 */
export const SHOT_B = {
  position: [0.35, 1.25, 0.75] as Vec3,
  target: [0.295, 1.075, -0.233] as Vec3,
  fov: 26,
  pushTo: [0.345, 1.239, 0.69] as Vec3,
} as const;
