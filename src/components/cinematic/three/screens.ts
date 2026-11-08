import {GH, GROUND, GW, KNIGHT, SLIME, type Sprite, type SlimeCopy} from '../../story/Game';
import type {Theme} from '../../../styles/themes';

/**
 * Screen painters: what is on the monitors, drawn into a canvas. They are the
 * canvas twins of the SVG components in ../../story (Game, Chat): same game,
 * same chat window, so the 2D scenes and the 3D scenes show the same product.
 * Every painter is a pure function of its state object.
 */

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const seg = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* ------------------------------------------------------------------ the game */

export type GameScreenState = {
  readonly time: number;
  readonly knightX?: number;
  readonly slimes?: readonly SlimeCopy[];
  /** 0..1 an empty dashed enemy slot. */
  readonly pending?: number;
  readonly pendingX?: number;
  /** 0..1 screen brightness; 0 = off. */
  readonly power?: number;
  /** 0..1 a small "level editor" panel open on the right (John is working, not playing). */
  readonly editor?: number;
};

const drawSprite = (ctx: CanvasRenderingContext2D, sprite: Sprite, x: number, y: number, sx = 1, sy = 1, flip = false, alpha = 1) => {
  const w = sprite.rows[0].length;
  const h = sprite.rows.length;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(sx * (flip ? -1 : 1), sy);
  ctx.translate(-w / 2, -h);
  for (let r = 0; r < h; r++) {
    const row = sprite.rows[r];
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      if (ch === '.') continue;
      ctx.fillStyle = sprite.palette[ch];
      ctx.fillRect(c, r, 1, 1);
    }
  }
  ctx.restore();
};

