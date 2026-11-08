import type {Vec3} from '../cyber/three/rig';

/**
 * One continuous world for the developer story, in metres, y up, floor at 0.
 *
 * Fern's reenactments feel physical because places keep their geography from
 * shot to shot: the camera can leave a desk, go through a window and arrive
 * at a far building without a cut, and the viewer always knows where they
 * are. These constants fix that geography for every cinematic experiment:
 *
 *   John's room      around the origin. He sits at +z facing -z; the back wall
 *                    with the window is at z = ROOM.back.
 *   outside          the window looks out over a dark district; the data
 *                    centre is the long low building far to the north-east.
 *   the data hall    inside that building. Its own local frame (HALL) so the
 *                    hall scenes can also be staged alone.
 */

export const ROOM = {
  width: 4.6,
  depth: 4.2,
  height: 2.75,
  /** z of the back wall (behind the desk). */
  back: -0.62,
  /** The window in the back wall. */
  window: {x: -0.15, y: 1.05, width: 1.7, height: 1.25, sill: 0.08},
} as const;

export const DESK = {
  /** Centre of the desk top. */
  center: [0, 0.74, -0.08] as Vec3,
  width: 1.9,
  depth: 0.8,
  thickness: 0.035,
} as const;

/** Game monitor: landscape 27", slightly turned toward John. */
export const GAME_MONITOR = {
  position: [-0.27, 1.1, -0.3] as Vec3,
  width: 0.6,
  height: 0.34,
  yaw: 0.12,
  /** Canvas resolution (16:9). */
  px: [768, 432] as const,
} as const;

/** Agent monitor: portrait, to the right, turned toward John. */
export const CHAT_MONITOR = {
  position: [0.5, 1.12, -0.24] as Vec3,
  width: 0.32,
  height: 0.57,
  yaw: -0.42,
  px: [432, 768] as const,
} as const;

export const KEYBOARD = {position: [-0.02, 0.757, 0.14] as Vec3, width: 0.44, depth: 0.15} as const;
export const MOUSE = {position: [0.34, 0.76, 0.16] as Vec3} as const;
export const MUG = {position: [-0.78, 0.74, -0.02] as Vec3} as const;
export const LAMP = {position: [0.86, 0.74, -0.34] as Vec3} as const;
export const PLANT = {position: [-0.86, 0.74, -0.36] as Vec3} as const;

/** John: seated, facing -z. The chair's floor point. */
export const JOHN = {position: [0, 0, 0.92] as Vec3} as const;

/** Where the desk's cables go: down the back, along the skirting, into a wall port by the window. */
export const WALL_PORT: Vec3 = [1.55, 0.3, ROOM.back + 0.02];

/**
 * The world outside the window. The ground is below John's floor (he is on an
 * upper storey), the district is low, and the data centre is the one lit
 * long building, far enough that it reads as "elsewhere".
 */
export const OUTSIDE = {
  groundY: -7.5,
  /** The data centre building: footprint centre and size. */
  dataCenter: {center: [38, -7.5, -168] as Vec3, width: 34, depth: 15, height: 7.5, yaw: 0.22},
} as const;

/**
 * The data hall, in its own local frame: racks stand on y = 0, rows run along
 * x, aisles along z. Used by the swarm, blind-spot and still-running scenes.
 * HALL_TO_WORLD places it inside the data centre building for the scenes
 * that travel there from the room.
 */
export const HALL = {
  rows: 4,
  perRow: 10,
  /** Distance between rack centres along a row. */
  pitch: 0.72,
  /** Distance between the centre lines of two rows (one aisle). */
  aisle: 2.6,
  rack: {width: 0.62, height: 2.05, depth: 1.05},
  /** Height of the overhead cable tray. */
  trayY: 2.55,
  ceilingY: 3.4,
} as const;

export const HALL_TO_WORLD = {
  position: [OUTSIDE.dataCenter.center[0], OUTSIDE.groundY + 0.4, OUTSIDE.dataCenter.center[2]] as Vec3,
  yaw: OUTSIDE.dataCenter.yaw,
} as const;

/** Local rack centre (floor point) in the hall for row r, index i. Racks in a row face +z if the row is even. */
export const rackAt = (row: number, i: number): Vec3 => {
  const x = (i - (HALL.perRow - 1) / 2) * HALL.pitch;
  const z = (row - (HALL.rows - 1) / 2) * HALL.aisle;
  return [x, 0, z];
};

/** Facing of a row: even rows look toward +z, odd rows toward -z, so each aisle has two faces. */
export const rackYaw = (row: number): number => (row % 2 === 0 ? 0 : Math.PI);
