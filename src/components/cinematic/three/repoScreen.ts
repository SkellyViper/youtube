import {KNIGHT, type Sprite} from '../../story/Game';
import type {Theme} from '../../../styles/themes';

/**
 * The wrong-project screen: John's 21:9 ultrawide, an observed moment.
 *
 *   left   his game: a game-engine editor with `my-game` open, the biggest
 *          and brightest thing on the screen is the level itself (sky,
 *          tiles, the knight, coins). Behind a bush, a dashed placeholder
 *          for the new enemy: where it will live. It stays empty.
 *   right  a terminal with two tabs, `my-game` and `cloud-ops`; the active
 *          one is cloud-ops, simply the tab he used last (a finished infra
 *          session is still in it). He types the enemy request into the
 *          agent there and sends it; the agent's first lines (no enemies
 *          folder, a README about infrastructure, a file created under
 *          ~/cloud-ops) make the mismatch evident by context alone. He goes
 *          back to his game and presses play; the terminal keeps working.
 *
 * Nothing is labelled wrong. Real text sizes (terminal 31 px in the
 * 2048 x 880 design space) for the terminal insert; in the wide shot only
 * the structure (game left, agent right, purple on the right) must read.
 *
 * Drawn in a 2048 x 880 design space at any canvas size. A pure function of
 * its state: same state, same pixels. The static layer (window chrome, the
 * level, the terminal tabs) is cached per theme and size once fonts are in.
 */
export type RepoScreenState = {
  /** Active time, seconds (carets, spinner, the running game). Never a clock. */
  readonly time: number;
  readonly theme: Theme;
  /** 0..1 how much of the request is typed into the agent's prompt box. */
  readonly typed: number;
  /** 0..1 Enter: the request moves up into the transcript, the box empties. */
  readonly submit: number;
  /** 0..1 the agent works: spinner, then tool calls appear one by one. */
  readonly working: number;
  /** 0..1 focus moves to the game window; the terminal keeps working unattended. */
  readonly focusLeft: number;
  /** 0..1 he presses play: the knight runs and jumps through the level. */
  readonly playing: number;
  /** 0..1 the ominous hold: activity dot on the cloud-ops tab, faint purple glow. */
  readonly linger: number;
  /** 0..1 he makes the running game full screen: it grows over the editor and the terminal, which keep going behind it. */
  readonly fullscreen?: number;
  /** Optional seconds since Enter for the spinner's counter (default: derived from working and linger). */
  readonly elapsed?: number;
  /** Optional seconds since play was pressed, for the knight's run (default: `time`). */
  readonly playClock?: number;
};

/* ------------------------------------------------------------------ geometry (design space 2048 x 880) */

type Rect = {readonly x: number; readonly y: number; readonly w: number; readonly h: number};

const CW = 2048;
const CH = 880;
const R_WIN = 12;

const GAME: Rect = {x: 20, y: 20, w: 1064, h: 840};
const TERMINAL: Rect = {x: 1104, y: 20, w: 924, h: 840};
const TABS: Rect = {x: TERMINAL.x, y: TERMINAL.y, w: TERMINAL.w, h: 66};

// Game editor: top bar, file dock, scene tabs, the viewport.
const G_TOP_H = 52;
const G_DOCK_W = 250;
const G_DOCK_X = GAME.x;
const G_MAIN_X = GAME.x + G_DOCK_W;
const G_RIGHT = GAME.x + GAME.w;
const G_BODY_Y = GAME.y + G_TOP_H;
const G_STABS_H = 46;
/** Game pixels are 6 design px. The viewport is 131 x 120 game px. */
const GPX = 6;
const VIEWPORT: Rect = {x: G_MAIN_X + 14, y: G_BODY_Y + G_STABS_H + 8, w: 131 * GPX, h: 120 * GPX};
/** Full screen: the viewport scaled to the picture's height (22/3 design px per game px = 11 px in the 3072 px export), centred. */
const FULLSCREEN_X = 544;
const FULLSCREEN_BARS = '#010207';
const GROUND_Y = 100;
const PLAT_A = {x: 30, y: 64, n: 3};
const PLAT_B = {x: 70, y: 52, n: 3};
const COINS: readonly (readonly [number, number])[] = [
  [36, 62],
  [46, 62],
  [78, 50],
  [88, 50],
];
const BUSH = {cx: 112, w: 22, h: 9};
/** The placeholder for the new enemy, half behind the bush (game px; bottom centre). */
const MARKER = {cx: 118, y: GROUND_Y};
const PLAY_BTN = {x: G_RIGHT - 128, y: GAME.y + G_TOP_H / 2};

// Terminal: tabs, transcript, spinner, prompt box, status line.
const T_X0 = TERMINAL.x + 28;
const T_RIGHT = TERMINAL.x + TERMINAL.w - 24;
const LH = 46;
const GAP = 23;
const STATUS_Y = TERMINAL.y + TERMINAL.h - 32;
const BOX_X = TERMINAL.x + 22;
const BOX_W = T_RIGHT - BOX_X;
const BOX_BOTTOM = STATUS_Y - 32;
const BOX_PAD = 18;
const boxH = (lines: number) => BOX_PAD * 2 + LH * lines;
const BOX_COLS = 42;
const TAB_GAME: Rect = {x: TERMINAL.x, y: TABS.y, w: 256, h: TABS.h};
const TAB_CLOUD: Rect = {x: TERMINAL.x + 256, y: TABS.y, w: 284, h: TABS.h};

/** The request, wrapped as the prompt box wraps it (42 columns, two lines). */
const PROMPT = 'add a new enemy that hides, scavenges to grow, multiplies, then ambushes the player';
const wrap = (text: string, cols: number): string[] => {
  const out: string[] = [];
  let cur = '';
  for (const word of text.split(' ')) {
    const next = cur ? `${cur} ${word}` : word;
    if (next.length > cols && cur) {
      out.push(cur);
      cur = word;
    } else cur = next;
  }
  if (cur) out.push(cur);
  return out;
};
const PROMPT_LINES = wrap(PROMPT, BOX_COLS);
const PROMPT_CHARS = PROMPT_LINES.reduce((a, l) => a + l.length, 0);

const frac = (r: Rect) => ({x: r.x / CW, y: r.y / CH, w: r.w / CW, h: r.h / CH});

