import type {Rig} from '../../../components/cyber/three';

/**
 * Static layout of the structure: a disc of cells (4 x 4 units each) around
 * the origin. The cell at the origin is the one the viewer watches forming
 * (drawn with full AgentCore3D instances); everything else is instanced.
 *
 * Units inside a cell sit on a square lattice of spacing A. Cells repeat
 * every PITCH = 6 A, so between two cells two lattice lines are missing: that
 * gap is what makes a cell readable as a cell.
 */

/** Lattice spacing inside a cell. */
export const A = 3.0;
/** Height at which every unit hovers above the mirror floor. */
export const HOVER = 1.55;
/** Distance between cell centres. */
export const PITCH = 6 * A;
/** Radius of the whole structure. */
export const RADIUS = 130;
/** Width of the outermost band, the units that drift towards red. */
export const RIM = 36;

/** The wide shot the reveal ends on. The layout only keeps what this camera can see. */
export const RIG_WIDE: Rig = {position: [0, 24, 62], target: [0, 0, -17], fov: 42};

/** Lattice slot (i, j in 0..3) -> the binary choice made at each of the four divisions (x, z, x, z). */
export const slotSigns = (i: number, j: number): readonly [number, number, number, number] => [i >= 2 ? 1 : -1, j >= 2 ? 1 : -1, i % 2 ? 1 : -1, j % 2 ? 1 : -1];

const slotOffset = (i: number) => (i - 1.5) * A;

/** Generous test against the wide shot's frustum (ground footprint plus margin). */
const inView = (x: number, z: number): boolean => {
  const dz = RIG_WIDE.position[2] - z;
  if (dz < 21) return false;
  return Math.abs(x) <= 0.76 * dz + 12;
};

export type SwarmField = {
  readonly count: number;
  /** Rest position per unit (x, y, z). */
  readonly rest: Float32Array;
  /** Centre of the unit's cell per unit (x, z). */
  readonly cell: Float32Array;
  /** The four division choices per unit (+1 / -1): x1, z2, x3, z4. */
  readonly signs: Int8Array;
  /** Distance from the origin of the unit at rest. */
  readonly dist: Float32Array;
  /** Distance from the origin of the unit's cell centre. */
  readonly cellDist: Float32Array;
  /** 0..1: how far into the outer band the unit sits. */
  readonly rim: Float32Array;
};

export type SwarmLinkSet = {
  readonly count: number;
  /** ax ay az bx by bz per link; A is the end nearer the origin. */
  readonly segments: Float32Array;
  /** Distance of the farther of the two cells: a link can only exist once that cell does. */
  readonly cellDist: Float32Array;
  /** Distance of the link's midpoint from the origin. */
  readonly dist: Float32Array;
  readonly rim: Float32Array;
  /** 1 = a long link between two cells, 0 = inside a cell. */
  readonly trunk: Uint8Array;
};

type Slot = {readonly x: number; readonly z: number; readonly d: number; readonly cellDist: number; readonly hero: boolean};

const rimOf = (d: number) => Math.min(1, Math.max(0, (d - (RADIUS - RIM)) / (RIM * 0.7)));

const N = Math.ceil((RADIUS + 2 * A) / PITCH);
const slotKey = (cx: number, cz: number, i: number, j: number) => (((cx + N + 1) * (2 * N + 3) + (cz + N + 1)) * 4 + i) * 4 + j;

