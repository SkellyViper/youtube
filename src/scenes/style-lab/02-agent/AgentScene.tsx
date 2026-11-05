import React from 'react';
import {AbsoluteFill} from 'remotion';
import {
  AgentCore3D,
  arcBetween,
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
  structureProps,
  useCameraRig,
  type Rig,
  type Vec3,
} from '../../../components/cyber/three';
import {useActiveTime, useBeats} from '../../../engine';
import {alpha, cyber, mix, motion} from '../../../styles/cyber';

/**
 * Sample 02: a single AI agent operating inside a system.
 *
 * 3D: the agent (gimbal iris) hovering over the obsidian floor, three dark
 * "tools" around it that it reaches into. 2D: a hairline reticle pinned to
 * the agent with projectPoint(), so the instrument overlay and the 3D world
 * move as one.
 *
 * Colour story: tools are blue (system). The agent is purple (intelligence).
 * What it touches takes on purple. In the last beat it turns red (threat).
 */

const BEATS = ['agent-assemble', 'agent-think', 'agent-reach', 'agent-operate', 'agent-turn'] as const;

const AGENT: Vec3 = [0, 1.55, 0];
const TOOLS: readonly {kind: 'data' | 'exec' | 'gate'; pos: Vec3; top: number}[] = [
  // 120 degrees apart, placed so that no camera in this sample lines a tool up with the agent.
  {kind: 'data', pos: [-3.25, 0, -1.2], top: 0.98},
  {kind: 'exec', pos: [3.25, 0, -1.2], top: 1.32},
  {kind: 'gate', pos: [0, 0, 3.45], top: 1.02},
];

const LINKS = TOOLS.map((t) => {
  const end: Vec3 = [t.pos[0], t.top, t.pos[2]];
  return {out: arcBetween(AGENT, end, 1.15), back: arcBetween(end, AGENT, 1.15)};
});

const RIG_START: Rig = {position: [0, 1.85, 7.6], target: [0, 1.5, 0], fov: cyber.camera.fov};

const useRig = () =>
  useCameraRig(RIG_START, [
    {beat: 'agent-assemble', to: {position: [0, 1.7, 5.4]}},
    {beat: 'agent-think', to: {position: [0.95, 1.62, 5.0]}},
    {beat: 'agent-reach', to: {position: [-2.6, 3.9, 10.6], target: [0, 0.95, 0.2]}},
    {beat: 'agent-operate', to: {position: [-1.2, 3.3, 9.6], target: [0, 1.0, 0.2]}},
    {beat: 'agent-turn', to: {position: [0.9, 3.0, 8.7], target: [0, 1.1, 0.4]}},
  ]);

/** Everything the 2D overlay and the 3D world both need, derived from beats. */
const useAgentState = () => {
  const b = useBeats(BEATS);
  const spin = useActiveTime();
  const open = b['agent-assemble'].at(0.1, 1.7, motion.arrive);
  const think = b['agent-think'];
  const reach = b['agent-reach'];
  const operate = b['agent-operate'];
  const turn = b['agent-turn'];

  const thinkPulse = Math.sin(Math.PI * think.at(0.15, 1.3));
  const flare = Math.sin(Math.PI * operate.at(0.95, 1.7));
  const threat = turn.at(0.25, 1.15, motion.glide);
  const energy = 0.25 + 0.75 * open + 0.5 * thinkPulse + 0.55 * flare + 0.25 * threat;
  // The rings swing into one plane while it "attends", then relax.
  const facing = think.at(0.1, 0.9, motion.glide) * (1 - reach.at(0, 0.9, motion.glide)) * 0.9;

  const tools = TOOLS.map((_, i) => {
    const outT = reach.at(0.12 + i * 0.26, 0.92 + i * 0.26, motion.signal);
    const lit = reach.at(0.86 + i * 0.26, 1.3 + i * 0.26, motion.ignite);
    const backT = operate.at(0.08 + i * 0.16, 0.86 + i * 0.16, motion.signal);
    // 0 = blue system, 1 = used by the agent (purple), 2 = compromised (red).
    const use = operate.at(0.1 + i * 0.16, 0.7 + i * 0.16, motion.glide);
    const red = turn.at(0.5 + i * 0.14, 1.0 + i * 0.14, motion.ignite);
    return {outT, lit, backT, ramp: use + red, red};
  });

  return {b, spin, open, energy, facing, threat, thinkPulse, tools, reticle: think.at(0.2, 1.2, motion.arrive), ripple: think.at(0.25, 1.45, motion.arrive)};
};