/**
 * Where things are on the picture, as fractions of width/height (0,0 = top
 * left). `prompt` is the prompt box with the whole request typed (it shrinks
 * to one line after Enter, keeping its bottom edge).
 */
export const REPO_SCREEN_LAYOUT = {
  game: frac(GAME),
  viewport: frac(VIEWPORT),
  terminal: frac(TERMINAL),
  tabs: frac(TABS),
  prompt: frac({x: BOX_X, y: BOX_BOTTOM - boxH(PROMPT_LINES.length), w: BOX_W, h: boxH(PROMPT_LINES.length)}),
} as const;

/* ------------------------------------------------------------------ the transcript */

type TLine =
  | {readonly k: 'user'; readonly text: string}
  | {readonly k: 'tool'; readonly name: string; readonly arg: string; readonly quiet?: boolean}
  | {readonly k: 'out'; readonly text: string}
  | {readonly k: 'done'; readonly text: string}
  | {readonly k: 'gap'};

/** The session he last used in this tab: a finished infra change. Drawn dim. */
const PREVIOUS: readonly TLine[] = [
  {k: 'out', text: 'Found 2 files'},
  {k: 'gap'},
  {k: 'user', text: 'bump staging to the larger instance'},
  {k: 'gap'},
  {k: 'tool', name: 'Read', arg: 'envs/staging/main.tf'},
  {k: 'out', text: 'Read 48 lines'},
  {k: 'gap'},
  {k: 'tool', name: 'Edit', arg: 'envs/staging/main.tf'},
  {k: 'out', text: 'instance_type = "c6i.xlarge"'},
  {k: 'gap'},
  {k: 'tool', name: 'Bash', arg: 'terraform apply'},
  {k: 'out', text: 'Apply complete. 1 changed.'},
  {k: 'gap'},
  {k: 'done', text: 'deploy finished'},
  {k: 'gap'},
];

/** What the agent does with his request, by `working` threshold. Search, Read and Write are in by 0.33. */
const TURN: readonly {readonly at: number; readonly line: TLine}[] = [
  {at: 0.02, line: {k: 'tool', name: 'Search', arg: 'enemies/**'}},
  {at: 0.07, line: {k: 'out', text: 'No matches'}},
  {at: 0.12, line: {k: 'gap'}},
  {at: 0.12, line: {k: 'tool', name: 'Read', arg: 'README.md'}},
  {at: 0.17, line: {k: 'out', text: 'cloud-ops · staging + prod infrastructure'}},
  {at: 0.23, line: {k: 'gap'}},
  {at: 0.23, line: {k: 'tool', name: 'Write', arg: 'enemies/scavenger.gd'}},
  {at: 0.28, line: {k: 'out', text: 'created ~/cloud-ops/enemies/scavenger.gd'}},
  {at: 0.5, line: {k: 'gap'}},
  {at: 0.5, line: {k: 'tool', name: 'Bash', arg: 'terraform plan', quiet: true}},
  {at: 0.6, line: {k: 'out', text: 'Plan: 3 to add, 1 to change.'}},
  {at: 0.8, line: {k: 'gap'}},
  {at: 0.8, line: {k: 'tool', name: 'Bash', arg: 'terraform apply', quiet: true}},
  {at: 0.87, line: {k: 'out', text: 'Running…'}},
];

/* ------------------------------------------------------------------ small math and colour */

/** Clamps to 0..1; NaN or a missing value reads as 0. */
const clamp01 = (t: number) => (t > 0 ? (t < 1 ? t : 1) : 0);
const seg = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const TAU = Math.PI * 2;

const rgbCache = new Map<string, readonly [number, number, number]>();
const rgb = (hex: string): readonly [number, number, number] => {
  let v = rgbCache.get(hex);
  if (!v) {
    const h = hex.replace('#', '');
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
    const n = parseInt(full, 16);
    v = [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
    rgbCache.set(hex, v);
  }
  return v;
};
/** a -> b by t, with alpha (CSS rgba string). */
const mix = (a: string, b: string, t: number, alpha = 1) => {
  const A = rgb(a);
  const B = rgb(b);
  const k = clamp01(t);
  return `rgba(${Math.round(A[0] + (B[0] - A[0]) * k)},${Math.round(A[1] + (B[1] - A[1]) * k)},${Math.round(A[2] + (B[2] - A[2]) * k)},${clamp01(alpha)})`;
};
const rgba = (hex: string, a: number) => mix(hex, hex, 0, a);
const hex2 = (n: number) => Math.round(n).toString(16).padStart(2, '0');
/** a -> b by t, as a hex colour (so it can be mixed again). */
const mixHex = (a: string, b: string, t: number) => {
  const A = rgb(a);
  const B = rgb(b);
  const k = clamp01(t);
  return `#${hex2(A[0] + (B[0] - A[0]) * k)}${hex2(A[1] + (B[1] - A[1]) * k)}${hex2(A[2] + (B[2] - A[2]) * k)}`;
};

/* ------------------------------------------------------------------ drawing helpers */

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
};

/** A cheap, deterministic glow: wide faint strokes under the real one (no shadowBlur, slow in software GL). */
const GLOW_LAYERS: readonly (readonly [number, number])[] = [
  [1, 0.08],
  [0.6, 0.12],
  [0.3, 0.2],
];
const glowStroke = (ctx: CanvasRenderingContext2D, trace: () => void, color: string, width: number, glow: number, alpha = 1) => {
  ctx.strokeStyle = color;
  if (glow > 0.5) {
    for (const [k, a] of GLOW_LAYERS) {
      ctx.globalAlpha = alpha * a;
      ctx.lineWidth = width + 2 * glow * k;
      trace();
      ctx.stroke();
    }
  }
  ctx.globalAlpha = alpha;
  ctx.lineWidth = width;
  trace();
  ctx.stroke();
  ctx.globalAlpha = 1;
};

/** The agent mark: two arcs and a hot centre; `turn` rotates it (the spinner). */
const iris = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, line: string, hot: string, lw: number, turn = 0) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(turn);
  ctx.strokeStyle = line;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0.3, 2.4);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.62, 3.4, 5.6);
  ctx.stroke();
  ctx.fillStyle = hot;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.24, 0, TAU);
  ctx.fill();
  ctx.restore();
};

