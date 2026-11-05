import React from 'react';
import {AbsoluteFill, Easing} from 'remotion';
import * as THREE from 'three';
import {
  Comet3D,
  GlowTube,
  hdr,
  hdrRamp,
  MirrorFloor,
  projectPoint,
  Reflect,
  SkyDome,
  Stage3D,
  StageLights,
  useCameraRig,
  type Rig,
  type Vec3,
} from '../../../components/cyber/three';
import {ComputeIsland, PerimeterRing, type RackSlot, type RingGate} from '../../../components/cyber/three/ComputeIsland';
import {useActiveTime, useBeats} from '../../../engine';
import {cyber, mix, motion} from '../../../styles/cyber';
import {A, A_FROM_PORT, B, B_FROM_DOCK, BOUNDS, BRIDGE_AB, BRIDGE_BC, C, C_FROM_DOCK, GATE_WIDTH, ISLANDS, type Bridge, type Island} from './layout';

/**
 * Sample 06: cloud compute as islands.
 *
 * Three providers = three dark plates floating over the mirror floor, told
 * apart by silhouette only. Racks are rows of thin slabs whose front seams
 * are level meters: blue = system load, purple = the agent's workload. The
 * hairline ring around an island is its boundary. A credential (a small hex
 * token) leaves A, B's ring opens a gap exactly where it arrives, lets it
 * through and closes again; then the work follows the access: A -> B -> C.
 *
 * 2D: hairline corner brackets pinned with projectPoint() to the island that
 * is currently receiving access or work.
 */

const BEATS = ['cloud-online', 'cloud-load', 'cloud-access', 'cloud-migrate'] as const;

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const bump = (t: number) => Math.sin(Math.PI * clamp01(t));

/* ------------------------------------------------------------------ timing */

/** The token leaves quickly and slows into the gate, so the pass is readable. */
const tokenEase = Easing.bezier(0.33, 0.15, 0.45, 1);
const TOKEN_T0 = 0.35;
const TOKEN_T1 = 1.95;
/** Beat time at which an eased 0..1 value reaches `u` (the easing is monotonic). */
const timeAt = (ease: (t: number) => number, u: number, t0: number, t1: number) => {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (ease(mid) < u) lo = mid;
    else hi = mid;
  }
  return t0 + ((lo + hi) / 2) * (t1 - t0);
};
/** When the token's head is in B's ring. Everything about the gate is timed off this. */
const T_GATE = timeAt(tokenEase, BRIDGE_AB.gateU, TOKEN_T0, TOKEN_T1);

const COMET_TAIL = 0.2;
/** Purple work packets: start times within `cloud-migrate`, and how long one takes to cross. */
const AB_STARTS = [0.1, 0.32, 0.54];
const AB_DUR = 0.75;
const BC_STARTS = [0.95, 1.17, 1.39];
const BC_DUR = 0.8;

/* ------------------------------------------------------------------ camera */

const RIG_START: Rig = {position: [0.9, 2.35, 14.2], target: [0.4, 1.6, -3], fov: cyber.camera.fov};

const useRig = () =>
  useCameraRig(RIG_START, [
    {beat: 'cloud-online', to: {position: [0.7, 2.25, 12.2]}},
    {beat: 'cloud-load', to: {position: [0.4, 2.2, 11.5], target: [0.3, 1.45, -3]}},
    {beat: 'cloud-access', to: {position: [1.5, 2.0, 9.4], target: [1.3, 1.35, -3.0]}},
    {beat: 'cloud-migrate', to: {position: [1.6, 2.6, 12.4], target: [0.6, 1.7, -5]}},
  ]);

/* ------------------------------------------------------------------ state */