type State = ReturnType<typeof useAgentState>;

const faceOrigin = (p: Vec3) => Math.atan2(-p[0], -p[2]);

const Tool: React.FC<{readonly kind: 'data' | 'exec' | 'gate'; readonly pos: Vec3; readonly lit: number; readonly ramp: number}> = ({
  kind,
  pos,
  lit,
  ramp,
}) => {
  const glowColor = hdrRamp(ramp, cyber.emissive.dim + (cyber.emissive.strong - cyber.emissive.dim) * lit);
  const seam = hdr(cyber.color.steel, 0.9).lerp(glowColor, lit);
  return (
    <group position={pos as [number, number, number]} rotation={[0, faceOrigin(pos), 0]}>
      {kind === 'data'
        ? [0, 1, 2].map((k) => (
            <group key={k} position={[0, 0.16 + k * 0.33, 0]}>
              <mesh>
                <cylinderGeometry args={[0.46, 0.46, 0.22, 48]} />
                <meshStandardMaterial {...structureProps} />
              </mesh>
              <mesh position={[0, 0.11, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.46, 0.011, 6, 64]} />
                <meshBasicMaterial color={seam} />
              </mesh>
            </group>
          ))
        : null}
      {kind === 'exec' ? (
        <>
          <mesh position={[0, 0.7, 0]}>
            <boxGeometry args={[1.05, 1.3, 0.1]} />
            <meshStandardMaterial {...structureProps} />
          </mesh>
          {[0, 1, 2].map((k) => (
            <mesh key={k} position={[-0.18 + k * 0.06, 1.05 - k * 0.2, 0.056]}>
              <boxGeometry args={[0.5 - k * 0.12, 0.022, 0.004]} />
              <meshBasicMaterial color={seam} />
            </mesh>
          ))}
          <mesh position={[0, 1.352, 0]}>
            <boxGeometry args={[1.05, 0.014, 0.1]} />
            <meshBasicMaterial color={seam} />
          </mesh>
        </>
      ) : null}
      {kind === 'gate' ? (
        <>
          <mesh position={[0, 0.62, 0]}>
            <torusGeometry args={[0.52, 0.05, 10, 64]} />
            <meshStandardMaterial {...structureProps} />
          </mesh>
          <mesh position={[0, 0.62, 0]}>
            <torusGeometry args={[0.4, 0.011, 6, 64]} />
            <meshBasicMaterial color={seam} />
          </mesh>
          <mesh position={[0, 0.62, 0]} scale={0.05 + 0.03 * lit}>
            <sphereGeometry args={[1, 16, 12]} />
            <meshBasicMaterial color={seam} />
          </mesh>
        </>
      ) : null}
    </group>
  );
};