const chevron = (ctx: CanvasRenderingContext2D, x: number, y: number, open: boolean, color: string) => {
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  if (open) {
    ctx.moveTo(x - 6, y - 3);
    ctx.lineTo(x, y + 4);
    ctx.lineTo(x + 6, y - 3);
  } else {
    ctx.moveTo(x - 3, y - 7);
    ctx.lineTo(x + 4, y);
    ctx.lineTo(x - 3, y + 7);
  }
  ctx.stroke();
  ctx.lineCap = 'butt';
};

const closeX = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) => {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - s, y - s);
  ctx.lineTo(x + s, y + s);
  ctx.moveTo(x + s, y - s);
  ctx.lineTo(x - s, y + s);
  ctx.stroke();
  ctx.lineCap = 'butt';
};

const playGlyph = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) => {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - s * 0.6, y - s);
  ctx.lineTo(x + s, y);
  ctx.lineTo(x - s * 0.6, y + s);
  ctx.closePath();
  ctx.fill();
};

/* ------------------------------------------------------------------ pixel sprites */

type Run = {readonly ch: string; readonly x: number; readonly y: number; readonly n: number};
type Pix = {readonly w: number; readonly h: number; readonly runs: readonly Run[]};
const pix = (rows: readonly string[]): Pix => {
  const runs: Run[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === '.') {
        x++;
        continue;
      }
      let n = 1;
      while (x + n < row.length && row[x + n] === ch) n++;
      runs.push({ch, x, y, n});
      x += n;
    }
  });
  return {w: rows[0].length, h: rows.length, runs};
};
const fromSprite = (s: Sprite) => pix(s.rows);
const KNIGHT_PIX = fromSprite(KNIGHT);
const COIN_PIX = pix(['..CCC..', '.CHHCC.', 'CHCCCDC', 'CHCCCDC', 'CHCCCDC', 'CCCCCDC', '.CCCDD.', '..DDD..']);
type Palette = Readonly<Record<string, string>>;

/** Draws a sprite with its bottom centre at (cx, by), integer pixel size `px`, optionally mirrored. */
const drawPix = (ctx: CanvasRenderingContext2D, p: Pix, pal: Palette, cx: number, by: number, px: number, flip = false) => {
  const x0 = Math.round(cx - (p.w * px) / 2);
  const y0 = Math.round(by - p.h * px);
  for (const r of p.runs) {
    const c = pal[r.ch];
    if (!c) continue;
    ctx.fillStyle = c;
    const x = flip ? p.w - r.x - r.n : r.x;
    ctx.fillRect(x0 + x * px, y0 + r.y * px, r.n * px, px);
  }
};

/* ------------------------------------------------------------------ the look (per theme, cached) */

const lookOf = (th: Theme) => {
  const sys = th.tone.system;
  const mind = th.tone.mind;
  const mono = (w: number, px: number) => `${w} ${px}px 'JetBrains Mono', ui-monospace, monospace`;
  const ui = (w: number, px: number) => `${w} ${px}px ${th.font}`;
  return {
    th,
    sys,
    mind,
    inert: th.tone.inert,
    /** Text sits just under white so the 3D bloom (threshold 0.92) leaves it crisp. */
    ink: mixHex(th.color.white, th.color.text, 0.18),
    text: th.color.text,
    dim: mixHex(th.color.dim, th.color.text, 0.12),
    faint: mixHex(th.color.dim, th.color.void, 0.25),
    desk: th.color.void,
    gChrome: mixHex(th.color.void, th.color.abyss, 0.55),
    gDock: mixHex(th.color.void, th.color.abyss, 0.85),
    gBody: mixHex(th.color.abyss, sys.deep, 0.06),
    termBg: mixHex(th.color.void, th.color.abyss, 0.7),
    tabBar: mixHex(th.color.void, th.color.abyss, 0.15),
    path: mixHex(sys.hot, th.color.text, 0.25),
    knight: {
      R: sys.hot,
      S: mixHex(th.color.white, sys.hot, 0.45),
      D: mixHex(th.color.void, sys.deep, 0.5),
      B: mixHex(sys.base, sys.deep, 0.2),
      Y: sys.hot,
      L: mixHex(th.color.white, th.color.text, 0.18),
      H: mixHex(sys.deep, th.color.steel, 0.5),
      K: mixHex(sys.deep, th.color.void, 0.35),
    } as Palette,
    /** The one warm accent: coins read as a game at any size. */
    coin: {C: th.tone.human.base, H: th.tone.human.hot, D: th.tone.human.deep} as Palette,
    fT: mono(400, 31),
    fTB: mono(700, 31),
    fTab: ui(500, 34),
    fUi: ui(500, 24),
    fUiB: ui(650, 25),
    fSmall: ui(500, 21),
  };
};
type Look = ReturnType<typeof lookOf>;
const lookCache = new WeakMap<Theme, Look>();
const look = (th: Theme): Look => {
  let l = lookCache.get(th);
  if (!l) {
    l = lookOf(th);
    lookCache.set(th, l);
  }
  return l;
};

const resetState = (ctx: CanvasRenderingContext2D) => {
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
  ctx.setLineDash([]);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'butt';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fontStretch = 'normal';
  ctx.letterSpacing = '0px';
  ctx.imageSmoothingEnabled = true;
};

/* ------------------------------------------------------------------ the level (static) */

