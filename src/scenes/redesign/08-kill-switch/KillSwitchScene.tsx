import React from 'react';
import {AbsoluteFill} from 'remotion';
import {AgentGlyph} from '../../../components/cyber/svg/AgentGlyph';
import {Curve2, type Pt} from '../../../components/cyber/svg/curve';
import {Trace} from '../../../components/cyber/svg/Signal2D';
import {Cable, Canvas, Packet, Rack, StoryBackdrop, World, blink, clamp01, ease, f2, lerp} from '../../../components/story';
import {useActiveTime, useBeats, useCamera} from '../../../engine';
import {alpha} from '../../../styles/cyber';
import {ThemeContext, useTheme} from '../../../styles/ThemeContext';
import type {Theme, ToneTriplet} from '../../../styles/themes';

/**
 * S08 · Compute, model access and the kill switch (2D, one continuous world).
 *
 * Cast (what each object stands for, and why it is here):
 *   - the agent          the gimbal iris, large. Its rings turn while it runs.
 *   - model service      a server box with a neural-lattice glyph: where the
 *                        agent's model is served from. It has no name, only
 *                        the icon and a small badge (circle / triangle / square
 *                        tell the three services apart later).
 *   - compute server     a rack, scaled down: the machine the agent runs on.
 *   - cables             two dependencies drawn as cables with energy pulses
 *                        travelling toward the agent: model access (mind tone)
 *                        and compute (system tone).
 *   - socket + key       an access key plugged into the model line. Pulling it
 *                        is the kill switch: no hand, the key just slides out.
 *   - the second rig     the same agent, to the right in the same world, fed
 *                        by three model services with three keys. Tagged
 *                        "Hypothetical": it is not a claim about any system.
 *
 * Beats:
 *   ks-feed   one agent, one model line with a key, one compute line. Pulses.
 *   ks-pull   the key slides out. The line dies from the socket toward the
 *             agent, the rings slow to a stop and grey out. The pulses stop.
 *   ks-many   the camera pulls wide and pans right to the hypothetical rig:
 *             three model lines, three keys, compute. Everything pulsing.
 *   ks-one    one key pulls. Only its line dies. The agent dims a little and
 *             keeps turning; the other two lines keep pulsing.
 */

/* ------------------------------------------------------------------ geometry */
const R = 170;
/** Point on the agent's ring at a screen-space angle (degrees, clockwise). */
const ring = (cx: number, cy: number, deg: number): Pt => ({x: cx + Math.cos((deg * Math.PI) / 180) * (R + 2), y: cy + Math.sin((deg * Math.PI) / 180) * (R + 2)});

const A1 = {x: 0, y: 0};
const MODEL1 = {x: -820, y: -300};
const RACK1 = {x: -820, y: 470, s: 0.55};
const SOCKET1_X = -560;
const M1 = Curve2.route([{x: MODEL1.x + 130, y: MODEL1.y}, {x: -420, y: MODEL1.y}, {x: -420, y: ring(A1.x, A1.y, 195).y}, ring(A1.x, A1.y, 195)], 70);
const C1 = Curve2.route([{x: RACK1.x + 60, y: 330}, {x: ring(A1.x, A1.y, 120).x, y: 330}, ring(A1.x, A1.y, 120)], 70);

const A2 = {x: 2600, y: 0};
const MODELS2 = [
  {x: 1780, y: -440},
  {x: 1780, y: -140},
  {x: 1780, y: 160},
];
const RACK2 = {x: 1780, y: 640, s: 0.5};
const SOCKET2_X = 2020;
const M2 = [
  Curve2.route([{x: MODELS2[0].x + 130, y: MODELS2[0].y}, {x: 2180, y: MODELS2[0].y}, {x: 2180, y: ring(A2.x, A2.y, 200).y}, ring(A2.x, A2.y, 200)], 70),
  Curve2.route([{x: MODELS2[1].x + 130, y: MODELS2[1].y}, {x: 2260, y: MODELS2[1].y}, {x: 2260, y: ring(A2.x, A2.y, 180).y}, ring(A2.x, A2.y, 180)], 70),
  Curve2.route([{x: MODELS2[2].x + 130, y: MODELS2[2].y}, {x: 2320, y: MODELS2[2].y}, {x: 2320, y: ring(A2.x, A2.y, 160).y}, ring(A2.x, A2.y, 160)], 70),
];
const C2 = Curve2.route([{x: RACK2.x + 55, y: 500}, {x: ring(A2.x, A2.y, 120).x, y: 500}, ring(A2.x, A2.y, 120)], 70);

