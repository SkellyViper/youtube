import React, {useMemo} from 'react';
import {createRandom} from '../random';
import {alpha, mix} from '../../styles/cyber';
import {useTheme} from '../../styles/ThemeContext';
import {Hall} from './DataCenter';
import {blink, clamp01, f2} from './math';

/**
 * The night outside John's window (S10): a city skyline in silhouette, a few
 * lit windows, and on the far horizon a small data centre. Nothing here moves
 * except the data centre's signal lights.
 *
 * Cast:
 *   - skyline   "the rest of the world, asleep".
 *   - far hall  the same hall the capsule reached in S02, seen from John's
 *               window. `signals` (0..2) is how many of its bays show the agent.
 *
 * Coordinates: (x, y) is the horizon's centre; the skyline spreads `width`.
 */
export const NightCity: React.FC<{readonly x: number; readonly y: number; readonly width: number; readonly time?: number; readonly signals?: number; readonly hallX?: number; readonly hallScale?: number}> = ({
  x,
  y,
  width,
  time = 0,
  signals = 0,
  hallX = 760,
  hallScale = 0.16,
}) => {
  const th = useTheme();
  const c = th.color;
  const city = useMemo(() => {
    const rnd = createRandom(1010);
    const buildings: {x: number; w: number; h: number; windows: {x: number; y: number}[]}[] = [];
    let cx = -width / 2;
    while (cx < width / 2) {
      const w = rnd.range(60, 170);
      // A gap in the skyline around the far hall, so the horizon (and the hall) shows through.
      const nearHall = Math.abs(cx + w / 2 - hallX) < 420;
      const h = (nearHall ? rnd.range(10, 26) : rnd.range(60, 420)) * (1 - 0.5 * Math.abs(cx / (width / 2)));
      const windows: {x: number; y: number}[] = [];
      for (let wy = 24; wy < h - 10; wy += 34) for (let wx = 14; wx < w - 10; wx += 26) if (rnd.next() < 0.09) windows.push({x: cx + wx, y: -wy});
      buildings.push({x: cx, w, h, windows});
      cx += w + rnd.range(6, 40);
    }
    return buildings;
  }, [width, hallX]);
  const sky = `M${f2(x - width)} ${f2(y - 2000)}h${f2(width * 2)}v2000h${f2(-width * 2)}z`;
  const sil = city.map((b) => `M${f2(x + b.x)} ${f2(y)}v${f2(-b.h)}h${f2(b.w)}v${f2(b.h)}z`).join('');
  const win = city.flatMap((b) => b.windows.map((w) => `M${f2(x + w.x)} ${f2(y + w.y)}h10v8h-10z`)).join('');
  const s1 = clamp01(signals);
  const s2 = clamp01(signals - 1);
  return (
    <g>
      <defs>
        <linearGradient id="night-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.void} />
          <stop offset="0.75" stopColor={mix(c.void, c.haze, 0.35)} />
          <stop offset="1" stopColor={mix(c.void, c.haze, 0.6)} />
        </linearGradient>
      </defs>
      <path d={sky} fill="url(#night-sky)" />
      {/* Horizon glow */}
      <rect x={x - width} y={y - 140} width={width * 2} height={140} fill={alpha(c.haze, 0.25)} />
      {/* The far data centre sits on the horizon, behind the skyline's lowest part. */}
      <Hall
        x={x + hallX}
        y={y + 6}
        s={hallScale}
        count={5}
        state={{
          time,
          room: 0.5,
          power: (i) => (i === 2 ? 0.6 + 0.4 * s1 : i === 3 ? 0.3 + 0.6 * s2 : 0.25),
          agent: (i) => (i === 2 ? s1 : i === 3 ? s2 : 0),
          threat: () => 0.25,
        }}
      />
      {/* Its two signal lights, visible from here as blinking points. */}
      {s1 > 0 ? <circle cx={x + hallX} cy={y - 60 * hallScale * 6} r={9} fill={th.tone.mind.base} opacity={s1 * (0.5 + 0.5 * blink(3, time, 0.7, 0.5))} /> : null}
      {s2 > 0 ? <circle cx={x + hallX + 300 * hallScale} cy={y - 60 * hallScale * 6} r={9} fill={th.tone.mind.base} opacity={s2 * (0.5 + 0.5 * blink(9, time + 0.4, 0.6, 0.5))} /> : null}
      <path d={sil} fill={mix(c.void, c.slate, 0.35)} />
      <path d={win} fill={alpha(th.tone.human.base, 0.35)} />
      <rect x={x - width} y={y} width={width * 2} height={3000} fill={c.void} />
    </g>
  );
};