const useCloudState = () => {
  const b = useBeats(BEATS);
  const time = useActiveTime();
  const online = b['cloud-online'];
  const load = b['cloud-load'];
  const access = b['cloud-access'];
  const migrate = b['cloud-migrate'];

  // Beat 1: out of depth, one after another; seams; rings.
  const arrive = ISLANDS.map((_, i) => online.at(i * 0.28, 1.25 + i * 0.28, motion.arrive));
  const seam = ISLANDS.map((_, i) => online.at(0.7 + i * 0.28, 1.2 + i * 0.28, motion.ignite));
  const ringDraw = ISLANDS.map((_, i) => online.at(0.9 + i * 0.2, 1.8 + i * 0.08, motion.glide));

  /** An ordered travelling wave: the "hum". Advances only while a beat plays. */
  const wave = (s: RackSlot, phase = 0) => 0.5 + 0.5 * Math.sin(Math.PI * 2 * (time * 0.5 - s.along * 0.9 - s.row * 0.27 + phase));
  const idle = 0.07;

  // Beat 3: the token.
  const tokenForm = access.at(0.08, 0.42, motion.ignite);
  const tokenU = access.at(TOKEN_T0, TOKEN_T1, tokenEase);
  const tokenSettle = access.at(TOKEN_T1 - 0.1, TOKEN_T1 + 0.35, motion.glide);
  // The tail is drawn in as the head goes through, so the ring can close behind it.
  const tokenTail = 1 - access.at(T_GATE - 0.1, T_GATE + 0.35, motion.glide);
  const gateOpen1 = access.at(T_GATE - 0.5, T_GATE - 0.15, motion.ignite) * (1 - access.at(T_GATE + 0.22, T_GATE + 0.7, motion.glide));
  // The gate stays warm after it has closed: that is where access was granted.
  const gateHeat1 = access.at(T_GATE - 0.6, T_GATE - 0.3, motion.ignite) * (1 - 0.4 * access.at(T_GATE + 0.35, T_GATE + 0.85));

  // Beat 4: the work follows.
  const gateOpen2 = migrate.at(0.05, 0.32, motion.ignite) * (1 - migrate.at(1.52, 1.84, motion.glide));
  const gateOpenC = migrate.at(1.3, 1.6, motion.ignite) * (1 - migrate.at(2.26, 2.56, motion.glide));
  const cometsAB = AB_STARTS.map((s) => migrate.at(s, s + AB_DUR * (1 + COMET_TAIL), motion.linear) * (1 + COMET_TAIL));
  const cometsBC = BC_STARTS.map((s) => migrate.at(s, s + BC_DUR * (1 + COMET_TAIL), motion.linear) * (1 + COMET_TAIL));

  // A: load climbs row by row (beat 2), a pulse gathers towards the port (beat 3), then it drains (beat 4).
  const aRacks = A.racks.map((s, i) => {
    const rise = load.at(0.08 + s.row * 0.18 + s.along * 0.3, 0.83 + s.row * 0.18 + s.along * 0.3, motion.arrive);
    const drain = migrate.at(0.15 + (1 - A_FROM_PORT[i]) * 0.65, 0.85 + (1 - A_FROM_PORT[i]) * 0.65, motion.glide);
    const gather = bump(access.at((1 - A_FROM_PORT[i]) * 0.2, 0.3 + (1 - A_FROM_PORT[i]) * 0.2));
    return {
      level: lerp(lerp(idle, 0.28 + 0.6 * wave(s), rise), idle * 0.5, drain),
      ramp: 0,
      boost: (1 + 0.7 * gather) * (1 - 0.5 * drain),
    };
  });

  // B: wakes when the token docks (beat 3), turns purple outwards from the dock (beat 4).
  const bRacks = B.racks.map((s, i) => {
    const d = B_FROM_DOCK[i];
    const wake = access.at(TOKEN_T1 - 0.1 + d * 0.15, TOKEN_T1 + 0.25 + d * 0.2, motion.ignite);
    const flash = bump(access.at(TOKEN_T1 - 0.1 + d * 0.15, TOKEN_T1 + 0.3 + d * 0.15));
    const purple = migrate.at(0.8 + d * 0.4, 1.25 + d * 0.4, motion.glide);
    return {
      level: lerp(idle + 0.17 * wake + 0.16 * flash, 0.3 + 0.52 * wave(s, 0.35), purple),
      ramp: purple,
      boost: 1 + 0.75 * flash,
    };
  });

  // C: idle until the work reaches it.
  const cRacks = C.racks.map((s, i) => {
    const d = C_FROM_DOCK[i];
    const purple = migrate.at(1.72 + d * 0.36, 2.2 + d * 0.36, motion.glide);
    return {level: lerp(idle, 0.4 + 0.5 * wave(s, 0.6), purple), ramp: purple, boost: 1 + 0.5 * bump(purple)};
  });

  return {
    b,
    arrive,
    seam,
    ringDraw,
    racks: [aRacks, bRacks, cRacks] as const,
    tokenForm,
    tokenU,
    tokenSettle,
    tokenTail,
    gateOpen1,
    gateHeat1,
    gateOpen2,
    gateOpenC,
    cometsAB,
    cometsBC,
    /** How purple the two bridges are (the first packet of each paints it). */
    paintAB: clamp01(cometsAB[0]),
    paintBC: clamp01(cometsBC[0]),
    drainA: migrate.at(0.15, 1.5),
    purpleB: migrate.at(0.8, 1.65, motion.glide),
    purpleC: migrate.at(1.72, 2.56, motion.glide),
    tokenRest: migrate.at(0.0, 0.7, motion.glide),
    bracketIn: access.at(T_GATE - 0.55, T_GATE - 0.05, motion.arrive),
    bracketMove: migrate.at(1.25, 1.9, motion.glide),
  };
};