/** Fraction of a route at which its first (horizontal) run reaches x. */
const paramAtX = (curve: Curve2, x: number) => (x - curve.points[0].x) / curve.length;

/* ------------------------------------------------------------------ helpers */
const hex2 = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0');
/** Blend two hex colours and stay in hex (the kit's `mix` returns rgb(), which `alpha` cannot read). */
const mixHex = (a: string, b: string, t: number) => {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => lerp((pa >> s) & 255, (pb >> s) & 255, clamp01(t));
  return `#${hex2(ch(16))}${hex2(ch(8))}${hex2(ch(0))}`;
};
const mixTone = (a: ToneTriplet, b: ToneTriplet, t: number): ToneTriplet => ({base: mixHex(a.base, b.base, t), hot: mixHex(a.hot, b.hot, t), deep: mixHex(a.deep, b.deep, t)});

/**
 * Ring phase for a run whose rate goes linearly from 1 to `rEnd` over `D`
 * seconds starting at `p0` (the integral of the rate), so slowing never
 * turns the rings backwards.
 */
const decelPhase = (t: number, p0: number, D: number, rEnd: number) => {
  if (t <= p0) return t;
  const u = Math.min(t - p0, D);
  return p0 + u - ((1 - rEnd) * u * u) / (2 * D) + Math.max(0, t - p0 - D) * rEnd;
};

/* ------------------------------------------------------------------ parts */
/** The agent, with its mind tone pulled toward `inert` by `fade`. */
const Agent: React.FC<{readonly x: number; readonly y: number; readonly spin: number; readonly energy: number; readonly fade: number}> = ({x, y, spin, energy, fade}) => {
  const th = useTheme();
  const themed: Theme = fade > 0.001 ? {...th, tone: {...th.tone, mind: mixTone(th.tone.mind, th.tone.inert, fade)}} : th;
  return (
    <ThemeContext.Provider value={themed}>
      <circle cx={x} cy={y} r={R + 14} fill={alpha(th.color.abyss, 0.9)} stroke={alpha(th.color.steel, 0.9)} strokeWidth={3} />
      <AgentGlyph x={x} y={y} r={R} spin={spin} energy={energy} />
    </ThemeContext.Provider>
  );
};

const LATTICE = [
  [3, 4, 2],
  [2, 3, 2],
  [4, 2, 1],
] as const;

/** A model service: a server box whose front carries a neural lattice. */
const ModelServer: React.FC<{readonly x: number; readonly y: number; readonly time: number; readonly variant: 0 | 1 | 2; readonly dim?: number}> = ({x, y, time, variant, dim = 0}) => {
  const th = useTheme();
  const k = th.color;
  const mind = th.tone.mind;
  const w = 260;
  const h = 200;
  const cols = LATTICE[variant];
  const xs = [-62, 0, 62];
  const nodes = cols.map((n, ci) => Array.from({length: n}, (_, i) => ({x: xs[ci], y: 18 + (i - (n - 1) / 2) * 30})));
  let links = '';
  for (let ci = 0; ci < nodes.length - 1; ci++) for (const a of nodes[ci]) for (const b of nodes[ci + 1]) links += `M${f2(a.x)} ${f2(a.y)}L${f2(b.x)} ${f2(b.y)}`;
  const badge =
    variant === 0 ? <circle cx={-w / 2 + 30} cy={-h / 2 + 24} r={9} fill={alpha(k.steel, 0.95)} /> : variant === 1 ? <path d={`M${-w / 2 + 30} ${-h / 2 + 14}l10 18h-20z`} fill={alpha(k.steel, 0.95)} /> : <rect x={-w / 2 + 21} y={-h / 2 + 15} width={18} height={18} fill={alpha(k.steel, 0.95)} />;
  return (
    <g transform={`translate(${f2(x)} ${f2(y)})`} opacity={1 - dim * 0.6}>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={th.radius} fill={k.slate} stroke={alpha(k.steel, 0.95)} strokeWidth={2.5} />
      <rect x={-w / 2 + 8} y={-h / 2 + 8} width={w - 16} height={32} fill={alpha(k.abyss, 0.8)} />
      {badge}
      {[0, 1, 2].map((i) => (
        <rect key={i} x={w / 2 - 30 - i * 14} y={-h / 2 + 22} width={8} height={4} fill={th.tone.system.base} opacity={blink(variant * 7 + i, time, 0.9 + i * 0.2, 0.6)} />
      ))}
      <rect x={-w / 2 + 8} y={-h / 2 + 46} width={w - 16} height={h - 54} fill={alpha(k.abyss, 0.6)} />
      <path d={links} stroke={alpha(mind.base, 0.4)} strokeWidth={1.6} fill="none" />
      {nodes.flat().map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={7} fill={mind.base} opacity={0.65 + 0.35 * Math.sin(time * 2.2 + i * 1.7)} />
      ))}
    </g>
  );
};