const World: React.FC<{readonly s: State}> = ({s}) => {
  const linkColor = mix(cyber.color.purple, cyber.color.red, s.threat);
  return (
    <>
      <SkyDome haze={mix(cyber.color.haze, cyber.color.redDeep, s.threat * 0.7)} intensity={0.35 + 0.65 * s.open} />
      <StageLights intensity={0.25 + 0.75 * s.open} />
      <MirrorFloor opacity={0.74} />

      <Reflect>
        <AgentCore3D position={AGENT} open={s.open} energy={s.energy} spin={s.spin} facing={s.facing} threat={s.threat} />

        {TOOLS.map((t, i) => (
          <Tool key={t.kind} kind={t.kind} pos={t.pos} lit={s.tools[i].lit} ramp={s.tools[i].ramp} />
        ))}

        {LINKS.map((link, i) => {
          const tool = s.tools[i];
          return (
            <group key={i}>
              {/* The link stays once the first signal has travelled it. */}
              <GlowTube curve={link.out} radius={0.008} color={linkColor} intensity={cyber.emissive.base * (0.55 + 0.45 * tool.lit)} to={tool.outT} />
              <Comet3D curve={link.out} t={tool.outT} color={cyber.color.purple} radius={0.018} />
              <Comet3D curve={link.back} t={tool.backT} color={cyber.color.purple} radius={0.018} />
            </group>
          );
        })}
      </Reflect>

      {/* Floor circuit joining the tools: infrastructure, so blue and dim. */}
      <mesh position={[0, 0.004, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[3.55, 0.007, 4, 160]} />
        <meshBasicMaterial color={hdr(cyber.color.blue, cyber.emissive.dim * (0.3 + 0.7 * s.b['agent-reach'].at(0, 1.2)))} />
      </mesh>
      {/* A single ripple on the floor when it "thinks". */}
      {s.ripple > 0 && s.ripple < 1 ? (
        <mesh position={[0, 0.006, 0]} rotation={[Math.PI / 2, 0, 0]} scale={0.4 + 3.4 * s.ripple}>
          <torusGeometry args={[1, 0.006, 4, 120]} />
          <meshBasicMaterial color={hdr(cyber.color.purple, cyber.emissive.strong * (1 - s.ripple))} transparent opacity={1 - s.ripple} />
        </mesh>
      ) : null}
    </>
  );
};

/** 2D instrument overlay pinned to the 3D agent. */
const Reticle: React.FC<{readonly rig: Rig; readonly s: State}> = ({rig, s}) => {
  if (s.reticle <= 0) return null;
  const p = projectPoint(rig, AGENT);
  const r = p.scale * 1.5;
  const color = mix(cyber.color.purpleHot, cyber.color.redHot, s.threat);
  // Four arcs with gaps; under threat the gaps open.
  const sweep = (Math.PI / 2 - 0.3 - 0.5 * s.threat) * s.reticle;
  const arcs = [0, 1, 2, 3].map((k) => {
    const a0 = k * (Math.PI / 2) + 0.15 + s.threat * 0.25 - Math.PI / 4;
    const a1 = a0 + sweep;
    return `M${(p.x + Math.cos(a0) * r).toFixed(2)} ${(p.y + Math.sin(a0) * r).toFixed(2)}A${r.toFixed(2)} ${r.toFixed(2)} 0 0 1 ${(p.x + Math.cos(a1) * r).toFixed(2)} ${(p.y + Math.sin(a1) * r).toFixed(2)}`;
  });
  const ticks = [0, 1, 2, 3].map((k) => {
    const a = k * (Math.PI / 2);
    const r0 = r + 10;
    const r1 = r + 10 + 22 * s.reticle;
    return `M${(p.x + Math.cos(a) * r0).toFixed(2)} ${(p.y + Math.sin(a) * r0).toFixed(2)}L${(p.x + Math.cos(a) * r1).toFixed(2)} ${(p.y + Math.sin(a) * r1).toFixed(2)}`;
  });
  return (
    <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
      <g fill="none" stroke={alpha(cyber.color.purpleHot, 1)} opacity={0.5 * s.reticle}>
        <path d={arcs.join('')} stroke={color} strokeWidth={cyber.line.hair} />
        <path d={ticks.join('')} stroke={color} strokeWidth={cyber.line.thin} />
      </g>
    </svg>
  );
};

/** Bloom is a screen-space effect: ease it off in close-ups so the core stays crisp. */
const bloomFor = (rig: Rig) => {
  const d = Math.hypot(rig.position[0] - AGENT[0], rig.position[1] - AGENT[1], rig.position[2] - AGENT[2]);
  const k = Math.min(1, Math.max(0, (d - 5.2) / 4));
  return 0.5 + (cyber.bloom.strength - 0.5) * k;
};

export const AgentScene: React.FC = () => {
  const rig = useRig();
  const s = useAgentState();
  return (
    <AbsoluteFill>
      <Stage3D rig={rig} bloom={{strength: bloomFor(rig)}}>
        <World s={s} />
      </Stage3D>
      <Reticle rig={rig} s={s} />
    </AbsoluteFill>
  );
};
