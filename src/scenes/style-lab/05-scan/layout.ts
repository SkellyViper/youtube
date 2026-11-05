import type {ScanBox, ScanFieldSpec} from '../../../components/cyber/three/ScanField';
import {scanCoord} from '../../../components/cyber/three/ScanField';
import type {Vec3} from '../../../components/cyber/three';

/**
 * The "system": a dark plate hovering just above the mirror floor, carrying
 * rows of modules like components on a board. World units; the floor is y = 0.
 *
 * Rows run along x. The skyline falls towards the camera (tall at the back,
 * low at the front) so that every module and the mark above it stay readable,
 * with one exception: the front-row tower `HOST`, the module the hidden thing
 * is attached to. Its reflection therefore hangs deepest into the floor.
 */
export const BOARD = {w: 8.6, d: 4.8, bottom: 0.14, top: 0.26} as const;

export type Module = {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly w: number;
  readonly d: number;
  readonly h: number;
};

const row = (prefix: string, z: number, d: number, items: readonly (readonly [x: number, w: number, h: number, dz?: number, dd?: number])[]): Module[] =>
  items.map(([x, w, h, dz = 0, dd = d], i) => ({id: `${prefix}${i + 1}`, x, z: z + dz, w, d: dd, h}));

export const MODULES: readonly Module[] = [
  // Back row: towers.
  ...row('b', -1.5, 1.0, [
    [-3.3, 1.0, 1.45],
    [-2.2, 0.7, 1.05],
    [-1.1, 1.0, 1.8],
    [-0.28, 0.5, 1.2],
    [0.6, 0.8, 1.0],
    [2.45, 1.0, 1.6],
    [3.55, 0.8, 1.15],
  ]),
  // Middle row: mid-rise, two cells split into pairs of small parts.
  ...row('m', 0, 0.9, [
    [-3.4, 0.7, 0.5],
    [-2.45, 0.8, 0.9],
    [-1.5, 0.7, 0.35, -0.25, 0.4],
    [-1.5, 0.7, 0.62, 0.25, 0.4],
    [-0.55, 0.8, 1.0],
    [0.9, 0.9, 0.6],
    [2.35, 0.8, 0.95],
    [3.45, 0.9, 0.4, -0.25, 0.4],
    [3.45, 0.9, 0.72, 0.25, 0.4],
  ]),
  // Front row: low slabs, and the host tower.
  ...row('f', 1.5, 1.0, [
    [-3.25, 1.1, 0.3],
    [-2.15, 0.7, 0.65],
    [-1.2, 0.8, 0.4],
    [-0.2, 0.7, 0.55],
    [0.85, 0.8, 1.35],
    [2.4, 0.9, 0.7],
    [3.5, 0.9, 0.3],
  ]),
];

/** The verified module that is, in fact, compromised. */
export const HOST_INDEX = MODULES.findIndex((m) => m.id === 'f5');
export const HOST = MODULES[HOST_INDEX];

/** The observable region: everything the scanner is pointed at. About 70 % of the modules. */
export const REGION = {x0: -4.0, x1: 1.62, z0: -2.2, z1: 2.2} as const;

/** The scan: a sheet as wide as the region is deep, travelling along +x across it. */
export const FIELD: ScanFieldSpec = {
  from: [REGION.x0, BOARD.top, (REGION.z0 + REGION.z1) / 2],
  to: [REGION.x1, BOARD.top, (REGION.z0 + REGION.z1) / 2],
  width: REGION.z1 - REGION.z0,
  height: 2.3,
};

export const OBSTACLES: readonly ScanBox[] = MODULES.map((m) => ({center: [m.x, m.z], size: [m.w, m.d], height: m.h}));

/** Where the sheet reaches / leaves each module, as fractions of the sweep. */
export const SCANNED = MODULES.map((m) => {
  const c = scanCoord(FIELD, [m.x, BOARD.top + m.h * 0.5, m.z]);
  const enter = scanCoord(FIELD, [m.x - m.w / 2, BOARD.top, m.z]).along;
  const leave = scanCoord(FIELD, [m.x + m.w / 2, BOARD.top, m.z]).along;
  return {inside: c.inside, enter, leave};
});

/** World position of the mark that floats above a module. */
export const tickAnchor = (m: Module): Vec3 => [m.x, BOARD.top + m.h + 0.26, m.z];

/* ------------------------------------------------------------------ hairlines */

