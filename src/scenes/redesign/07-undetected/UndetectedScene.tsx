import React from 'react';
import {AbsoluteFill} from 'remotion';
import * as THREE from 'three';
import {MirrorFloor, Reflect, SkyDome, StageLights} from '../../../components/cyber/three/Environment';
import {getHaloTexture, hdr, structureProps} from '../../../components/cyber/three/materials';
import {projectPoint, useCameraRig, type Rig, type Vec3} from '../../../components/cyber/three/rig';
import {ScanField, scanSince} from '../../../components/cyber/three/ScanField';
import {GlowTube, curveThrough} from '../../../components/cyber/three/Signal3D';
import {Stage3D} from '../../../components/cyber/three/Stage3D';
import {Machine3D} from '../../../components/story/three/Machines3D';
import {bump, clamp01, ease, lerp, seg, smooth} from '../../../components/story/math';
import {useActiveTime, useBeats} from '../../../engine';
import {alpha} from '../../../styles/cyber';
import {useTheme} from '../../../styles/ThemeContext';
import {AGENT, CAMPUS, HALLS, HEIGHT, SCAN, SCAN_OBSTACLES, ZONE_MACHINES, hallCorners, type HallSpec, type MachineSpec} from './layout';

/**
 * S07 · The undetected agent (3D).
 *
 * Cast:
 *   - the zone          a rectangle drawn on the floor with four corner posts:
 *                       the part of the data centre the scan is responsible for.
 *                       Its line is faint until the scan has cleared it, then
 *                       it holds a confident green: "this hall is clean".
 *   - the racks         eight recognisable machines inside the zone (racks,
 *                       towers, a GPU box). Their LEDs blink idly; nothing is
 *                       wrong with any of them.
 *   - the scan          a translucent vertical sheet with a hot leading edge
 *                       that sweeps the zone from left to right, climbing over
 *                       each machine it crosses.
 *   - the checks        a flat green tick that pops up above each machine the
 *                       moment the sheet passes it: eight passes, no misses.
 *   - the campus        four more halls of the same machines beyond the first,
 *                       unscanned, dim, with no green line around them.
 *   - the agent         the gimbal iris inside one rack of a far hall, the
 *                       only purple light in the frame once the camera is high.
 *   - brackets          2D corner brackets on the scanned zone (green) and a
 *                       small one on the hidden machine (purple), with a dashed
 *                       outline of the coverage edge between them.
 *
 * Beats:
 *   ud-hall     medium 3/4 on the zone: racks idle, the zone line is drawn.
 *   ud-scan     the sheet sweeps; a tick pops over each machine; the zone
 *               line brightens to "clean"; the camera starts to lift.
 *   ud-campus   one continuous crane up and back: four more halls appear;
 *               as the camera settles, one far rack ignites purple.
 *   ud-hold     a little higher still; brackets mark the scanned zone and,
 *               far outside its dashed edge, the one machine it never saw.
 */

const ZONE = HALLS[0];
const ZONE_CORNERS = hallCorners(ZONE);
const AGENT_TOP = HEIGHT[AGENT.kind];

/** A closed rectangle as four straight tubes. */
const edgesOf = (h: HallSpec): THREE.Curve<THREE.Vector3>[] => {
  const c = hallCorners(h);
  return c.map((p, i) => curveThrough([p, c[(i + 1) % 4]]));
};
const HALL_EDGES = HALLS.map(edgesOf);

const CAM0: Rig = {position: [8.4, 3.4, 10.6], target: [-0.6, 1.0, 0], fov: 36};
const RIG_TRACK = [
  {beat: 'ud-hall', to: {position: [7.6, 3.2, 9.6] as Vec3, target: [-1.2, 1.0, 0] as Vec3}, from: 0, until: 2.2},
  // Pan with the sheet as it crosses the zone.
  {beat: 'ud-scan', to: {target: [1.2, 1.0, 0] as Vec3, position: [8.6, 3.4, 9.8] as Vec3}, from: 0.2, until: 2.5, easing: ease.inOut},
];
/**
 * The crane is one continuous move: it begins while the scan is still
 * retiring, carries through the whole of ud-campus and settles a little
 * higher during the first second of ud-hold. One curve, so there is no hitch
 * at the beat boundaries.
 */
