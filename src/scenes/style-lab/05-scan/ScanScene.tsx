import React from 'react';
import {AbsoluteFill} from 'remotion';
import * as THREE from 'three';
import {
  AgentCore3D,
  Comet3D,
  curveThrough,
  GlowTube,
  getHaloTexture,
  hdr,
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
import {ScanField} from '../../../components/cyber/three/ScanField';
import {useActiveTime, useBeats} from '../../../engine';
import {cyber, mix, motion} from '../../../styles/cyber';
import {Board} from './Board';
import {AGENT, AGENT_SCALE, BOARD, FIELD, HOST_INDEX, HOST_TIP_Y, MODULES, OBSTACLES, REGION, SCANNED, SEGMENTS, tickAnchor} from './layout';
import {softVisibility, type Box3} from './occlusion';

/**
 * Sample 05: scanning and detection. "Not detected" does not mean "not there".
 *
 * 3D: a board of dark modules hovering over the mirror floor. A scan sheet
 * sweeps the marked region; what it passes is traced in blue and ticked.
 * 2D: the ticks and the region's corner brackets are hairlines pinned to the
 * 3D picture with projectPoint().
 *
 * The twist uses the floor. Everything in the glass is a reflection of
 * something above it, except one thing: a red agent hanging under a verified
 * module, below the plane the scan ever touched. It is there from frame 0;
 * the first three beats simply never look down.
 */

const BEATS = ['scan-arm', 'scan-sweep', 'scan-clear', 'scan-reveal', 'scan-miss'] as const;

/** The sweep runs over this part of the `scan-sweep` beat, at constant speed. */
const SWEEP_FROM = 0.06;
const SWEEP_TO = 1.98;
const SWEEP_SECONDS = SWEEP_TO - SWEEP_FROM;

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/** Constant velocity with a short ease at each end (a machine starting and stopping). */
const cruise = (t: number, ease = 0.08): number => {
  const v = 1 / (1 - ease);
  if (t < ease) return (v * t * t) / (2 * ease);
  if (t > 1 - ease) return 1 - (v * (1 - t) * (1 - t)) / (2 * ease);
  return v * (t - ease / 2);
};

/* ------------------------------------------------------------------ camera */

// Three-quarter view, slightly above: the board fills the frame and the floor in front of it is cut off low.
const RIG_START: Rig = {position: [3.3, 4.0, 10.4], target: [-0.2, 1.45, 0], fov: cyber.camera.fov};

const useRig = () =>
  useCameraRig(RIG_START, [
    // A slow drift with the sweep.
    {beat: 'scan-sweep', to: {position: [3.72, 3.96, 10.22], target: [-0.08, 1.45, 0]}, easing: motion.glide},
    // Down and back: the floor fills the lower half of the frame.
    {beat: 'scan-reveal', to: {position: [3.4, 1.6, 13.4], target: [0.55, -0.88, 0.7]}},
    // Lean in on the one module.
    {beat: 'scan-miss', to: {position: [3.3, 1.5, 12.8], target: [0.58, -0.93, 0.78]}},
  ]);

/* ------------------------------------------------------------------ colours */

type RGB = readonly [number, number, number];
const rgb = (c: THREE.Color): RGB => [c.r, c.g, c.b];
const lerp3 = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

const PAINT = {
  edge: {idle: rgb(hdr(cyber.color.steel, 0.85)), steady: rgb(hdr(cyber.color.blue, 1.25)), hot: rgb(hdr(cyber.color.blueHot, 3.2))},
  trace: {idle: rgb(hdr(cyber.color.steel, 0.45)), steady: rgb(hdr(cyber.color.blue, 0.5)), hot: rgb(hdr(cyber.color.blueHot, 1.1))},
  rim: rgb(hdr(cyber.color.steel, 0.75)),
} as const;

/* ------------------------------------------------------------------ state */

const useScanState = () => {
  const b = useBeats(BEATS);
  const spin = useActiveTime();
  const arm = b['scan-arm'];
  const sweep = b['scan-sweep'];
  const clear = b['scan-clear'];
  const reveal = b['scan-reveal'];
  const miss = b['scan-miss'];

  // Beat 1: the region is marked, then the sheet stands up on its near edge.
  const brackets = [0, 1, 2, 3].map((i) => arm.at(0.04 + (i === 1 || i === 2 ? 0.1 : 0), 0.4 + (i === 1 || i === 2 ? 0.1 : 0), motion.ignite));
  const outline = arm.at(0.18, 0.8, motion.glide);
  const sheetAppear = arm.at(0.5, 1.14);

  // Beat 2: the sweep. Everything it lights is a function of how far behind the sheet it is.
  const progress = cruise(sweep.at(SWEEP_FROM, SWEEP_TO));
  // By the end of the beat every flash has died down, whatever its age.
  const settle = sweep.at(1.85, 2.34, motion.glide);

  // Beat 3: the sheet retires, the marks lock: all clear.
  const retire = clear.at(0, 0.6);
  const lock = clear.at(0.25, 0.65, motion.ignite);
  const allClear = Math.sin(Math.PI * clear.at(0.3, 0.95));

  // Beat 4: the glass clears as the camera goes down.
  const look = reveal.at(0.3, 2.2, motion.glide);
  const glass = 0.86 - 0.46 * look;

  // Beat 5: the thing under the verified module pulses once.
  const pulse = Math.sin(Math.PI * miss.at(0.1, 0.95));
  const risen = miss.at(0.1, 0.95, motion.glide);
  const focus = miss.at(0.1, 0.75, motion.glide);

  // Per-hairline colour.
  const colors = new Float32Array(SEGMENTS.length * 3);
  SEGMENTS.forEach((s, i) => {
    let c: RGB;
    if (s.kind === 'rim') {
      c = PAINT.rim;
    } else {
      const paint = PAINT[s.kind];
      const since = s.along >= 0 && progress > 0 ? (progress - s.along) * SWEEP_SECONDS : -1;
      if (since <= 0) {
        c = paint.idle;
      } else {
        const lit = clamp01(since / 0.05);
        const flash = Math.exp(-since / 0.2) * (1 - settle);
        const steady: RGB = [paint.steady[0] * (1 + 0.5 * allClear), paint.steady[1] * (1 + 0.5 * allClear), paint.steady[2] * (1 + 0.5 * allClear)];
        c = lerp3(lerp3(paint.idle, steady, lit), paint.hot, flash);
      }
    }
    colors[i * 3] = c[0];
    colors[i * 3 + 1] = c[1];
    colors[i * 3 + 2] = c[2];
  });

  // The verified marks: one per module the sheet has left behind.
  const ticks = MODULES.map((_, i) => {
    const scan = SCANNED[i];
    if (!scan.inside || progress <= 0) return {draw: 0, fresh: 0};
    const since = (progress - scan.leave) * SWEEP_SECONDS - 0.03;
    if (since <= 0) return {draw: 0, fresh: 0};
    return {draw: Math.max(clamp01(since / 0.16), settle), fresh: Math.exp(-since / 0.3) * (1 - settle)};
  });

  return {
    brackets,
    outline,
    sheetAppear,
    progress,
    retire,
    lock,
    allClear,
    glass,
    look,
    focus,
    colors,
    ticks,
    spin,
    agentEnergy: 0.8 + 0.15 * look + 0.6 * pulse + 0.15 * risen,
    tether: 2.3 + 0.9 * miss.at(0.08, 0.6, motion.ignite),
    // The pulse travels up the tether into the module once the core has flared.
    tetherSignal: miss.at(0.3, 0.9, motion.signal) * 1.32,
    redLight: reveal.at(0.8, 2.25, motion.glide) * (1 + 0.9 * pulse + 0.3 * risen),
  };
};

type State = ReturnType<typeof useScanState>;

/* ------------------------------------------------------------------ 3D */

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);

