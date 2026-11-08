import * as THREE from 'three';
import type {Vec3} from '../cyber/three/rig';
import {curveThrough} from '../cyber/three/Signal3D';
import {HALL, HALL_TO_WORLD, OUTSIDE, ROOM, WALL_PORT, rackAt, rackYaw} from './world';

/**
 * The physical route a message takes from John's desk to the data hall, and
 * the transforms between the hall's local frame and the world. Shared by the
 * experiments that travel between the two places, so the geography is the
 * same in every scene.
 */

/** The rack the story's agent lands in. Row 1 faces -z (toward the aisle shared with row 0). */
export const HERO_RACK = {row: 1, i: 3} as const;

const yaw = HALL_TO_WORLD.yaw;
const cosY = Math.cos(yaw);
const sinY = Math.sin(yaw);

/** Hall-local point -> world. */
export const hallToWorld = (p: Vec3): Vec3 => [HALL_TO_WORLD.position[0] + p[0] * cosY + p[2] * sinY, HALL_TO_WORLD.position[1] + p[1], HALL_TO_WORLD.position[2] - p[0] * sinY + p[2] * cosY];

/** Hall-local direction -> world (no translation). */
export const hallDirToWorld = (d: Vec3): Vec3 => [d[0] * cosY + d[2] * sinY, d[1], -d[0] * sinY + d[2] * cosY];

/** The hero rack's open-bay point, hall-local. */
export const heroBayLocal = (): Vec3 => {
  const p = rackAt(HERO_RACK.row, HERO_RACK.i);
  const ry = rackYaw(HERO_RACK.row);
  const dz = HALL.rack.depth / 2 - 0.12;
  return [p[0] - Math.sin(ry) * dz, 0.95, p[2] + Math.cos(ry) * dz];
};

/** Where cables enter the hall: the end of the hero row's tray, hall-local. */
export const hallEntryLocal = (): Vec3 => {
  const p = rackAt(HERO_RACK.row, 0);
  return [p[0] - 2.4, HALL.trayY, p[2]];
};

/** A point above the hero rack on its tray, hall-local. */
export const heroTrayLocal = (): Vec3 => {
  const p = rackAt(HERO_RACK.row, HERO_RACK.i);
  return [p[0], HALL.trayY - 0.05, p[2]];
};

/**
 * The whole route, world coordinates:
 *   wall port -> down the facade -> along the street -> up into the data
 *   centre -> along the tray -> down into the hero rack's bay.
 * Returned with the fractions at which it passes its landmarks, so beats can
 * be keyed to "leaves the building", "arrives at the hall".
 */
export type Route = {
  readonly curve: THREE.Curve<THREE.Vector3>;
  /** Fractions of arc length. */
  readonly marks: {readonly outside: number; readonly street: number; readonly building: number; readonly roof: number; readonly tray: number; readonly bay: number};
};

export const buildRoute = (): Route => {
  const dc = OUTSIDE.dataCenter;
  const g = OUTSIDE.groundY;
  const entry = hallToWorld(hallEntryLocal());
  const tray = hallToWorld(heroTrayLocal());
  const bay = hallToWorld(heroBayLocal());
  // The cable bundle drops from the tray into the top of the rack at its back, runs down inside, and reaches the bay from behind.
  const rackP = rackAt(HERO_RACK.row, HERO_RACK.i);
  const ry = rackYaw(HERO_RACK.row);
  const rear = (d: number): Vec3 => [rackP[0] + Math.sin(ry) * d, 0, rackP[2] - Math.cos(ry) * d];
  const rackTopRear = hallToWorld([rear(0.3)[0], HALL.rack.height + 0.02, rear(0.3)[2]]);
  const rackInside = hallToWorld([rear(0.2)[0], 1.0, rear(0.2)[2]]);
  // Fibre entry on the near facade of the data centre, at street level.
  const facade: Vec3 = [dc.center[0] - 9, g + 0.6, dc.center[2] + dc.depth / 2 + 0.2];
  const pts: Vec3[] = [
    WALL_PORT,
    [WALL_PORT[0], WALL_PORT[1] - 0.2, ROOM.back - 0.3],
    [WALL_PORT[0] + 0.1, g + 0.5, ROOM.back - 0.5],
    [WALL_PORT[0] + 1.6, g + 0.3, ROOM.back - 2.6],
    [4.4, g + 0.3, -12],
    [7, g + 0.3, -28],
    [10.5, g + 0.3, -46],
    [14, g + 0.3, -64],
    [17.5, g + 0.3, -83],
    [21, g + 0.3, -102],
    [24.5, g + 0.3, -121],
    [28, g + 0.3, -140],
    [facade[0] - 3, g + 0.3, facade[2] + 5],
    facade,
    [facade[0], g + dc.height + 0.4, facade[2] - 0.2],
    [entry[0], g + dc.height + 0.5, entry[2]],
    entry,
    tray,
    rackTopRear,
    rackInside,
    bay,
  ];
  const curve = curveThrough(pts, 0.3);
  // Arc-length fractions of the landmarks.
  const total = curve.getLength();
  const lengths = curve.getLengths(400);
  const at = (p: Vec3) => {
    const v = new THREE.Vector3(p[0], p[1], p[2]);
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i <= 400; i++) {
      const q = curve.getPoint(i / 400);
      const d = q.distanceTo(v);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return lengths[best] / total;
  };
  return {
    curve,
    marks: {outside: at(pts[2]), street: at(pts[4]), building: at(facade), roof: at([entry[0], g + dc.height + 0.5, entry[2]]), tray: at(tray), bay: 1},
  };
};