/** The access key seated in a socket on a horizontal cable run. `pull` 0 = seated, 1 = out. */
const KeySocket: React.FC<{readonly x: number; readonly y: number; readonly pull: number; readonly seated: number}> = ({x, y, pull, seated}) => {
  const th = useTheme();
  const k = th.color;
  const human = th.tone.human;
  const dy = -150 * pull;
  const rim = mixHex(th.tone.system.base, th.tone.inert.base, 1 - seated);
  return (
    <g transform={`translate(${f2(x)} ${f2(y)})`}>
      <rect x={-36} y={-24} width={72} height={48} rx={5} fill={k.slate} stroke={alpha(k.steel, 0.95)} strokeWidth={2.5} />
      <rect x={-11} y={-24} width={22} height={9} fill={k.void} stroke={rim} strokeWidth={2} />
      <rect x={-30} y={14} width={60} height={4} fill={rim} opacity={0.4 + 0.6 * seated} />
      {/* the key: bow at the top, shaft down into the slot */}
      <g transform={`translate(0 ${f2(-24 + dy)})`} opacity={1 - 0.25 * pull}>
        <rect x={-7} y={-78} width={14} height={78} rx={2} fill={human.base} stroke={human.hot} strokeWidth={1.5} />
        <rect x={7} y={-14} width={10} height={7} fill={human.base} />
        <rect x={7} y={-28} width={8} height={7} fill={human.base} />
        <circle cx={0} cy={-98} r={22} fill={human.base} stroke={human.hot} strokeWidth={1.5} />
        <circle cx={0} cy={-98} r={8} fill={k.abyss} />
      </g>
    </g>
  );
};

/**
 * A dependency: the cable, its lit core (whole before `deadFrom`; after the
 * socket it shrinks toward the agent as `dead` grows), and pulses toward the
 * agent that fade with `flow`.
 */
const Feed: React.FC<{readonly curve: Curve2; readonly color: string; readonly time: number; readonly socketT?: number; readonly dead?: number; readonly flow: number; readonly phase?: number; readonly speed?: number}> = ({
  curve,
  color,
  time,
  socketT = 0,
  dead = 0,
  flow,
  phase = 0,
  speed = 0.4,
}) => {
  const th = useTheme();
  const front = socketT + dead * (1 - socketT);
  return (
    <g>
      <Cable curve={curve} color={color} lit={0} width={9} />
      {socketT > 0 ? <Trace curve={curve} to={socketT} color={color} width={9} halo={22 * th.glow} /> : null}
      {front < 0.999 ? <Trace curve={curve} from={front} to={1} color={color} width={9} halo={22 * th.glow} /> : null}
      {flow > 0.001 ? (
        <g opacity={flow}>
          {[0, 1, 2].map((i) => {
            const u = time * speed + i / 3 + phase;
            const t = u - Math.floor(u);
            // Pulses only travel the lit part past the socket.
            const tt = Math.max(t, front);
            return t >= front || dead <= 0 ? <Packet key={i} curve={curve} t={tt} color={color} tail={0.1} size={6} /> : null;
          })}
        </g>
      ) : null}
    </g>
  );
};

/* ------------------------------------------------------------------ camera */
const CAM_INITIAL = {x: -330, y: 60, zoom: 0.95};
const CAM_TRACK = [
  {beat: 'ks-pull', to: {x: -280, y: 30, zoom: 1.02}, from: 0.6, until: 2.8, easing: ease.camera},
  {beat: 'ks-many', to: {x: 1000, y: 40, zoom: 0.52}, from: 0, until: 1.4, easing: ease.inOut},
  {beat: 'ks-many', to: {x: 2250, y: 20, zoom: 0.78}, from: 1.0, until: 2.6, easing: ease.inOut},
  {beat: 'ks-one', to: {x: 2330, y: 10, zoom: 0.85}, from: 0.2, until: 2.6, easing: ease.camera},
];

