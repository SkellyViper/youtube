import React, {useLayoutEffect, useMemo} from 'react';
import {AbsoluteFill} from 'remotion';
import {
  AgentCore3D,
  Comet3D,
  GlowTube,
  hdr,
  hdrRamp,
  MirrorFloor,
  Reflect,
  SkyDome,
  Stage3D,
  StageLights,
  useCameraRig,
  type Rig,
  type Vec3,
} from '../../../components/cyber/three';
import {CameraClip, flattenRig, rigDistance, type PlanView} from '../../../components/cyber/three/PlanCamera';
import {useActiveTime, useBeats, useScalarTrack} from '../../../engine';
import {cyber, mix, motion} from '../../../styles/cyber';
import {AVENUE_GRID, BOULEVARD_GRID, NODE_RING, PLAZA_RING, ROUTES} from './city';
import {PlanOverlay} from './PlanOverlay';
import {createField, paintSeams, SlabField, wakeFront, type SeamLight} from './SlabField';

/**
 * Sample 01: the cinematic opening.
 *
 * A dark field of compute wakes up, turns out to be a city, receives a mind,
 * and then flattens into a diagram: the camera swings to a top-down view
 * while a dolly-zoom removes the perspective, and a hairline 2D overlay lands
 * on what is now a plan.
 *
 * Colour story: everything is blue (systems) until the signals arrive; the
 * agent in the plaza is the only purple thing in the world.
 */

const BEATS = ['hero-wake', 'hero-scale', 'hero-signal', 'hero-flatten'] as const;

const AGENT: Vec3 = [0, 5.2, 0];
const AGENT_SCALE = 3.4;

/** Frame 0: on the boulevard floor, a little off its centre line, looking at the plaza. */
const RIG_START: Rig = {position: [0.9, 0.5, 46], target: [0, 3.6, 0], fov: cyber.camera.fov};

/** The plan the world flattens into: the node sits a little left of centre. */
export const PLAN: PlanView = {center: [4, 0, 0], frame: 60, fov: 2.6, azimuth: 0};

/** Comets travel at one speed; the routes are timed so they land one after another. */
const COMET_SPEED = 125;
const COMET_TAIL = 0.15;
const ARRIVALS = ROUTES.map((route, i) => {
  const arrive = 1.14 + i * 0.04;
  return {route, arrive, start: arrive - route.total / COMET_SPEED};
});

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const useHero = () => {
  const b = useBeats(BEATS);
  const spin = useActiveTime();
  const wake = b['hero-wake'];
  const scale = b['hero-scale'];
  const signal = b['hero-signal'];
  const flatten = b['hero-flatten'];

  // Beats 1-3 are ordinary camera keyframes: a low push, a crane up and back, an arc down to the plaza.
  const base = useCameraRig(RIG_START, [
    {beat: 'hero-wake', to: {position: [0.7, 0.62, 37]}},
    {beat: 'hero-scale', to: {position: [2.4, 30, 100], target: [0, 0, -82]}},
    {beat: 'hero-signal', to: {position: [16.5, 8.4, 36.5], target: [0, 5.0, 0]}},
  ]);
  // Beat 4: swing over the top while the lens flattens.
  const swing = flatten.at(0, 1.8, motion.camera);
  const lens = flatten.at(0.1, 1.9, motion.glide);
  const rig = flattenRig(base, PLAN, swing, lens);

  // Fog is a property of the world until the flatten, then of the drawing:
  // it has to thin out as the camera backs away or it would swallow the plan.
  const worldFog = useScalarTrack(0.013, [
    {beat: 'hero-scale', to: 0.0068},
    {beat: 'hero-signal', to: 0.0095},
  ]);
  const fog = lerp(worldFog * rigDistance(base), 0.12, lens) / rigDistance(rig);

  const flat = flatten.at(0.25, 1.75, motion.glide);
  const open = signal.at(1.2, 2.05, motion.arrive);
  const flare = Math.sin(Math.PI * signal.at(1.2, 2.0));
  const dawn = wake.at(0, 1.5, motion.glide);
  const rise = scale.at(0.2, 2.0, motion.glide);
  const descend = signal.at(0, 1.6, motion.glide);

  const seams: SeamLight = {
    front: wakeFront(wake.at(0.12, 1.92, motion.signal)),
    level: 1.25 * (1 - 0.45 * flat),
    skirt: 0.09 + 0.75 * flat,
  };

  return {
    rig,
    fog,
    spin,
    flat,
    open,
    flare,
    seams,
    dawn,
    // From high up the band would look thick (its lower half is no longer hidden by the floor):
    // thin it as the camera rises, let it breathe again as it comes down to the plaza.
    sky: 0.12 + 0.88 * dawn - 0.3 * rise + 0.12 * descend,
    skyWidth: 0.085 - 0.03 * rise,
    lights: 0.2 + 0.8 * wake.at(0.2, 1.6, motion.glide) + 0.5 * rise - 0.35 * descend,
    grid: 0.05 + 0.3 * wake.at(0.3, 1.8, motion.glide) + 0.35 * flat,
    energy: 0.3 + 0.7 * open + 0.55 * flare,
    ring: signal.at(1.14, 1.55, motion.ignite),
    ripple: signal.at(1.3, 2.05, motion.arrive),
    comets: ARRIVALS.map(({arrive, start}) => Math.min(1 + COMET_TAIL + 0.01, Math.max(0, (signal.time - start) / (arrive - start)))),
    land: flatten.at(1.5, 2.15, motion.arrive),
    lead: flatten.at(1.75, 2.35, motion.glide),
  };
};

