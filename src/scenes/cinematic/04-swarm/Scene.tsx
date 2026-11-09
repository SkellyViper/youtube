import React, {useMemo} from 'react';
import {AbsoluteFill} from 'remotion';
import * as THREE from 'three';
import {Campus, CAMPUS_BUILDINGS} from '../../../components/cinematic/three/Campus';
import {DataHall} from '../../../components/cinematic/three/DataHall';
import {Rack} from '../../../components/cinematic/three/Rack';
import {rackAt, rackYaw} from '../../../components/cinematic/world';
import {AgentCore3D} from '../../../components/cyber/three/AgentCore3D';
import {hdr} from '../../../components/cyber/three/materials';
import {useCameraRig, type Rig, type Vec3} from '../../../components/cyber/three/rig';
import {Comet3D, GlowTube} from '../../../components/cyber/three/Signal3D';
import {Stage3D} from '../../../components/cyber/three/Stage3D';
import {clamp01, ease, lerp, seg, smooth} from '../../../components/story/math';
import {useActiveTime, useBeats, useScalarTrack} from '../../../engine';
import {useShotRig} from '../../../shot';
import {useTheme} from '../../../styles/ThemeContext';
import * as SP from './spread';
import {Takeover} from './Takeover';

/**
 * X04 · One agent becomes a swarm (cinematic 3D).
 *
 * Cast:
 *   - the origin rack   row 1, rack 3: the machine the agent landed in (X02).
 *                       Its bay is open; the gimbal iris sits in the mouth of
 *                       the bay. Purple LEDs among blue.
 *   - the iris          the channel's picture of an AI. It flares when it
 *                       copies itself; a second one assembles in the next rack.
 *   - the riser cable   a patch cable from the bay up the rack's front rail
 *                       and over the top to the bundle under the tray. The
 *                       copy is seen leaving on it, and arriving on the next
 *                       rack's.
 *   - the tray          every row's overhead cable tray and the bundle in it.
 *                       Copies run along it from rack to rack; cables slung
 *                       between trays carry them to the other rows.
 *   - the racks         forty machines. Each changes hands when a copy drops
 *                       into it: LEDs turn purple, the top vent glows, a pool
 *                       of the agent's light falls on the aisle in front.
 *   - the ceiling       fades as the camera rises through it: the hall is one
 *                       roofless box among others.
 *   - the campus        four more buildings, their status lights system blue,
 *                       fibre conduits on the ground between them. The copies
 *                       leave the hall along the fibre; the next buildings'
 *                       lights start turning.
 *
 * Beats:
 *   sw-copy     close on the open bay: the iris flares; a pulse leaves up the
 *               riser to the tray. The camera tilts up with it.
 *   sw-next     the pulse runs the tray to the next rack, drops down its riser
 *               into the bay; that rack changes hands. The camera dollies with
 *               it and ends on a two-shot of two purple racks.
 *   sw-waves    both emit: pulses leave in both directions along the tray and
 *               across the crossovers; the hall turns purple in waves by graph
 *               distance. The camera cranes up to the ceiling and back to the
 *               hall's corner.
 *   sw-campus   the camera rises through the ceiling as it fades. Below, the
 *               hall finishes turning; around it the campus; pulses leave on
 *               the fibre and the next buildings begin.
 */

const IRIS_ORIGIN = SP.irisAt(SP.ORIGIN.row, SP.ORIGIN.i);
const IRIS_NEXT = SP.irisAt(SP.NEXT.row, SP.NEXT.i);
const NEXT_POS = rackAt(SP.NEXT.row, SP.NEXT.i);
const NEXT_YAW = rackYaw(SP.NEXT.row);

