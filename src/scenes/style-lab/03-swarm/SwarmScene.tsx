import React, {useMemo} from 'react';
import {AbsoluteFill} from 'remotion';
import * as THREE from 'three';
import {
  AgentCore3D,
  getHaloTexture,
  GlowTube,
  hdr,
  SkyDome,
  Stage3D,
  useCameraRig,
  type Rig,
  type Vec3,
} from '../../../components/cyber/three';
import {AgentSwarm} from '../../../components/cyber/three/AgentSwarm';
import {LinkLines} from '../../../components/cyber/three/LinkLines';
import {useActiveTime, useBeats, type BeatClock} from '../../../engine';
import {cyber, motion} from '../../../styles/cyber';
import {A, FIELD, HERO_LINKS, HERO_SLOTS, HOVER, RADIUS, RIG_WIDE, type SwarmField, type SwarmLinkSet} from './field';

/**
 * Sample 03: replication.
 *
 * One agent divides (1 -> 2 -> 4), keeps dividing while the copies settle
 * into a 4 x 4 lattice, and the camera then pulls back to show that this
 * lattice is one cell of a structure made of thousands. In the last beat
 * every unit turns to look at the camera at once, a pulse runs outward from
 * the first cell, and the far rim comes back red.
 *
 * The first cell is 16 real AgentCore3D instances; everything else is two
 * AgentSwarm draw calls (full-detail units near the camera, lite ones beyond)
 * that grow, cell by cell, with the same four divisions the viewer just watched.
 */

const BEATS = ['swarm-split', 'swarm-lattice', 'swarm-reveal', 'swarm-attend'] as const;

/** Half the distance between siblings after the first two divisions (before the lattice opens up). */
const H1 = 2.0;

const RIG_START: Rig = {position: [0, 1.85, 6.8], target: [0, 1.5, 0], fov: cyber.camera.fov};

const useRig = () =>
  useCameraRig(RIG_START, [
    // Hold still for the first division, then crane up so the second one, in depth, reads as a square.
    {beat: 'swarm-split', to: {position: [0, 10.4, 6.2], target: [0, 1.0, 0]}, from: 0.5},
    {beat: 'swarm-lattice', to: {position: [0, 20.5, 11.5], target: [0, 0.9, 1.0]}},
    {beat: 'swarm-reveal', to: RIG_WIDE},
  ]);

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const smooth = (t: number) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

/* ------------------------------------------------------------------ one division */

/**
 * One fission, between `t0` and `t1` seconds of a beat:
 * the body stretches, two copies creep apart, slide, and the bridge between
 * them thins and snaps.
 */
const fission = (clock: BeatClock, t0: number, t1: number) => {
  const u = clock.at(t0, t1);
  const creep = smooth((u - 0.06) / 0.3);
  const slide = motion.glide(clamp01((u - 0.3) / 0.62));
  const sep = 0.07 * creep + 0.93 * slide;
  const s = Math.sin(Math.PI * clamp01((u - 0.02) / 0.5));
  return {
    started: u > 0,
    /** 0 -> 1: how far apart the two copies are. */
    sep,
    /** Elongation along the division axis: rises before the copies part, gone once they have. */
    stretch: s * s,
    /** 1 thick bridge -> 0 hairline. */
    thick: 1 - smooth((sep - 0.03) / 0.5),
    /** 0 -> 1: the tether has snapped and retracts into both siblings. */
    snap: smooth((sep - 0.62) / 0.22),
    /** Brightness swell while dividing. */
    glow: Math.sin(Math.PI * smooth(u)),
  };
};

/* ------------------------------------------------------------------ reveal + pulse timing */

/** Seconds into the reveal beat at which a cell (by distance of its centre) starts to grow. */
const arrival = (cellDist: number) => 0.06 + Math.pow(cellDist / RADIUS, 0.72) * 1.5;
/** Seconds a cell takes to divide into its 16 units. */
const GROW = 0.62;
/** Seconds a link takes to draw on once its cell has locked. */
const LINK_DRAW = 0.3;

const TAU = {near: FIELD.near.cellDist.map(arrival), far: FIELD.far.cellDist.map(arrival)};
const LINK_START = FIELD.links.cellDist.map((d) => arrival(d) + GROW * 0.86);

/** Brightness of the pulse `x` world units behind its front (fast attack, long tail). */
const pulse = (x: number) => (x <= 0 ? 0 : x < 3 ? smooth(x / 3) : Math.exp(-(x - 3) / 11));

