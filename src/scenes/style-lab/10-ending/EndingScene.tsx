import React, {useMemo} from 'react';
import {AbsoluteFill} from 'remotion';
import * as THREE from 'three';
import {
  AgentCore3D,
  Comet3D,
  getHaloTexture,
  GlowTube,
  hdr,
  MirrorFloor,
  NetworkNode3D,
  Reflect,
  SkyDome,
  Stage3D,
  StageLights,
  structureProps,
  useCameraRig,
  type Rig,
} from '../../../components/cyber/three';
import {useBeats} from '../../../engine';
import {cyber, mix, motion} from '../../../styles/cyber';
import {buildFarField} from './farField';
import {AGENT, EMBER, EMBER_LOCAL, EMBER_NORMAL, EMBER_SITE, JOURNEYS, LINKS, siteIndexOf, SITES, type Site} from './lattice';
import {LightField, LightStreaks} from './LightField';

/**
 * Sample 10: the ending. A small system winds down and goes dark, one tiny
 * indicator stays on, and the camera lifts to show that the system we watched
 * was one district of an immense field that never stopped.
 *
 * Everything is a pure function of the four beat clocks; holds are frozen.
 */

const BEATS = ['end-slow', 'end-dark', 'end-ember', 'end-horizon'] as const;

const {color: C, emissive: E} = cyber;

/* ------------------------------------------------------------------ camera */

const RIG_START: Rig = {position: [-2.4, 1.7, 12.6], target: [0.3, 2.05, 0], fov: cyber.camera.fov};

const useRig = () =>
  useCameraRig(RIG_START, [
    // The camera barely breathes while the system winds down and goes dark.
    {beat: 'end-slow', to: {position: [-2.1, 1.7, 12.3]}},
    {beat: 'end-dark', to: {position: [-1.4, 1.65, 11.6], target: [0.5, 1.85, 0.2]}},
    // Drift in on the one thing that is still on, looking down: the horizon leaves the frame.
    {beat: 'end-ember', to: {position: [0.05, 2.05, 7.0], target: [1.9, 0.62, 3.5]}, easing: motion.glide},
    // Rise, tilt up and back: the horizon comes back into the frame, and it is lit.
    {beat: 'end-horizon', to: {position: [4.2, 2.7, 20.5], target: [0.8, 5.6, -20]}},
  ]);

/** Footprint of the rail on the floor: a dim blue trace through the rail's corners. */
const FOOTPRINT = (() => {
  const rail = SITES.filter((s) => s.id.startsWith('m'));
  const pts = rail.map((s) => new THREE.Vector3(s.pos[0], 0.004, s.pos[2]));
  const p = new THREE.CurvePath<THREE.Vector3>();
  for (let i = 0; i < pts.length; i++) p.add(new THREE.LineCurve3(pts[i], pts[(i + 1) % pts.length]));
  return {curve: p, far: Math.max(...rail.map((s) => s.far))};
})();

/* ------------------------------------------------------------------ state */

const hump = (x: number) => Math.sin(Math.PI * x) ** 2;

/** Seconds into `end-dark` at which a light at normalised distance `far` starts to go out: outside first. */
const offAt = (far: number) => 0.08 + (1 - far) * 1.3;

const SPIN_START = 3.4;
/** Ring speed when we arrive, in AgentCore3D spin-seconds per second. */
const SPIN_SPEED = 3.2;
const SPIN_TIME = 1.9;