type State = ReturnType<typeof useCloudState>;

/* ------------------------------------------------------------------ 3D pieces */

const HEX_RING = new THREE.TorusGeometry(1, 0.1, 4, 6);
const SPHERE = new THREE.SphereGeometry(1, 16, 12);
const lookM = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0);

/** The credential: a white-hot head inside a tiny hexagon, flying like a comet. */
const Token: React.FC<{
  readonly bridge: Bridge;
  readonly u: number;
  readonly form: number;
  readonly settle: number;
  readonly tail: number;
  /** 0..1: docked and quiet (the core cools, the hexagon stays). */
  readonly rest: number;
  readonly eye: Vec3;
}> = ({bridge, u, form, settle, tail, rest, eye}) => {
  if (form <= 0.001) return null;
  const p = bridge.path.getPointAt(clamp01(u));
  const q = new THREE.Quaternion().setFromRotationMatrix(lookM.lookAt(new THREE.Vector3(eye[0], eye[1], eye[2]), p, UP));
  const size = 0.11 * (0.4 + 0.6 * form) * (1 + 0.5 * bump(form));
  return (
    <group>
      <Comet3D curve={bridge.path} t={u} tail={0.012 + 0.2 * tail} color={cyber.color.blue} radius={0.017} head={0} persist />
      <group position={p} quaternion={q}>
        <mesh geometry={HEX_RING} scale={size} rotation={[0, 0, Math.PI / 6]}>
          <meshBasicMaterial color={hdr(cyber.color.blueHot, cyber.emissive.strong * (0.4 + 0.6 * form) * (1 - 0.3 * settle) * (1 - 0.5 * rest))} />
        </mesh>
        <mesh geometry={SPHERE} scale={0.042 * form * (1 - 0.15 * settle) * (1 - 0.45 * rest)}>
          <meshBasicMaterial color={hdr(cyber.color.white, cyber.emissive.hot * (1 - 0.7 * rest))} />
        </mesh>
      </group>
    </group>
  );
};

/** A dock: the flat hexagonal socket on a plate where a token comes to rest. Island-local. */
const Dock: React.FC<{readonly at: THREE.Vector3; readonly lit: number; readonly tone: number; readonly presence: number}> = ({at, lit, tone, presence}) => (
  <mesh geometry={HEX_RING} position={[at.x, 0.012, at.z]} rotation={[Math.PI / 2, 0, 0]} scale={[0.17, 0.17, 0.05]}>
    <meshBasicMaterial color={hdr(cyber.color.steel, 0.55 * presence).lerp(hdrRamp(tone, cyber.emissive.base), lit)} />
  </mesh>
);

