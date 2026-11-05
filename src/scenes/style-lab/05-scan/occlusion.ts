import type {Vec3} from '../../../components/cyber/three';

export type Box3 = {readonly min: Vec3; readonly max: Vec3};

/** Does the segment eye -> eye + d (parameter 0..tMax) pass through the box grown by `grow`? Slab test. */
const hits = (eye: Vec3, d: Vec3, box: Box3, grow: number, tMax: number): boolean => {
  let t0 = 0;
  let t1 = tMax;
  for (let k = 0; k < 3; k++) {
    const lo = box.min[k] - grow;
    const hi = box.max[k] + grow;
    if (Math.abs(d[k]) < 1e-9) {
      if (eye[k] < lo || eye[k] > hi) return false;
      continue;
    }
    const a = (lo - eye[k]) / d[k];
    const b = (hi - eye[k]) / d[k];
    t0 = Math.max(t0, Math.min(a, b));
    t1 = Math.min(t1, Math.max(a, b));
    if (t0 > t1) return false;
  }
  return true;
};

/**
 * How visible a world point is from the eye, 0..1, given opaque boxes.
 * A 2D overlay cannot be depth-tested against the 3D picture, so marks pinned
 * to 3D positions use this instead: it falls smoothly to 0 as the line of
 * sight comes within `feather` world units of a box, so a mark that slides
 * behind a module during a camera move fades rather than pops.
 */
export const softVisibility = (eye: Vec3, point: Vec3, boxes: readonly Box3[], feather = 0.09): number => {
  const d: Vec3 = [point[0] - eye[0], point[1] - eye[1], point[2] - eye[2]];
  let v = 1;
  for (const box of boxes) {
    if (!hits(eye, d, box, feather, 0.999)) continue;
    if (hits(eye, d, box, 0, 0.999)) return 0;
    // Smallest growth at which the sight line touches the box = its clearance.
    let lo = 0;
    let hi = feather;
    for (let i = 0; i < 7; i++) {
      const mid = (lo + hi) / 2;
      if (hits(eye, d, box, mid, 0.999)) hi = mid;
      else lo = mid;
    }
    v = Math.min(v, hi / feather);
  }
  return v * v * (3 - 2 * v);
};
