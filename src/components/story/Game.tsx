import React from 'react';
import {clamp01, f2, lerp, seg} from './math';

/**
 * GameView: the indie game John is building, drawn as crisp pixel art.
 *
 * Cast:
 *   - knight   the player character. Tells the viewer "this is a game" at a glance.
 *   - slime    the new ENEMY John is designing. It can squash and split in two
 *              (the "multiplies" mechanic), which quietly foreshadows replication.
 *   - ground, platform, hills, sky: a recognisable side-scroller level.
 *   - pending  an empty dashed slot where an enemy should appear (S02: the
 *              request never reached the game).
 *
 * The game keeps its own warm, friendly palette in every theme: it is the
 * developer's world, deliberately unlike the cold world of the agent.
 *
 * Coordinates: drawn in a 192 x 108 pixel grid, scaled to `width` x `height`.
 */

export const GW = 192;
export const GH = 108;
export const GROUND = 86;

export type Sprite = {readonly rows: readonly string[]; readonly palette: Readonly<Record<string, string>>};

// 12 x 10 slime with two little horns: unmistakably an enemy.
export const SLIME: Sprite = {
  rows: [
    '..h......h..',
    '..hh....hh..',
    '...GGGGGG...',
    '..GGGGGGGG..',
    '.GGWWGGWWGG.',
    'GGGWKGGWKGGG',
    'GGGGGGGGGGGG',
    'GGGGMMMMGGGG',
    'gGGGGGGGGGGg',
    '.gggggggggg.',
  ],
  palette: {G: '#6EE05A', g: '#2F9A3A', W: '#FFFFFF', K: '#13241A', M: '#1B5E2A', h: '#F2E7C9'},
};

// 9 x 13 knight with a red plume and a sword.
export const KNIGHT: Sprite = {
  rows: [
    '...RR....',
    '..RRR....',
    '..SSSS...',
    '.SSSSSS..',
    '.SDSSDS..',
    '.SSSSSS..',
    '..BBBB..L',
    '.BBBBBB.L',
    'SBBYYBBSL',
    '.BBBBBB.H',
    '..BB.BB..',
    '..BB.BB..',
    '.KK...KK.',
  ],
  palette: {R: '#E5484D', S: '#C9D2DE', D: '#273041', B: '#3E6FD8', Y: '#F5C84B', L: '#E8EEF6', H: '#8A5A2B', K: '#3A2A20'},
};

const spritePaths = (s: Sprite) => {
  const byColor: Record<string, string> = {};
  s.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      byColor[ch] = (byColor[ch] ?? '') + `M${x} ${y}h1v1h-1z`;
    }
  });
  return Object.entries(byColor).map(([k, d]) => ({fill: s.palette[k], d}));
};
const SLIME_PATHS = spritePaths(SLIME);
const KNIGHT_PATHS = spritePaths(KNIGHT);

const SpriteG: React.FC<{readonly paths: {fill: string; d: string}[]; readonly w: number; readonly h: number; readonly x: number; readonly y: number; readonly sx?: number; readonly sy?: number; readonly flip?: boolean; readonly opacity?: number}> = ({
  paths,
  w,
  h,
  x,
  y,
  sx = 1,
  sy = 1,
  flip = false,
  opacity = 1,
}) => (
  // (x, y) is the bottom-centre of the sprite: squash and stretch stay grounded.
  <g transform={`translate(${f2(x)} ${f2(y)}) scale(${f2(sx * (flip ? -1 : 1))} ${f2(sy)}) translate(${f2(-w / 2)} ${-h})`} opacity={opacity}>
    {paths.map((p, i) => (
      <path key={i} d={p.d} fill={p.fill} />
    ))}
  </g>
);

/** Ground tiles, platform, hills: one static path per colour. */
const LEVEL = (() => {
  let grass = '';
  let dirt = '';
  let dirtDark = '';
  for (let x = 0; x < GW; x += 8) {
    grass += `M${x} ${GROUND}h8v2h-8z`;
    dirt += `M${x} ${GROUND + 2}h8v${GH - GROUND - 2}h-8z`;
    dirtDark += `M${x + 2} ${GROUND + 6}h2v2h-2zM${x + 6} ${GROUND + 12}h2v2h-2zM${x + 1} ${GROUND + 17}h2v1h-2z`;
  }
  // A floating brick platform.
  let brick = '';
  for (let x = 128; x < 168; x += 8) brick += `M${x} 58h7v5h-7z`;
  // Pixel hills in the distance.
  let hills = '';
  const hill = (cx: number, w: number, hgt: number) => {
    for (let i = 0; i < w; i++) {
      const t = i / (w - 1);
      const y = Math.round(hgt * Math.sin(Math.PI * t));
      hills += `M${cx - w / 2 + i} ${GROUND - y}h1v${y}h-1z`;
    }
  };
  hill(30, 60, 22);
  hill(100, 80, 30);
  hill(170, 56, 18);
  // Clouds.
  const cloud = (x: number, y: number) => `M${x} ${y}h14v3h-14zM${x + 3} ${y - 3}h7v3h-7zM${x - 3} ${y + 3}h20v2h-20z`;
  const clouds = cloud(20, 18) + cloud(118, 12) + cloud(160, 26);
  return {grass, dirt, dirtDark, brick, hills, clouds};
})();