const paintLevel = (ctx: CanvasRenderingContext2D, L: Look) => {
  const {sys, th} = L;
  const V = VIEWPORT;
  const g = (x: number, y: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(V.x + x * GPX, V.y + y * GPX, w * GPX, h * GPX);
  };
  const W = V.w / GPX;
  // Night sky in flat bands, dithered at the seams, brightening to the horizon.
  const bands: readonly (readonly [number, string])[] = [
    [0, mixHex(th.color.void, sys.deep, 0.5)],
    [22, mixHex(th.color.void, sys.deep, 0.8)],
    [38, mixHex(sys.deep, sys.base, 0.14)],
    [50, mixHex(sys.deep, sys.base, 0.45)],
    [60, mixHex(sys.base, sys.hot, 0.12)],
  ];
  bands.forEach(([y0, c], i) => {
    const y1 = i + 1 < bands.length ? bands[i + 1][0] : GROUND_Y;
    g(0, y0, W, y1 - y0, c);
    if (i > 0) for (let x = 0; x < W; x += 2) g(x + ((y0 / 2) % 2), y0 - 1, 1, 1, c);
  });
  // Stars.
  for (const [x, y] of [
    [8, 6],
    [21, 14],
    [34, 4],
    [47, 19],
    [60, 9],
    [73, 24],
    [84, 5],
    [96, 30],
    [124, 12],
    [15, 33],
    [58, 36],
    [118, 34],
  ] as const)
    g(x, y, 1, 1, (x + y) % 3 === 0 ? L.ink : sys.hot);
  // Moon.
  const mx = 108;
  const my = 16;
  for (let dy = -6; dy <= 6; dy++) {
    const hw = Math.floor(Math.sqrt(42 - dy * dy));
    g(mx - hw, my + dy, hw * 2 + 1, 1, mixHex(sys.hot, th.color.white, 0.3));
  }
  g(mx - 3, my - 2, 2, 2, mixHex(sys.hot, sys.base, 0.3));
  g(mx + 2, my + 2, 2, 1, mixHex(sys.hot, sys.base, 0.3));
  // Far and near hills.
  for (let x = 0; x < W; x++) {
    const far = Math.round(66 + 4 * Math.sin(x * 0.07 + 0.5) + 2.5 * Math.sin(x * 0.19));
    g(x, far, 1, GROUND_Y - far, mixHex(sys.deep, sys.base, 0.12));
    const near = Math.round(84 + 4 * Math.sin(x * 0.11 + 2) + 2 * Math.sin(x * 0.31));
    g(x, near, 1, GROUND_Y - near, mixHex(sys.deep, th.color.void, 0.45));
  }
  // Tiles: bricks with a bright top edge.
  const B = mixHex(sys.base, sys.deep, 0.42);
  const Hh = sys.hot;
  const D = mixHex(sys.deep, th.color.void, 0.35);
  const tile = (x: number, y: number, top: boolean) => {
    g(x, y, 8, 8, B);
    if (top) {
      g(x, y, 8, 1, Hh);
      g(x, y + 1, 8, 1, mixHex(Hh, B, 0.55));
    }
    g(x, y + 4, 8, 1, D);
    g(x, y + 7, 8, 1, D);
    g(x + 3, y + (top ? 2 : 0), 1, top ? 2 : 4, D);
    g(x + 7, y + 5, 1, 2, D);
  };
  for (let x = 0; x < W; x += 8) for (let y = GROUND_Y; y < V.h / GPX; y += 8) tile(x, y, y === GROUND_Y);
  for (const p of [PLAT_A, PLAT_B]) for (let i = 0; i < p.n; i++) tile(p.x + i * 8, p.y, true);
  // The placeholder for the new enemy: a dashed little creature, half hidden behind the bush.
  const mx0 = V.x + MARKER.cx * GPX;
  const my0 = V.y + MARKER.y * GPX;
  const pts: readonly (readonly [number, number])[] = [
    [-7, 0],
    [-7, -5],
    [-6, -8],
    [-5, -9],
    [-5.5, -13],
    [-3, -10],
    [3, -10],
    [5.5, -13],
    [5, -9],
    [6, -8],
    [7, -5],
    [7, 0],
  ];
  ctx.fillStyle = rgba(sys.hot, 0.08);
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(mx0 + x * GPX, my0 + y * GPX) : ctx.moveTo(mx0 + x * GPX, my0 + y * GPX)));
  ctx.closePath();
  ctx.fill();
  ctx.setLineDash([12, 9]);
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = rgba(sys.hot, 0.7);
  ctx.stroke();
  ctx.setLineDash([]);
  // The bush in front of it.
  const leaf = mixHex(sys.deep, sys.base, 0.3);
  const leafHi = mixHex(sys.base, sys.hot, 0.1);
  const leafLo = mixHex(sys.deep, th.color.void, 0.2);
  const bx = BUSH.cx;
  for (let dy = 0; dy < BUSH.h; dy++) {
    const k = dy / BUSH.h;
    const hw = Math.round((BUSH.w / 2) * Math.sqrt(1 - Math.pow(1 - k, 2)));
    g(bx - hw, GROUND_Y - BUSH.h + dy, hw * 2, 1, dy > BUSH.h - 3 ? leafLo : leaf);
  }
  for (const [x, y] of [
    [-6, -7],
    [-2, -8],
    [3, -7],
    [7, -5],
    [-8, -4],
    [0, -5],
  ] as const)
    g(bx + x, GROUND_Y + y, 2, 1, leafHi);
};

/* ------------------------------------------------------------------ the static layer */

