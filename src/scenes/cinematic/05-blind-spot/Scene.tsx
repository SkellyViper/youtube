import React, {useMemo} from 'react';
import {AbsoluteFill} from 'remotion';
import * as THREE from 'three';
import {Stage3D} from '../../../components/cyber/three/Stage3D';
import {useCameraRig, type Rig, type Vec3} from '../../../components/cyber/three/rig';
import {Cage, CageSign, type CageSpec} from '../../../components/cinematic/three/Cage';
import {Closet} from '../../../components/cinematic/three/Closet';
import {DataHall} from '../../../components/cinematic/three/DataHall';
import {cineMaterials, litMix} from '../../../components/cinematic/three/materials';
import {HALL, rackAt, rackYaw} from '../../../components/cinematic/world';
import {clamp01, ease, lerp, seg, smooth} from '../../../components/story/math';
import {useActiveTime, useBeats} from '../../../engine';
import {useTheme} from '../../../styles/ThemeContext';

/**
 * X05 · The scanner misses something (cinematic 3D).
 *
 * Cast:
 *   - the cage          a chain-link enclosure around two rows of the hall:
 *                       the area the scan is responsible for, made of steel
 *                       you could touch. Gates on both aisle ends; the near
 *                       one is slid open, the far one is shut. Open top.
 *   - the racks         twenty ordinary cabinets inside the cage, blue LEDs,
 *                       nothing wrong with any of them.
 *   - the scanner       a bar of green light on a trolley that rides a rail
 *                       under the ceiling, down the cold aisle. Where it
 *                       passes it throws a pool of light on the rack faces.
 *   - the check lamps   a small lamp housing on the top edge of every rack;
 *                       its tick lights steadily once the scanner has passed.
 *   - the sign plates   one by each gate, with an indicator lamp; the lamp
 *                       and a hairline along the cage's top rail turn green
 *                       when the zone has been cleared.
 *   - the closet        a comms closet against the end wall, outside the
 *                       cage, door ajar, light off: a shelf, cardboard boxes,
 *                       an old tower PC with one blinking LED and, in its
 *                       open drive bay, the gimbal iris. The scan has no
 *                       route to it.
 *
 * Beats:
 *   bs-zone     from the open gate, down the aisle: the cage, the racks, the
 *               scanner parked at the near end, unlit. The bar ignites.
 *   bs-sweep    the scanner rides the aisle at constant speed; the pool of
 *               light slides along the faces; check lamps light behind it.
 *               The camera dollies with it, through the gate.
 *   bs-clear    it parks before the shut gate. Every tick is green. The rail
 *               hairline and the sign lamps confirm the zone. Stillness; then
 *               the camera begins to rise.
 *   bs-outside  one crane: up over the fence into the side corridor and
 *               round toward the end wall, where the closet door stands open
 *               with purple light on its floor.
 *   bs-hold     a wide three-quarter from above: the green zone behind its
 *               wire on the left, the lit closet on the right. Hold.
 */

const ROW0 = rackAt(0, 0)[2];
const ROW1 = rackAt(1, 0)[2];
/** The cold aisle between rows 0 and 1 and the two rack faces that look onto it. */
const AISLE_Z = (ROW0 + ROW1) / 2;
const FACE0_Z = ROW0 + HALL.rack.depth / 2;
const FACE1_Z = ROW1 - HALL.rack.depth / 2;
const GATE: readonly [number, number] = [FACE0_Z + 0.025, FACE1_Z - 0.025];
const CAGE: CageSpec = {
  min: [-4.3, ROW0 - HALL.rack.depth / 2 - 0.575],
  max: [4.3, ROW1 + HALL.rack.depth / 2 + 0.575],
  height: 2.4,
  gates: [
    {end: -1, z0: GATE[0], z1: GATE[1], open: 1},
    {end: 1, z0: GATE[0], z1: GATE[1], open: 0},
  ],
};
const RAIL_Y = 3.12;
const BAR_Y = 2.12;
const SCAN_FROM = -3.7;
const SCAN_TO = 3.8;
const CLOSET_POS: Vec3 = [4.5, 0, -7.28];

/** The camera's lane in the aisle: a step toward row 1, clear of the rail and the trolley; it trails the bar by about 2.3 m. */
const CAM_Y = 1.45;
const CAM_Z = AISLE_Z + 0.35;
const DOLLY_FROM = -5.9;
const DOLLY_TO = 1.4;
/** The camera looks a little past the bar, and up at it, so the bar rides in the upper third of the frame. */
const LOOK_AHEAD = 0.4;

