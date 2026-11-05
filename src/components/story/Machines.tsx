import React from 'react';
import {AgentGlyph} from '../cyber/svg/AgentGlyph';
import {alpha, mix} from '../../styles/cyber';
import {useTheme} from '../../styles/ThemeContext';
import {blink, clamp01, f2} from './math';

/**
 * Recognisable computers, front view (2D). Every machine in the redesign is
 * one of these silhouettes, so "a computer" is never a dot or a glowing cube.
 *
 *   Rack     a data-centre cabinet: stacked 1U servers with status LEDs and
 *            one open bay where a process (the agent) can be seen running.
 *   Laptop   an open laptop (a personal machine).
 *   Tower    a desktop tower with a front grille.
 *   GpuBox   a wide compute box with fans (rented compute).
 *
 * Shared props:
 *   (x, y)   bottom-centre in the parent's coordinates; `s` scales the machine.
 *   power    0..1, how lit its LEDs are (0 = switched off).
 *   time     seconds of motion (LED flicker is a pure function of it).
 *   agent    0..1, the agent occupying the machine (assembles inside it).
 *   threat   0..1, the occupying agent's threat tint.
 *   check    0..1, a green "verified" tick above the machine (scans/tests).
 *   tone     tint of idle LEDs: 'system' (default) or another role.
 */
export type MachineProps = {
  readonly x: number;
  readonly y: number;
  readonly s?: number;
  readonly power?: number;
  readonly time?: number;
  readonly agent?: number;
  readonly agentEnergy?: number;
  readonly threat?: number;
  readonly check?: number;
  readonly seed?: number;
  readonly dim?: number;
};

export const Check: React.FC<{readonly x: number; readonly y: number; readonly r: number; readonly p: number}> = ({x, y, r, p}) => {
  const th = useTheme();
  if (p <= 0.001) return null;
  const safe = th.tone.safe;
  const draw = clamp01(p * 1.4);
  return (
    <g transform={`translate(${f2(x)} ${f2(y)}) scale(${f2(0.6 + 0.4 * clamp01(p * 2))})`} opacity={clamp01(p * 3)}>
      <circle r={r} fill={alpha(safe.deep, 0.85)} stroke={safe.base} strokeWidth={r * 0.1} />
      <path
        d={`M${f2(-r * 0.45)} ${f2(r * 0.02)}L${f2(-r * 0.12)} ${f2(r * 0.34)}L${f2(r * 0.48)} ${f2(-r * 0.34)}`}
        fill="none"
        stroke={safe.hot}
        strokeWidth={r * 0.17}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray="1 1"
        strokeDashoffset={1 - draw}
      />
    </g>
  );
};

/** Rack: 220 x 600 units at s = 1. The open bay is at 45-60% height. */
export const Rack: React.FC<MachineProps> = ({x, y, s = 1, power = 1, time = 0, agent = 0, agentEnergy = 1, threat = 0, check = 0, seed = 0, dim = 0}) => {
  const th = useTheme();
  const c = th.color;
  const sys = th.tone.system;
  const mind = th.tone.mind;
  const w = 220;
  const h = 600;
  const units = 14;
  const bayTop = 4;
  const bayRows = 4;
  const uh = (h - 60) / units;
  let unitPath = '';
  let ledPath = '';
  let ledHot = '';
  for (let i = 0; i < units; i++) {
    if (i >= bayTop && i < bayTop + bayRows) continue;
    const uy = 36 + i * uh;
    unitPath += `M${-w / 2 + 14} ${uy + 3}h${w - 28}v${uh - 6}h${-(w - 28)}z`;
    for (let k = 0; k < 3; k++) {
      const lx = w / 2 - 34 + k * 9;
      const on = blink(seed * 31 + i * 7 + k, time, 0.8 + k * 0.3, 0.55);
      if (on > 0.5) ledHot += `M${lx} ${uy + uh / 2 - 2}h4v4h-4z`;
      else ledPath += `M${lx} ${uy + uh / 2 - 2}h4v4h-4z`;
    }
  }
  const bayY = 36 + bayTop * uh + 3;
  const bayH = bayRows * uh - 6;
  const occupied = clamp01(agent);
  const ledColor = mix(sys.base, mind.base, occupied);
  return (
    <g transform={`translate(${f2(x)} ${f2(y)}) scale(${f2(s)}) translate(0 ${-h})`} opacity={1 - dim * 0.75}>
      <rect x={-w / 2} y={0} width={w} height={h} rx={6} fill={c.slate} stroke={alpha(c.steel, 0.95)} strokeWidth={2.5} />
      <rect x={-w / 2 + 8} y={10} width={w - 16} height={16} fill={alpha(c.steel, 0.4)} />
      <path d={unitPath} fill={alpha(c.abyss, 0.9)} stroke={alpha(c.steel, 0.55)} strokeWidth={1.2} />
      <path d={ledPath} fill={ledColor} opacity={0.25 * power} />
      <path d={ledHot} fill={ledColor} opacity={0.95 * power} />
      {/* The open bay: a dark recess, lit from inside when a process lives here. */}
      <rect x={-w / 2 + 14} y={bayY} width={w - 28} height={bayH} rx={4} fill={c.void} stroke={alpha(occupied > 0 ? mind.base : c.steel, 0.5 + 0.5 * occupied)} strokeWidth={2} />
      {occupied > 0.001 ? (
        <>
          <rect x={-w / 2 + 14} y={bayY} width={w - 28} height={bayH} rx={4} fill={alpha(threat > 0.5 ? th.tone.threat.base : mind.base, 0.16 * occupied * th.glow)} />
          <AgentGlyph x={0} y={bayY + bayH / 2} r={bayH * 0.42} open={occupied} energy={agentEnergy} spin={time + seed} threat={threat} />
        </>
      ) : null}
      {/* Feet */}
      <rect x={-w / 2 + 6} y={h} width={26} height={8} fill={c.steel} />
      <rect x={w / 2 - 32} y={h} width={26} height={8} fill={c.steel} />
      <Check x={0} y={-50} r={34} p={check} />
    </g>
  );
};