/** A port: the bead on a ring that a bridge leaves from. Island-local. */
const Port: React.FC<{readonly at: THREE.Vector3; readonly lit: number; readonly tone: number; readonly show: number}> = ({at, lit, tone, show}) =>
  show <= 0.001 ? null : (
    <mesh geometry={SPHERE} position={at} scale={0.034 * show * (1 + 0.5 * lit)}>
      <meshBasicMaterial color={hdrRamp(tone, cyber.emissive.base + (cyber.emissive.hot - cyber.emissive.base) * lit)} />
    </mesh>
  );

/** A bridge's line: stays where a signal has passed; blue first, repainted purple by the first work packet. */
const BridgeLine: React.FC<{readonly bridge: Bridge; readonly drawn: number; readonly paint: number; readonly level: number}> = ({bridge, drawn, paint, level}) => (
  <>
    <GlowTube curve={bridge.path} radius={0.0075} color={cyber.color.blue} intensity={level} from={paint} to={drawn} segments={160} />
    <GlowTube curve={bridge.path} radius={0.0075} color={cyber.color.purple} intensity={level * 1.25} from={0} to={Math.min(paint, drawn)} segments={160} />
  </>
);

const World: React.FC<{readonly s: State; readonly rig: Rig}> = ({s, rig}) => {
  const lit = clamp01(s.arrive[0] * 1.4);
  const gatesB: RingGate[] = [{at: BRIDGE_AB.gateAt, open: Math.max(s.gateOpen1, s.gateOpen2), width: GATE_WIDTH, heat: Math.max(s.gateHeat1, s.gateOpen2)}];
  const gatesC: RingGate[] = [{at: BRIDGE_BC.gateAt, open: s.gateOpenC, width: GATE_WIDTH, heat: s.gateOpenC}];
  const gates: readonly (readonly RingGate[])[] = [[], gatesB, gatesC];
  // Ring tone follows what the island is doing: blue, then purple once the agent's work is inside.
  const ringTone = [0, s.purpleB, s.purpleC];
  const ringLevel = [1 - 0.45 * s.drainA, 1, 1];

  return (
    <>
      <SkyDome intensity={0.5 + 0.5 * lit} />
      <StageLights intensity={0.3 + 0.7 * lit} />
      <MirrorFloor opacity={0.74} />

      <Reflect>
        {ISLANDS.map((isl: Island, i) => {
          const away = 1 - s.arrive[i];
          const racks = s.racks[i];
          return (
            <group key={isl.key} position={[0, (2.0 - isl.pos[1]) * away, -26 * away]}>
              <ComputeIsland
                plate={isl.plate}
                racks={isl.racks}
                position={isl.pos}
                yaw={isl.yaw}
                presence={clamp01(s.arrive[i] * 1.6)}
                seam={s.seam[i] * (i === 0 ? 1 - 0.55 * s.drainA : 1)}
                level={(k) => racks[k].level}
                ramp={(k) => racks[k].ramp}
                boost={(k) => racks[k].boost}
              >
                <PerimeterRing
                  curve={isl.ring}
                  draw={s.ringDraw[i]}
                  drawFrom={i === 0 ? BRIDGE_AB.portAt + 0.5 : i === 1 ? BRIDGE_AB.gateAt + 0.5 : BRIDGE_BC.gateAt + 0.5}
                  color={mix(cyber.color.blue, cyber.color.purple, ringTone[i])}
                  intensity={cyber.emissive.base * 0.8 * ringLevel[i]}
                  gates={gates[i]}
                  hot={cyber.color.white}
                  hotIntensity={2.2}
                  heatReach={0.35}
                  markSize={0.13}
                />
                {i === 0 ? <Port at={BRIDGE_AB.portLocal} show={s.ringDraw[0]} lit={Math.max(bump(s.tokenForm) * (1 - clamp01(s.tokenU * 6)), 0)} tone={s.paintAB} /> : null}
                {i === 1 ? (
                  <>
                    <Dock at={BRIDGE_AB.dockLocal} presence={s.arrive[1]} lit={Math.max(s.tokenSettle, 0)} tone={s.purpleB} />
                    <Port at={BRIDGE_BC.portLocal} show={s.ringDraw[1]} lit={0} tone={s.paintBC} />
                  </>
                ) : null}
                {i === 2 ? <Dock at={BRIDGE_BC.dockLocal} presence={s.arrive[2]} lit={s.purpleC} tone={s.purpleC} /> : null}
              </ComputeIsland>
            </group>
          );
        })}

        <BridgeLine bridge={BRIDGE_AB} drawn={s.tokenU} paint={s.paintAB} level={0.95} />
        <BridgeLine bridge={BRIDGE_BC} drawn={s.paintBC} paint={s.paintBC} level={0.95} />

        <Token bridge={BRIDGE_AB} u={s.tokenU} form={s.tokenForm} settle={s.tokenSettle} tail={s.tokenTail} rest={s.tokenRest} eye={rig.position} />

        {s.cometsAB.map((t, k) => (
          <Comet3D key={`ab${k}`} curve={BRIDGE_AB.path} t={t} tail={COMET_TAIL} color={cyber.color.purple} radius={0.019} head={2.6} />
        ))}
        {s.cometsBC.map((t, k) => (
          <Comet3D key={`bc${k}`} curve={BRIDGE_BC.path} t={t} tail={COMET_TAIL} color={cyber.color.purple} radius={0.021} head={2.3} />
        ))}
      </Reflect>
    </>
  );
};