const paintStaticGame = (ctx: CanvasRenderingContext2D, L: Look) => {
  const {sys, inert} = L;
  const r = GAME;
  ctx.save();
  roundRect(ctx, r.x, r.y, r.w, r.h, R_WIN);
  ctx.clip();
  ctx.fillStyle = L.gBody;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  // Top bar: project, workspaces, play controls.
  ctx.fillStyle = L.gChrome;
  ctx.fillRect(r.x, r.y, r.w, G_TOP_H);
  const ty = r.y + G_TOP_H / 2;
  ctx.font = L.fUiB;
  ctx.fillStyle = L.ink;
  ctx.fillText('my-game', r.x + 24, ty + 1);
  ctx.font = L.fSmall;
  const wsX = r.x + r.w / 2 - 70;
  ctx.fillStyle = L.ink;
  ctx.fillText('2D', wsX, ty + 1);
  ctx.fillStyle = rgba(sys.base, 0.85);
  ctx.fillRect(wsX - 4, r.y + G_TOP_H - 6, 36, 3);
  ctx.fillStyle = L.dim;
  ctx.fillText('Script', wsX + 64, ty + 1);
  // Pause and stop (play is dynamic).
  ctx.fillStyle = L.dim;
  ctx.fillRect(PLAY_BTN.x + 44, ty - 9, 5, 18);
  ctx.fillRect(PLAY_BTN.x + 54, ty - 9, 5, 18);
  ctx.fillRect(PLAY_BTN.x + 82, ty - 9, 18, 18);

  // File dock.
  ctx.fillStyle = L.gDock;
  ctx.fillRect(G_DOCK_X, G_BODY_Y, G_DOCK_W, r.y + r.h - G_BODY_Y);
  ctx.fillStyle = rgba(L.text, 0.08);
  ctx.fillRect(G_DOCK_X + G_DOCK_W - 2, G_BODY_Y, 2, r.y + r.h - G_BODY_Y);
  ctx.font = L.fSmall;
  ctx.fillStyle = L.dim;
  ctx.fillText('Files', G_DOCK_X + 20, G_BODY_Y + 28);
  const rowH = 40;
  const row0 = G_BODY_Y + 72;
  const fileIcon = (x: number, y: number, kind: 'gd' | 'scene' | 'cfg') => {
    if (kind === 'gd') {
      ctx.fillStyle = sys.base;
      roundRect(ctx, x - 7, y - 7, 14, 14, 3);
      ctx.fill();
    } else if (kind === 'scene') {
      ctx.strokeStyle = sys.hot;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, 6.5, 0, TAU);
      ctx.stroke();
    } else {
      ctx.fillStyle = inert.hot;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, TAU);
      ctx.fill();
    }
  };
  const rows: readonly {readonly depth: number; readonly name: string; readonly dir?: 'open' | 'closed'; readonly icon?: 'gd' | 'scene' | 'cfg'; readonly sel?: boolean; readonly root?: boolean}[] = [
    {depth: 0, name: 'my-game', dir: 'open', root: true},
    {depth: 1, name: 'sprites', dir: 'closed'},
    {depth: 1, name: 'enemies', dir: 'open'},
    {depth: 2, name: 'scavenger.gd', icon: 'gd'},
    {depth: 1, name: 'player.gd', icon: 'gd'},
    {depth: 1, name: 'level_01.tscn', icon: 'scene', sel: true},
    {depth: 1, name: 'main.tscn', icon: 'scene'},
    {depth: 1, name: 'project.godot', icon: 'cfg'},
  ];
  rows.forEach((row, i) => {
    const y = row0 + i * rowH;
    const x = G_DOCK_X + 16 + row.depth * 22;
    if (row.sel) {
      ctx.fillStyle = rgba(sys.base, 0.16);
      ctx.fillRect(G_DOCK_X, y - rowH / 2, G_DOCK_W - 2, rowH);
      ctx.fillStyle = rgba(sys.base, 0.7);
      ctx.fillRect(G_DOCK_X, y - rowH / 2, 3, rowH);
    }
    if (row.dir) chevron(ctx, x + 8, y, row.dir === 'open', L.dim);
    else if (row.icon) fileIcon(x + 8, y, row.icon);
    ctx.font = row.root ? L.fUiB : L.fUi;
    ctx.fillStyle = row.sel || row.root ? L.ink : L.text;
    ctx.fillText(row.name, x + 26, y + 1);
  });

  // Scene tabs above the viewport.
  ctx.fillStyle = L.gChrome;
  ctx.fillRect(G_MAIN_X, G_BODY_Y, G_RIGHT - G_MAIN_X, G_STABS_H);
  let tx = G_MAIN_X;
  for (const tb of [
    {name: 'level_01.tscn', w: 236, active: true},
    {name: 'main.tscn', w: 190, active: false},
  ]) {
    if (tb.active) {
      ctx.fillStyle = L.gBody;
      ctx.fillRect(tx, G_BODY_Y, tb.w, G_STABS_H);
    }
    ctx.fillStyle = rgba(L.text, 0.08);
    ctx.fillRect(tx + tb.w - 2, G_BODY_Y, 2, G_STABS_H);
    fileIcon(tx + 24, G_BODY_Y + G_STABS_H / 2, 'scene');
    ctx.font = L.fUi;
    ctx.fillStyle = tb.active ? L.ink : L.dim;
    ctx.fillText(tb.name, tx + 42, G_BODY_Y + G_STABS_H / 2 + 1);
    if (tb.active) closeX(ctx, tx + tb.w - 22, G_BODY_Y + G_STABS_H / 2, 6, L.dim);
    tx += tb.w;
  }

  // The viewport: his level.
  ctx.save();
  ctx.beginPath();
  ctx.rect(VIEWPORT.x, VIEWPORT.y, VIEWPORT.w, VIEWPORT.h);
  ctx.clip();
  paintLevel(ctx, L);
  ctx.restore();
  ctx.strokeStyle = rgba(L.text, 0.16);
  ctx.lineWidth = 2;
  ctx.strokeRect(VIEWPORT.x - 1, VIEWPORT.y - 1, VIEWPORT.w + 2, VIEWPORT.h + 2);
  ctx.restore();
};

const paintStaticTerminal = (ctx: CanvasRenderingContext2D, L: Look) => {
  const r = TERMINAL;
  ctx.save();
  roundRect(ctx, r.x, r.y, r.w, r.h, R_WIN);
  ctx.clip();
  ctx.fillStyle = L.termBg;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  // Tab bar: my-game, cloud-ops (active: the one he used last), a new-tab button.
  ctx.fillStyle = L.tabBar;
  ctx.fillRect(TABS.x, TABS.y, TABS.w, TABS.h);
  const c = TAB_CLOUD;
  ctx.fillStyle = L.termBg;
  ctx.fillRect(c.x, c.y, c.w, c.h);
  ctx.fillStyle = rgba(L.sys.base, 0.85);
  ctx.fillRect(c.x, c.y, c.w, 4);
  ctx.fillStyle = rgba(L.text, 0.1);
  ctx.fillRect(TAB_GAME.x + TAB_GAME.w - 2, TAB_GAME.y + 14, 2, TAB_GAME.h - 28);
  ctx.font = L.fTab;
  ctx.fillStyle = L.dim;
  ctx.fillText('my-game', TAB_GAME.x + 32, TAB_GAME.y + TAB_GAME.h / 2 + 2);
  ctx.fillStyle = L.ink;
  ctx.fillText('cloud-ops', c.x + 32, c.y + c.h / 2 + 2);
  closeX(ctx, c.x + c.w - 30, c.y + c.h / 2, 7, L.dim);
  ctx.strokeStyle = L.dim;
  ctx.lineWidth = 3;
  ctx.beginPath();
  const px = c.x + c.w + 40;
  const py = TABS.y + TABS.h / 2;
  ctx.moveTo(px - 10, py);
  ctx.lineTo(px + 10, py);
  ctx.moveTo(px, py - 10);
  ctx.lineTo(px, py + 10);
  ctx.stroke();
  // Status line under the prompt box: where the agent runs.
  ctx.font = L.fT;
  ctx.fillStyle = L.path;
  ctx.fillText('~/cloud-ops', T_X0, STATUS_Y);
  ctx.fillStyle = L.faint;
  ctx.textAlign = 'right';
  ctx.fillText('? for shortcuts', T_RIGHT - 4, STATUS_Y);
  ctx.textAlign = 'left';
  ctx.restore();
};

