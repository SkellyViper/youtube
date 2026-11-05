import React, {useMemo} from 'react';
import {AbsoluteFill} from 'remotion';
import * as THREE from 'three';
import {AgentCore3D} from '../../../components/cyber/three/AgentCore3D';
import {MirrorFloor, Reflect, SkyDome, StageLights} from '../../../components/cyber/three/Environment';
import {hdr} from '../../../components/cyber/three/materials';
import {projectPoint, useCameraRig, type Rig, type Vec3} from '../../../components/cyber/three/rig';
import {GlowTube, curveThrough} from '../../../components/cyber/three/Signal3D';
import {Stage3D} from '../../../components/cyber/three/Stage3D';
import {Machine3D} from '../../../components/story/three/Machines3D';
import {clamp01, ease, lerp, seg, smooth} from '../../../components/story/math';
import {useActiveTime, useBeats, useScalarTrack} from '../../../engine';
import {alpha} from '../../../styles/cyber';
import {useTheme} from '../../../styles/ThemeContext';
import {FIRST, FLOOR, ORIGIN, type MachineSpec} from './layout';

/**
 * S04 · Replication and expansion (3D).
 *
 * Cast:
 *   - origin rack      the machine the agent was left running in (S02/S03).
 *   - the agent        the gimbal iris in the rack's open bay.
 *   - the copy         a second iris that peels off the first: the division.
 *   - cables           dark conduits on the floor between machines. A copy
 *                      travels one as a spark; the cable stays lit behind it.
 *   - machines         36 recognisably different computers (racks, towers,
 *                      GPU boxes, laptops). Each lights with the agent's colour
 *                      only when a copy lands in it: "spreading" is visible as
 *                      machines changing hands, not as dots multiplying.
 *   - bracket          a 2D corner bracket on the origin in the wide shot, so
 *                      the eye can find where it all began.
 *
 * Beats:
 *   rp-divide    close on the rack: the core splits, the copy climbs to the uplink.
 *   rp-travel    the copy runs the cable; the camera goes with it; it lands in
 *                a GPU box, which turns purple.
 *   rp-multiply  both divide; sparks leave on every cable; the camera cranes up.
 *   rp-scale     high wide: waves of copies reach the whole floor; the far
 *                edge turns toward red; the origin is bracketed.
 */

const vec = (m: MachineSpec, local: readonly [number, number, number] = [0, 0, 0]): Vec3 => {
  const c = Math.cos(m.yaw);
  const s = Math.sin(m.yaw);
  return [m.x + local[0] * c + local[2] * s, local[1], m.z - local[0] * s + local[2] * c];
};
const bayOf = (m: MachineSpec): Vec3 => vec(m, m.bay);
/** Top-of-machine uplink port, where a copy leaves from. */
const portOf = (m: MachineSpec): Vec3 => {
  const h = m.kind === 'rack' ? 2.22 : m.kind === 'tower' ? 1.02 : m.kind === 'gpu' ? 0.62 : 0.66;
  return [m.x, h, m.z];
};

/** Cable from a parent's port down to the floor, across, and up into the child's bay. */
const cableBetween = (a: MachineSpec, b: MachineSpec): THREE.Curve<THREE.Vector3> => {
  const pa = portOf(a);
  const pb = bayOf(b);
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len = Math.hypot(dx, dz);
  const ux = dx / len;
  const uz = dz / len;
  return curveThrough(
    [pa, [a.x + ux * 0.9, 0.05, a.z + uz * 0.9], [b.x - ux * 1.1, 0.05, b.z - uz * 1.1], [b.x - ux * 0.55, pb[1] * 0.6, b.z - uz * 0.55], pb],
    0.35,
  );
};

const CABLES = FLOOR.filter((m) => m.parent !== null).map((m) => ({child: m, parent: FLOOR[m.parent!], curve: cableBetween(FLOOR[m.parent!], m)}));
const FIRST_CABLE = CABLES.find((c) => c.child.id === FIRST.id)!;

const ORIGIN_BAY = bayOf(ORIGIN);
const ORIGIN_PORT = portOf(ORIGIN);
const FIRST_BAY = bayOf(FIRST);

