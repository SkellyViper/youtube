import React from 'react';
import {Curve2, type Pt} from '../cyber/svg/curve';
import {alpha, mix} from '../../styles/cyber';
import {useTheme} from '../../styles/ThemeContext';
import {Rack} from './Machines';
import {clamp01, f2, seg} from './math';

/**
 * CloudEnvironment (2D): a row of racks in a dark hall, with a floor line and
 * an overhead cable tray. Used by S02, S03 and S10 (far away).
 *
 * Cast:
 *   - racks      the computers. One of them (`hot`) hosts the agent.
 *   - cold aisle a floor line with soft light pools: "a hall, not a void".
 *   - uplink     the point where the cable from outside enters the hall.
 *
 * (x, y) is the floor's centre line. Racks stand on it.
 */
export const RACK_GAP = 300;

export type HallState = {
  readonly time?: number;
  /** Per-rack LED power, default 1. */
  readonly power?: (i: number) => number;
  /** Per-rack agent presence 0..1. */
  readonly agent?: (i: number) => number;
  readonly threat?: (i: number) => number;
  readonly check?: (i: number) => number;
  /** 0..1 the room's own light (floor pools, tray). */
  readonly room?: number;
};

export const rackX = (i: number, count: number) => (i - (count - 1) / 2) * RACK_GAP;

export const Hall: React.FC<{readonly x: number; readonly y: number; readonly count?: number; readonly s?: number; readonly state?: HallState}> = ({x, y, count = 5, s = 1, state = {}}) => {
  const th = useTheme();
  const c = th.color;
  const {time = 0, power = () => 1, agent = () => 0, threat = () => 0, check = () => 0, room = 1} = state;
  const halfW = ((count - 1) / 2) * RACK_GAP + 240;
  return (
    <g transform={`translate(${f2(x)} ${f2(y)}) scale(${f2(s)})`}>
      {/* Back wall gradient and floor */}
      <rect x={-halfW - 200} y={-900} width={halfW * 2 + 400} height={900} fill={alpha(c.abyss, 0.9 * room)} />
      <rect x={-halfW - 200} y={0} width={halfW * 2 + 400} height={500} fill={mix(c.void, c.slate, 0.25 * room)} />
      <line x1={-halfW - 200} y1={0} x2={halfW + 200} y2={0} stroke={alpha(c.steel, 0.9)} strokeWidth={3} />
      {/* Floor light pools under each rack */}
      {Array.from({length: count}, (_, i) => (
        <ellipse key={i} cx={rackX(i, count)} cy={20} rx={170} ry={38} fill={alpha(mix(th.tone.system.base, th.tone.mind.base, agent(i)), 0.1 * power(i) * (0.5 + 0.5 * room))} />
      ))}
      {/* Overhead cable tray */}
      <rect x={-halfW - 120} y={-690} width={halfW * 2 + 240} height={16} fill={alpha(c.steel, 0.5 * room)} />
      {Array.from({length: count}, (_, i) => (
        <rect key={i} x={rackX(i, count) - 6} y={-674} width={12} height={74} fill={alpha(c.steel, 0.5 * room)} />
      ))}
      {Array.from({length: count}, (_, i) => (
        <Rack key={i} x={rackX(i, count)} y={0} power={power(i)} time={time} agent={agent(i)} threat={threat(i)} check={check(i)} seed={i * 1.37 + 2} />
      ))}
    </g>
  );
};

/* ------------------------------------------------------------------ cables & signals */

/**
 * NetworkConnection (2D): a cable drawn as a dark conduit with a lit core. It
 * can draw on (`draw`), carry a travelling packet (`packet` 0..1) and stay
 * lit behind the packet (`lit` 0..1 of its length).
 */
export const Cable: React.FC<{
  readonly curve: Curve2;
  readonly draw?: number;
  readonly lit?: number;
  readonly color: string;
  readonly width?: number;
  readonly conduit?: boolean;
  readonly opacity?: number;
  readonly glow?: number;
}> = ({curve, draw = 1, lit = 0, color, width = 4, conduit = true, opacity = 1, glow = 1}) => {
  const th = useTheme();
  if (draw <= 0.001) return null;
  const d = curve.slice(0, clamp01(draw));
  const litD = lit > 0.001 ? curve.slice(0, clamp01(Math.min(lit, draw))) : null;
  return (
    <g fill="none" strokeLinecap="round" opacity={opacity}>
      {conduit ? <path d={d} stroke={th.color.steel} strokeWidth={width * 2.6} opacity={0.55} /> : null}
      <path d={d} stroke={alpha(color, 0.35)} strokeWidth={width} />
      {litD ? (
        <>
          <path d={litD} stroke={color} strokeWidth={width * 3.2} opacity={0.18 * glow * th.glow} />
          <path d={litD} stroke={color} strokeWidth={width} />
        </>
      ) : null}
    </g>
  );
};

/** A packet travelling a cable: a hot head and a tapering tail. */
export const Packet: React.FC<{readonly curve: Curve2; readonly t: number; readonly color: string; readonly tail?: number; readonly size?: number; readonly children?: (p: Pt, angle: number) => React.ReactNode}> = ({
  curve,
  t,
  color,
  tail = 0.12,
  size = 7,
  children,
}) => {
  const th = useTheme();
  if (t <= 0 || t >= 1 + tail) return null;
  const head = clamp01(t);
  const p = curve.pointAt(head);
  const angle = (curve.angleAt(head) * 180) / Math.PI;
  const t0 = Math.max(0, t - tail);
  return (
    <g>
      {head > t0 ? <path d={curve.slice(t0, head)} fill="none" stroke={color} strokeWidth={size * 1.6} strokeLinecap="round" opacity={0.55 * seg(1 + tail - t, 0, tail)} /> : null}
      {t <= 1 ? (
        <>
          <circle cx={p.x} cy={p.y} r={size * 2.6} fill={alpha(color, 0.25 * th.glow)} />
          <circle cx={p.x} cy={p.y} r={size} fill={th.color.white} />
        </>
      ) : null}
      {children && t <= 1 ? children(p, angle) : null}
    </g>
  );
};