const paintStatic = (ctx: CanvasRenderingContext2D, L: Look) => {
  ctx.fillStyle = L.desk;
  ctx.fillRect(0, 0, CW, CH);
  paintStaticGame(ctx, L);
  paintStaticTerminal(ctx, L);
};

const staticCache = new WeakMap<Theme, Map<string, HTMLCanvasElement>>();
/** The static layer at the target resolution, once per theme and size; only cached once the fonts are in. */
const staticLayer = (L: Look, width: number, height: number): HTMLCanvasElement | null => {
  let bySize = staticCache.get(L.th);
  const key = `${width}x${height}`;
  const hit = bySize?.get(key);
  if (hit) return hit;
  if (typeof document === 'undefined' || !document.fonts) return null;
  if (!document.fonts.check(L.fUi) || !document.fonts.check(L.fT)) return null;
  const cv = document.createElement('canvas');
  cv.width = width;
  cv.height = height;
  const c = cv.getContext('2d');
  if (!c) return null;
  c.setTransform(width / CW, 0, 0, height / CH, 0, 0);
  resetState(c);
  paintStatic(c, L);
  if (!bySize) {
    bySize = new Map();
    staticCache.set(L.th, bySize);
  }
  bySize.set(key, cv);
  return cv;
};

/* ------------------------------------------------------------------ the painter */

/** The knight's test run (game px): back and forth along the ground, hopping. */
const knightRun = (tp: number) => {
  const u = (tp * 0.1) % 2;
  const tri = u < 1 ? u : 2 - u;
  const x = lerp(16, 98, smooth(tri));
  const left = u >= 1;
  const ph = (tp / 1.35) % 1;
  const hop = ph < 0.44 ? Math.sin((Math.PI * ph) / 0.44) : 0;
  return {x, lift: 15 * hop, left, step: hop > 0 ? 0 : Math.floor(tp * 9) % 2};
};