type FieldFrame = {positions: Float32Array; open: Float32Array; energy: Float32Array; ramp: Float32Array; flash: Float32Array};

const makeFieldFrame = (f: SwarmField): FieldFrame => ({
  positions: new Float32Array(f.count * 3),
  open: new Float32Array(f.count),
  energy: new Float32Array(f.count),
  ramp: new Float32Array(f.count),
  flash: new Float32Array(f.count),
});

/**
 * State of every instanced unit at one moment.
 * `rt` = seconds into the reveal, `rho` = radius of the pulse front (0 before it starts).
 * Each cell replays the divisions: all 16 units start at the cell centre and
 * part along x, z, x, z.
 */
const fillField = (f: SwarmField, tau: Float32Array, out: FieldFrame, rt: number, rho: number, base: number, dim: number): void => {
  for (let n = 0; n < f.count; n++) {
    const g = clamp01((rt - tau[n]) / GROW);
    const x1 = A * smooth(g / 0.42);
    const z2 = A * smooth((g - 0.14) / 0.42);
    const x3 = 0.5 * A * smooth((g - 0.42) / 0.44);
    const z4 = 0.5 * A * smooth((g - 0.56) / 0.44);
    out.positions[n * 3] = f.cell[n * 2] + f.signs[n * 4] * x1 + f.signs[n * 4 + 2] * x3;
    out.positions[n * 3 + 1] = HOVER;
    out.positions[n * 3 + 2] = f.cell[n * 2 + 1] + f.signs[n * 4 + 1] * z2 + f.signs[n * 4 + 3] * z4;
    out.open[n] = smooth(g / 0.5);
    const fresh = 1 - smooth((g - 0.3) / 0.7);
    const x = rho - f.dist[n];
    const red = f.rim[n] * smooth((x - 8) / 30);
    const wave = pulse(x);
    // Brighter only where it is fully red, so the transition runs purple -> magenta -> red, never via white.
    out.energy[n] = (base * dim + 0.35 * fresh + 0.6 * wave) * (1 + 0.55 * red * red);
    out.flash[n] = 1.3 * wave;
    out.ramp[n] = 1 + red;
  }
};

type LinkFrame = {to: Float32Array; level: Float32Array; ramp: Float32Array};

const fillLinks = (l: SwarmLinkSet, out: LinkFrame, rt: number, rho: number, dim: number): void => {
  for (let n = 0; n < l.count; n++) {
    out.to[n] = clamp01((rt - LINK_START[n]) / LINK_DRAW);
    const x = rho - l.dist[n];
    const red = l.rim[n] * smooth((x - 8) / 30);
    out.level[n] = (l.trunk[n] ? 0.95 : 0.7) * dim * (1 + 0.6 * red * red) + 3.2 * pulse(x);
    out.ramp[n] = 1 + red;
  }
};

/**
 * Glass reflects strongly at grazing angles and hardly at all from above (Fresnel).
 * At eye level the floor is a mirror; from the crane shots the mirrored copies
 * would sit between the rows and double them, so the floor darkens with the
 * camera's elevation.
 */
const floorOpacity = (rig: Rig): number => {
  const dy = rig.position[1] - rig.target[1];
  const dh = Math.hypot(rig.position[0] - rig.target[0], rig.position[2] - rig.target[2]);
  const elevation = (Math.atan2(dy, dh) * 180) / Math.PI;
  return 0.74 + (0.95 - 0.74) * smooth((elevation - 6) / 16);
};

/* ------------------------------------------------------------------ state */

type HeroUnit = {
  readonly key: number;
  readonly pos: Vec3;
  readonly energy: number;
  /** Share of a halo this copy carries (two coincident copies carry half each). */
  readonly halo: number;
  /** Direction to the camera, as yaw / pitch from +z. */
  readonly yaw: number;
  readonly pitch: number;
};

type TetherState = {readonly key: string; readonly a: Vec3; readonly b: Vec3; readonly thick: number; readonly snap: number};