/** Laptop: 260 wide at s = 1, screen 160 tall. The agent shows on its screen. */
export const Laptop: React.FC<MachineProps> = ({x, y, s = 1, power = 1, time = 0, agent = 0, agentEnergy = 1, threat = 0, check = 0, seed = 0, dim = 0}) => {
  const th = useTheme();
  const c = th.color;
  return (
    <g transform={`translate(${f2(x)} ${f2(y)}) scale(${f2(s)})`} opacity={1 - dim * 0.75}>
      <path d="M-150 0h300l-18 -16h-264z" fill={c.steel} />
      <rect x={-120} y={-196} width={240} height={176} rx={8} fill={c.slate} stroke={alpha(c.steel, 0.95)} strokeWidth={2.5} />
      <rect x={-108} y={-184} width={216} height={150} rx={3} fill={c.void} />
      <rect x={-108} y={-184} width={216} height={150} rx={3} fill={alpha(th.tone.system.base, 0.1 * power)} />
      {agent > 0.001 ? <AgentGlyph x={0} y={-109} r={52} open={agent} energy={agentEnergy} spin={time + seed} threat={threat} /> : null}
      <Check x={0} y={-250} r={30} p={check} />
    </g>
  );
};

/** Tower: 150 x 300 at s = 1, with a front grille and a status strip. */
export const Tower: React.FC<MachineProps> = ({x, y, s = 1, power = 1, time = 0, agent = 0, agentEnergy = 1, threat = 0, check = 0, seed = 0, dim = 0}) => {
  const th = useTheme();
  const c = th.color;
  const mind = th.tone.mind;
  let grille = '';
  for (let i = 0; i < 9; i++) grille += `M-50 ${-250 + i * 14}h100v4h-100z`;
  return (
    <g transform={`translate(${f2(x)} ${f2(y)}) scale(${f2(s)})`} opacity={1 - dim * 0.75}>
      <rect x={-75} y={-300} width={150} height={300} rx={8} fill={c.slate} stroke={alpha(c.steel, 0.95)} strokeWidth={2.5} />
      <path d={grille} fill={alpha(c.abyss, 0.9)} />
      <rect x={-55} y={-110} width={110} height={86} rx={4} fill={c.void} stroke={alpha(agent > 0 ? mind.base : c.steel, 0.6)} strokeWidth={2} />
      {agent > 0.001 ? <AgentGlyph x={0} y={-67} r={36} open={agent} energy={agentEnergy} spin={time + seed} threat={threat} /> : null}
      <rect x={45} y={-290} width={14} height={4} fill={th.tone.system.base} opacity={power * blink(seed, time, 1, 0.6)} />
      <Check x={0} y={-350} r={30} p={check} />
    </g>
  );
};

/** GPU box: 300 x 170 at s = 1, two fans and a window. */
export const GpuBox: React.FC<MachineProps> = ({x, y, s = 1, power = 1, time = 0, agent = 0, agentEnergy = 1, threat = 0, check = 0, seed = 0, dim = 0}) => {
  const th = useTheme();
  const c = th.color;
  const mind = th.tone.mind;
  const fan = (cx: number) => {
    const a = time * 3 + seed;
    const blades = Array.from({length: 5}, (_, i) => {
      const t = a + (i / 5) * Math.PI * 2;
      return `M${cx} -85L${f2(cx + Math.cos(t) * 34)} ${f2(-85 + Math.sin(t) * 34)}`;
    }).join('');
    return (
      <g>
        <circle cx={cx} cy={-85} r={40} fill={c.abyss} stroke={alpha(c.steel, 0.9)} strokeWidth={2} />
        <path d={blades} stroke={alpha(c.steel, 0.9)} strokeWidth={6} strokeLinecap="round" opacity={0.6 + 0.4 * power} />
      </g>
    );
  };
  return (
    <g transform={`translate(${f2(x)} ${f2(y)}) scale(${f2(s)})`} opacity={1 - dim * 0.75}>
      <rect x={-150} y={-170} width={300} height={170} rx={8} fill={c.slate} stroke={alpha(c.steel, 0.95)} strokeWidth={2.5} />
      {fan(-90)}
      <rect x={-30} y={-140} width={120} height={110} rx={4} fill={c.void} stroke={alpha(agent > 0 ? mind.base : c.steel, 0.6)} strokeWidth={2} />
      {agent > 0.001 ? <AgentGlyph x={30} y={-85} r={44} open={agent} energy={agentEnergy} spin={time + seed} threat={threat} /> : null}
      <rect x={110} y={-150} width={22} height={4} fill={th.tone.system.base} opacity={power * blink(seed + 3, time, 1.3, 0.6)} />
      <Check x={0} y={-220} r={30} p={check} />
    </g>
  );
};