export const KillSwitchScene: React.FC = () => {
  const th = useTheme();
  const time = useActiveTime();
  const b = useBeats(['ks-feed', 'ks-pull', 'ks-many', 'ks-one']);
  const cam = useCamera(CAM_INITIAL, CAM_TRACK);
  const mind = th.tone.mind.base;
  const sys = th.tone.system.base;

  // ---- rig 1: the kill switch -----------------------------------------------
  const pull1 = b['ks-pull'].at(0.35, 1.2, ease.back);
  const dead1 = b['ks-pull'].at(1.0, 2.3, ease.inOut);
  const flow1 = 1 - b['ks-pull'].at(0.9, 1.3);
  const fade1 = b['ks-pull'].at(1.3, 2.7, ease.inOut);
  const spin1 = b['ks-feed'].time + decelPhase(b['ks-pull'].time, 1.0, 1.6, 0);
  const energy1 = lerp(1, 0.25, fade1);
  const socket1T = paramAtX(M1, SOCKET1_X);

  // ---- rig 2: the hypothetical, distributed version ------------------------
  const tag = b['ks-many'].at(1.5, 2.1);
  const pull2 = b['ks-one'].at(0.3, 1.15, ease.back);
  const dead2 = b['ks-one'].at(0.9, 2.2, ease.inOut);
  const flow2 = 1 - b['ks-one'].at(0.8, 1.2);
  const dim2 = b['ks-one'].at(1.1, 2.5, ease.inOut);
  const spin2 = 3 + b['ks-feed'].time + b['ks-pull'].time + b['ks-many'].time + decelPhase(b['ks-one'].time, 0.9, 1.4, 0.65);
  const energy2 = lerp(1, 0.72, dim2);
  const socket2T = M2.map((m) => paramAtX(m, SOCKET2_X));

  return (
    <AbsoluteFill>
      <StoryBackdrop intensity={0.6} />
      <Canvas>
        <World cam={cam}>
          {/* ---------------- rig 1 ---------------- */}
          <ModelServer x={MODEL1.x} y={MODEL1.y} time={time} variant={0} />
          <Rack x={RACK1.x} y={RACK1.y} s={RACK1.s} time={time} seed={4} />
          <Feed curve={M1} color={mind} time={time} socketT={socket1T} dead={dead1} flow={flow1} />
          <Feed curve={C1} color={sys} time={time} flow={lerp(1, 0.35, fade1)} phase={0.5} speed={0.33} />
          <KeySocket x={SOCKET1_X} y={MODEL1.y} pull={pull1} seated={1 - clamp01(pull1 * 3)} />
          <Agent x={A1.x} y={A1.y} spin={spin1} energy={energy1} fade={fade1} />

          {/* ---------------- rig 2 ---------------- */}
          {MODELS2.map((m, i) => (
            <ModelServer key={i} x={m.x} y={m.y} time={time + i * 0.7} variant={i as 0 | 1 | 2} />
          ))}
          <Rack x={RACK2.x} y={RACK2.y} s={RACK2.s} time={time} seed={9} />
          {M2.map((m, i) => (
            <Feed key={i} curve={m} color={mind} time={time} socketT={socket2T[i]} dead={i === 1 ? dead2 : 0} flow={i === 1 ? flow2 : 1} phase={i * 0.37} speed={0.4 - i * 0.03} />
          ))}
          <Feed curve={C2} color={sys} time={time} flow={1} phase={0.2} speed={0.33} />
          {MODELS2.map((m, i) => (
            <KeySocket key={i} x={SOCKET2_X} y={m.y} pull={i === 1 ? pull2 : 0} seated={i === 1 ? 1 - clamp01(pull2 * 3) : 1} />
          ))}
          <Agent x={A2.x} y={A2.y} spin={spin2} energy={energy2} fade={dim2 * 0.3} />
          <text x={A2.x - 150} y={-560} fontFamily={th.font} fontSize={34} letterSpacing={8} fill={th.color.dim} opacity={tag} textAnchor="middle">
            Hypothetical
          </text>
        </World>
      </Canvas>
    </AbsoluteFill>
  );
};