/** The region's border, drawn on the plate from the four corners towards the middle of each side. */
const RegionOutline: React.FC<{readonly draw: number; readonly lock: number}> = ({draw, lock}) => {
  if (draw <= 0.001) return null;
  const y = BOARD.top + 0.007;
  const w = 0.012;
  const color = hdr(cyber.color.blueHot, 1.05).lerp(hdr(cyber.color.blue, 1.5), lock);
  const lx = REGION.x1 - REGION.x0;
  const lz = REGION.z1 - REGION.z0;
  const halves: {pos: [number, number, number]; scale: [number, number, number]}[] = [];
  for (const z of [REGION.z0, REGION.z1]) {
    for (const [x, dir] of [
      [REGION.x0, 1],
      [REGION.x1, -1],
    ] as const) {
      const len = (lx / 2) * draw;
      halves.push({pos: [x + (dir * len) / 2, y, z], scale: [len, w, w]});
    }
  }
  for (const x of [REGION.x0, REGION.x1]) {
    for (const [z, dir] of [
      [REGION.z0, 1],
      [REGION.z1, -1],
    ] as const) {
      const len = (lz / 2) * draw;
      halves.push({pos: [x, y, z + (dir * len) / 2], scale: [w, w, len]});
    }
  }
  return (
    <group>
      {halves.map((h, i) => (
        <mesh key={i} geometry={UNIT_BOX} position={h.pos} scale={h.scale}>
          <meshBasicMaterial color={color} />
        </mesh>
      ))}
    </group>
  );
};

