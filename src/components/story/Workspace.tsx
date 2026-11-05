import React from 'react';
import {alpha, mix} from '../../styles/cyber';
import {useTheme} from '../../styles/ThemeContext';
import {AgentChat, type ChatState} from './Chat';
import {GameView, type SlimeCopy} from './Game';
import {clamp01, f2, lerp} from './math';

/**
 * DeveloperWorkspace: John's desk, in world units. Used by S01, S02, S03 and
 * S10 with the same coordinates, so the camera can return to the same place.
 *
 * Cast:
 *   - game monitor  (landscape, left)  shows the game. Warm light.
 *   - agent monitor (portrait, right)  shows the coding agent's chat. Cool light.
 *   - John          a hooded figure from behind, lit only by his screens. He is
 *                   the person; the viewer never needs his face.
 *   - desk, keyboard, mouse, mug, lamp pool: enough for "a room, late".
 *   - window        behind the desk, a night sky. S10 leaves through it.
 *
 * World origin: the centre of the game monitor's screen is (0, 0).
 */

export const GAME_SCREEN = {x: -560, y: -300, w: 1120, h: 630};
export const AGENT_SCREEN = {x: 700, y: -430, w: 560, h: 780};
export const DESK_Y = 420;
export const WINDOW = {x: -1700, y: -1250, w: 3400, h: 760};

export type WorkspaceState = {
  readonly time?: number;
  readonly game: {
    readonly knightX?: number;
    readonly slimes?: readonly SlimeCopy[];
    readonly pending?: number;
    readonly pendingX?: number;
    readonly power?: number;
  };
  readonly chat: ChatState;
  /** 0..1 brightness of the agent monitor. */
  readonly agentPower?: number;
  /** 0..1 how much John is typing (hands move). */
  readonly typing?: number;
  /** 0..1 overall room light (0 = only the screens). */
  readonly room?: number;
  /** 0..1 how open the window to the night is (S10). */
  readonly night?: number;
  /** Children drawn inside the window (the far city). */
  readonly beyond?: React.ReactNode;
};