const CAM0: Rig = {position: [1.7, 1.75, 3.1], target: [0, 1.45, 0], fov: 34};
const RIG_TRACK = [
  {beat: 'rp-divide', to: {position: [1.3, 1.9, 2.6] as Vec3, target: [0, 1.7, 0] as Vec3}, from: 0.2, until: 2.3},
  {beat: 'rp-travel', to: {position: [FIRST.x + 1.6, 1.5, FIRST.z + 2.8] as Vec3, target: [FIRST_BAY[0], FIRST_BAY[1] + 0.1, FIRST_BAY[2]] as Vec3}},
  {beat: 'rp-multiply', to: {position: [3.5, 5.0, 9.5] as Vec3, target: [2.4, 0.4, -3.0] as Vec3, fov: 36}, from: 0.2},
  {beat: 'rp-scale', to: {position: [1.5, 12.5, 15.5] as Vec3, target: [0, 0, -6.5] as Vec3, fov: 42}, from: 0, until: 3.0},
];
/** Spread-seconds: 0 until multiply starts, 1 by its end, then on to the whole floor. */
const SPREAD_TRACK = [
  {beat: 'rp-multiply', to: 1.0, easing: ease.linear},
  {beat: 'rp-scale', to: 5.2, easing: ease.linear},
];