export type Segment = {
  readonly a: Vec3;
  readonly b: Vec3;
  /** 'edge' = a module edge, 'trace' = a conductor on the plate, 'rim' = the plate's own outline. */
  readonly kind: 'edge' | 'trace' | 'rim';
  readonly width: number;
  /** Sweep fraction at which the sheet reaches the segment's midpoint; -1 if it never does. */
  readonly along: number;
};

const EDGE_WIDTH = 0.014;
const TRACE_WIDTH = 0.011;

const segment = (a: Vec3, b: Vec3, kind: Segment['kind'], width: number): Segment => {
  const mid: Vec3 = [(a[0] + b[0]) / 2, Math.min(BOARD.top + FIELD.height, (a[1] + b[1]) / 2), (a[2] + b[2]) / 2];
  const c = scanCoord(FIELD, mid);
  return {a, b, kind, width, along: kind !== 'rim' && c.inside ? c.along : -1};
};

const moduleEdges = (m: Module): Segment[] => {
  const x0 = m.x - m.w / 2;
  const x1 = m.x + m.w / 2;
  const z0 = m.z - m.d / 2;
  const z1 = m.z + m.d / 2;
  const y0 = BOARD.top;
  const y1 = BOARD.top + m.h;
  const out: Segment[] = [];
  for (const y of [y0, y1]) {
    out.push(segment([x0, y, z0], [x1, y, z0], 'edge', EDGE_WIDTH));
    out.push(segment([x0, y, z1], [x1, y, z1], 'edge', EDGE_WIDTH));
    out.push(segment([x0, y, z0], [x0, y, z1], 'edge', EDGE_WIDTH));
    out.push(segment([x1, y, z0], [x1, y, z1], 'edge', EDGE_WIDTH));
  }
  for (const x of [x0, x1]) for (const z of [z0, z1]) out.push(segment([x, y0, z], [x, y1, z], 'edge', EDGE_WIDTH));
  return out;
};

/** Conductors on the plate: two buses in the aisles between the rows, and a stub from each module to its bus. */
const traces = (): Segment[] => {
  const y = BOARD.top + 0.004;
  const out: Segment[] = [];
  const buses = [-0.74, 0.74];
  // Short pieces, so the scan lights a bus progressively; one joint falls exactly on the region's edge.
  const step = 0.43;
  const start = REGION.x1 - step * 13;
  for (const z of buses) {
    for (let i = 0; start + i * step < 3.86; i++) {
      const x = start + i * step;
      out.push(segment([x, y, z], [Math.min(3.9, x + step), y, z], 'trace', TRACE_WIDTH));
    }
  }
  for (const m of MODULES) {
    const z0 = m.z - m.d / 2;
    const z1 = m.z + m.d / 2;
    // Each module ties into the nearest bus (middle-row parts into the one on their side).
    const bus = m.z < -0.5 ? buses[0] : m.z > 0.5 ? buses[1] : m.z <= 0 ? buses[0] : buses[1];
    const from = bus < m.z ? z0 : z1;
    const x = m.x + (m.w > 0.75 ? 0.2 : 0);
    if (Math.abs(from - bus) > 0.02) out.push(segment([x, y, from], [x, y, bus], 'trace', TRACE_WIDTH));
    if (m.w > 0.95) out.push(segment([m.x - 0.3, y, from], [m.x - 0.3, y, bus], 'trace', TRACE_WIDTH));
  }
  return out;
};

const rim = (): Segment[] => {
  const x = BOARD.w / 2;
  const z = BOARD.d / 2;
  const y = BOARD.top;
  return [
    segment([-x, y, -z], [x, y, -z], 'rim', EDGE_WIDTH),
    segment([-x, y, z], [x, y, z], 'rim', EDGE_WIDTH),
    segment([-x, y, -z], [-x, y, z], 'rim', EDGE_WIDTH),
    segment([x, y, -z], [x, y, z], 'rim', EDGE_WIDTH),
  ];
};

export const SEGMENTS: readonly Segment[] = [...MODULES.flatMap(moduleEdges), ...traces(), ...rim()];

/* ------------------------------------------------------------------ the hidden thing */

/** Depth of the host's reflection below the floor: where its mirrored top is. */
export const HOST_TIP_Y = -(BOARD.top + HOST.h);
export const AGENT_SCALE = 0.46;
/** Hangs below the floor, under the host. No counterpart above. */
export const AGENT: Vec3 = [HOST.x, HOST_TIP_Y - 1.12, HOST.z];