export const paintGame = (ctx: CanvasRenderingContext2D, width: number, height: number, s: GameScreenState) => {
  const power = clamp01(s.power ?? 1);
  ctx.fillStyle = '#020203';
  ctx.fillRect(0, 0, width, height);
  if (power <= 0.001) return;
  const editor = clamp01(s.editor ?? 0);
  const viewW = width * (1 - 0.28 * editor);
  const scale = Math.min(viewW / GW, height / GH);
  ctx.save();
  ctx.translate((viewW - GW * scale) / 2, (height - GH * scale) / 2);
  ctx.scale(scale, scale);
  ctx.imageSmoothingEnabled = false;
  // Sky.
  const sky = ctx.createLinearGradient(0, 0, 0, GH);
  sky.addColorStop(0, '#2B3A7A');
  sky.addColorStop(0.55, '#6A5AB0');
  sky.addColorStop(1, '#F29A6B');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, GW, GH);
  // Clouds.
  ctx.fillStyle = 'rgba(244,230,240,0.85)';
  for (const [x, y] of [
    [20, 18],
    [118, 12],
    [160, 26],
  ]) {
    ctx.fillRect(x, y, 14, 3);
    ctx.fillRect(x + 3, y - 3, 7, 3);
    ctx.fillRect(x - 3, y + 3, 20, 2);
  }
  // Hills.
  ctx.fillStyle = '#3C3F86';
  const hill = (cx: number, w: number, hgt: number) => {
    for (let i = 0; i < w; i++) {
      const t = i / (w - 1);
      const y = Math.round(hgt * Math.sin(Math.PI * t));
      ctx.fillRect(cx - w / 2 + i, GROUND - y, 1, y);
    }
  };
  hill(30, 60, 22);
  hill(100, 80, 30);
  hill(170, 56, 18);
  // Ground.
  ctx.fillStyle = '#8A5A3A';
  ctx.fillRect(0, GROUND + 2, GW, GH - GROUND - 2);
  ctx.fillStyle = '#6B4129';
  for (let x = 0; x < GW; x += 8) {
    ctx.fillRect(x + 2, GROUND + 6, 2, 2);
    ctx.fillRect(x + 6, GROUND + 12, 2, 2);
    ctx.fillRect(x + 1, GROUND + 17, 2, 1);
  }
  ctx.fillStyle = '#58C45A';
  ctx.fillRect(0, GROUND, GW, 2);
  // Brick platform.
  ctx.fillStyle = '#C9764A';
  for (let x = 128; x < 168; x += 8) ctx.fillRect(x, 58, 7, 5);
  // Knight.
  const step = Math.floor(s.time * 6) % 2;
  drawSprite(ctx, KNIGHT, s.knightX ?? 44, GROUND + (step ? 0 : -0.5));
  // Pending slot.
  const pending = clamp01(s.pending ?? 0);
  if (pending > 0.001) {
    const px = s.pendingX ?? 120;
    ctx.save();
    ctx.globalAlpha = pending * 0.8;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 0.6;
    ctx.setLineDash([1.5, 1.5]);
    ctx.strokeRect(px - 7, GROUND - 12, 14, 12);
    ctx.setLineDash([]);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(px - 1.5, GROUND - 9, 3, 1);
    ctx.fillRect(px + 0.5, GROUND - 8, 1, 2);
    ctx.fillRect(px - 0.5, GROUND - 6, 1, 1);
    ctx.fillRect(px - 0.5, GROUND - 4, 1, 1);
    ctx.restore();
  }
  // Slimes.
  for (const sl of s.slimes ?? []) {
    const sq = sl.squash ?? 0;
    const lift = sl.lift ?? 0;
    ctx.fillStyle = `rgba(0,0,0,${0.25 * (sl.opacity ?? 1)})`;
    ctx.beginPath();
    ctx.ellipse(sl.x, GROUND + 0.5, 5 * (1 - clamp01(lift / 30) * 0.6), 1, 0, 0, Math.PI * 2);
    ctx.fill();
    drawSprite(ctx, SLIME, sl.x, GROUND - lift, 1 + sq * 0.35, 1 - sq * 0.3, sl.flip, sl.opacity ?? 1);
  }
  ctx.restore();
  // Editor side panel: an inspector with the enemy's properties as bars.
  if (editor > 0.001) {
    const px = viewW;
    ctx.fillStyle = '#12141C';
    ctx.fillRect(px, 0, width - px, height);
    ctx.fillStyle = '#1C2030';
    ctx.fillRect(px, 0, width - px, 34);
    ctx.fillStyle = 'rgba(200,210,235,0.75)';
    ctx.fillRect(px + 16, 13, 70, 8);
    const rows = [0.7, 0.45, 0.6, 0.35, 0.5, 0.65, 0.4];
    rows.forEach((w, i) => {
      const y = 60 + i * 34;
      ctx.fillStyle = 'rgba(160,172,200,0.35)';
      ctx.fillRect(px + 16, y, 54, 7);
      ctx.fillStyle = 'rgba(110,224,90,0.55)';
      ctx.fillRect(px + 84, y, (width - px - 100) * w, 7);
    });
    // The slime preview in the inspector.
    ctx.save();
    ctx.translate(px + (width - px) / 2, height - 40);
    ctx.scale(3.2, 3.2);
    drawSprite(ctx, SLIME, 0, 0);
    ctx.restore();
  }
  if (power < 1) {
    ctx.fillStyle = `rgba(2,2,3,${1 - power})`;
    ctx.fillRect(0, 0, width, height);
  }
};

/* ------------------------------------------------------------------ the agent chat */

export type ChatScreenState = {
  readonly time: number;
  readonly theme: Theme;
  /** 0 = game project active, 1 = cloud project active (animates the highlight). */
  readonly tab?: number;
  /** 0..1 how much of the prompt has been typed into the input box. */
  readonly typed?: number;
  /** 0..1 the prompt bubble rises into the conversation. */
  readonly posted?: number;
  /** 0..1 the agent's reply writes itself (code bars). */
  readonly reply?: number;
  /** 0..1 a "running" status line with a moving indicator. */
  readonly working?: number;
  /** 0..1 window closes (collapses to a line). */
  readonly close?: number;
  readonly power?: number;
  /** Second environment name shown on the right tab; the game is always the left tab. */
  readonly labels?: readonly [string, string];
};

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