export const ReplicationScene: React.FC = () => {
  const th = useTheme();
  const time = useActiveTime();
  const b = useBeats(['rp-divide', 'rp-travel', 'rp-multiply', 'rp-scale']);
  const track = useCameraRig(CAM0, RIG_TRACK);
  const spread = useScalarTrack(0, SPREAD_TRACK);

  // ---- beat 1: division ------------------------------------------------------
  const squeeze = b['rp-divide'].at(0.1, 0.9, ease.inOut); // anticipation: the core brightens and tightens
  const split = b['rp-divide'].at(0.8, 1.6, ease.back); // the copy peels off sideways
  const climb = b['rp-divide'].at(1.5, 2.4, ease.inOut); // and climbs to the uplink port
  const copyPos: Vec3 = [
    lerp(lerp(ORIGIN_BAY[0], ORIGIN_BAY[0] + 0.55, split), ORIGIN_PORT[0], climb),
    lerp(ORIGIN_BAY[1], ORIGIN_PORT[1] + 0.12, climb),
    lerp(lerp(ORIGIN_BAY[2], ORIGIN_BAY[2] + 0.35, split), ORIGIN_PORT[2], climb),
  ];

  // ---- beat 2: the followed journey ------------------------------------------
  const travel = b['rp-travel'].at(0.1, 2.3, ease.inOut);
  const land = b['rp-travel'].at(2.1, 2.9, ease.out);
  const sparkPos = useMemo(() => new THREE.Vector3(), []);
  if (travel > 0 && travel < 1) FIRST_CABLE.curve.getPointAt(travel, sparkPos);
  const follow = smooth(seg(travel, 0, 0.2)) * (1 - smooth(seg(travel, 0.72, 1)));
  const rig: Rig = {
    position: [lerp(track.position[0], sparkPos.x + 2.0, follow), lerp(track.position[1], sparkPos.y + 1.5, follow), lerp(track.position[2], sparkPos.z + 3.4, follow)],
    target: [lerp(track.target[0], sparkPos.x, follow), lerp(track.target[1], sparkPos.y + 0.2, follow), lerp(track.target[2], sparkPos.z, follow)],
    fov: track.fov,
  };

  // ---- beats 3-4: the floor changes hands ------------------------------------
  const state = (m: MachineSpec) => {
    if (m.id === ORIGIN.id) return {agent: 1, energy: 1 + 0.6 * Math.sin(Math.PI * squeeze) + 0.5 * Math.sin(Math.PI * seg(spread, 0, 0.3)), threat: 0, sparkT: 0, lit: 1};
    if (m.id === FIRST.id) return {agent: land, energy: 1 + 0.5 * Math.sin(Math.PI * seg(spread, 0.1, 0.4)), threat: 0, sparkT: travel, lit: travel};
    const sparkT = seg(spread, m.arrival - 0.85, m.arrival);
    const agent = seg(spread, m.arrival - 0.05, m.arrival + 0.45);
    const threat = m.depth >= 4 ? 0.85 * seg(spread, m.arrival + 0.4, m.arrival + 1.3) : 0;
    return {agent, energy: 1 + 0.6 * Math.sin(Math.PI * seg(spread, m.arrival, m.arrival + 0.4)), threat, sparkT, lit: sparkT};
  };
  const states = FLOOR.map(state);
  const bracket = b['rp-scale'].at(2.2, 3.0, ease.out);
  const originScreen = projectPoint(rig, [ORIGIN.x, 1.1, ORIGIN.z]);
  const reached = states.filter((s) => s.agent > 0.5).length;

  return (
    <AbsoluteFill>
      <Stage3D rig={rig} bloom={th.bloom} fog={th.fog.density} fogColor={th.fog.color} background={th.color.void}>
        <SkyDome haze={th.color.haze} intensity={0.9} />
        <StageLights rim={th.tone.system.base} intensity={1.7} />
        <MirrorFloor opacity={1 - th.reflect * 0.25} color={th.color.void} grid={2} gridColor={th.color.steel} gridOpacity={0.35} gridExtent={60} />
        <Reflect enabled={th.reflect > 0.5}>
          {FLOOR.map((m, i) => (
            <Machine3D
              key={m.id}
              kind={m.kind}
              position={[m.x, 0, m.z]}
              yaw={m.yaw}
              bay={m.bay}
              power={0.55 + 0.45 * states[i].lit}
              agent={states[i].agent}
              agentEnergy={states[i].energy}
              threat={states[i].threat}
              time={time}
              seed={i}
              lite={m.depth >= 3}
            />
          ))}
        </Reflect>
        {/* The copy, while it is between the origin's bay and the uplink port. */}
        {split > 0 && travel <= 0 ? <AgentCore3D position={copyPos} scale={lerp(0.1, 0.3, clamp01(split))} open={clamp01(split * 1.4)} energy={1.3} spin={time + 4} seed={4} /> : null}
        {/* Cables: dim conduit always, lit behind each spark, with the spark itself as a hot segment. */}
        {CABLES.map((c, i) => {
          const s = states[c.child.id];
          return (
            <group key={i}>
              <GlowTube curve={c.curve} radius={0.035} color={th.color.steel} intensity={0.6} segments={40} radial={5} />
              {s.lit > 0 ? <GlowTube curve={c.curve} radius={0.028} color={th.tone.mind.base} intensity={1.5 * th.glow} to={clamp01(s.lit)} segments={40} radial={5} /> : null}
              {s.sparkT > 0 && s.sparkT < 1 ? <GlowTube curve={c.curve} radius={0.045} color={th.tone.mind.hot} intensity={3.4} from={Math.max(0, s.sparkT - 0.12)} to={s.sparkT} segments={40} radial={6} /> : null}
            </group>
          );
        })}
        {/* Division flash at the origin when the copy peels off. */}
        {split > 0 && split < 1 ? (
          <mesh position={ORIGIN_BAY as [number, number, number]}>
            <sphereGeometry args={[0.2 + 0.5 * split, 12, 12]} />
            <meshBasicMaterial color={hdr(th.tone.mind.hot, 2.5 * (1 - split))} transparent opacity={0.5 * (1 - split)} depthWrite={false} />
          </mesh>
        ) : null}
      </Stage3D>

      {/* 2D overlay: bracket the origin in the wide shot, and a small count. */}
      {bracket > 0.001 && originScreen.visible ? (
        <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
          {(() => {
            const r = 40 + (1 - bracket) * 30;
            const arm = 16;
            const x = originScreen.x;
            const y = originScreen.y;
            const col = th.tone.mind.hot;
            const d = `M${x - r} ${y - r + arm}V${y - r}H${x - r + arm}M${x + r - arm} ${y - r}H${x + r}V${y - r + arm}M${x + r} ${y + r - arm}V${y + r}H${x + r - arm}M${x - r + arm} ${y + r}H${x - r}V${y + r - arm}`;
            return (
              <g opacity={bracket}>
                <path d={d} stroke={col} strokeWidth={2.5} fill="none" />
                <text x={x + r + 14} y={y + 8} fontFamily={th.font} fontSize={26} fill={alpha(col, 0.9)}>
                  {reached}
                </text>
              </g>
            );
          })()}
        </svg>
      ) : null}
    </AbsoluteFill>
  );
};