const sweepTarget = (sx: number): Vec3 => [sx + LOOK_AHEAD, 1.75, AISLE_Z - 0.35];

const CAM0: Rig = {position: [-6.3, 1.5, AISLE_Z], target: [-2.0, 1.7, AISLE_Z], fov: 46};
const RIG_TRACK = [{beat: 'bs-zone', to: {position: [DOLLY_FROM, CAM_Y, CAM_Z] as Vec3, target: sweepTarget(SCAN_FROM), fov: 44}, from: 0.0, until: 2.6}];
const FINAL: Rig = {position: [6.0, 3.0, 0.0], target: [2.8, 0.85, -5.3], fov: 44};
/** Seconds before the end of bs-clear at which the crane starts to rise. */
const CRANE_LEAD = 0.5;

/** Constant speed with short eased ramps at both ends: a trolley on a rail, not a cursor. */
const RAMP = 0.14;
const travel = (t: number) => {
  const x = clamp01(t);
  const r = RAMP;
  let s: number;
  if (x < r) s = (x * x) / (2 * r);
  else if (x < 1 - r) s = r / 2 + (x - r);
  else {
    const u = 1 - x;
    s = 1 - r - (u * u) / (2 * r);
  }
  return s / (1 - r);
};

/** A spot light with its target in the scene, so it aims where it is told. */
const SpotTo: React.FC<{readonly position: Vec3; readonly target: Vec3; readonly color: string; readonly intensity: number; readonly angle: number; readonly penumbra?: number; readonly distance?: number; readonly castShadow?: boolean}> = ({position, target, color, intensity, angle, penumbra = 0.5, distance = 6, castShadow = false}) => {
  const light = useMemo(() => {
    const l = new THREE.SpotLight();
    l.target = new THREE.Object3D();
    l.shadow.mapSize.set(1024, 1024);
    l.shadow.bias = -0.0006;
    l.shadow.camera.near = 0.3;
    l.shadow.camera.far = 8;
    return l;
  }, []);
  light.color.set(color);
  light.intensity = intensity;
  light.angle = angle;
  light.penumbra = penumbra;
  light.distance = distance;
  light.decay = 2;
  light.castShadow = castShadow;
  return (
    <>
      <primitive object={light} position={[position[0], position[1], position[2]]} />
      <primitive object={light.target} position={[target[0], target[1], target[2]]} />
    </>
  );
};

/**
 * The scanner: a rail under the ceiling along the aisle, hangers to the
 * slab, a trolley, a stem and the light bar across the aisle. `level` is the
 * bar's light, 0 off .. 1 scanning.
 */