/** The opening camera (also the pose the editable shot locks to, see ./shot.ts). */
export const CAM0: Rig = {position: [-1.72, 1.08, -2.9], target: [IRIS_ORIGIN[0], IRIS_ORIGIN[1] + 0.02, IRIS_ORIGIN[2]], fov: 30};
const RIG_TRACK = [
  // A slow push on the iris while it flares.
  {beat: 'sw-copy', to: {position: [-1.6, 1.06, -2.74] as Vec3, fov: 28}, from: 0.0, until: 1.0, easing: ease.inOut},
  // Back and up as the copy climbs (the target follows the pulse).
  {beat: 'sw-copy', to: {position: [-1.95, 1.3, -3.08] as Vec3, fov: 33}, from: 1.0, until: 2.55},
  // The two-shot: both racks, purple among blue.
  {beat: 'sw-next', to: {position: [-0.3, 1.32, -3.22] as Vec3, target: [-0.72, 1.22, -1.6] as Vec3, fov: 42}, from: 0.8, until: 2.8},
  // Crane straight up in the aisle to the ceiling, then back over row 0 to the hall's corner.
  {beat: 'sw-waves', to: {position: [-0.9, 2.95, -3.0] as Vec3, target: [0.3, 1.0, -1.0] as Vec3, fov: 44}, from: 0.0, until: 1.7},
  {beat: 'sw-waves', to: {position: [-6.0, 3.05, -6.4] as Vec3, target: [2.0, 0.5, 1.2] as Vec3, fov: 50}, from: 1.2, until: 3.6},
  // Through the roof and up over the campus.
  {beat: 'sw-campus', to: {position: [-20, 23, -22] as Vec3, target: [3, 6, 3] as Vec3, fov: 55}, from: 0.0, until: 3.4},
];

/** Progress of the first copy along COPY_CURVE: up to the tray in sw-copy, the rest in sw-next. */
const COPY_TRACK = [
  {beat: 'sw-copy', to: SP.COPY_U_TRAY, from: 0.9, until: 2.5, easing: ease.inOut},
  {beat: 'sw-next', to: 1, from: 0.0, until: 2.1, easing: ease.inOut},
];

const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** A pulse travelling an edge of the spread: a bright window of the conduit with a hot head, then a fading wake. */
const EdgePulse: React.FC<{readonly curve: THREE.Curve<THREE.Vector3>; readonly u: number; readonly wake: number; readonly radius: number; readonly head: number; readonly color: string; readonly white: string; readonly glow: number}> = ({curve, u, wake, radius, head, color, white, glow}) => {
  if (u <= 0) return null;
  if (u < 1) {
    const p = curve.getPointAt(u);
    return (
      <group>
        <GlowTube curve={curve} radius={radius} color={color} intensity={1.6 * glow} from={Math.max(0, u - 0.3)} to={u} segments={48} radial={5} />
        <mesh position={p} scale={head}>
          <sphereGeometry args={[1, 10, 8]} />
          <meshBasicMaterial color={hdr(white, 4)} />
        </mesh>
      </group>
    );
  }
  if (wake <= 0.001) return null;
  return <GlowTube curve={curve} radius={radius} color={color} intensity={0.7 * glow} opacity={wake} segments={48} radial={5} />;
};