const useEndingState = () => {
  const b = useBeats(BEATS);
  const slow = b['end-slow'];
  const dark = b['end-dark'];
  const ember = b['end-ember'];
  const horizon = b['end-horizon'];

  // Beat 1: wind down. Speed falls as (1 - u)^2, so the angle is its integral: no snap at either end.
  const u = slow.at(0, SPIN_TIME);
  const spin = SPIN_START + (SPIN_SPEED * SPIN_TIME * (1 - (1 - u) ** 3)) / 3;
  const calm = slow.at(0.1, 1.95, motion.glide);
  const level = 1 - 0.4 * calm;

  // The last signals finish their journeys; nothing follows them.
  const journeys = JOURNEYS.map((j) => {
    const t = j.t0 + (1 + j.tail - j.t0) * slow.at(0, j.arrive);
    const landed = (j.arrive * (1 - j.t0)) / (1 + j.tail - j.t0);
    return {t, bump: hump(slow.at(landed, Math.min(slow.duration, landed + 0.7)))};
  });
  const agentBump = JOURNEYS.reduce((sum, j, i) => sum + (j.end === 'a' ? journeys[i].bump : 0), 0);

  // Beat 2: lights out, from the outer edge inward. Links go just before the sites they join.
  const sites = SITES.map((s, i) => {
    const p = dark.at(offAt(s.far), offAt(s.far) + 0.6);
    const bump = JOURNEYS.reduce((sum, j, k) => sum + (siteIndexOf(j.end) === i ? journeys[k].bump : 0), 0);
    return level * (1 + 0.5 * bump) * (1 - p) ** 2;
  });
  const links = LINKS.map((l) => {
    if (l.spoke) return level * (1 - dark.at(1.0, 1.55)) ** 2;
    const start = Math.max(0, offAt(l.far) - 0.16);
    return level * (1 - dark.at(start, start + 0.42)) ** 2;
  });
  const footprint = level * (1 - dark.at(offAt(FOOTPRINT.far) - 0.16, offAt(FOOTPRINT.far) + 0.3)) ** 2;
  // The agent is last: it dims, then folds in on itself the way it once assembled, and is gone.
  const energy = (level + 0.16 * agentBump) * (1 - dark.at(1.1, 1.8, motion.glide));
  const open = 1 - dark.at(1.45, 2.3, motion.glide);
  const night = dark.at(0.15, 2.3, motion.glide);

  // Beat 3: the one indicator that never went out. It was always on, dim; now it is the only thing. One slow breath.
  const emberLevel = 0.3 + 0.7 * ember.at(0.2, 1.3, motion.glide) + 0.45 * hump(ember.at(0.3, 1.6));
  const emberHalo = 0.25 + 0.75 * ember.at(0.1, 1.0, motion.glide);

  // Beat 4: the rest of the world. It comes up while the horizon is still out of frame, so the tilt finds it already lit.
  const field = 0.85 * horizon.at(0, 0.45);
  const travel = horizon.at(0, horizon.duration, motion.signal);
  const dawn = horizon.at(0.1, 2.4, motion.glide);

  return {
    spin,
    journeys,
    sites,
    links,
    footprint,
    energy,
    open,
    emberLevel,
    emberHalo,
    field,
    travel,
    sky: (1 - 0.28 * calm) * (1 - 0.9 * night) + 0.62 * dawn,
    lights: 1 - 0.12 * calm - 0.32 * night,
  };
};

type State = ReturnType<typeof useEndingState>;

/* ------------------------------------------------------------------ pieces */

/** Dead structure keeps a hairline of steel; lit structure is blue. */
const seamColor = (light: number, lit = 1.2) => hdr(C.steel, 0.42).lerp(hdr(C.blue, lit), Math.min(1, light));

const DEAD_LEVEL = -0.2;

const SiteLight: React.FC<{readonly site: Site; readonly light: number}> = ({site, light}) => {
  const top = site.kind === 'pylon' ? 0.8 : site.port ? 0.62 : 0.45;
  return (
    <NetworkNode3D
      position={site.pos}
      size={site.port ? 0.07 : site.kind === 'pylon' ? 0.055 : 0.055}
      color={mix(C.steel, C.blue, Math.min(1, light * 1.5))}
      level={DEAD_LEVEL + (top - DEAD_LEVEL) * light}
      ring={site.port}
    />
  );
};

