import React from 'react';
import {AgentGlyph} from '../cyber/svg/AgentGlyph';
import {alpha} from '../../styles/cyber';
import {useTheme} from '../../styles/ThemeContext';
import {clamp01, f2, lerp, seg} from './math';

/**
 * AgentChat: the AI coding agent's window, drawn into a portrait monitor.
 *
 * Cast:
 *   - two project tabs  a gamepad (the game project) and a cloud (a cloud
 *                       automation project). The only words are the two short
 *                       project names: the UI *is* the subject in S02.
 *   - agent avatar      the gimbal iris, so the viewer links "chat" with "agent".
 *   - message bubbles   lines of bars, never real text.
 *   - prompt bubble     John's request: it carries a thumbnail of the slime, so
 *                       its content ("make this enemy") is visible without words.
 *   - input box         where typing appears.
 *
 * Local coordinates: (0, 0) top-left of the screen, `width` x `height`.
 */

export const CHAT_TAB_H = 64;

export type ChatState = {
  /** 0 = game tab active, 1 = cloud tab active (animates the highlight). */
  readonly tab?: number;
  /** 0..1 how much of the prompt has been typed in the input box. */
  readonly typed?: number;
  /** 0..1 the prompt bubble rises into the conversation. */
  readonly posted?: number;
  /** 0..1 the posted bubble folds away (it became the capsule). */
  readonly folded?: number;
  /** 0..1 the agent writes a reply (code bars). */
  readonly reply?: number;
  /** 0..1 window closes (collapses to a line, then a dot). */
  readonly close?: number;
  /** Seconds of motion. */
  readonly time?: number;
};

const bars = (x: number, y: number, widths: readonly number[], lh: number, h = 9) =>
  widths.map((w, i) => `M${f2(x)} ${f2(y + i * lh)}h${f2(w)}v${h}h${f2(-w)}z`).join('');

/** The prompt bubble's thumbnail: the slime, in 1-colour pixels. */
const SLIME_THUMB = (() => {
  const rows = ['..x....x..', '...xxxx...', '..xxxxxx..', '.xxoxxoxx.', 'xxxxxxxxxx', 'xxxxxxxxxx', '.xxxxxxxx.'];
  let body = '';
  let eyes = '';
  rows.forEach((r, y) => {
    for (let x = 0; x < r.length; x++) {
      if (r[x] === 'x') body += `M${x} ${y}h1v1h-1z`;
      if (r[x] === 'o') eyes += `M${x} ${y}h1v1h-1z`;
    }
  });
  return {body, eyes};
})();

export const SlimeThumb: React.FC<{readonly x: number; readonly y: number; readonly size: number; readonly opacity?: number}> = ({x, y, size, opacity = 1}) => (
  <g transform={`translate(${f2(x)} ${f2(y)}) scale(${f2(size / 10)})`} opacity={opacity} shapeRendering="crispEdges">
    <path d={SLIME_THUMB.body} fill="#6EE05A" />
    <path d={SLIME_THUMB.eyes} fill="#13241A" />
  </g>
);

export const GamepadIcon: React.FC<{readonly x: number; readonly y: number; readonly s?: number; readonly color: string; readonly opacity?: number}> = ({x, y, s = 1, color, opacity = 1}) => (
  <g transform={`translate(${f2(x)} ${f2(y)}) scale(${f2(s)})`} opacity={opacity}>
    <path d="M-15 -6a7 7 0 0 1 7-5h16a7 7 0 0 1 7 5l3 10a4 4 0 0 1-7 3l-4-4h-14l-4 4a4 4 0 0 1-7-3z" fill={color} />
    <path d="M-10 -3h6M-7 -6v6" stroke="#05060a" strokeWidth={2} />
    <circle cx={7} cy={-4} r={1.6} fill="#05060a" />
    <circle cx={10.5} cy={-1} r={1.6} fill="#05060a" />
  </g>
);

export const CloudIcon: React.FC<{readonly x: number; readonly y: number; readonly s?: number; readonly color: string; readonly opacity?: number; readonly fill?: boolean}> = ({x, y, s = 1, color, opacity = 1, fill = true}) => (
  <path
    transform={`translate(${f2(x)} ${f2(y)}) scale(${f2(s)})`}
    d="M-14 8a7 7 0 0 1-1-14 10 10 0 0 1 19-3 8 8 0 0 1 11 9 6 6 0 0 1-2 8z"
    fill={fill ? color : 'none'}
    stroke={fill ? 'none' : color}
    strokeWidth={fill ? 0 : 2 / s}
    opacity={opacity}
  />
);