const CRANE_LEAD = 0.5; // seconds before the end of ud-scan at which the lift begins
const CRANE_SETTLE = 1.1; // seconds into ud-hold at which it is finally still
const HIGH: Rig = {position: [2.4, 21.5, 18.5], target: [0, 0, -8.4], fov: 40};

/** Seconds the sheet takes to cross the zone (progress 0 -> 1). */
const SWEEP_SECONDS = 2.3;

/** A flat tick made of two thin bars, hovering and facing the camera. */
const Check3D: React.FC<{readonly position: Vec3; readonly appear: number; readonly color: string; readonly intensity: number; readonly yaw: number}> = ({position, appear, color, intensity, yaw}) => {
  if (appear <= 0.001) return null;
  const s = ease.overshoot(clamp01(appear));
  const mat = hdr(color, intensity);
  return (
    <group position={position as [number, number, number]} rotation={[0, yaw, 0]} scale={0.9 * s}>
      <mesh position={[-0.14, 0.0, 0]} rotation={[0, 0, -0.9]}>
        <boxGeometry args={[0.3, 0.075, 0.05]} />
        <meshBasicMaterial color={mat} />
      </mesh>
      <mesh position={[0.13, 0.11, 0]} rotation={[0, 0, 0.85]}>
        <boxGeometry args={[0.56, 0.075, 0.05]} />
        <meshBasicMaterial color={mat} />
      </mesh>
    </group>
  );
};

/** A short post on a zone corner with a small lit cap. */
const CornerPost: React.FC<{readonly position: Vec3; readonly cap: THREE.Color; readonly color: string}> = ({position, cap, color}) => (
  <group position={position as [number, number, number]}>
    <mesh position={[0, 0.3, 0]}>
      <boxGeometry args={[0.1, 0.6, 0.1]} />
      <meshStandardMaterial {...structureProps} color={color} />
    </mesh>
    <mesh position={[0, 0.62, 0]}>
      <boxGeometry args={[0.12, 0.04, 0.12]} />
      <meshBasicMaterial color={cap} />
    </mesh>
  </group>
);