type Hero = ReturnType<typeof useHero>;

const World: React.FC<{readonly s: Hero}> = ({s}) => {
  const field = useMemo(createField, []);
  useLayoutEffect(() => () => field.dispose(), [field]);

  // Paint the seams and size the hairlines for this frame's lens.
  const {front, level, skirt} = s.seams;
  useLayoutEffect(() => {
    paintSeams(field, {front, level, skirt});
  }, [field, front, level, skirt]);
  field.hairline.value = (1.6 * 2 * Math.tan((s.rig.fov * Math.PI) / 360)) / 1080;

  const distance = rigDistance(s.rig);
  const ringColor = hdrRamp(s.ring, lerp(cyber.emissive.dim * (0.2 + 0.8 * s.dawn), cyber.emissive.base, s.ring) + 1.2 * s.flare);

  return (
    <>
      <CameraClip near={Math.max(0.1, (s.rig.position[1] - 10) * 0.35)} far={Math.max(600, distance * 1.2 + 400)} />
      <SkyDome intensity={s.sky} width={s.skyWidth} />
      <StageLights intensity={s.lights} />
      <MirrorFloor opacity={0.76} />
      <lineSegments geometry={AVENUE_GRID} position={[0, 0.002, 0]}>
        <lineBasicMaterial color={mix(cyber.color.steel, cyber.color.blue, 0.4 + 0.3 * s.flat)} transparent opacity={s.grid} depthWrite={false} />
      </lineSegments>
      {/* The two boulevards: the same hairline, brighter, leading the eye to the plaza. */}
      <lineSegments geometry={BOULEVARD_GRID} position={[0, 0.003, 0]}>
        <lineBasicMaterial color={cyber.color.blue} transparent opacity={0.04 + 0.56 * s.dawn + 0.2 * s.flat} depthWrite={false} />
      </lineSegments>

      {/* The agent lights the structure around the plaza. */}
      <pointLight position={AGENT as [number, number, number]} color={cyber.color.purple} intensity={1000 * (0.7 * s.open + 0.6 * s.flare)} decay={2} />

      <Reflect>
        <SlabField field={field} />
        <group position={AGENT as [number, number, number]} rotation={[(-Math.PI / 2) * s.flat, 0, 0]}>
          <AgentCore3D scale={AGENT_SCALE} open={s.open} energy={s.energy} spin={s.spin} facing={s.flat} />
        </group>
      </Reflect>

      {/* Rings inlaid in the plaza floor: the socket the signals run into. */}
      <mesh position={[0, 0.03, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[NODE_RING, 0.04, 4, 160]} />
        <meshBasicMaterial color={ringColor} />
      </mesh>
      <mesh position={[0, 0.03, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[PLAZA_RING, 0.03, 4, 200]} />
        <meshBasicMaterial color={hdr(cyber.color.blue, 0.04 + 0.7 * s.dawn)} />
      </mesh>

      {/* Signals: comets along the avenues. Where one has passed, a thin line stays. */}
      {ARRIVALS.map(({route}, i) => {
        const t = s.comets[i];
        return (
          <group key={i}>
            <GlowTube curve={route} radius={0.05} color={cyber.color.purple} intensity={cyber.emissive.base * 0.9} to={Math.min(1, t)} segments={320} radial={5} />
            <Comet3D curve={route} t={t} tail={COMET_TAIL} color={cyber.color.purple} radius={0.075} head={2.6} />
          </group>
        );
      })}

      {/* One ripple across the plaza when the agent ignites. */}
      {s.ripple > 0 && s.ripple < 1 ? (
        <mesh position={[0, 0.04, 0]} rotation={[Math.PI / 2, 0, 0]} scale={NODE_RING + (16 - NODE_RING) * s.ripple}>
          <torusGeometry args={[1, 0.006, 4, 160]} />
          <meshBasicMaterial color={hdr(cyber.color.purple, cyber.emissive.strong * (1 - s.ripple))} transparent opacity={1 - s.ripple} />
        </mesh>
      ) : null}
    </>
  );
};

export const HeroScene: React.FC = () => {
  const s = useHero();
  return (
    <AbsoluteFill>
      <Stage3D rig={s.rig} fog={s.fog}>
        <World s={s} />
      </Stage3D>
      <PlanOverlay rig={s.rig} land={s.land} lead={s.lead} />
    </AbsoluteFill>
  );
};
