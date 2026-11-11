import type {Vec3} from '../components/cyber/three/rig';

/**
 * Camera helpers for locked shots.
 *
 * `screenInsert` answers "where does the camera go for a close-up of this
 * part of the screen?" so that inserts are computed the same way in every
 * scene instead of being nudged by hand. An insert is cut to (a camera key
 * with `cut: true`), never travelled to.
 */

/** A flat or curved screen: centre of the picture, picture size in metres, curvature radius (omit or 0 = flat). The screen faces +z. */
export type ScreenSpec = {readonly center: Vec3; readonly width: number; readonly height: number; readonly radius?: number};

/** A part of the picture, as fractions of it (x from the left edge, y from the top). */
export type ScreenRegion = {readonly x: number; readonly y: number; readonly w: number; readonly h: number};

export type InsertOptions = {
  /** Vertical field of view, degrees (default 26: the episode's insert lens). */
  readonly fov?: number;
  /** How much of the frame the region fills in its tighter dimension, 0..1 (default 0.62: the region plus some of its surroundings, so the viewer keeps their bearings). */
  readonly fill?: number;
  /** Degrees the camera stands to the side of the region's normal (+ = toward +x). Keep it small: text shears beyond about 8 degrees. */
  readonly yaw?: number;
  /** Degrees the camera stands above the region's normal. */
  readonly pitch?: number;
  /** Frame aspect (default 16 / 9). */
  readonly aspect?: number;
};

/** World point of a picture position (fractions) on the screen, and the outward normal there. */
export const screenPoint = (screen: ScreenSpec, u: number, v: number): {point: Vec3; normal: Vec3} => {
  const x = (u - 0.5) * screen.width;
  const y = (0.5 - v) * screen.height;
  const r = screen.radius ?? 0;
  if (r <= 0) return {point: [screen.center[0] + x, screen.center[1] + y, screen.center[2]], normal: [0, 0, 1]};
  // A curved panel bends around a vertical axis `radius` in front of it; x is arc length.
  const a = x / r;
  return {point: [screen.center[0] + r * Math.sin(a), screen.center[1] + y, screen.center[2] + r - r * Math.cos(a)], normal: [-Math.sin(a), 0, Math.cos(a)]};
};

/**
 * A near-frontal insert on `region`: the camera sits on the region's normal
 * (turned by `yaw` / `pitch`), far enough for the region to fill `fill` of
 * the frame, and looks at the region's centre.
 */
export const screenInsert = (screen: ScreenSpec, region: ScreenRegion, options: InsertOptions = {}): {position: Vec3; target: Vec3; fov: number} => {
  const {fov = 26, fill = 0.62, yaw = 0, pitch = 0, aspect = 16 / 9} = options;
  const {point, normal} = screenPoint(screen, region.x + region.w / 2, region.y + region.h / 2);
  const tanV = Math.tan((fov * Math.PI) / 360);
  const k = Math.min(1, Math.max(0.05, fill));
  const distance = Math.max((region.w * screen.width) / (2 * tanV * aspect), (region.h * screen.height) / (2 * tanV)) / k;
  // Turn the normal about the vertical axis, then lift it.
  const base = Math.atan2(normal[0], normal[2]) + (yaw * Math.PI) / 180;
  const lift = (pitch * Math.PI) / 180;
  const dir: Vec3 = [Math.sin(base) * Math.cos(lift), Math.sin(lift), Math.cos(base) * Math.cos(lift)];
  const round = (n: number) => Math.round(n * 1000) / 1000;
  return {
    position: [round(point[0] + dir[0] * distance), round(point[1] + dir[1] * distance), round(point[2] + dir[2] * distance)],
    target: [round(point[0]), round(point[1]), round(point[2])],
    fov,
  };
};
