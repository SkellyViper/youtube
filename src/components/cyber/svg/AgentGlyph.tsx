import React from 'react';
import {alpha, mix} from '../../../styles/cyber';
import {useTheme} from '../../../styles/ThemeContext';
import {agentPalette} from '../../../styles/themes';

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const smooth = (t: number) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

const arc = (r: number, a0: number, a1: number): string => {
  const x0 = Math.cos(a0) * r;
  const y0 = Math.sin(a0) * r;
  const x1 = Math.cos(a1) * r;
  const y1 = Math.sin(a1) * r;
  const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r.toFixed(2)} ${r.toFixed(2)} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
};

const RINGS = [
  {r: 0.56, w: 0.05, arcs: 3, sweep: 1.62, rate: 0.11, level: 1},
  {r: 0.78, w: 0.034, arcs: 2, sweep: 2.55, rate: -0.07, level: 0.8},
  {r: 1.0, w: 0.022, arcs: 4, sweep: 0.98, rate: 0.045, level: 0.55},
] as const;

/**
 * The 2D form of the agent (flat "iris"): the same three broken rings and
 * hot core as AgentCore3D, seen head-on. Use it in diagrams so the agent is
 * the same character in 2D and 3D. Place inside an <svg>.
 *
 *   open 0..1 assembles it, energy 0..1.6 is brightness, spin is seconds of
 *   motion, threat 0..1 turns it red and scatters the rings, calm 0..1 is
 *   the blue idle tint.
 */
export const AgentGlyph: React.FC<{
  readonly x: number;
  readonly y: number;
  /** Outer ring radius in px. */
  readonly r?: number;
  readonly open?: number;
  readonly energy?: number;
  readonly spin?: number;
  readonly threat?: number;
  readonly calm?: number;
  readonly halo?: boolean;
}> = ({x, y, r = 90, open = 1, energy = 1, spin = 0, threat = 0, calm = 0, halo = true}) => {
  const theme = useTheme();
  if (open <= 0.001) return null;
  const c = agentPalette(theme);
  const base = threat > 0 ? mix(c.purple, c.red, threat) : mix(c.purple, c.blue, calm);
  const hot = threat > 0 ? mix(c.purpleHot, c.redHot, threat) : mix(c.purpleHot, c.blueHot, calm);
  const haloHex = threat > 0.5 ? c.red : calm > 0.5 ? c.blue : c.purple;
  const e = Math.min(1.6, Math.max(0, energy));
  const coreOpen = smooth(open / 0.35);

  return (
    <g transform={`translate(${x.toFixed(2)} ${y.toFixed(2)})`} fill="none" strokeLinecap="butt">
      {halo ? (
        <>
          <circle r={r * 1.5} fill={alpha(haloHex, 0.05 * e * coreOpen * theme.glow)} />
          <circle r={r * 0.82} fill={alpha(haloHex, 0.09 * e * coreOpen * theme.glow)} />
          <circle r={r * 0.4} fill={alpha(haloHex, 0.2 * e * coreOpen * theme.glow)} />
        </>
      ) : null}
      {RINGS.map((ring, k) => {
        const p = smooth((open - 0.22 - k * 0.16) / 0.46);
        if (p <= 0) return null;
        const scatter = threat * (0.5 + 0.25 * k) * Math.sin(spin * (1.1 + 0.37 * k) + k * 2.1);
        const turn = spin * ring.rate * Math.PI * 2 * (1 + threat * 1.6) + k + scatter;
        const gap = (Math.PI * 2) / ring.arcs;
        const rr = r * ring.r * (0.55 + 0.45 * p);
        const d = Array.from({length: ring.arcs}, (_, i) => arc(rr, turn + i * gap, turn + i * gap + ring.sweep * p)).join('');
        return (
          <path
            key={k}
            d={d}
            stroke={k === 0 ? hot : base}
            strokeWidth={Math.max(1.25, r * ring.w)}
            opacity={p * ring.level * (0.35 + 0.65 * Math.min(e, 1.2))}
          />
        );
      })}
      {/* Faceted shell, flattened: a hexagon turning slowly. */}
      <polygon
        points={Array.from({length: 6}, (_, i) => {
          const a = (i / 6) * Math.PI * 2 - spin * 0.2;
          return `${(Math.cos(a) * r * 0.3).toFixed(2)},${(Math.sin(a) * r * 0.3).toFixed(2)}`;
        }).join(' ')}
        stroke={base}
        strokeWidth={Math.max(1.25, r * 0.016)}
        opacity={smooth((open - 0.1) / 0.4) * (0.3 + 0.5 * Math.min(e, 1.2))}
      />
      <circle r={r * 0.115 * coreOpen * (0.9 + 0.1 * e)} fill={hot} opacity={0.35 + 0.65 * Math.min(e, 1)} />
      <circle r={r * 0.06 * coreOpen} fill={c.white} opacity={Math.min(1, 0.3 + 0.7 * e)} />
    </g>
  );
};