export const Scene: React.FC = () => {
  const th = useTheme();
  const time = useActiveTime();
  const b = useBeats(['sw-copy', 'sw-next', 'sw-waves', 'sw-campus']);
  const keyed = useCameraRig(CAM0, RIG_TRACK);
  const copyU = useScalarTrack(0, COPY_TRACK);
  const mind = th.tone.mind.base;
  const glow = th.glow;

  // ---- the spread clock: starts with sw-waves, keeps counting through sw-campus --------------------------
  const S = b['sw-waves'].time + b['sw-campus'].time;

  // ---- the first copy ---------------------------------------------------------------------------------------
  const flare = b['sw-copy'].at(0.25, 0.85, ease.inOut) * (1 - b['sw-copy'].at(1.0, 1.7, ease.inOut));
  const left = b['sw-copy'].at(0.9, 1.3, ease.out); // the copy has left the iris
  const landed = b['sw-next'].at(2.05, 2.7, ease.out); // the next rack changes hands
  const pulse = useMemo(() => new THREE.Vector3(), []);
  if (copyU > 0 && copyU < 1) SP.COPY_CURVE.getPointAt(copyU, pulse);
  else if (copyU >= 1) pulse.set(IRIS_NEXT[0], IRIS_NEXT[1], IRIS_NEXT[2]);
  else pulse.set(IRIS_ORIGIN[0], IRIS_ORIGIN[1], IRIS_ORIGIN[2]);
  const travelling = copyU > 0 && copyU < 1;

  // ---- camera: keyed moves; the target follows the first copy while it climbs and drops --------------------
  const followW = b['sw-copy'].at(0.95, 1.5, ease.inOut) * (1 - b['sw-next'].at(1.35, 2.3, ease.inOut));
  // Aim a little under the pulse once it is high, so the rack top stays in frame and the pulse rides the upper third.
  const lead = 0.04 - 0.32 * smooth(seg(pulse.y, 1.7, 2.45));
  const codeRig: Rig = {
    position: keyed.position,
    target: lerp3(keyed.target, [pulse.x, pulse.y + lead, pulse.z], followW),
    fov: keyed.fov,
  };
  // The shot camera: this choreography, unless the shot config locks it or keys a camera track (./shot.ts).
  const rig = useShotRig(codeRig);

  // ---- the roof: fades as the camera reaches it; the campus comes up as the camera leaves ----------------------
  // From the directed camera, so a locked or keyed shot camera still clears the roof when it rises through it.
  const camY = rig.position[1];
  const ceiling = 1 - smooth(seg(camY, 3.05, 3.36));
  const reveal = smooth(seg(camY, 3.1, 5.5));
  const fog = lerp(0.02, 0.008, reveal);

  // ---- rack states ------------------------------------------------------------------------------------------------
  const levelOf = (row: number, i: number) => {
    if (row === SP.ORIGIN.row && i === SP.ORIGIN.i) return 1;
    if (row === SP.NEXT.row && i === SP.NEXT.i) return landed;
    return SP.infectionAt(row, i, S);
  };
  const stateOf = (row: number, i: number) => {
    if (row === SP.ORIGIN.row && i === SP.ORIGIN.i) return {power: 1, activity: 0.75 + 0.25 * flare, agent: 1, open: 1};
    // The next rack is drawn in detail by this scene on top of its instanced stand-in, whose LEDs stay dark.
    if (row === SP.NEXT.row && i === SP.NEXT.i) return {power: 0, activity: 0};
    const inf = SP.infectionAt(row, i, S);
    return {power: 1, activity: 0.15 + (0.15 * ((row * 7 + i * 3) % 5)) / 5 + 0.7 * inf, agent: inf};
  };
  const nextState = {power: 1, activity: 0.2 + 0.8 * landed, agent: landed, open: landed};
  const takenOf = (bi: number) => SP.buildingTakenAt(bi, S);

  // ---- the trunk out of the hall ---------------------------------------------------------------------------------
  const trunkU = seg(S, SP.TRUNK_D, SP.TRUNK_A);
  const trunkWake = 1 - seg(S, SP.TRUNK_A, SP.TRUNK_A + 1.2);

  return (
    <AbsoluteFill>
      <Stage3D rig={rig} bloom={{strength: 0.45, radius: 0.6, threshold: 1.0}} fog={fog} fogColor={th.color.void} background={th.color.void} exposure={1.2} shadows>
        <Campus buildings={CAMPUS_BUILDINGS} taken={takenOf} reveal={reveal} />
        <DataHall stateOf={stateOf} hero={{row: SP.ORIGIN.row, i: SP.ORIGIN.i, showAgent: false}} time={time} lights={0.55} room={1.8} ceiling={ceiling} />
        {/* The next rack in full detail (its bay opens, its LEDs turn), a hair in front of its instanced stand-in. */}
        <Rack position={[NEXT_POS[0], 0, NEXT_POS[2] + Math.cos(NEXT_YAW) * 0.004]} yaw={NEXT_YAW} state={nextState} time={time} seed={SP.NEXT.row * 31 + SP.NEXT.i} showAgent={false} />
        {/* The irises, in the mouths of the open bays, facing the aisle */}
        <group position={[IRIS_ORIGIN[0], IRIS_ORIGIN[1], IRIS_ORIGIN[2]]} rotation={[0, rackYaw(SP.ORIGIN.row), 0]}>
          <AgentCore3D scale={0.062} open={1} energy={1.0 + 0.7 * flare - 0.15 * left} spin={time} facing={0.85} halo={false} seed={3} />
        </group>
        {landed > 0.001 ? (
          <group position={[IRIS_NEXT[0], IRIS_NEXT[1], IRIS_NEXT[2]]} rotation={[0, NEXT_YAW, 0]}>
            <AgentCore3D scale={0.062} open={landed} energy={0.9 + 0.5 * landed} spin={time + 2.3} facing={0.85} halo={false} seed={4} />
          </group>
        ) : null}
        {/* The agent's light on the aisle in front of the taken racks */}
        <pointLight position={[IRIS_ORIGIN[0], IRIS_ORIGIN[1] + 0.1, IRIS_ORIGIN[2] - 0.35]} intensity={3 + 7 * flare} color={mind} distance={5} decay={2} />
        <pointLight position={[IRIS_NEXT[0], IRIS_NEXT[1] + 0.1, IRIS_NEXT[2] - 0.35]} intensity={(landed > 0.001) ? (7 * landed) : 0} color={mind} distance={5} decay={2} />
        <pointLight position={pulse} intensity={(travelling) ? (3) : 0} color={mind} distance={4} decay={2} />
        <Takeover levelOf={levelOf} color={mind} glow={glow} />

        {/* Conduits: always there, faintly lit steel */}
        {SP.TRAY_BUNDLES.map((c, k) => (
          <GlowTube key={`tray${k}`} curve={c} radius={0.024} color={th.color.steel} intensity={0.5} segments={120} radial={5} />
        ))}
        {SP.CROSSOVERS.map((c, k) => (
          <GlowTube key={`x${k}`} curve={c} radius={0.016} color={th.color.steel} intensity={0.5} segments={24} radial={5} />
        ))}
        {SP.DROPS.map((c, k) => (
          <GlowTube key={`d${k}`} curve={c} radius={0.014} color={th.color.steel} intensity={0.5} segments={6} radial={5} />
        ))}
        <GlowTube curve={SP.RISER_ORIGIN} radius={0.009} color={th.color.steel} intensity={0.6} segments={80} radial={5} />
        <GlowTube curve={SP.RISER_NEXT} radius={0.009} color={th.color.steel} intensity={0.6} segments={80} radial={5} />
        <GlowTube curve={SP.TRUNK_CURVE} radius={0.03} color={th.color.steel} intensity={0.5} segments={64} radial={5} />
        {SP.FIBRES.map((f, k) => (
          <GlowTube key={`f${k}`} curve={f.curve} radius={0.08} color={th.color.steel} intensity={0.6} segments={64} radial={5} />
        ))}

        {/* The first copy: a comet along the riser, the tray and the next riser, the cable lit behind it */}
        {travelling ? <GlowTube curve={SP.COPY_CURVE} radius={0.014} color={mind} intensity={1.3 * glow} from={Math.max(0, copyU - 0.12)} to={copyU} segments={300} radial={5} /> : null}
        {travelling ? <Comet3D curve={SP.COPY_CURVE} t={copyU / 1.04} tail={0.04} color={mind} radius={0.02} intensity={2.6 * glow} head={1.8} /> : null}

        {/* The waves: one pulse per edge of the spread tree */}
        {SP.SPREAD.edges.map((e, k) => (
          <EdgePulse key={k} curve={e.curve} u={seg(S, e.depart, e.arrive)} wake={1 - seg(S, e.arrive, e.arrive + 0.9)} radius={0.03} head={0.045} color={mind} white={th.color.white} glow={glow} />
        ))}

        {/* Out of the hall: the trunk, then the fibres to the next buildings */}
        <EdgePulse curve={SP.TRUNK_CURVE} u={trunkU} wake={trunkWake} radius={0.04} head={0.07} color={mind} white={th.color.white} glow={glow} />
        {SP.FIBRES.map((f, k) => (
          <EdgePulse key={`fp${k}`} curve={f.curve} u={seg(S, f.depart, f.arrive)} wake={1 - seg(S, f.arrive, f.arrive + 2.0)} radius={0.12} head={0.25} color={mind} white={th.color.white} glow={glow} />
        ))}
        {/* Light from the hall below spills upward once the roof is gone (what the camera above sees of the purple hall) */}
        <pointLight position={[0, 6, 0]} intensity={(reveal > 0.01) ? (40 * reveal * clamp01(SP.infectionAt(2, 5, S) + 0.3)) : 0} color={mind} distance={30} decay={2} />
      </Stage3D>
    </AbsoluteFill>
  );
};