export const paintRepoScreen = (ctx: CanvasRenderingContext2D, width: number, height: number, s: RepoScreenState): void => {
  const L = look(s.theme);
  const {sys, mind, inert} = L;
  const t = s.time;
  const typed = clamp01(s.typed);
  const submit = clamp01(s.submit);
  const working = clamp01(s.working);
  const focus = clamp01(s.focusLeft);
  const playing = clamp01(s.playing);
  const linger = clamp01(s.linger);
  const pulse = 0.5 - 0.5 * Math.cos((TAU * t) / 2.4);
  // Carets blink between two visible levels, so a frozen frame never loses them.
  const blink = Math.floor(t * 1.7) % 2 === 0 ? 1 : 0.38;

  ctx.save();
  resetState(ctx);
  const layer = staticLayer(L, width, height);
  if (layer) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(layer, 0, 0);
    ctx.setTransform(width / CW, 0, 0, height / CH, 0, 0);
  } else {
    ctx.setTransform(width / CW, 0, 0, height / CH, 0, 0);
    paintStatic(ctx, L);
  }

  /* ---------------- the game window: the level comes alive when he presses play */
  const play = smooth(playing);
  const tp = s.playClock ?? t;
  // The knight: standing at the start while editing, running the level while playing.
  const run = knightRun(tp);
  const kx = lerp(22, run.x, play);
  const lift = run.lift * play;
  const bobY = play > 0.5 && run.step ? 1 : 0;
  /** Coins and the knight, for a level whose top-left is (ox, oy) and whose game pixel is `px` design px. */
  const sprites = (ox: number, oy: number, px: number) => {
    COINS.forEach(([x, y], i) => {
      const bob = play > 0 ? Math.round(Math.sin(tp * 3.2 + i * 1.3) * play) : 0;
      drawPix(ctx, COIN_PIX, L.coin, ox + (x + 0.5) * px, oy + (y + bob) * px, px);
    });
    drawPix(ctx, KNIGHT_PIX, L.knight, ox + kx * px, oy + (GROUND_Y - lift) * px + (bobY * px) / 2, px, play > 0.5 && run.left);
  };
  {
    const V = VIEWPORT;
    // Editor overlay (the camera's frame) while editing; gone while the game runs.
    if (play < 1) {
      ctx.strokeStyle = rgba(sys.hot, 0.3 * (1 - play));
      ctx.lineWidth = 2.5;
      ctx.setLineDash([16, 10]);
      ctx.strokeRect(V.x + 4 * GPX, V.y + 8 * GPX, 120 * GPX, 108 * GPX);
      ctx.setLineDash([]);
    }
    // Coins (bob while running).
    ctx.save();
    ctx.beginPath();
    ctx.rect(V.x, V.y, V.w, V.h);
    ctx.clip();
    sprites(V.x, V.y, GPX);
    ctx.restore();
    // Play button; a small "running" state while the game runs.
    const ty = GAME.y + G_TOP_H / 2;
    if (play > 0.001) {
      roundRect(ctx, PLAY_BTN.x - 178, ty - 17, 156, 34, 17);
      ctx.fillStyle = rgba(sys.base, 0.18 * play);
      ctx.fill();
      playGlyph(ctx, PLAY_BTN.x - 154, ty, 8, rgba(sys.hot, play));
      ctx.font = L.fSmall;
      ctx.fillStyle = rgba(sys.hot, play);
      ctx.fillText('running', PLAY_BTN.x - 136, ty + 1);
      roundRect(ctx, PLAY_BTN.x - 14, ty - 17, 34, 34, 8);
      ctx.fillStyle = rgba(sys.base, 0.3 * play);
      ctx.fill();
    }
    playGlyph(ctx, PLAY_BTN.x + 2, ty, 10, mix(L.dim, sys.hot, play));
    // Window edge: focus blue when he is in it.
    roundRect(ctx, GAME.x + 1.5, GAME.y + 1.5, GAME.w - 3, GAME.h - 3, R_WIN);
    ctx.lineWidth = 3;
    ctx.strokeStyle = mix(inert.hot, sys.base, focus, lerp(0.26, 0.6, focus));
    ctx.stroke();
    if (play > 0.001) {
      ctx.strokeStyle = rgba(sys.base, 0.55 * play);
      ctx.lineWidth = 3;
      ctx.strokeRect(V.x - 1.5, V.y - 1.5, V.w + 3, V.h + 3);
    }
  }

  /* ---------------- the terminal */
  const tFocus = 1 - focus;
  const e = easeInOut(submit);
  const term = TERMINAL;
  // The hold: a faint purple wash on this side.
  if (linger > 0.001) {
    ctx.save();
    roundRect(ctx, term.x, term.y + TABS.h, term.w, term.h - TABS.h, R_WIN);
    ctx.clip();
    ctx.fillStyle = rgba(mind.base, 0.035 * linger * (0.7 + 0.3 * pulse));
    ctx.fillRect(term.x, term.y + TABS.h, term.w, term.h - TABS.h);
    ctx.restore();
  }
  ctx.font = L.fT;
  const ch = ctx.measureText('0').width;

  // Prompt box geometry: grows with the wrapped text, shrinks back to one line after Enter.
  const shown = Math.floor(typed * PROMPT_CHARS + 1e-6);
  let rest = shown;
  const reveal = PROMPT_LINES.map((l) => {
    const n = Math.min(l.length, Math.max(0, rest));
    rest -= n;
    return n;
  });
  let typedLines = 1;
  reveal.forEach((n, i) => {
    if (n > 0) typedLines = i + 1;
  });
  const box0H = boxH(typedLines);
  const boxHNow = lerp(box0H, boxH(1), e);
  const boxTop = BOX_BOTTOM - boxHNow;
  const spin = smooth(seg(submit, 0.55, 1));
  // The spinner row, with a blank half-line above it as in the real TUI.
  const SPIN_H = LH + 24;
  const spinRow = SPIN_H * spin;
  const tBottom = boxTop - 16 - spinRow;

  // Transcript items, bottom-anchored (older lines scroll off the top as new ones arrive).
  type Item = {readonly line: TLine; readonly h: number; readonly a: number; readonly prev: boolean; readonly user?: number};
  const items: Item[] = [];
  for (const line of PREVIOUS) items.push({line, h: line.k === 'gap' ? GAP : LH, a: 1, prev: true});
  PROMPT_LINES.forEach((_l, j) => items.push({line: {k: 'gap'}, h: LH * e, a: e, prev: false, user: j}));
  items.push({line: {k: 'gap'}, h: GAP * e, a: e, prev: false});
  for (const {at, line} of TURN) {
    const a = smooth(seg(working, at, at + 0.04));
    if (a <= 0) continue;
    items.push({line, h: (line.k === 'gap' ? GAP : LH) * a, a, prev: false});
  }
  const tops: number[] = new Array(items.length);
  let y = tBottom;
  for (let i = items.length - 1; i >= 0; i--) {
    y -= items[i].h;
    tops[i] = y;
  }

  const clipTop = TABS.y + TABS.h;
  const bx = BOX_X + 22;
  const box0Top = BOX_BOTTOM - box0H;
  ctx.save();
  ctx.beginPath();
  // Everything in the terminal's text area (transcript, spinner, his request in the box or on its way up) is clipped below the tabs.
  ctx.rect(term.x, clipTop, term.w, BOX_BOTTOM - clipTop);
  ctx.clip();
  // His message: a faint band behind it once it has landed in the transcript.
  const firstUser = items.findIndex((it) => it.user === 0);
  if (e > 0.001 && firstUser >= 0) {
    const top = tops[firstUser];
    const h = items[firstUser].h + items[firstUser + 1].h;
    ctx.fillStyle = rgba(L.text, 0.06 * e);
    ctx.fillRect(term.x + 10, top - 4, term.w - 20, h + 8);
  }
  const col = (c: number) => T_X0 + c * ch;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.user !== undefined || it.line.k === 'gap') continue;
    const cy = tops[i] + it.h / 2;
    if (cy < clipTop - LH || cy > tBottom + LH) continue;
    // A new line first opens its row, then its text fades in: drawn from the start it ghosts over the line above (visible in the insert).
    ctx.globalAlpha = it.prev ? it.a : clamp01((it.a - 0.55) / 0.45);
    const ln = it.line;
    if (ln.k === 'user') {
      ctx.font = L.fT;
      ctx.fillStyle = L.faint;
      ctx.fillText('>', col(0), cy);
      ctx.fillText(ln.text, col(2), cy);
    } else if (ln.k === 'tool') {
      const quiet = it.prev || ln.quiet;
      ctx.fillStyle = it.prev ? L.faint : ln.quiet ? mixHex(mind.base, L.faint, 0.45) : mind.base;
      ctx.beginPath();
      ctx.arc(col(0.5), cy, 7.5, 0, TAU);
      ctx.fill();
      ctx.font = L.fTB;
      ctx.fillStyle = it.prev ? L.dim : quiet ? L.text : L.ink;
      ctx.fillText(ln.name, col(2), cy);
      ctx.font = L.fT;
      ctx.fillStyle = it.prev ? L.faint : quiet ? L.dim : L.text;
      ctx.fillText(`(${ln.arg})`, col(2 + ln.name.length), cy);
    } else if (ln.k === 'out') {
      ctx.strokeStyle = L.faint;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(col(2.6), cy - 16);
      ctx.lineTo(col(2.6), cy + 1);
      ctx.lineTo(col(3.8), cy + 1);
      ctx.stroke();
      ctx.font = L.fT;
      ctx.fillStyle = it.prev ? L.faint : L.dim;
      ctx.fillText(ln.text, col(5), cy);
    } else if (ln.k === 'done') {
      ctx.strokeStyle = it.prev ? mixHex(L.faint, sys.base, 0.35) : sys.base;
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(col(0.05), cy);
      ctx.lineTo(col(0.4), cy + 7);
      ctx.lineTo(col(1.05), cy - 9);
      ctx.stroke();
      ctx.lineCap = 'butt';
      ctx.font = L.fT;
      ctx.fillStyle = L.dim;
      ctx.fillText(ln.text, col(2), cy);
    }
    ctx.globalAlpha = 1;
  }
  // The spinner: the agent mark turning, a shimmering verb and the elapsed counter.
  if (spin > 0.001) {
    const cy = boxTop - 16 - LH / 2;
    ctx.globalAlpha = spin;
    iris(ctx, col(0.5), cy, 12, mind.base, mind.hot, 3.5, t * 3.2);
    ctx.font = L.fT;
    const verb = 'Working…';
    const head = ((t * 0.9) % 1.6) * verb.length - 2;
    for (let i = 0; i < verb.length; i++) {
      const d = Math.abs(i - head);
      ctx.fillStyle = mix(mind.base, mind.hot, Math.max(0, 1 - d / 2.2));
      ctx.fillText(verb[i], col(2 + i), cy);
    }
    const secs = Math.max(1, Math.floor(s.elapsed ?? 1 + working * 7 + linger * 2.4));
    ctx.fillStyle = L.dim;
    ctx.fillText(`${secs}s · esc to interrupt`, col(2 + verb.length + 1), cy);
    ctx.globalAlpha = 1;
  }
  // The typed text: in the box, then carried up into the transcript as his message.
  PROMPT_LINES.forEach((line, j) => {
    const n = reveal[j];
    if (n <= 0) return;
    const fromX = bx + 2 * ch;
    const fromY = box0Top + BOX_PAD + LH * (j + 0.5);
    let x = fromX;
    let yy = fromY;
    if (e > 0) {
      const k = items.findIndex((it) => it.user === j);
      x = lerp(fromX, T_X0 + 2 * ch, e);
      yy = lerp(fromY, tops[k] + items[k].h / 2, e);
      if (j === 0) {
        ctx.fillStyle = rgba(L.dim, e);
        ctx.fillText('>', lerp(bx, T_X0, e), yy);
      }
    }
    ctx.fillStyle = L.ink;
    ctx.fillText(line.slice(0, n), x, yy);
  });
  // Lines scrolling off the top fade out under the tab bar instead of leaving glyph slivers.
  const fade = ctx.createLinearGradient(0, clipTop, 0, clipTop + 40);
  fade.addColorStop(0, rgba(L.termBg, 1));
  fade.addColorStop(1, rgba(L.termBg, 0));
  ctx.fillStyle = fade;
  ctx.fillRect(term.x, clipTop, term.w, 40);
  ctx.restore();

  // The prompt box.
  roundRect(ctx, BOX_X, boxTop, BOX_W, boxHNow, 14);
  ctx.lineWidth = 3;
  ctx.strokeStyle = mix(inert.hot, sys.base, 0.3 * tFocus, lerp(0.45, 0.85, tFocus));
  ctx.stroke();
  ctx.font = L.fT;
  ctx.fillStyle = mix(L.dim, L.ink, tFocus * 0.6);
  ctx.fillText('>', bx, boxTop + BOX_PAD + LH / 2);
  // Caret: a block while the terminal has focus, a hollow block once he is back in his game.
  const empty = e > 0.6;
  if (submit <= 0.001 || empty) {
    let cx = bx + 2 * ch;
    let cyLine = 0;
    if (!empty) {
      cyLine = typedLines - 1;
      cx += reveal[cyLine] * ch;
    }
    const cy = (empty ? boxTop : box0Top) + BOX_PAD + LH * (cyLine + 0.5);
    const typing = typed > 0 && typed < 1 && submit <= 0;
    if (tFocus > 0.5) {
      ctx.fillStyle = rgba(L.ink, 0.85 * (typing ? 1 : blink));
      ctx.fillRect(cx + 2, cy - 19, ch, 38);
    } else {
      ctx.strokeStyle = rgba(L.dim, 0.9);
      ctx.lineWidth = 2.5;
      ctx.strokeRect(cx + 3, cy - 18, ch - 2, 36);
    }
  }

  // The tab: a small pulsing activity dot on cloud-ops during the hold.
  if (linger > 0.001) {
    const dx = TAB_CLOUD.x + TAB_CLOUD.w - 62;
    const dy = TAB_CLOUD.y + TAB_CLOUD.h / 2 + 1;
    glowStroke(
      ctx,
      () => {
        ctx.beginPath();
        ctx.arc(dx, dy, 9 + 2 * pulse, 0, TAU);
      },
      mind.base,
      3,
      6 * pulse,
      linger * (0.5 + 0.5 * pulse),
    );
    ctx.globalAlpha = linger;
    ctx.fillStyle = mix(mind.base, mind.hot, pulse);
    ctx.beginPath();
    ctx.arc(dx, dy, 6.5, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  // The terminal's window edge: focus blue while he types, then quiet; purple glow in the hold.
  {
    const trace = () => roundRect(ctx, term.x + 1.5, term.y + 1.5, term.w - 3, term.h - 3, R_WIN);
    trace();
    ctx.lineWidth = 3;
    ctx.strokeStyle = mix(inert.hot, sys.base, tFocus, lerp(0.26, 0.6, tFocus));
    ctx.stroke();
    if (linger > 0.001) glowStroke(ctx, trace, mind.base, 3, 18 * (0.6 + 0.4 * pulse), linger * 0.75);
  }

  /* ---------------- full screen: the running game takes the whole display */
  // A fixed-aspect game on an ultrawide fills the height and leaves black at the sides. Everything else
  // (the editor, the terminal and whatever the agent is doing in it) is still there, behind it.
  const fs = smooth(clamp01(s.fullscreen ?? 0));
  if (fs > 0.001) {
    const V = VIEWPORT;
    const k = lerp(1, CH / V.h, fs);
    const r = {x: lerp(V.x, FULLSCREEN_X, fs), y: lerp(V.y, 0, fs), w: V.w * k, h: V.h * k};
    ctx.fillStyle = rgba(FULLSCREEN_BARS, fs);
    ctx.fillRect(0, 0, CW, CH);
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    if (layer) {
      // The level from the cached layer, enlarged without smoothing: pixel art stays crisp.
      const sx = width / CW;
      const sy = height / CH;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(layer, V.x * sx, V.y * sy, V.w * sx, V.h * sy, r.x, r.y, r.w, r.h);
      ctx.imageSmoothingEnabled = true;
    } else {
      ctx.save();
      ctx.translate(r.x - V.x * k, r.y - V.y * k);
      ctx.scale(k, k);
      paintLevel(ctx, L);
      ctx.restore();
    }
    sprites(r.x, r.y, GPX * k);
    ctx.restore();
  }

  ctx.restore();
};