export const UndetectedScene: React.FC = () => {
  const th = useTheme();
  const time = useActiveTime();
  const b = useBeats(['ud-hall', 'ud-scan', 'ud-campus', 'ud-hold']);
  const track = useCameraRig(CAM0, RIG_TRACK);
  const craneSeconds = CRANE_LEAD + b['ud-campus'].duration + CRANE_SETTLE;
  const craneTime = seg(b['ud-scan'].time, b['ud-scan'].duration - CRANE_LEAD, b['ud-scan'].duration) * CRANE_LEAD + b['ud-campus'].time + Math.min(b['ud-hold'].time, CRANE_SETTLE);
  const crane = ease.camera(clamp01(craneTime / craneSeconds));
  const rig: Rig = {
    position: [lerp(track.position[0], HIGH.position[0], crane), lerp(track.position[1], HIGH.position[1], crane), lerp(track.position[2], HIGH.position[2], crane)],
    target: [lerp(track.target[0], HIGH.target[0], crane), lerp(track.target[1], HIGH.target[1], crane), lerp(track.target[2], HIGH.target[2], crane)],
    fov: lerp(track.fov, HIGH.fov, crane),
  };
  const safe = th.tone.safe;
  const mind = th.tone.mind;

  // ---- beat 1: the zone is drawn --------------------------------------------
  const drawZone = b['ud-hall'].at(0.2, 1.4, ease.out); // the line runs round the rectangle

  // ---- beat 2: the scan ------------------------------------------------------
  const appear = b['ud-scan'].at(0.0, 0.35, ease.out);
  const progress = b['ud-scan'].at(0.25, 0.25 + SWEEP_SECONDS, ease.linear);
  const retire = b['ud-scan'].at(2.6, 3.0, ease.in);
  const clean = b['ud-scan'].at(2.3, 2.9, ease.out); // the zone line settles to "clean"
  const zoneLevel = lerp(0.85, 1.35 * th.glow, clean) * (0.3 + 0.7 * drawZone);
  const sinceOf = (m: MachineSpec) => scanSince(SCAN, progress, [m.x, 0, m.z], SWEEP_SECONDS);

  // ---- beat 3: the campus, and the agent -------------------------------------
  const ignite = b['ud-campus'].at(2.0, 2.9, ease.out);
  const flare = bump(b['ud-campus'].time, 2.1, 3.0) * 0.8 + bump(b['ud-hold'].time, 0.2, 1.2) * 0.3;
  const farLit = b['ud-campus'].at(0.0, 1.6, ease.out); // the other halls' LEDs come up a little as they enter frame

  // ---- beat 4: the overlay ---------------------------------------------------
  const bracket = b['ud-campus'].at(2.4, 3.0, ease.out) * 0.4 + b['ud-hold'].at(0.0, 0.8, ease.out) * 0.6;
  const markAgent = b['ud-hold'].at(0.3, 1.0, ease.out);

  const checkYaw = (m: MachineSpec) => Math.atan2(rig.position[0] - m.x, rig.position[2] - m.z);
  const zoneScreen = ZONE_CORNERS.map((c) => projectPoint(rig, c));
  const agentScreen = projectPoint(rig, [AGENT.x, AGENT_TOP * 0.55, AGENT.z]);

  return (
    <AbsoluteFill>
      <Stage3D rig={rig} bloom={th.bloom} fog={th.fog.density} fogColor={th.fog.color} background={th.color.void}>
        <SkyDome haze={th.color.haze} intensity={0.9} />
        <StageLights rim={th.tone.system.base} intensity={1.7} />
        <MirrorFloor opacity={1 - th.reflect * 0.25} color={th.color.void} grid={2} gridColor={th.color.steel} gridOpacity={0.35} gridExtent={60} />
        <Reflect enabled={th.reflect > 0.5}>
          {CAMPUS.map((m) => {
            const isAgent = m.id === AGENT.id;
            const inZone = m.hall === 0;
            return (
              <Machine3D
                key={m.id}
                kind={m.kind}
                position={[m.x, 0, m.z]}
                yaw={m.yaw}
                bay={m.bay}
                power={inZone ? 0.75 : 0.1 + 0.3 * farLit + (isAgent ? 0.6 * ignite : 0)}
                agent={isAgent ? ignite : 0}
                agentEnergy={1 + flare}
                time={time}
                seed={m.id}
                lite={!inZone && !isAgent}
              />
            );
          })}
        </Reflect>

        {/* Zone boundaries: the scanned hall in safe tone, the others as unlit steel hairlines. */}
        {HALL_EDGES.map((edges, h) =>
          edges.map((curve, i) => (
            <GlowTube
              key={`${h}-${i}`}
              curve={curve}
              radius={h === 0 ? 0.04 : 0.025}
              color={h === 0 ? safe.base : th.color.steel}
              intensity={h === 0 ? zoneLevel : 0.5}
              to={h === 0 ? seg(drawZone, i * 0.25, i * 0.25 + 0.25) : 1}
              segments={2}
              radial={6}
            />
          )),
        )}
        {ZONE_CORNERS.map((c, i) => (
          <CornerPost key={i} position={c} cap={hdr(safe.base, zoneLevel * 0.8 * (0.4 + 0.6 * seg(drawZone, i * 0.25, i * 0.25 + 0.2)))} color={th.color.slate} />
        ))}

        {/* The scan sheet, draped over whatever it is crossing. */}
        <ScanField field={SCAN} progress={progress} appear={appear} retire={retire} color={safe.base} hot={safe.hot} gain={1.3 * th.glow} edge={3.2 * th.glow} edgeRadius={0.018} obstacles={SCAN_OBSTACLES} />

        {/* A tick over each machine the sheet has passed. */}
        {ZONE_MACHINES.map((m) => {
          const since = sinceOf(m);
          if (since <= 0) return null;
          const pop = seg(since, 0, 0.32);
          return <Check3D key={m.id} position={[m.x, HEIGHT[m.kind] + 0.55, m.z]} appear={pop} color={safe.base} intensity={(2.0 + 1.6 * (1 - smooth(seg(since, 0, 0.6)))) * th.glow} yaw={checkYaw(m)} />;
        })}

        {/* The agent's ignition: a brief purple breath on the floor around its rack, so the light reads from high up. */}
        {ignite > 0.001 ? (
          <mesh position={[AGENT.x, 0.02, AGENT.z]} rotation={[-Math.PI / 2, 0, 0]} scale={4.6 + 1.2 * flare}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial map={getHaloTexture()} color={hdr(mind.base, 2.2 * ignite)} transparent opacity={0.75 * ignite} depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>
        ) : null}
      </Stage3D>

      {/* 2D overlay: the scanned zone's extent, and the one machine outside it. */}
      {bracket > 0.001 ? (
        <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
          {(() => {
            const arm = 36;
            const cx = zoneScreen.reduce((s, p) => s + p.x, 0) / 4;
            const cy = zoneScreen.reduce((s, p) => s + p.y, 0) / 4;
            const unit = (ax: number, ay: number) => {
              const l = Math.hypot(ax, ay) || 1;
              return [ax / l, ay / l] as const;
            };
            // Each bracket sits a little outside its corner and its two arms run along the zone's projected edges.
            const corners = zoneScreen.map((p, i) => {
              const prev = zoneScreen[(i + 3) % 4];
              const next = zoneScreen[(i + 1) % 4];
              const a = unit(prev.x - p.x, prev.y - p.y);
              const c = unit(next.x - p.x, next.y - p.y);
              const out = unit(p.x - cx, p.y - cy);
              const x = p.x + out[0] * 18;
              const y = p.y + out[1] * 18;
              return `M${x + a[0] * arm} ${y + a[1] * arm}L${x} ${y}L${x + c[0] * arm} ${y + c[1] * arm}`;
            });
            const edge =
              zoneScreen
                .map((p, i) => {
                  const out = unit(p.x - cx, p.y - cy);
                  return `${i === 0 ? 'M' : 'L'}${p.x + out[0] * 9} ${p.y + out[1] * 9}`;
                })
                .join('') + 'Z';
            const ar = 26;
            const aa = 11;
            const ax = agentScreen.x;
            const ay = agentScreen.y;
            const agentPath = `M${ax - ar} ${ay - ar + aa}V${ay - ar}H${ax - ar + aa}M${ax + ar - aa} ${ay - ar}H${ax + ar}V${ay - ar + aa}M${ax + ar} ${ay + ar - aa}V${ay + ar}H${ax + ar - aa}M${ax - ar + aa} ${ay + ar}H${ax - ar}V${ay + ar - aa}`;
            return (
              <g>
                <g opacity={bracket}>
                  <path d={edge} stroke={alpha(safe.base, 0.55)} strokeWidth={th.line} strokeDasharray="10 8" fill="none" />
                  {corners.map((d, i) => (
                    <path key={i} d={d} stroke={safe.hot} strokeWidth={2.5} fill="none" strokeLinecap="square" strokeLinejoin="miter" />
                  ))}
                </g>
                {agentScreen.visible ? (
                  <g opacity={markAgent} transform={`translate(${ax} ${ay}) scale(${lerp(1.6, 1, markAgent)}) translate(${-ax} ${-ay})`}>
                    <path d={agentPath} stroke={mind.hot} strokeWidth={2.5} fill="none" />
                  </g>
                ) : null}
              </g>
            );
          })()}
        </svg>
      ) : null}
    </AbsoluteFill>
  );
};