const build = () => {
  const slots = new Map<number, Slot>();
  type UnitDraft = {x: number; z: number; cellX: number; cellZ: number; signs: readonly number[]; d: number; cellDist: number; near: boolean};
  const units: UnitDraft[] = [];

  for (let cz = -N; cz <= N; cz++) {
    for (let cx = -N; cx <= N; cx++) {
      const cellX = cx * PITCH;
      const cellZ = cz * PITCH;
      const cellDist = Math.hypot(cellX, cellZ);
      const hero = cx === 0 && cz === 0;
      // Cells close to the camera get the full-detail unit.
      const near = Math.abs(cx) <= 3 && cz >= -3;
      for (let j = 0; j < 4; j++) {
        for (let i = 0; i < 4; i++) {
          const x = cellX + slotOffset(i);
          const z = cellZ + slotOffset(j);
          const d = Math.hypot(x, z);
          if (d > RADIUS || !inView(x, z)) continue;
          slots.set(slotKey(cx, cz, i, j), {x, z, d, cellDist, hero});
          if (!hero) units.push({x, z, cellX, cellZ, signs: slotSigns(i, j), d, cellDist, near});
        }
      }
    }
  }

  const pack = (list: readonly UnitDraft[]): SwarmField => {
    const count = list.length;
    const rest = new Float32Array(count * 3);
    const cell = new Float32Array(count * 2);
    const signs = new Int8Array(count * 4);
    const dist = new Float32Array(count);
    const cellDist = new Float32Array(count);
    const rim = new Float32Array(count);
    list.forEach((u, n) => {
      rest.set([u.x, HOVER, u.z], n * 3);
      cell.set([u.cellX, u.cellZ], n * 2);
      signs.set(u.signs, n * 4);
      dist[n] = u.d;
      cellDist[n] = u.cellDist;
      rim[n] = rimOf(u.d);
    });
    return {count, rest, cell, signs, dist, cellDist, rim};
  };

  // Links: every unit to its +x and +z neighbour inside the cell, and the two
  // middle rows / columns across the gap to the next cell.
  type LinkDraft = {a: Slot; b: Slot; trunk: boolean};
  const links: LinkDraft[] = [];
  const add = (p: Slot | undefined, q: Slot | undefined, trunk: boolean) => {
    if (!p || !q) return;
    if (p.hero && q.hero) return; // the first cell draws its own links
    links.push(p.d <= q.d ? {a: p, b: q, trunk} : {a: q, b: p, trunk});
  };
  for (let cz = -N; cz <= N; cz++) {
    for (let cx = -N; cx <= N; cx++) {
      for (let j = 0; j < 4; j++) {
        for (let i = 0; i < 4; i++) {
          const here = slots.get(slotKey(cx, cz, i, j));
          if (!here) continue;
          if (i < 3) add(here, slots.get(slotKey(cx, cz, i + 1, j)), false);
          else if (j === 1 || j === 2) add(here, slots.get(slotKey(cx + 1, cz, 0, j)), true);
          if (j < 3) add(here, slots.get(slotKey(cx, cz, i, j + 1)), false);
          else if (i === 1 || i === 2) add(here, slots.get(slotKey(cx, cz + 1, i, 0)), true);
        }
      }
    }
  }
  const linkSet: SwarmLinkSet = {
    count: links.length,
    segments: new Float32Array(links.length * 6),
    cellDist: new Float32Array(links.length),
    dist: new Float32Array(links.length),
    rim: new Float32Array(links.length),
    trunk: new Uint8Array(links.length),
  };
  links.forEach((l, n) => {
    linkSet.segments.set([l.a.x, HOVER, l.a.z, l.b.x, HOVER, l.b.z], n * 6);
    linkSet.cellDist[n] = Math.max(l.a.cellDist, l.b.cellDist);
    const d = Math.hypot((l.a.x + l.b.x) / 2, (l.a.z + l.b.z) / 2);
    linkSet.dist[n] = d;
    linkSet.rim[n] = rimOf(d);
    linkSet.trunk[n] = l.trunk ? 1 : 0;
  });

  return {near: pack(units.filter((u) => u.near)), far: pack(units.filter((u) => !u.near)), links: linkSet};
};

/** Built once, at module load: the layout never changes. */
export const FIELD = build();

/** The 16 lattice slots of the first cell, in a fixed order. */
export const HERO_SLOTS = Array.from({length: 16}, (_, n) => {
  const i = n % 4;
  const j = Math.floor(n / 4);
  return {i, j, signs: slotSigns(i, j), x: slotOffset(i), z: slotOffset(j)};
});

/** The first cell's 24 links, as pairs of HERO_SLOTS indices, with the distance of the midpoint from the cell centre. */
export const HERO_LINKS = (() => {
  const out: {a: number; b: number; d: number}[] = [];
  for (let j = 0; j < 4; j++) {
    for (let i = 0; i < 4; i++) {
      const n = j * 4 + i;
      if (i < 3) out.push({a: n, b: n + 1, d: Math.hypot(slotOffset(i) + A / 2, slotOffset(j))});
      if (j < 3) out.push({a: n, b: n + 4, d: Math.hypot(slotOffset(i), slotOffset(j) + A / 2)});
    }
  }
  return out;
})();