const TETHER = curveThrough([
  [AGENT[0], AGENT[1] + 0.05, AGENT[2]],
  [AGENT[0], HOST_TIP_Y + 0.03, AGENT[2]],
]);

/**
 * The hidden thing. It is deliberately NOT inside <Reflect>: it has no
 * counterpart above the floor. It hangs below y = 0, so it is only ever seen
 * through the glass, and the glass dims it.
 */
const Hidden: React.FC<{readonly s: State}> = ({s}) => (
  <>
    {/* Group render order -3: drawn before the floor (-1), like the reflections, so the glass dims all of it. */}
    <group renderOrder={-3}>
      <AgentCore3D position={AGENT} scale={AGENT_SCALE} threat={1} energy={s.agentEnergy} spin={s.spin} />
      <GlowTube curve={TETHER} radius={0.0085} color={cyber.color.red} intensity={s.tether} segments={24} />
      <Comet3D curve={TETHER} t={s.tetherSignal} color={cyber.color.red} radius={0.016} tail={0.3} intensity={3.4} />
      {/* Its light on the undersides around it: the reflections nearby pick up red. */}
      <pointLight position={[AGENT[0] + 0.25, AGENT[1] + 0.35, AGENT[2] + 0.75]} color={cyber.color.red} intensity={42 * s.redLight} distance={4.6} decay={1.6} />
    </group>
    {/* The only part above the glass: its light bleeding through. */}
    {s.redLight > 0.001 ? (
      <sprite position={AGENT as [number, number, number]} scale={[4.3, 4.3, 1]} renderOrder={2}>
        <spriteMaterial map={getHaloTexture()} color={hdr(cyber.color.red, 0.11 * s.redLight)} transparent depthWrite={false} blending={THREE.AdditiveBlending} fog={false} />
      </sprite>
    ) : null}
  </>
);

const World: React.FC<{readonly s: State}> = ({s}) => (
  <>
    <SkyDome intensity={0.95} />
    <StageLights intensity={0.62} />
    <MirrorFloor opacity={s.glass} />

    <Reflect>
      <Board colors={s.colors} />
    </Reflect>
    <RegionOutline draw={s.outline} lock={s.lock} />

    <ScanField field={FIELD} progress={s.progress} appear={s.sheetAppear} retire={s.retire} obstacles={OBSTACLES} />
    {/* The sheet's reflection: additive light after the floor, at the level the floor would have left it. */}
    <group scale={[1, -1, 1]}>
      <ScanField field={FIELD} progress={s.progress} appear={s.sheetAppear} retire={s.retire} obstacles={OBSTACLES} gain={1 - s.glass} />
    </group>

    <Hidden s={s} />
  </>
);

/* ------------------------------------------------------------------ 2D overlay */

const BOXES: readonly Box3[] = MODULES.map((m) => ({
  min: [m.x - m.w / 2, BOARD.top, m.z - m.d / 2],
  max: [m.x + m.w / 2, BOARD.top + m.h, m.z + m.d / 2],
}));

const CORNERS: readonly (readonly [x: number, z: number, sx: number, sz: number])[] = [
  [REGION.x0, REGION.z0, -1, -1],
  [REGION.x1, REGION.z0, 1, -1],
  [REGION.x1, REGION.z1, 1, 1],
  [REGION.x0, REGION.z1, -1, 1],
];

const f = (n: number) => n.toFixed(2);