const useSwarmState = (rig: Rig) => {
  const b = useBeats(BEATS);
  const spin = useActiveTime() * 1.35;
  const split = b['swarm-split'];
  const lattice = b['swarm-lattice'];
  const reveal = b['swarm-reveal'];
  const attend = b['swarm-attend'];

  // Scratch buffers, refilled every frame (a pure function of the frame).
  const scratch = useMemo(
    () => ({
      near: makeFieldFrame(FIELD.near),
      far: makeFieldFrame(FIELD.far),
      links: {to: new Float32Array(FIELD.links.count), level: new Float32Array(FIELD.links.count), ramp: new Float32Array(FIELD.links.count)},
      heroSegments: new Float32Array(HERO_LINKS.length * 2 * 6),
      heroTo: new Float32Array(HERO_LINKS.length * 2),
      heroLevel: new Float32Array(HERO_LINKS.length * 2),
    }),
    [],
  );

  // The four divisions: x, z (beat 1), x, z (beat 2).
  const f = [fission(split, 0.1, 1.2), fission(split, 1.05, 2.15), fission(lattice, 0, 0.95), fission(lattice, 0.7, 1.65)] as const;
  // While the third and fourth divisions happen, the earlier pairs move out to make room.
  const room3 = lattice.at(0, 1.0, motion.glide);
  const room4 = lattice.at(0.7, 1.7, motion.glide);
  const half = [H1 * f[0].sep + (A - H1) * room3, H1 * f[1].sep + (A - H1) * room4, 0.5 * A * f[2].sep, 0.5 * A * f[3].sep] as const;

  // Rings share one orientation while dividing, and again, for good, when the swarm attends.
  const attendFacing = attend.at(0.12, 0.56, motion.ignite);
  const facing = Math.max(
    0.92 * split.at(0, 0.42, motion.glide) * (1 - split.at(1.74, 2.2, motion.glide)),
    0.7 * lattice.at(0, 0.3, motion.glide) * (1 - lattice.at(1.3, 1.85, motion.glide)),
    attendFacing,
  );

  // The last beat: the whole structure takes one breath (dims) as it turns to look, then a single
  // pulse leaves the first cell and crosses everything, ordered by distance.
  const dim = 1 - 0.38 * Math.sin(Math.PI * attend.at(0, 0.5));
  const rho = (RADIUS + 70) * attend.at(0.46, 1.6);
  const lock = Math.sin(Math.PI * lattice.at(1.55, 2.2));
  // Once it is one cell among thousands, the first cell stays brighter than the rest.
  const heroBase = (1 + 0.2 * (f[0].glow + f[1].glow) + 0.15 * (f[2].glow + f[3].glow) + 0.25 * lock + 0.4 * reveal.at(0.3, 2.0)) * dim;

  const pos = (signs: readonly number[]): Vec3 => [signs[0] * half[0] + signs[2] * half[2], HOVER, signs[1] * half[1] + signs[3] * half[3]];

  const heroPos: Vec3[] = HERO_SLOTS.map((slot) => pos(slot.signs));
  const units: HeroUnit[] = [];
  HERO_SLOTS.forEach((slot, n) => {
    // Before a division starts, its two outcomes are one body: draw only one of them.
    if (slot.signs.some((sign, k) => sign > 0 && !f[k].started)) return;
    const p = heroPos[n];
    let halo = 1;
    f.forEach((fk, k) => {
      if (fk.started) halo *= 0.5 + 0.5 * smooth((2 * half[k]) / 1.4);
    });
    const x = rho - Math.hypot(slot.x, slot.z);
    const dx = rig.position[0] - p[0];
    const dy = rig.position[1] - p[1];
    const dz = rig.position[2] - p[2];
    units.push({
      key: n,
      pos: p,
      energy: heroBase + 0.6 * pulse(x),
      halo,
      yaw: Math.atan2(dx, dz),
      pitch: Math.atan2(dy, Math.hypot(dx, dz)),
    });
  });

  // Tethers: one per pair of siblings, only while that division is under way.
  const tethers: TetherState[] = [];
  f.forEach((fk, k) => {
    if (!fk.started || fk.snap >= 1) return;
    HERO_SLOTS.forEach((slot, n) => {
      if (slot.signs[k] > 0) return;
      if (slot.signs.some((sign, q) => q > k && sign > 0)) return; // later divisions have not happened yet
      const sibling = HERO_SLOTS.findIndex((other) => other.signs.every((sign, q) => (q === k ? sign > 0 : sign === slot.signs[q])));
      tethers.push({key: `${k}-${n}`, a: heroPos[n], b: heroPos[sibling], thick: fk.thick, snap: fk.snap});
    });
  });

  // The first cell's own links: each grows from both units and meets in the middle.
  const linkLevel = (1.15 + 0.9 * lock) * dim;
  HERO_LINKS.forEach((link, n) => {
    const pa = heroPos[link.a];
    const pb = heroPos[link.b];
    const mx = (pa[0] + pb[0]) / 2;
    const mz = (pa[2] + pb[2]) / 2;
    scratch.heroSegments.set([pa[0], HOVER, pa[2], mx, HOVER, mz, pb[0], HOVER, pb[2], mx, HOVER, mz], n * 12);
    const order = link.d / (A * 2.2);
    const drawn = lattice.at(1.42 + order * 0.24, 1.86 + order * 0.24, motion.glide);
    const level = linkLevel + 3.2 * pulse(rho - link.d);
    scratch.heroTo[n * 2] = drawn;
    scratch.heroTo[n * 2 + 1] = drawn;
    scratch.heroLevel[n * 2] = level;
    scratch.heroLevel[n * 2 + 1] = level;
  });

  // Everything beyond the first cell. Always evaluated (and mounted, hidden with open = 0 before
  // the reveal), so the swarm's shaders are compiled long before its first visible frame.
  fillField(FIELD.near, TAU.near, scratch.near, reveal.time, rho, 0.68, dim);
  fillField(FIELD.far, TAU.far, scratch.far, reveal.time, rho, 0.66, dim);
  fillLinks(FIELD.links, scratch.links, reveal.time, rho, dim);

  return {
    spin,
    facing,
    look: attendFacing,
    units,
    tethers,
    stretch: [0.2 * f[0].stretch + 0.12 * f[2].stretch, 0.2 * f[1].stretch + 0.12 * f[3].stretch] as const,
    brackets: lattice.at(1.72, 2.18, motion.glide),
    pool: lattice.at(1.6, 2.2, motion.arrive) * dim,
    floor: floorOpacity(rig),
    scratch,
    camera: rig.position,
  };
};