/* ------------------------------------------------------------------ 2D overlay */

type Box = {x0: number; y0: number; x1: number; y1: number};

const screenBox = (rig: Rig, points: readonly Vec3[]): Box => {
  const box = {x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity};
  for (const p of points) {
    const q = projectPoint(rig, p);
    box.x0 = Math.min(box.x0, q.x);
    box.x1 = Math.max(box.x1, q.x);
    box.y0 = Math.min(box.y0, q.y);
    box.y1 = Math.max(box.y1, q.y);
  }
  return box;
};

/** Hairline corner brackets on the island that is receiving access or work. */
const Brackets: React.FC<{readonly rig: Rig; readonly s: State}> = ({rig, s}) => {
  if (s.bracketIn <= 0.001) return null;
  const from = screenBox(rig, BOUNDS.b);
  const to = screenBox(rig, BOUNDS.c);
  const k = s.bracketMove;
  // Standing just off what they mark; they close in as they appear.
  const pad = 14 + 46 * (1 - s.bracketIn);
  const x0 = lerp(from.x0, to.x0, k) - pad;
  const x1 = lerp(from.x1, to.x1, k) + pad;
  const y0 = lerp(from.y0, to.y0, k) - pad;
  const y1 = lerp(from.y1, to.y1, k) + pad;
  const arm = Math.max(12, Math.min(22, (x1 - x0) * 0.045));
  const f = (n: number) => n.toFixed(2);
  const corner = (x: number, y: number, dx: number, dy: number) => `M${f(x + dx * arm)} ${f(y)}L${f(x)} ${f(y)}L${f(x)} ${f(y + dy * arm)}`;
  const d = corner(x0, y0, 1, 1) + corner(x1, y0, -1, 1) + corner(x0, y1, 1, -1) + corner(x1, y1, -1, -1);
  const tone = Math.max(s.purpleB, s.purpleC * k);
  const color = mix(cyber.color.blueHot, cyber.color.purpleHot, tone);
  return (
    <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
      <path d={d} fill="none" stroke={color} strokeWidth={cyber.line.hair} opacity={0.78 * s.bracketIn} />
    </svg>
  );
};

export const CloudScene: React.FC = () => {
  const rig = useRig();
  const s = useCloudState();
  return (
    <AbsoluteFill>
      <Stage3D rig={rig}>
        <World s={s} rig={rig} />
      </Stage3D>
      <Brackets rig={rig} s={s} />
    </AbsoluteFill>
  );
};