export type SlimeCopy = {
  /** Ground x in game pixels. */
  readonly x: number;
  /** Height above the ground in game pixels (jumps). */
  readonly lift?: number;
  readonly squash?: number;
  readonly flip?: boolean;
  readonly opacity?: number;
};

export const GameView: React.FC<{
  readonly width: number;
  readonly height: number;
  /** Seconds of motion (walk cycle, idle bob). */
  readonly time?: number;
  /** Knight ground position (game px). */
  readonly knightX?: number;
  /** The slimes on screen. Empty = none. */
  readonly slimes?: readonly SlimeCopy[];
  /** 0..1: an empty dashed enemy slot (the request that never arrived). */
  readonly pending?: number;
  readonly pendingX?: number;
  /** 0..1 screen brightness (0 = off). */
  readonly power?: number;
}> = ({width, height, time = 0, knightX = 44, slimes = [], pending = 0, pendingX = 120, power = 1}) => {
  const s = Math.min(width / GW, height / GH);
  const step = Math.floor(time * 6) % 2;
  return (
    <g>
      <defs>
        <linearGradient id="game-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2B3A7A" />
          <stop offset="0.55" stopColor="#6A5AB0" />
          <stop offset="1" stopColor="#F29A6B" />
        </linearGradient>
      </defs>
      <g transform={`scale(${s.toFixed(5)})`} shapeRendering="crispEdges">
        <rect width={GW} height={GH} fill="url(#game-sky)" />
        <path d={LEVEL.clouds} fill="#F4E6F0" opacity={0.85} />
        <path d={LEVEL.hills} fill="#3C3F86" />
        <path d={LEVEL.dirt} fill="#8A5A3A" />
        <path d={LEVEL.dirtDark} fill="#6B4129" />
        <path d={LEVEL.grass} fill="#58C45A" />
        <path d={LEVEL.brick} fill="#C9764A" />
        <SpriteG paths={KNIGHT_PATHS} w={9} h={13} x={knightX} y={GROUND + (step ? 0 : -0.5)} />
        {pending > 0.001 ? (
          <g opacity={pending}>
            <rect x={pendingX - 7} y={GROUND - 12} width={14} height={12} fill="none" stroke="#FFFFFF" strokeWidth={0.5} strokeDasharray="1.5 1.5" opacity={0.75} />
            <path d={`M${pendingX - 1.5} ${GROUND - 9}h3v1h-3zM${pendingX + 0.5} ${GROUND - 8}h1v2h-1zM${pendingX - 0.5} ${GROUND - 6}h1v1h-1zM${pendingX - 0.5} ${GROUND - 4}h1v1h-1z`} fill="#FFFFFF" opacity={0.85} />
          </g>
        ) : null}
        {slimes.map((sl, i) => {
          const sq = sl.squash ?? 0;
          return (
            <g key={i}>
              {/* Shadow shrinks as the slime rises. */}
              <ellipse cx={sl.x} cy={GROUND + 0.5} rx={5 * (1 - clamp01((sl.lift ?? 0) / 30) * 0.6)} ry={1} fill="#000" opacity={0.25 * (sl.opacity ?? 1)} />
              <SpriteG paths={SLIME_PATHS} w={12} h={10} x={sl.x} y={GROUND - (sl.lift ?? 0)} sx={1 + sq * 0.35} sy={1 - sq * 0.3} flip={sl.flip} opacity={sl.opacity} />
            </g>
          );
        })}
      </g>
      {/* Screen power: off = black glass. */}
      {power < 1 ? <rect width={width} height={height} fill="#020203" opacity={1 - clamp01(power)} /> : null}
    </g>
  );
};

/**
 * The slime's split, as a pure function of progress (0..1):
 * 0-0.35 anticipation (squash down), 0.35-0.75 two copies leap apart,
 * 0.75-1 landing squash and settle. Returns the slimes to draw.
 */
export const slimeSplit = (p: number, x = 120, spread = 18, idle = 0): SlimeCopy[] => {
  const crouch = seg(p, 0, 0.35);
  const leap = seg(p, 0.35, 0.78);
  const land = seg(p, 0.75, 1);
  const bob = Math.abs(Math.sin(idle * 3.2)) * 3;
  if (p <= 0) return [{x, lift: bob, squash: 0}];
  if (leap <= 0) return [{x, squash: Math.sin(crouch * Math.PI * 0.5) * 0.9}];
  const arc = Math.sin(leap * Math.PI) * 14;
  const squash = land > 0 ? Math.sin(land * Math.PI) * 0.6 : -0.25 * Math.sin(leap * Math.PI);
  return [
    {x: lerp(x, x - spread, leap), lift: arc, squash, flip: true},
    {x: lerp(x, x + spread, leap), lift: arc, squash},
  ];
};