export const AgentChat: React.FC<{readonly width: number; readonly height: number; readonly state: ChatState}> = ({width: Wd, height: Ht, state}) => {
  const th = useTheme();
  const mind = th.tone.mind;
  const sys = th.tone.system;
  const human = th.tone.human;
  const {tab = 0, typed = 0, posted = 0, folded = 0, reply = 0, close = 0, time = 0} = state;
  const c = th.color;
  const font = th.font;

  // Close: height collapses to a line, then the line to a point.
  const cy = clamp01(close / 0.6);
  const cx = seg(close, 0.5, 1);
  const sy = 1 - cy * 0.995;
  const sxs = 1 - cx;
  if (sxs <= 0.001) return null;

  const tabW = (Wd - 24) / 2;
  const tabX = (k: number) => 12 + k * tabW;
  const hlX = lerp(tabX(0), tabX(1), clamp01(tab));
  const onCloud = tab > 0.5;
  const pad = 22;

  // History: different conversations in the two projects.
  const histA = bars(pad + 60, CHAT_TAB_H + 34, [210, 170, 236], 20);
  const histB = bars(pad + 60, CHAT_TAB_H + 34, [150, 232, 120, 190], 20);
  const replyLines = [180, 120, 206, 96, 160];
  const replyCount = Math.ceil(reply * replyLines.length - 0.001);

  // Prompt bubble: typed in the input box, then rises into the thread.
  const inputY = Ht - 92;
  const bubbleH = 104;
  const bubbleRestY = Ht - 92 - bubbleH - 28;
  const bubbleY = lerp(inputY, bubbleRestY, posted);
  const bubbleOpacity = posted > 0 ? 1 - folded : 0;
  const caretOn = Math.floor(time * 2.4) % 2 === 0;

  return (
    <g transform={`translate(${f2(Wd / 2)} ${f2(Ht / 2)}) scale(${f2(sxs)} ${f2(sy)}) translate(${f2(-Wd / 2)} ${f2(-Ht / 2)})`}>
      <rect width={Wd} height={Ht} fill={c.abyss} />
      <rect width={Wd} height={Ht} fill={alpha(mind.deep, 0.18)} />
      {/* Tabs */}
      <rect x={0} y={0} width={Wd} height={CHAT_TAB_H} fill={alpha(c.slate, 0.9)} />
      <rect x={hlX} y={10} width={tabW} height={CHAT_TAB_H - 10} rx={Math.min(th.radius, 10)} fill={c.abyss} />
      <rect x={hlX + 10} y={CHAT_TAB_H - 4} width={tabW - 20} height={4} fill={onCloud ? sys.base : human.base} />
      <GamepadIcon x={tabX(0) + 34} y={CHAT_TAB_H / 2 + 6} s={1.15} color={human.base} opacity={0.55 + 0.45 * (1 - tab)} />
      <text x={tabX(0) + 62} y={CHAT_TAB_H / 2 + 13} fontFamily={font} fontSize={22} fill={c.text} opacity={0.5 + 0.5 * (1 - tab)}>
        my-game
      </text>
      <CloudIcon x={tabX(1) + 32} y={CHAT_TAB_H / 2 + 5} s={1.1} color={sys.base} opacity={0.55 + 0.45 * tab} />
      <text x={tabX(1) + 62} y={CHAT_TAB_H / 2 + 13} fontFamily={font} fontSize={22} fill={c.text} opacity={0.5 + 0.5 * tab}>
        cloud-ops
      </text>

      {/* Thread */}
      <svg x={0} y={CHAT_TAB_H} width={Wd} height={Ht - CHAT_TAB_H} overflow="hidden">
        <g transform={`translate(0 ${-CHAT_TAB_H})`}>
          <AgentGlyph x={pad + 24} y={CHAT_TAB_H + 46} r={22} spin={time} energy={0.9} calm={onCloud ? 0.6 : 0} halo={false} />
          <path d={histA} fill={c.dim} opacity={0.55 * (1 - tab)} />
          <path d={histB} fill={c.dim} opacity={0.55 * tab} />
          {replyCount > 0 ? (
            <g>
              <rect x={pad + 52} y={CHAT_TAB_H + 118} width={Wd - pad * 2 - 52} height={replyCount * 22 + 22} rx={Math.min(th.radius, 10)} fill={alpha(mind.deep, 0.5)} />
              <path d={bars(pad + 68, CHAT_TAB_H + 132, replyLines.slice(0, replyCount), 22, 10)} fill={mind.hot} opacity={0.85} />
            </g>
          ) : null}
          {bubbleOpacity > 0.001 ? (
            <g opacity={bubbleOpacity}>
              <rect x={Wd - pad - 270} y={bubbleY} width={270} height={bubbleH} rx={Math.min(th.radius, 12)} fill={alpha(human.base, 0.16)} stroke={alpha(human.base, 0.6)} strokeWidth={1.5} />
              <rect x={Wd - pad - 256} y={bubbleY + 16} width={72} height={72} rx={4} fill="#26305E" />
              <SlimeThumb x={Wd - pad - 250} y={bubbleY + 28} size={60} />
              <path d={bars(Wd - pad - 170, bubbleY + 24, [134, 110, 140], 22, 10)} fill={c.text} opacity={0.8} />
            </g>
          ) : null}
        </g>
      </svg>

      {/* Input box */}
      <rect x={pad} y={inputY} width={Wd - pad * 2} height={64} rx={Math.min(th.radius, 12)} fill={c.slate} stroke={alpha(c.steel, 0.9)} strokeWidth={1.5} />
      {typed > 0 && posted < 0.02 ? (
        <g>
          <rect x={pad + 14} y={inputY + 13} width={38} height={38} rx={3} fill="#26305E" opacity={seg(typed, 0, 0.15)} />
          <SlimeThumb x={pad + 18} y={inputY + 20} size={30} opacity={seg(typed, 0, 0.15)} />
          <rect x={pad + 64} y={inputY + 27} width={Math.max(0, (Wd - pad * 2 - 100) * seg(typed, 0.15, 1))} height={10} fill={c.text} opacity={0.8} />
        </g>
      ) : null}
      {posted < 0.02 && close <= 0 ? (
        <rect x={pad + 66 + Math.max(0, (Wd - pad * 2 - 100) * seg(typed, 0.15, 1))} y={inputY + 20} width={3} height={24} fill={c.text} opacity={caretOn ? 0.9 : 0.15} />
      ) : null}
      {/* Close flash: the collapsing line is bright. */}
      {close > 0 ? <rect width={Wd} height={Ht} fill={c.white} opacity={0.6 * Math.sin(Math.PI * clamp01(close)) * 0.7} /> : null}
    </g>
  );
};