type State = ReturnType<typeof useSwarmState>;

/* ------------------------------------------------------------------ pieces */

const UNIT_X = new THREE.LineCurve3(new THREE.Vector3(-0.5, 0, 0), new THREE.Vector3(0.5, 0, 0));
const TETHER_R = 0.01;

/** The bridge between two siblings: thick at first, a hairline when stretched, then it snaps and retracts. */
const Tether: React.FC<{readonly t: TetherState}> = ({t}) => {
  const dx = t.b[0] - t.a[0];
  const dz = t.b[2] - t.a[2];
  const len = Math.hypot(dx, dz);
  if (len < 0.02) return null;
  const k = (0.0045 + 0.05 * t.thick) / TETHER_R;
  const intensity = cyber.emissive.base + (cyber.emissive.strong - cyber.emissive.base) * t.thick;
  return (
    <group position={[(t.a[0] + t.b[0]) / 2, HOVER, (t.a[2] + t.b[2]) / 2]} rotation={[0, -Math.atan2(dz, dx), 0]} scale={[len, k, k]}>
      <GlowTube curve={UNIT_X} radius={TETHER_R} color={cyber.color.purpleHot} intensity={intensity} from={0} to={0.5 * (1 - t.snap)} segments={64} />
      <GlowTube curve={UNIT_X} radius={TETHER_R} color={cyber.color.purpleHot} intensity={intensity} from={0.5 + 0.5 * t.snap} to={1} segments={64} />
    </group>
  );
};

/** Corner brackets on the floor around the first cell: the instrument mark that says "this one". */
const BRACKETS = (() => {
  const c = 1.5 * A + 1.9;
  const arm = 1.7;
  const y = 0.02;
  const out: number[] = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      out.push(sx * c, y, sz * c, sx * (c - arm), y, sz * c);
      out.push(sx * c, y, sz * c, sx * c, y, sz * (c - arm));
    }
  }
  return new Float32Array(out);
})();

/** Diameter of the pool of light under the first cell. */
const POOL = 4.4 * A;

/*
 * The glass and its mirror.
 *
 * The shared <MirrorFloor> + <Reflect> pair relies on the mirror group's renderOrder to draw the
 * mirrored copy before the glass. three.js resets that order at every nested Group, so transparent
 * pieces inside AgentCore3D (its wireframe shell) and additive sprites / lines sort after the glass
 * (renderOrder -1, no depth write) and show at full brightness, whatever the floor's opacity.
 * Here the glass sorts at GLASS: transparent pieces of the mirrored copy sort at or below 0 (before
 * it, so it dims them) and those of the real copy above it.
 */
