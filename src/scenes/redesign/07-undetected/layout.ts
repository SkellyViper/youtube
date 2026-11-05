import {createRandom} from '../../../components/random';
import type {ScanBox, ScanFieldSpec} from '../../../components/cyber/three/ScanField';
import type {Vec3} from '../../../components/cyber/three/rig';

/**
 * The campus: several identical halls on one obsidian floor.
 *
 *   - hall 0 is the SCANNED ZONE at the origin: a bracketed rectangle holding
 *     eight machines in two rows. The scan sheet sweeps it along +x.
 *   - halls 1..4 lie beyond it, the same layout, unscanned and dimmer.
 *   - exactly one machine in a far hall holds the agent.
 *
 * Everything is deterministic (seeded) so the camera choreography is stable.
 */
export type MachineKind = 'rack' | 'tower' | 'gpu';

export type MachineSpec = {
  readonly id: number;
  readonly hall: number;
  readonly kind: MachineKind;
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  /** Where a process is shown inside the machine, in local units (y up, z toward the viewer). */
  readonly bay: readonly [number, number, number];
};

export type HallSpec = {
  readonly id: number;
  readonly cx: number;
  readonly cz: number;
};

export const BAY: Record<MachineKind, readonly [number, number, number]> = {
  rack: [0, 1.42, 0.47],
  tower: [0, 0.62, 0.27],
  gpu: [0.3, 0.3, 0.47],
};

/** Height of each kind's body and its footprint, for the check mark and the scan drape. */
export const HEIGHT: Record<MachineKind, number> = {rack: 2.2, tower: 1.0, gpu: 0.6};
export const FOOT: Record<MachineKind, readonly [number, number]> = {rack: [1.0, 0.9], tower: [0.5, 0.5], gpu: [1.5, 0.9]};

/** Half-extents of a hall's floor zone. */
export const ZONE_HX = 5.2;
export const ZONE_HZ = 3.8;

export const HALLS: readonly HallSpec[] = [
  {id: 0, cx: 0, cz: 0},
  {id: 1, cx: -14, cz: -3},
  {id: 2, cx: 14, cz: -3},
  {id: 3, cx: -7.5, cz: -16},
  {id: 4, cx: 7.5, cz: -16},
];

/** Two rows of four; the scanned hall's kinds are fixed so the silhouettes read well up close. */
const ZONE_KINDS: readonly MachineKind[] = ['rack', 'tower', 'gpu', 'rack', 'gpu', 'rack', 'rack', 'tower'];
const SLOT_X = [-3.7, -1.25, 1.25, 3.7];
const SLOT_Z = [1.7, -1.7];

export const buildCampus = (seed = 71): MachineSpec[] => {
  const rnd = createRandom(seed);
  const out: MachineSpec[] = [];
  for (const hall of HALLS) {
    for (let r = 0; r < SLOT_Z.length; r++) {
      for (let c = 0; c < SLOT_X.length; c++) {
        const i = r * SLOT_X.length + c;
        const kind = hall.id === 0 ? ZONE_KINDS[i] : rnd.pick(['rack', 'rack', 'tower', 'gpu'] as const);
        out.push({
          id: out.length,
          hall: hall.id,
          kind,
          x: hall.cx + SLOT_X[c] + rnd.range(-0.15, 0.15),
          z: hall.cz + SLOT_Z[r] + rnd.range(-0.2, 0.2),
          yaw: rnd.range(-0.18, 0.18),
          bay: BAY[kind],
        });
      }
    }
  }
  return out;
};

export const CAMPUS = buildCampus();
export const ZONE_MACHINES = CAMPUS.filter((m) => m.hall === 0);
/** The hidden agent: a rack in the far-left hall, second row, so it sits near the top of the wide frame. */
export const AGENT = CAMPUS.find((m) => m.hall === 3 && m.kind === 'rack' && m.z < HALLS[3].cz) ?? CAMPUS.find((m) => m.hall === 3)!;

/** The scan: a sheet that crosses the zone left to right, a little wider than the zone so the edge posts are met. */
export const SCAN: ScanFieldSpec = {from: [-ZONE_HX - 0.5, 0, 0], to: [ZONE_HX + 0.5, 0, 0], width: ZONE_HZ * 2, height: 3.2};

export const SCAN_OBSTACLES: readonly ScanBox[] = ZONE_MACHINES.map((m) => ({center: [m.x, m.z], size: FOOT[m.kind], height: HEIGHT[m.kind]}));

/** Floor corners of a hall, going round. */
export const hallCorners = (h: HallSpec): readonly Vec3[] => [
  [h.cx - ZONE_HX, 0, h.cz - ZONE_HZ],
  [h.cx + ZONE_HX, 0, h.cz - ZONE_HZ],
  [h.cx + ZONE_HX, 0, h.cz + ZONE_HZ],
  [h.cx - ZONE_HX, 0, h.cz + ZONE_HZ],
];