const Scanner: React.FC<{readonly x: number; readonly level: number}> = ({x, level}) => {
  const th = useTheme();
  const m = useMemo(() => cineMaterials(th), [th]);
  const safe = th.tone.safe;
  const railLen = SCAN_TO - SCAN_FROM + 0.5;
  const railX = (SCAN_TO + SCAN_FROM) / 2;
  const trolleyY = RAIL_Y - 0.1;
  const stemTop = trolleyY - 0.07;
  const stemBottom = BAR_Y + 0.04;
  const strip = litMix(safe.deep, safe.hot, level, 0.18 + 1.9 * th.glow * level);
  const hangers = useMemo(() => Array.from({length: 8}, (_, k) => SCAN_FROM - 0.25 + ((railLen) * k) / 7), [railLen]);
  return (
    <group>
      <mesh position={[railX, RAIL_Y, AISLE_Z]}>
        <boxGeometry args={[railLen, 0.06, 0.1]} />
        <meshStandardMaterial color={m.rackRail} roughness={0.5} metalness={0.6} />
      </mesh>
      {hangers.map((hx, k) => (
        <mesh key={k} position={[hx, (RAIL_Y + 0.03 + HALL.ceilingY) / 2, AISLE_Z]}>
          <cylinderGeometry args={[0.014, 0.014, HALL.ceilingY - RAIL_Y - 0.03, 8]} />
          <meshStandardMaterial color={m.rackRail} roughness={0.5} metalness={0.6} />
        </mesh>
      ))}
      <group position={[x, 0, AISLE_Z]}>
        <mesh position={[0, trolleyY, 0]} castShadow>
          <boxGeometry args={[0.28, 0.14, 0.18]} />
          <meshStandardMaterial color={m.steelDark} roughness={0.5} metalness={0.5} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.1, RAIL_Y - 0.005, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 0.12, 12]} />
            <meshStandardMaterial color={m.steel} roughness={0.4} metalness={0.7} />
          </mesh>
        ))}
        <mesh position={[0, (stemTop + stemBottom) / 2, 0]}>
          <cylinderGeometry args={[0.025, 0.025, stemTop - stemBottom, 10]} />
          <meshStandardMaterial color={m.steelDark} roughness={0.5} metalness={0.5} />
        </mesh>
        {/* The bar across the aisle */}
        <mesh position={[0, BAR_Y, 0]} castShadow>
          <boxGeometry args={[0.09, 0.08, 1.3]} />
          <meshStandardMaterial color={m.steelDark} roughness={0.45} metalness={0.55} />
        </mesh>
        {/* lit strips: underside and both long faces */}
        <mesh position={[0, BAR_Y - 0.041, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.05, 1.24]} />
          <meshBasicMaterial color={strip} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.046, BAR_Y - 0.012, 0]} rotation={[0, (s * Math.PI) / 2, 0]}>
            <planeGeometry args={[1.24, 0.034]} />
            <meshBasicMaterial color={strip} />
          </mesh>
        ))}
        {/* a small running lamp on the trolley */}
        <mesh position={[0.141, trolleyY + 0.03, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[0.02, 0.012]} />
          <meshBasicMaterial color={litMix(th.tone.system.deep, th.tone.system.base, level, 0.5 + 1.4 * level)} />
        </mesh>
        {level > 0.002 ? (
          <group>
            <pointLight position={[0, BAR_Y - 0.1, 0]} intensity={7 * level} color={safe.base} distance={3.2} decay={2} />
            <SpotTo position={[0, BAR_Y - 0.03, -0.06]} target={[0, 0.95, FACE0_Z - AISLE_Z]} color={safe.base} intensity={30 * level} angle={0.42} penumbra={0.45} distance={5} castShadow />
            <SpotTo position={[0, BAR_Y - 0.03, 0.06]} target={[0, 0.95, FACE1_Z - AISLE_Z]} color={safe.base} intensity={30 * level} angle={0.42} penumbra={0.45} distance={5} />
          </group>
        ) : null}
      </group>
    </group>
  );
};

/**
 * A check lamp on the top edge of a rack: a small housing on a bracket, a
 * dark lens and a tick that lights steadily once the rack has been scanned.
 * Local +z is the aisle side.
 */
const CheckLamp: React.FC<{readonly position: Vec3; readonly yaw: number; readonly on: number; readonly flash: number}> = ({position, yaw, on, flash}) => {
  const th = useTheme();
  const m = useMemo(() => cineMaterials(th), [th]);
  const col = litMix(th.tone.safe.deep, th.tone.safe.base, on, 0.16 + (2.0 + 1.5 * flash) * th.glow * on);
  return (
    <group position={[position[0], position[1], position[2]]} rotation={[0, yaw, 0]}>
      <mesh position={[0, 0.055, -0.05]} castShadow>
        <boxGeometry args={[0.18, 0.08, 0.1]} />
        <meshStandardMaterial color={m.steelDark} roughness={0.75} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0.01, -0.12]}>
        <boxGeometry args={[0.05, 0.02, 0.16]} />
        <meshStandardMaterial color={m.steelDark} roughness={0.75} metalness={0.3} />
      </mesh>
      {/* a matte dark lens: it must not catch the scanner's light and look lit before its turn */}
      <mesh position={[0, 0.055, 0.001]}>
        <planeGeometry args={[0.15, 0.062]} />
        <meshStandardMaterial color={m.plasticDark} roughness={0.9} metalness={0.05} />
      </mesh>
      <mesh position={[-0.028, 0.046, 0.004]} rotation={[0, 0, -0.85]}>
        <boxGeometry args={[0.038, 0.011, 0.004]} />
        <meshBasicMaterial color={col} />
      </mesh>
      <mesh position={[0.014, 0.058, 0.004]} rotation={[0, 0, 0.8]}>
        <boxGeometry args={[0.074, 0.011, 0.004]} />
        <meshBasicMaterial color={col} />
      </mesh>
    </group>
  );
};

const LAMPS = (() => {
  const list: {row: number; i: number; position: Vec3; yaw: number}[] = [];
  for (let row = 0; row < 2; row++) {
    const yaw = rackYaw(row);
    for (let i = 0; i < HALL.perRow; i++) {
      const p = rackAt(row, i);
      const face = p[2] + Math.cos(yaw) * (HALL.rack.depth / 2 - 0.03);
      list.push({row, i, position: [p[0], HALL.rack.height + 0.02, face], yaw});
    }
  }
  return list;
})();