/** A check mark of size `size` px centred on (x, y), drawn on from its short stroke. */
const checkPath = (x: number, y: number, size: number, draw: number): string => {
  const p0 = [x - 0.52 * size, y - 0.04 * size];
  const p1 = [x - 0.15 * size, y + 0.34 * size];
  const p2 = [x + 0.56 * size, y - 0.44 * size];
  const l1 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
  const l2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
  const d = clamp01(draw) * (l1 + l2);
  if (d <= l1) {
    const k = d / l1;
    return `M${f(p0[0])} ${f(p0[1])}L${f(p0[0] + (p1[0] - p0[0]) * k)} ${f(p0[1] + (p1[1] - p0[1]) * k)}`;
  }
  const k = (d - l1) / l2;
  return `M${f(p0[0])} ${f(p0[1])}L${f(p1[0])} ${f(p1[1])}L${f(p1[0] + (p2[0] - p1[0]) * k)} ${f(p1[1] + (p2[1] - p1[1]) * k)}`;
};

/** Hairline instrument marks pinned to the 3D picture: region brackets and "verified" ticks. */
const Marks: React.FC<{readonly rig: Rig; readonly s: State}> = ({rig, s}) => {
  const eye = rig.position;

  // Corner brackets: three short legs standing just off each corner of the region.
  const off = 0.16 - 0.09 * s.lock;
  const leg = 0.46;
  const post = 0.3;
  const y = BOARD.top + 0.012;
  const bracketColor = mix(cyber.color.blueHot, cyber.color.blue, s.lock * 0.75);
  const brackets = CORNERS.map(([cx, cz, sx, sz], i) => {
    const k = s.brackets[i];
    if (k <= 0.001) return null;
    const corner: Vec3 = [cx + sx * off, y, cz + sz * off];
    const visible = softVisibility(eye, corner, BOXES);
    if (visible <= 0.001) return null;
    const a = projectPoint(rig, corner);
    const ex = projectPoint(rig, [corner[0] - sx * leg * k, y, corner[2]]);
    const ez = projectPoint(rig, [corner[0], y, corner[2] - sz * leg * k]);
    const ey = projectPoint(rig, [corner[0], y + post * k, corner[2]]);
    const d = `M${f(ex.x)} ${f(ex.y)}L${f(a.x)} ${f(a.y)}L${f(ez.x)} ${f(ez.y)}M${f(a.x)} ${f(a.y)}L${f(ey.x)} ${f(ey.y)}`;
    return <path key={i} d={d} stroke={bracketColor} strokeWidth={cyber.line.thin} opacity={(0.55 + 0.4 * k + 0.25 * s.allClear) * visible} />;
  });

  const ticks = MODULES.map((m, i) => {
    const t = s.ticks[i];
    if (t.draw <= 0.001) return null;
    const anchor = tickAnchor(m);
    const visible = softVisibility(eye, anchor, BOXES);
    if (visible <= 0.001) return null;
    const p = projectPoint(rig, anchor);
    const host = i === HOST_INDEX;
    const size = Math.min(26, Math.max(14, p.scale * 0.125)) * (1 + 0.12 * s.allClear + 0.25 * t.fresh);
    const d = checkPath(p.x, p.y, size, t.draw);
    const color = mix(cyber.color.blueHot, cyber.color.white, Math.max(t.fresh, 0.35 * s.allClear));
    // In the last beat the other marks step back; the host's stays exactly as it was.
    const level = (0.9 + 0.1 * Math.max(t.fresh, s.allClear)) * visible * (host ? 1 : 1 - 0.45 * s.focus);
    return (
      <g key={m.id} opacity={level}>
        <path d={d} stroke={cyber.color.blue} strokeWidth={cyber.line.thin + 5} opacity={0.28 + 0.3 * t.fresh} />
        <path d={d} stroke={color} strokeWidth={cyber.line.thin + 0.5} />
      </g>
    );
  });

  return (
    <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {brackets}
        {ticks}
      </g>
    </svg>
  );
};

export const ScanScene: React.FC = () => {
  const rig = useRig();
  const s = useScanState();
  return (
    <AbsoluteFill>
      <Stage3D rig={rig}>
        <World s={s} />
      </Stage3D>
      <Marks rig={rig} s={s} />
    </AbsoluteFill>
  );
};