export const Workspace: React.FC<{readonly state: WorkspaceState}> = ({state}) => {
  const th = useTheme();
  const c = th.color;
  const human = th.tone.human;
  const mind = th.tone.mind;
  const {time = 0, game, chat, agentPower = 1, typing = 0, room = 1, night = 0, beyond} = state;
  const gamePower = game.power ?? 1;
  const warm = alpha(human.base, 0.5 * gamePower);
  const cool = alpha(mind.base, 0.45 * agentPower);
  const G = GAME_SCREEN;
  const A = AGENT_SCREEN;
  const hand = Math.sin(time * 9) * 6 * typing;

  return (
    <g>
      <defs>
        <radialGradient id="ws-warm" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor={warm} />
          <stop offset="1" stopColor={alpha(human.base, 0)} />
        </radialGradient>
        <radialGradient id="ws-cool" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor={cool} />
          <stop offset="1" stopColor={alpha(mind.base, 0)} />
        </radialGradient>
        <linearGradient id="ws-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.void} />
          <stop offset="1" stopColor={mix(c.void, c.slate, 0.55 * room)} />
        </linearGradient>
        <clipPath id="ws-window">
          <rect x={WINDOW.x} y={WINDOW.y} width={WINDOW.w} height={WINDOW.h} />
        </clipPath>
      </defs>

      {/* Wall and window */}
      <rect x={-5000} y={-4000} width={10000} height={4000 + DESK_Y} fill="url(#ws-wall)" />
      <g clipPath="url(#ws-window)">
        <rect x={WINDOW.x} y={WINDOW.y} width={WINDOW.w} height={WINDOW.h} fill={mix(c.void, c.abyss, 0.6)} />
        {beyond}
      </g>
      <rect x={WINDOW.x} y={WINDOW.y} width={WINDOW.w} height={WINDOW.h} fill="none" stroke={alpha(c.steel, 0.9 * (0.4 + 0.6 * room) * (1 - night * 0.6))} strokeWidth={14} />
      <line x1={0} y1={WINDOW.y} x2={0} y2={WINDOW.y + WINDOW.h} stroke={alpha(c.steel, 0.9 * (0.4 + 0.6 * room) * (1 - night * 0.6))} strokeWidth={10} />

      {/* Screen light on the wall */}
      <ellipse cx={G.x + G.w / 2} cy={G.y + G.h / 2} rx={G.w * 1.1} ry={G.h * 1.1} fill="url(#ws-warm)" opacity={0.85} />
      <ellipse cx={A.x + A.w / 2} cy={A.y + A.h / 2} rx={A.w * 1.4} ry={A.h * 0.9} fill="url(#ws-cool)" opacity={0.85} />

      {/* Desk */}
      <rect x={-1500} y={DESK_Y} width={3000} height={90} fill={mix(c.slate, c.abyss, 0.3)} />
      <rect x={-1500} y={DESK_Y} width={3000} height={8} fill={alpha(c.steel, 0.8)} />
      <rect x={-1500} y={DESK_Y + 90} width={3000} height={2000} fill={c.void} />
      {/* Light pools on the desk */}
      <ellipse cx={G.x + G.w / 2} cy={DESK_Y + 20} rx={G.w * 0.7} ry={60} fill={alpha(human.base, 0.18 * gamePower)} />
      <ellipse cx={A.x + A.w / 2} cy={DESK_Y + 20} rx={A.w * 0.9} ry={50} fill={alpha(mind.base, 0.16 * agentPower)} />

      {/* Game monitor */}
      <rect x={G.x + G.w / 2 - 60} y={G.y + G.h + 24} width={120} height={DESK_Y - (G.y + G.h) - 24} fill={c.slate} />
      <rect x={G.x + G.w / 2 - 170} y={DESK_Y - 14} width={340} height={14} rx={4} fill={c.steel} />
      <rect x={G.x - 24} y={G.y - 24} width={G.w + 48} height={G.h + 48} rx={10} fill={c.slate} stroke={alpha(c.steel, 0.9)} strokeWidth={3} />
      <svg x={G.x} y={G.y} width={G.w} height={G.h} overflow="hidden">
        <GameView width={G.w} height={G.h} time={time} knightX={game.knightX} slimes={game.slimes} pending={game.pending} pendingX={game.pendingX} power={gamePower} />
      </svg>

      {/* Agent monitor (portrait) */}
      <rect x={A.x + A.w / 2 - 40} y={A.y + A.h + 24} width={80} height={DESK_Y - (A.y + A.h) - 24} fill={c.slate} />
      <rect x={A.x + A.w / 2 - 120} y={DESK_Y - 14} width={240} height={14} rx={4} fill={c.steel} />
      <rect x={A.x - 22} y={A.y - 22} width={A.w + 44} height={A.h + 44} rx={10} fill={c.slate} stroke={alpha(c.steel, 0.9)} strokeWidth={3} />
      <svg x={A.x} y={A.y} width={A.w} height={A.h} overflow="hidden">
        <rect width={A.w} height={A.h} fill={c.void} />
        <g opacity={agentPower}>
          <AgentChat width={A.w} height={A.h} state={{...chat, time}} />
        </g>
      </svg>

      {/* Keyboard, mouse, mug */}
      <rect x={-330} y={DESK_Y - 22} width={620} height={30} rx={6} fill={c.steel} />
      <rect x={-316} y={DESK_Y - 16} width={592} height={6} fill={alpha(c.abyss, 0.8)} />
      <ellipse cx={420} cy={DESK_Y - 8} rx={34} ry={22} fill={c.steel} />
      <g transform="translate(-620 0)">
        <rect x={-50} y={DESK_Y - 120} width={100} height={120} rx={10} fill={mix(c.slate, human.base, 0.15)} />
        <path d={`M50 ${DESK_Y - 95}a30 30 0 0 1 0 60`} fill="none" stroke={mix(c.slate, human.base, 0.15)} strokeWidth={14} />
      </g>

      {/* John: hood, shoulders, arms to the keyboard. Seen from behind, lit by screens. */}
      <g transform={`translate(0 ${DESK_Y + 40})`}>
        <path d="M-330 540 C-330 260 -220 150 0 150 C220 150 330 260 330 540Z" fill={mix(c.void, c.slate, 0.7)} />
        <path d="M-120 170 C-120 40 -80 -30 0 -30 C80 -30 120 40 120 170 Z" fill={mix(c.void, c.slate, 0.8)} />
        {/* Rim light from each screen */}
        <path d="M-120 170 C-120 40 -80 -30 0 -30 C-20 20 -40 60 -60 160Z" fill={alpha(human.base, 0.25 * gamePower)} />
        <path d="M120 170 C120 40 80 -30 0 -30 C20 20 40 60 60 160Z" fill={alpha(mind.base, 0.3 * agentPower)} />
        <path d="M-330 540 C-330 260 -220 150 0 150 C-80 180 -150 260 -200 540Z" fill={alpha(human.base, 0.14 * gamePower)} />
        <path d="M330 540 C330 260 220 150 0 150 C80 180 150 260 200 540Z" fill={alpha(mind.base, 0.16 * agentPower)} />
        {/* Arms */}
        <path d={`M-220 300 C-240 200 -170 60 -120 ${-50 + hand}`} fill="none" stroke={mix(c.void, c.slate, 0.75)} strokeWidth={70} strokeLinecap="round" />
        <path d={`M220 300 C240 200 170 60 120 ${-50 - hand}`} fill="none" stroke={mix(c.void, c.slate, 0.75)} strokeWidth={70} strokeLinecap="round" />
      </g>
    </g>
  );
};

/** The capsule a prompt becomes when sent: a glowing pill with the request's thumbnail. */
export const PromptCapsule: React.FC<{readonly x: number; readonly y: number; readonly s?: number; readonly angle?: number; readonly open?: number; readonly tone?: 'human' | 'mind' | 'threat'}> = ({
  x,
  y,
  s = 1,
  angle = 0,
  open = 1,
  tone = 'human',
}) => {
  const th = useTheme();
  const t = th.tone[tone];
  const o = clamp01(open);
  if (o <= 0.001) return null;
  return (
    <g transform={`translate(${f2(x)} ${f2(y)}) rotate(${f2(angle)}) scale(${f2(s * lerp(0.6, 1, o))})`} opacity={o}>
      <ellipse rx={70} ry={34} fill={alpha(t.base, 0.22 * th.glow)} />
      <ellipse rx={110} ry={52} fill={alpha(t.base, 0.08 * th.glow)} />
      <rect x={-56} y={-22} width={112} height={44} rx={22} fill={th.color.abyss} stroke={t.base} strokeWidth={3} />
      <rect x={-42} y={-14} width={28} height={28} rx={3} fill="#26305E" />
      <g transform="translate(-40 -11) scale(2.4)">
        <path d="M1 0h1v1H1zM6 0h1v1H6zM2 1h4v1H2zM1 2h6v1H1zM0 3h8v3H0zM1 6h6v1H1z" fill="#6EE05A" />
        <path d="M2 3h1v1H2zM5 3h1v1H5z" fill="#13241A" />
      </g>
      <rect x={-6} y={-9} width={46} height={5} rx={2} fill={th.color.text} opacity={0.8} />
      <rect x={-6} y={1} width={34} height={5} rx={2} fill={th.color.text} opacity={0.6} />
    </g>
  );
};