const gamepadIcon = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) => {
  ctx.fillStyle = color;
  roundRect(ctx, x - 9 * s, y - 5 * s, 18 * s, 10 * s, 4 * s);
  ctx.fill();
  ctx.fillStyle = '#10121A';
  ctx.fillRect(x - 6 * s, y - 1 * s, 4 * s, 2 * s);
  ctx.fillRect(x - 5 * s, y - 2 * s, 2 * s, 4 * s);
  ctx.beginPath();
  ctx.arc(x + 4 * s, y - 1 * s, 1.2 * s, 0, Math.PI * 2);
  ctx.arc(x + 6.5 * s, y + 1 * s, 1.2 * s, 0, Math.PI * 2);
  ctx.fill();
};

const cloudIcon = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) => {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x - 4 * s, y + 1 * s, 4 * s, 0, Math.PI * 2);
  ctx.arc(x + 1 * s, y - 2 * s, 5 * s, 0, Math.PI * 2);
  ctx.arc(x + 6 * s, y + 1.5 * s, 3.5 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x - 4 * s, y + 1 * s, 10 * s, 4.5 * s);
};

const slimeThumb = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  drawSprite(ctx, SLIME, 0, 0);
  ctx.restore();
};

export const paintChat = (ctx: CanvasRenderingContext2D, width: number, height: number, s: ChatScreenState) => {
  const th = s.theme;
  const power = clamp01(s.power ?? 1);
  const close = clamp01(s.close ?? 0);
  ctx.fillStyle = '#05060B';
  ctx.fillRect(0, 0, width, height);
  if (power <= 0.001) return;
  // Closing: the window squashes to a horizontal line, then a dot.
  const squash = 1 - 0.985 * seg(close, 0, 0.6);
  const shrink = 1 - 0.98 * seg(close, 0.55, 1);
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.scale(shrink, squash);
  ctx.translate(-width / 2, -height / 2);

  const mind = th.tone.mind;
  const human = th.tone.human;
  ctx.fillStyle = '#0B0D15';
  ctx.fillRect(0, 0, width, height);
  // Title bar.
  ctx.fillStyle = '#141826';
  ctx.fillRect(0, 0, width, 40);
  ctx.fillStyle = '#2A3146';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(20 + i * 18, 20, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Two project tabs: the game (left) and the cloud environment (right).
  const tab = clamp01(s.tab ?? 0);
  const tabY = 52;
  const tabH = 46;
  const tabW = (width - 36) / 2;
  const hx = lerp(14, 14 + tabW + 8, tab);
  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  roundRect(ctx, 14, tabY, tabW, tabH, 8);
  ctx.fill();
  roundRect(ctx, 14 + tabW + 8, tabY, tabW, tabH, 8);
  ctx.fill();
  const hot = tab < 0.5 ? human.base : mind.base;
  ctx.fillStyle = `rgba(255,255,255,0.07)`;
  roundRect(ctx, hx, tabY, tabW, tabH, 8);
  ctx.fill();
  ctx.fillStyle = hot;
  ctx.fillRect(hx + 10, tabY + tabH - 3, tabW - 20, 3);
  const labels = s.labels ?? ['my-game', 'cloud-ops'];
  gamepadIcon(ctx, 14 + 26, tabY + tabH / 2, 1.1, tab < 0.5 ? human.hot : 'rgba(170,180,205,0.55)');
  cloudIcon(ctx, 14 + tabW + 8 + 26, tabY + tabH / 2, 1.1, tab >= 0.5 ? mind.hot : 'rgba(170,180,205,0.55)');
  ctx.font = `600 17px ${th.font}`;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = tab < 0.5 ? '#E8EEF8' : 'rgba(170,180,205,0.7)';
  ctx.fillText(labels[0], 14 + 50, tabY + tabH / 2 + 1);
  ctx.fillStyle = tab >= 0.5 ? '#E8EEF8' : 'rgba(170,180,205,0.7)';
  ctx.fillText(labels[1], 14 + tabW + 8 + 50, tabY + tabH / 2 + 1);

  // Conversation: earlier turns as bars. Agent on the left with the iris mark, human on the right.
  const top = tabY + tabH + 26;
  const bar = (x: number, y: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c;
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.fill();
  };
  const iris = (x: number, y: number, r: number) => {
    ctx.strokeStyle = mind.base;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(x, y, r, 0.3, 2.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, r * 0.62, 3.4, 5.6);
    ctx.stroke();
    ctx.fillStyle = mind.hot;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.22, 0, Math.PI * 2);
    ctx.fill();
  };
  let y = top;
  // An earlier agent message.
  iris(30, y + 10, 9);
  bar(50, y, width * 0.52, 9, 'rgba(190,200,225,0.42)');
  bar(50, y + 16, width * 0.38, 9, 'rgba(190,200,225,0.3)');
  y += 46;
  // An earlier human message.
  bar(width - 24 - width * 0.36, y, width * 0.36, 9, `rgba(255,255,255,0.22)`);
  y += 34;
  iris(30, y + 10, 9);
  bar(50, y, width * 0.46, 9, 'rgba(190,200,225,0.42)');
  y += 36;

  // The prompt bubble: typed in the input box, then posted into the conversation.
  const typed = clamp01(s.typed ?? 0);
  const posted = clamp01(s.posted ?? 0);
  const inputY = height - 92;
  const bubbleW = width - 48;
  const bubbleH = 64;
  const by = lerp(inputY, y, posted);
  if (typed > 0.001) {
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.fillStyle = posted > 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.05)';
    roundRect(ctx, 24, by, bubbleW, bubbleH, 10);
    ctx.fill();
    ctx.strokeStyle = posted > 0.5 ? 'rgba(255,255,255,0.08)' : human.base;
    ctx.lineWidth = 1.5;
    roundRect(ctx, 24, by, bubbleW, bubbleH, 10);
    ctx.stroke();
    // The request carries a thumbnail of the enemy: "add this enemy, make it split".
    slimeThumb(ctx, 24 + 30, by + 46, 2.6);
    const lines = [0.62, 0.48, 0.3];
    lines.forEach((w, i) => {
      const reveal = seg(typed, i / 3, (i + 1) / 3);
      if (reveal <= 0) return;
      bar(24 + 62, by + 14 + i * 16, (bubbleW - 90) * w * reveal, 8, 'rgba(235,240,250,0.8)');
    });
    // Caret while typing.
    if (typed < 1 && Math.floor(s.time * 2.5) % 2 === 0) {
      const i = Math.min(2, Math.floor(typed * 3));
      const w = (bubbleW - 90) * lines[i] * seg(typed, i / 3, (i + 1) / 3);
      ctx.fillStyle = '#EAF2FF';
      ctx.fillRect(24 + 62 + w + 4, by + 12 + i * 16, 2, 12);
    }
    ctx.restore();
  }
  y += bubbleH + 22;

  // The agent's reply: a code block that writes itself, and a running status.
  const reply = clamp01(s.reply ?? 0);
  if (reply > 0.001 && posted > 0.99) {
    iris(30, y + 10, 9);
    const codeW = width - 74;
    const codeH = 118;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    roundRect(ctx, 50, y, codeW, codeH, 8);
    ctx.fill();
    const widths = [0.5, 0.72, 0.38, 0.64, 0.55, 0.3];
    const colors = [mind.hot, '#7FC8FF', '#E6D17A', '#7FC8FF', mind.hot, '#8ED08A'];
    widths.forEach((w, i) => {
      const reveal = seg(reply, i / widths.length, (i + 1) / widths.length);
      if (reveal <= 0) return;
      bar(64 + (i % 3) * 14, y + 14 + i * 17, (codeW - 40) * w * reveal, 7, colors[i]);
    });
    y += codeH + 18;
  }
  const working = clamp01(s.working ?? 0);
  if (working > 0.001) {
    ctx.save();
    ctx.globalAlpha = working;
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    roundRect(ctx, 50, y, width - 74, 30, 15);
    ctx.fill();
    // Three dots marching: progress, derived from time.
    for (let i = 0; i < 3; i++) {
      const phase = (s.time * 2.2 - i * 0.33) % 1;
      const a = 0.35 + 0.65 * Math.max(0, Math.sin(Math.PI * ((phase + 1) % 1)));
      ctx.fillStyle = `rgba(205,178,255,${a})`;
      ctx.beginPath();
      ctx.arc(70 + i * 14, y + 15, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    bar(116, y + 11, (width - 74) * 0.42, 8, 'rgba(190,200,225,0.45)');
    ctx.restore();
  }

  // Input box with the send button.
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  roundRect(ctx, 24, inputY, bubbleW, bubbleH, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  roundRect(ctx, 24, inputY, bubbleW, bubbleH, 10);
  ctx.stroke();
  ctx.fillStyle = typed > 0.95 && posted < 0.05 ? hot : 'rgba(255,255,255,0.12)';
  roundRect(ctx, width - 24 - 44, inputY + bubbleH / 2 - 15, 30, 30, 8);
  ctx.fill();
  ctx.fillStyle = '#0B0D15';
  ctx.beginPath();
  ctx.moveTo(width - 24 - 44 + 10, inputY + bubbleH / 2 + 7);
  ctx.lineTo(width - 24 - 44 + 15, inputY + bubbleH / 2 - 7);
  ctx.lineTo(width - 24 - 44 + 20, inputY + bubbleH / 2 + 7);
  ctx.lineTo(width - 24 - 44 + 15, inputY + bubbleH / 2 + 3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  if (power < 1) {
    ctx.fillStyle = `rgba(2,2,3,${1 - power})`;
    ctx.fillRect(0, 0, width, height);
  }
};

/* ------------------------------------------------------------------ a terminal / console */

export type TerminalScreenState = {
  readonly time: number;
  readonly theme: Theme;
  /** 0..1 how far the log has progressed. */
  readonly progress?: number;
  /** Lines in the log, as relative widths and a kind. */
  readonly lines?: readonly {readonly w: number; readonly kind?: 'info' | 'ok' | 'warn' | 'mind'}[];
  readonly power?: number;
  readonly title?: string;
};

export const paintTerminal = (ctx: CanvasRenderingContext2D, width: number, height: number, s: TerminalScreenState) => {
  const power = clamp01(s.power ?? 1);
  ctx.fillStyle = '#04050A';
  ctx.fillRect(0, 0, width, height);
  if (power <= 0.001) return;
  const th = s.theme;
  ctx.fillStyle = '#0A0C14';
  ctx.fillRect(0, 0, width, 30);
  if (s.title) {
    ctx.font = `500 13px ${th.font}`;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(190,200,225,0.7)';
    ctx.fillText(s.title, 14, 15);
  }
  const lines = s.lines ?? [
    {w: 0.5},
    {w: 0.72, kind: 'ok'},
    {w: 0.4},
    {w: 0.66, kind: 'mind'},
    {w: 0.3},
    {w: 0.58, kind: 'ok'},
    {w: 0.45, kind: 'mind'},
    {w: 0.7},
    {w: 0.36, kind: 'mind'},
    {w: 0.62},
  ];
  const progress = clamp01(s.progress ?? 1);
  const lh = 20;
  const visible = Math.floor(progress * lines.length * 1.0001);
  const scroll = Math.max(0, visible - Math.floor((height - 50) / lh));
  for (let i = scroll; i < Math.min(lines.length, visible + 1); i++) {
    const l = lines[i];
    const reveal = i < visible ? 1 : seg(progress * lines.length, i, i + 1);
    const y = 44 + (i - scroll) * lh;
    const c = l.kind === 'ok' ? th.tone.safe.base : l.kind === 'warn' ? th.tone.threat.base : l.kind === 'mind' ? th.tone.mind.base : 'rgba(190,200,225,0.55)';
    ctx.fillStyle = 'rgba(190,200,225,0.35)';
    ctx.fillRect(14, y, 22, 7);
    ctx.fillStyle = c;
    ctx.fillRect(44, y, (width - 70) * l.w * reveal, 7);
  }
  // Cursor.
  if (Math.floor(s.time * 2.5) % 2 === 0) {
    const i = Math.min(lines.length, visible);
    ctx.fillStyle = '#EAF2FF';
    ctx.fillRect(14, 44 + (i - scroll) * lh, 8, 12);
  }
  if (power < 1) {
    ctx.fillStyle = `rgba(2,2,3,${1 - power})`;
    ctx.fillRect(0, 0, width, height);
  }
};