const GLASS = 1;
const order = (mirror: boolean) => (mirror ? 0 : GLASS + 1);

const Glass: React.FC<{readonly opacity: number}> = ({opacity}) => (
  <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={GLASS}>
    <planeGeometry args={[900, 900]} />
    <meshBasicMaterial color={cyber.color.void} transparent opacity={opacity} depthWrite={false} />
  </mesh>
);

/** Renders `children(mirror)` twice: mirrored through the floor plane, then for real. Keep it pure. */
const Mirrored: React.FC<{readonly children: (mirror: boolean) => React.ReactNode}> = ({children}) => (
  <>
    <group scale={[1, -1, 1]}>{children(true)}</group>
    <group>{children(false)}</group>
  </>
);

const World: React.FC<{readonly s: State}> = ({s}) => {
  const {scratch} = s;
  return (
    <>
      <SkyDome />
      <Glass opacity={s.floor} />

      {/* A faint pool of light on the glass under the first cell. */}
      {s.pool > 0 ? (
        <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[POOL, POOL, 1]} renderOrder={GLASS + 0.5}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            map={getHaloTexture()}
            color={hdr(cyber.color.purple, 0.32 * s.pool)}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ) : null}

      <Mirrored>
        {(mirror) => (
          <>
            {s.units.map((u) => (
              <React.Fragment key={u.key}>
                {/* Whenever the rings share one plane, that plane faces the camera. */}
                <group position={u.pos as [number, number, number]} rotation={[-u.pitch * s.facing, u.yaw * s.facing, 0, 'YXZ']} scale={[1 + s.stretch[0], 1, 1 + s.stretch[1]]}>
                  <AgentCore3D open={1} energy={u.energy} spin={s.spin} facing={s.facing} halo={false} />
                </group>
                <sprite position={u.pos as [number, number, number]} scale={[3, 3, 1]} renderOrder={order(mirror)}>
                  <spriteMaterial
                    map={getHaloTexture()}
                    color={hdr(cyber.color.purple, 0.13 * u.energy * u.halo)}
                    transparent
                    depthWrite={false}
                    blending={THREE.AdditiveBlending}
                    fog={false}
                  />
                </sprite>
              </React.Fragment>
            ))}

            {s.tethers.map((t) => (
              <Tether key={t.key} t={t} />
            ))}

            <LinkLines
              count={HERO_LINKS.length * 2}
              segments={scratch.heroSegments}
              to={scratch.heroTo}
              level={scratch.heroLevel}
              hot={0.35}
              width={0.009}
              tip={2.2}
              tipLength={0.35}
              renderOrder={order(mirror)}
            />

            <AgentSwarm
              count={FIELD.near.count}
              positions={scratch.near.positions}
              open={scratch.near.open}
              energy={scratch.near.energy}
              ramp={scratch.near.ramp}
              flash={scratch.near.flash}
              facing={s.look}
              faceTarget={s.camera}
              spin={s.spin}
              detail="full"
            />
            <AgentSwarm
              count={FIELD.far.count}
              positions={scratch.far.positions}
              open={scratch.far.open}
              energy={scratch.far.energy}
              ramp={scratch.far.ramp}
              flash={scratch.far.flash}
              facing={s.look}
              faceTarget={s.camera}
              spin={s.spin}
              detail="lite"
            />
            <LinkLines
              count={FIELD.links.count}
              segments={FIELD.links.segments}
              to={scratch.links.to}
              level={scratch.links.level}
              ramp={scratch.links.ramp}
              width={0.009}
              tip={2.5}
              tipLength={1.2}
              renderOrder={order(mirror)}
            />
          </>
        )}
      </Mirrored>

      <LinkLines count={8} segments={BRACKETS} to={s.brackets} level={1.25} hot={1} width={0.012} minPixels={1.5} conserve={0.2} renderOrder={GLASS + 1} />
    </>
  );
};

export const SwarmScene: React.FC = () => {
  const rig = useRig();
  const s = useSwarmState(rig);
  return (
    <AbsoluteFill>
      <Stage3D rig={rig} fog={0.0058}>
        <World s={s} />
      </Stage3D>
    </AbsoluteFill>
  );
};