export const Scene: React.FC = () => {
  const th = useTheme();
  const time = useActiveTime();
  const b = useBeats(['bs-zone', 'bs-sweep', 'bs-clear', 'bs-outside', 'bs-hold']);
  const keyed = useCameraRig(CAM0, RIG_TRACK);

  // ---- the scanner ---------------------------------------------------------------
  const ignite = b['bs-zone'].at(2.05, 2.55, ease.out);
  const sweepT = travel(b['bs-sweep'].at(0.08, 3.3, ease.linear));
  const sx = lerp(SCAN_FROM, SCAN_TO, sweepT);
  const park = b['bs-clear'].at(0.15, 0.9, ease.inOut); // the bar dims to standby once parked
  const barLevel = ignite * (1 - 0.72 * park);
  const clear = b['bs-clear'].at(0.4, 1.1, ease.out);

  // ---- camera: keyed approach, dolly with the scanner, then one crane -----------
  const dolly: Rig = {position: [lerp(DOLLY_FROM, DOLLY_TO, sweepT), CAM_Y, CAM_Z], target: sweepTarget(sx), fov: 44};
  const base = b['bs-sweep'].started ? dolly : keyed;
  const craneSeconds = CRANE_LEAD + b['bs-outside'].duration;
  const craneTime = seg(b['bs-clear'].time, b['bs-clear'].duration - CRANE_LEAD, b['bs-clear'].duration) * CRANE_LEAD + b['bs-outside'].time;
  const u = ease.camera(clamp01(craneTime / craneSeconds));
  // Rise first (clear of the fence top and the parked trolley), then drift out into the corridor.
  const rig: Rig = {
    position: [lerp(base.position[0], FINAL.position[0], u), lerp(base.position[1], FINAL.position[1], smooth(u / 0.4)), lerp(base.position[2], FINAL.position[2], smooth((u - 0.35) / 0.65))],
    target: [lerp(base.target[0], FINAL.target[0], u), lerp(base.target[1], FINAL.target[1], u), lerp(base.target[2], FINAL.target[2], u)],
    fov: lerp(base.fov, FINAL.fov, u),
  };

  // ---- the closet machine ---------------------------------------------------------
  const energy = 0.9 + 0.3 * b['bs-outside'].at(1.6, 3.0, ease.out);

  const stateOf = (row: number) => (row < 2 ? {power: 1, activity: 0.15} : {power: 0.7, activity: 0.08});

  return (
    <AbsoluteFill>
      <Stage3D rig={rig} bloom={{strength: 0.45, radius: 0.6, threshold: 1.0}} fog={0.02} fogColor={th.color.void} background={th.color.void} exposure={1.2} shadows>
        {/* lights just under the level at which the fixtures' own panels bloom: the scanner is the bright thing here */}
        <DataHall stateOf={stateOf} hero={null} time={time} lights={0.45} room={1.6} />
        <Cage spec={CAGE} clear={clear} />
        <CageSign position={[CAGE.min[0] - 0.038, 1.65, GATE[0] - 0.2]} yaw={-Math.PI / 2} clear={clear} />
        <CageSign position={[CAGE.max[0] + 0.038, 1.65, GATE[1] + 0.2]} yaw={Math.PI / 2} clear={clear} />
        <Scanner x={sx} level={barLevel} />
        {LAMPS.map((l) => {
          const passed = sx - l.position[0];
          const on = seg(passed, 0.15, 0.5);
          // A brighter pop just after lighting; whatever is left of it fades as the scanner parks, so the hold is steady.
          const flash = (1 - smooth(seg(passed, 0.5, 1.5))) * (1 - park);
          return <CheckLamp key={`${l.row}-${l.i}`} position={l.position} yaw={l.yaw} on={on} flash={flash} />;
        })}
        {/* A faint green on the aisle floor once the zone is cleared: the lamps' light, pooled */}
        {clear > 0.01 ? <pointLight position={[0, 2.0, AISLE_Z]} intensity={2.2 * clear} color={th.tone.safe.base} distance={7} decay={2} /> : null}
        <Closet position={CLOSET_POS} width={2.2} depth={1.8} height={2.6} doorOpen={1} agent={1} energy={energy} time={time} seed={5} />
        {/* a cold hall light reaching the corridor by the closet, so the door frame reads before the purple does */}
        <pointLight position={[5.6, 3.2, -4.4]} intensity={6} color={th.tone.system.hot} distance={6} decay={2} />
      </Stage3D>
    </AbsoluteFill>
  );
};
