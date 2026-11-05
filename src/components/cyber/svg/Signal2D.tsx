import React from 'react';
import {alpha, cyber} from '../../../styles/cyber';
import type {Curve2} from './curve';

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/** CSS `filter` value for a neon glow around an SVG/HTML element. Use sparingly. */
export const glow = (color: string, radius: number = cyber.glow2d.base, strength = 0.9): string =>
  `drop-shadow(0 0 ${radius}px ${alpha(color, strength)})`;

/**
 * A line that draws on along a Curve2 (SVG; place inside an <svg>).
 * `from`/`to` are fractions of the curve: animate `to` for a draw-on,
 * `from` for a retract, both for a travelling dash.
 */
export const Trace: React.FC<{
  readonly curve: Curve2;
  readonly from?: number;
  readonly to?: number;
  readonly color?: string;
  readonly width?: number;
  readonly opacity?: number;
  /** Adds a wide, faint underlay stroke (cheap glow without a filter). */
  readonly halo?: number;
  readonly cap?: 'butt' | 'round';
}> = ({curve, from = 0, to = 1, color = cyber.color.blue, width = cyber.line.thin, opacity = 1, halo = 0, cap = 'round'}) => {
  const d = curve.slice(from, to);
  if (!d || opacity <= 0.001) return null;
  return (
    <g opacity={opacity} fill="none" strokeLinecap={cap} strokeLinejoin="round">
      {halo > 0 ? <path d={d} stroke={color} strokeWidth={width + halo} opacity={0.16} /> : null}
      <path d={d} stroke={color} strokeWidth={width} />
    </g>
  );
};

/**
 * The 2D comet: white-hot head, tapered coloured tail, constant speed along
 * a Curve2.
 *
 * `t` is the progress of the whole pass, 0..1: the head reaches the end of
 * the curve at t = L / (L + tail) and by t = 1 the tail has drained into the
 * target, so a finished comet leaves nothing behind. With `persist` the head
 * stays at the end.
 */
export const Comet2D: React.FC<{
  readonly curve: Curve2;
  readonly t: number;
  /** Tail length in px. */
  readonly tail?: number;
  readonly color?: string;
  readonly width?: number;
  readonly persist?: boolean;
  readonly opacity?: number;
}> = ({curve, t: pass, tail = 180, color = cyber.color.purple, width = 4, persist = false, opacity = 1}) => {
  const tailT = tail / Math.max(1, curve.length);
  // Head position along the curve; runs past 1 so the tail can drain.
  const t = pass * (1 + tailT);
  if (t <= 0 || (t >= 1 + tailT && !persist)) return null;
  const head = curve.pointAt(clamp01(t));
  const showHead = t < 1 || persist;
  const pieces = [
    {len: 1, w: 0.4, o: 0.28},
    {len: 0.6, w: 0.7, o: 0.55},
    {len: 0.28, w: 1, o: 1},
  ];
  return (
    <g opacity={opacity} fill="none" strokeLinecap="round" strokeLinejoin="round">
      {pieces.map((p, i) => {
        const d = curve.slice(t - tailT * p.len, t);
        return d ? <path key={i} d={d} stroke={color} strokeWidth={width * p.w} opacity={p.o} /> : null;
      })}
      {showHead ? (
        <>
          <circle cx={head.x} cy={head.y} r={width * 3.2} fill={alpha(color, 0.28)} />
          <circle cx={head.x} cy={head.y} r={width * 1.7} fill={alpha(color, 0.7)} />
          <circle cx={head.x} cy={head.y} r={width * 0.95} fill={cyber.color.white} />
        </>
      ) : null}
    </g>
  );
};

/** A 2D network node (SVG): dot, optional ring, brightness from `level`. */
export const Node2D: React.FC<{
  readonly x: number;
  readonly y: number;
  readonly r?: number;
  readonly color?: string;
  /** 0 = unlit structure, 1 = lit, up to 2 = flaring. */
  readonly level?: number;
  readonly ring?: boolean;
  readonly appear?: number;
}> = ({x, y, r = 9, color = cyber.color.blue, level = 1, ring = false, appear = 1}) => {
  if (appear <= 0.001) return null;
  const lit = clamp01(level);
  const flare = clamp01(level - 1);
  return (
    <g transform={`translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${appear.toFixed(4)})`}>
      {lit > 0.02 ? <circle r={r * (2.6 + flare * 1.6)} fill={alpha(color, 0.12 * lit + 0.16 * flare)} /> : null}
      {ring ? <circle r={r * 1.9} fill="none" stroke={lit > 0.5 ? color : cyber.color.steel} strokeWidth={cyber.line.hair} opacity={0.4 + 0.5 * lit} /> : null}
      <circle r={r} fill={lit > 0.02 ? color : cyber.color.steel} opacity={0.35 + 0.65 * lit} />
      {flare > 0 || lit > 0.7 ? <circle r={r * 0.42} fill={cyber.color.white} opacity={0.5 * lit + 0.5 * flare} /> : null}
    </g>
  );
};