const Slab: React.FC<{readonly site: Site; readonly light: number; readonly ember?: number}> = ({site, light, ember}) => {
  const {w, h, t, yaw} = site.slab!;
  const seam = seamColor(light);
  return (
    <group position={[site.pos[0], 0, site.pos[2]]} rotation={[0, yaw, 0]}>
      <mesh position={[0, h / 2, 0]} scale={[w, h, t]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial {...structureProps} />
      </mesh>
      {[0, 1, 2].map((k) => (
        <mesh key={k} position={[-w * 0.16 + k * w * 0.055, h - 0.24 - k * 0.19, t / 2 + 0.003]} scale={[w * (0.48 - k * 0.11), 0.02, 0.004]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color={seam} />
        </mesh>
      ))}
      <mesh position={[0, h + 0.006, 0]} scale={[w, 0.012, t]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={seam} />
      </mesh>
      {ember !== undefined ? (
        <mesh position={EMBER_LOCAL as [number, number, number]} scale={[0.021, 0.021, 0.008]}>
          <sphereGeometry args={[1, 16, 12]} />
          <meshBasicMaterial color={hdr(C.red, ember)} />
        </mesh>
      ) : null}
    </group>
  );
};

const Pylon: React.FC<{readonly site: Site; readonly light: number}> = ({site, light}) => {
  const h = site.pos[1];
  return (
    <group position={[site.pos[0], 0, site.pos[2]]}>
      <mesh position={[0, h / 2, 0]} scale={[0.075, h, 0.075]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial {...structureProps} />
      </mesh>
      <mesh position={[0, h - 0.5, 0]} scale={[0.62, 0.035, 0.035]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial {...structureProps} />
      </mesh>
      <mesh position={[0, 0.02, 0]} scale={[0.34, 0.04, 0.34]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial {...structureProps} />
      </mesh>
      <mesh position={[0, h - 0.5, 0.04]} scale={[0.62, 0.012, 0.004]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={seamColor(light, 1.1)} />
      </mesh>
    </group>
  );
};

/** The agent's mount: a dark hoop on a post. When the agent is gone, the empty hoop is what is left of it. */
const Yoke: React.FC = () => (
  <group position={[AGENT[0], 0, AGENT[2]]}>
    <mesh position={[0, AGENT[1], 0]}>
      <torusGeometry args={[1.24, 0.024, 10, 120]} />
      <meshStandardMaterial {...structureProps} />
    </mesh>
    <mesh position={[0, (AGENT[1] - 1.24) / 2, 0]} scale={[0.06, AGENT[1] - 1.24, 0.06]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial {...structureProps} />
    </mesh>
    <mesh position={[0, 0.01, 0]}>
      <cylinderGeometry args={[0.2, 0.2, 0.02, 40]} />
      <meshStandardMaterial {...structureProps} color={C.abyss} />
    </mesh>
  </group>
);

/** Soft red breath around the ember and under it in the floor, plus the little light it throws on its slab. */
const EmberGlow: React.FC<{readonly level: number; readonly halo: number}> = ({level, halo}) => {
  const out = 0.05;
  const p: [number, number, number] = [EMBER[0] + EMBER_NORMAL[0] * out, EMBER[1], EMBER[2] + EMBER_NORMAL[2] * out];
  const k = level * halo;
  return (
    <>
      <sprite position={p} scale={[0.42, 0.42, 1]} renderOrder={3}>
        <spriteMaterial map={getHaloTexture()} color={hdr(C.red, 0.2 * k)} transparent depthWrite={false} blending={THREE.AdditiveBlending} fog={false} />
      </sprite>
      <sprite position={[p[0], -p[1], p[2]]} scale={[0.42, 0.42, 1]} renderOrder={3}>
        <spriteMaterial map={getHaloTexture()} color={hdr(C.red, 0.05 * k)} transparent depthWrite={false} blending={THREE.AdditiveBlending} fog={false} />
      </sprite>
      <pointLight position={[p[0] + EMBER_NORMAL[0] * 0.1, p[1], p[2] + EMBER_NORMAL[2] * 0.1]} color={C.red} intensity={0.45 * k} distance={1.25} decay={2} />
    </>
  );
};

/* ------------------------------------------------------------------ world */

const World: React.FC<{readonly s: State}> = ({s}) => {
  const far = useMemo(() => buildFarField(), []);
  return (
    <>
      <SkyDome intensity={s.sky} />
      <StageLights intensity={s.lights} />
      <MirrorFloor opacity={0.76} />

      <Reflect>
        <AgentCore3D position={AGENT} open={s.open} energy={s.energy} spin={s.spin} />
        <Yoke />

        {LINKS.map((l, i) => {
          const light = s.links[i];
          if (l.spoke) {
            return <GlowTube key={i} curve={l.curve} radius={0.007} color={C.purple} intensity={E.base * light} segments={8} />;
          }
          return (
            <GlowTube
              key={i}
              curve={l.curve}
              radius={0.0065}
              color={mix(C.steel, C.blue, Math.min(1, light * 1.4))}
              intensity={0.24 + 0.8 * light}
              segments={8}
            />
          );
        })}

        {SITES.map((site, i) => (
          <group key={site.id}>
            {site.kind === 'slab' ? <Slab site={site} light={s.sites[i]} ember={site.id === EMBER_SITE ? s.emberLevel : undefined} /> : null}
            {site.kind === 'pylon' ? <Pylon site={site} light={s.sites[i]} /> : null}
            {site.kind === 'slab' ? null : <SiteLight site={site} light={s.sites[i]} />}
          </group>
        ))}

        {JOURNEYS.map((j, i) => (
          <Comet3D key={i} curve={j.curve} t={s.journeys[i].t} tail={j.tail} color={j.mind ? C.purple : C.blue} radius={0.016} />
        ))}
      </Reflect>

      {/* On the floor, not reflected. */}
      <GlowTube curve={FOOTPRINT.curve} radius={0.006} color={mix(C.steel, C.blue, Math.min(1, s.footprint * 1.4))} intensity={0.12 + 0.45 * s.footprint} segments={8} />

      <EmberGlow level={s.emberLevel} halo={s.emberHalo} />

      <LightField data={far.lights} intensity={s.field} reflect={0.055} fade={430} sizeRef={300} minSize={2.2} maxSize={5.5} />
      <LightStreaks data={far.streaks} travel={s.travel} intensity={s.field} reflect={0.055} fade={430} sizeRef={300} minSize={2} maxSize={6} />
    </>
  );
};

export const EndingScene: React.FC = () => {
  const rig = useRig();
  const s = useEndingState();
  return (
    <AbsoluteFill>
      <Stage3D rig={rig}>
        <World s={s} />
      </Stage3D>
    </AbsoluteFill>
  );
};
