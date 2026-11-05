import React from 'react';
import {cyber} from '../../../styles/cyber';
import {Curve2, type Pt} from './curve';

/**
 * A small family of abstract objects for technical diagrams, drawn in the
 * same instrument-like line language as CyberFrame's chrome: hairlines, thin
 * plates, corner brackets. Each has a distinct silhouette and a visible
 * "activated" state, so a diagram made of them reads as a system of things
 * rather than circles joined by lines. Place inside an <svg>.
 *
 *   message   a capsule holding three short bars of different lengths (a prompt, a request)
 *   service   a chamfered block with process lines and an indicator (a running program)
 *   store     three stacked plates (a database); `act` pulls one plate out and re-slots it on top
 *   queue     a bracketed row of cells; `act` fills them left to right
 *   endpoint  an open ring with a line leaving it (an external system, the outside world)
 *   ledger    a tall plate with written lines; `act` writes one more
 *   switch    a lever between two posts; `act` closes it
 *
 * Common props: `level` 0 = unlit structure (steel), 1 = lit in `color`;
 * `appear` 0..1 builds it on; `act` 0..1 plays its state change; `bracket`
 * 0..1 stands four corner brackets just off it (emphasis).
 */
export type PictogramKind = 'message' | 'service' | 'store' | 'queue' | 'endpoint' | 'ledger' | 'switch';

export type PictogramProps = {
  readonly x: number;
  readonly y: number;
  /** Nominal width in px (the message capsule is exactly this wide). Default 96. */
  readonly size?: number;
  /** Lit stroke colour (a tone's `base`). */
  readonly color?: string;
  /** Hot accent (a tone's `hot`). */
  readonly hot?: string;
  /** 0 = unlit structure, 1 = lit. */
  readonly level?: number;
  /** 0..1 build-on. */
  readonly appear?: number;
  /** 0..1 state change; meaning depends on the kind (see above). */
  readonly act?: number;
  /** 0..1 corner brackets standing just off the pictogram. */
  readonly bracket?: number;
  readonly opacity?: number;
};

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const smooth = (t: number) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};
const seg = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const fx = (n: number) => n.toFixed(2);

/** Accepts `#rgb`, `#rrggbb` and `rgb()` / `rgba()` strings (the output of `mix`). */
const parseColor = (c: string): [number, number, number] => {
  if (c.startsWith('#')) {
    const h = c.slice(1);
    const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = c.match(/[\d.]+/g);
  return m && m.length >= 3 ? [Number(m[0]), Number(m[1]), Number(m[2])] : [0, 0, 0];
};

/** rgba() of a blend between two colours. */
const tint = (a: string, b: string, t: number, opacity: number): string => {
  const A = parseColor(a);
  const B = parseColor(b);
  const k = clamp01(t);
  return `rgba(${Math.round(A[0] + (B[0] - A[0]) * k)}, ${Math.round(A[1] + (B[1] - A[1]) * k)}, ${Math.round(A[2] + (B[2] - A[2]) * k)}, ${clamp01(opacity).toFixed(3)})`;
};

/** Half extents (px) of each kind at `size`; links attach just outside these. */
export const pictogramExtent = (kind: PictogramKind, size = 96): {readonly w: number; readonly h: number} => {
  const u = size / 96;
  switch (kind) {
    case 'message':
      return {w: 48 * u, h: 23 * u};
    case 'service':
      return {w: 39 * u, h: 31 * u};
    case 'store':
      return {w: 42 * u, h: 29 * u};
    case 'queue':
      return {w: 52 * u, h: 16 * u};
    case 'endpoint':
      return {w: 36 * u, h: 22 * u};
    case 'ledger':
      return {w: 25 * u, h: 33 * u};
    case 'switch':
      return {w: 40 * u, h: 16 * u};
  }
};

type Ink = {
  readonly lit: number;
  readonly line: string;
  readonly hot: string;
  readonly lineOp: number;
  readonly plate: string;
  readonly haloOp: number;
  readonly color: string;
};

const makeInk = (level: number, color: string, hot: string): Ink => {
  const lit = clamp01(level);
  return {
    lit,
    color,
    line: tint(cyber.color.steel, color, lit, 1),
    hot: tint(cyber.color.steel, hot, lit, 1),
    lineOp: 0.64 + 0.36 * lit,
    plate: tint(cyber.color.slate, color, lit * 0.4, 0.5 + 0.15 * lit),
    haloOp: 0.16 * lit,
  };
};

/** Outline with a wide faint underlay when lit (cheap glow, no filter). */
const Outline: React.FC<{readonly d: string; readonly ink: Ink; readonly width?: number; readonly fill?: string}> = ({d, ink, width = cyber.line.hair, fill = 'none'}) => (
  <>
    {ink.haloOp > 0.005 ? <path d={d} fill="none" stroke={ink.color} strokeWidth={width + 7} opacity={ink.haloOp} strokeLinejoin="round" /> : null}
    <path d={d} fill={fill} stroke={ink.line} strokeWidth={width} opacity={ink.lineOp} strokeLinejoin="round" />
  </>
);

/** Shared placement, pool of light, build-on and the emphasis brackets. */
const Frame: React.FC<{
  readonly x: number;
  readonly y: number;
  readonly u: number;
  readonly ink: Ink;
  readonly hw: number;
  readonly hh: number;
  readonly appear: number;
  readonly bracket: number;
  readonly opacity: number;
  /** Build-on is handled by the child (draw-on) instead of scale + fade. */
  readonly ownAppear?: boolean;
  readonly children: React.ReactNode;
}> = ({x, y, u, ink, hw, hh, appear, bracket, opacity, ownAppear = false, children}) => {
  if (appear <= 0.001 || opacity <= 0.001) return null;
  const a = ownAppear ? 1 : smooth(appear);
  const off = 9 * u;
  const arm = 10 * u;
  const spread = (1 - smooth(bracket)) * 7 * u;
  const X = hw + off + spread;
  const Y = hh + off + spread;
  // Light pooled behind the object follows its shape, so a tall plate does not sit in a round blob.
  const px = hw * 1.9 + 6 * u;
  const py = hh * 2.2 + 10 * u;
  return (
    <g transform={`translate(${fx(x)} ${fx(y)})${a < 1 ? ` scale(${fx(0.85 + 0.15 * a)})` : ''}`} opacity={opacity * (ownAppear ? 1 : a)}>
      {ink.lit > 0.02 ? (
        <>
          <ellipse rx={px} ry={py} fill={ink.color} opacity={0.04 * ink.lit} />
          <ellipse rx={px * 0.62} ry={py * 0.62} fill={ink.color} opacity={0.07 * ink.lit} />
        </>
      ) : null}
      {children}
      {bracket > 0.001 ? (
        <path
          d={`M${fx(-X)} ${fx(-Y + arm)}V${fx(-Y)}H${fx(-X + arm)}M${fx(X - arm)} ${fx(-Y)}H${fx(X)}V${fx(-Y + arm)}M${fx(X)} ${fx(Y - arm)}V${fx(Y)}H${fx(X - arm)}M${fx(-X + arm)} ${fx(Y)}H${fx(-X)}V${fx(Y - arm)}`}
          fill="none"
          stroke={ink.color}
          strokeWidth={cyber.line.thin}
          opacity={smooth(bracket)}
        />
      ) : null}
    </g>
  );
};

type Resolved = Required<Omit<PictogramProps, 'size' | 'color' | 'hot'>> & {readonly u: number; readonly ink: Ink};

const resolve = (p: PictogramProps): Resolved => {
  const color = p.color ?? cyber.color.blue;
  const hot = p.hot ?? cyber.color.blueHot;
  return {
    x: p.x,
    y: p.y,
    u: (p.size ?? 96) / 96,
    ink: makeInk(p.level ?? 0, color, hot),
    level: p.level ?? 0,
    appear: p.appear ?? 1,
    act: p.act ?? 0,
    bracket: p.bracket ?? 0,
    opacity: p.opacity ?? 1,
  };
};

/* ------------------------------------------------------------------ message */

const stadium = (w: number, h: number): Curve2 => {
  const r = h / 2;
  const hx = w / 2 - r;
  const pts: Pt[] = [{x: 0, y: -r}];
  pts.push({x: hx, y: -r});
  for (let i = 1; i <= 16; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / 16;
    pts.push({x: hx + Math.cos(a) * r, y: Math.sin(a) * r});
  }
  pts.push({x: -hx, y: r});
  for (let i = 1; i <= 16; i++) {
    const a = Math.PI / 2 + (Math.PI * i) / 16;
    pts.push({x: -hx + Math.cos(a) * r, y: Math.sin(a) * r});
  }
  pts.push({x: 0, y: -r});
  return new Curve2(pts);
};

const STADIUM = stadium(96, 46);
const BARS = [
  {y: -11, len: 44, hot: true},
  {y: 0, len: 30, hot: false},
  {y: 11, len: 38, hot: false},
] as const;

/** The prompt: a capsule holding three short bars of different lengths. Builds on by drawing its outline. */
export const MessageCapsule: React.FC<PictogramProps> = (props) => {
  const {x, y, u, ink, appear, act, bracket, opacity} = resolve(props);
  const outline = STADIUM.slice(0, seg(appear, 0, 0.7));
  const send = smooth(act);
  return (
    <Frame x={x} y={y} u={u} ink={ink} hw={48 * u} hh={23 * u} appear={appear} bracket={bracket} opacity={opacity} ownAppear>
      <g transform={u === 1 ? undefined : `scale(${fx(u)})`}>
        {outline ? <Outline d={outline} ink={ink} /> : null}
        {BARS.map((bar, i) => {
          const grow = smooth(seg(appear, 0.3 + i * 0.14, 0.72 + i * 0.14));
          if (grow <= 0) return null;
          // `act` nudges the content towards the exit: the message is being sent.
          const x0 = -26 + send * 6;
          return (
            <path
              key={i}
              d={`M${fx(x0)} ${bar.y}H${fx(x0 + bar.len * grow)}`}
              stroke={bar.hot ? ink.hot : ink.line}
              strokeWidth={3}
              strokeLinecap="round"
              opacity={(bar.hot ? 1 : 0.85) * ink.lineOp}
            />
          );
        })}
      </g>
    </Frame>
  );
};

/* ------------------------------------------------------------------ service */

const SERVICE_D = 'M-31 -31H19L31 -19V31H-31Z';

/** A running program: chamfered block, process lines, an indicator. `act` writes a third line and lights the indicator. */
export const ServiceBlock: React.FC<PictogramProps> = (props) => {
  const {x, y, u, ink, appear, act, bracket, opacity} = resolve(props);
  const a = smooth(act);
  const line3 = 32 * smooth(seg(act, 0.1, 0.8));
  return (
    <Frame x={x} y={y} u={u} ink={ink} hw={39 * u} hh={31 * u} appear={appear} bracket={bracket} opacity={opacity}>
      <g transform={u === 1 ? undefined : `scale(${fx(u)})`}>
        <Outline d={SERVICE_D} ink={ink} fill={ink.plate} />
        {/* Ports. */}
        <path d="M-31 0H-39M31 0H39" stroke={ink.line} strokeWidth={cyber.line.hair} opacity={ink.lineOp} />
        {/* Process lines. */}
        <path d="M-18 -10H10M-18 0H2" stroke={ink.line} strokeWidth={cyber.line.hair} opacity={ink.lineOp} strokeLinecap="round" />
        {line3 > 0 ? <path d={`M-18 10H${fx(-18 + line3)}`} stroke={ink.hot} strokeWidth={cyber.line.thin} opacity={ink.lineOp} strokeLinecap="round" /> : null}
        {/* Indicator. */}
        <rect x={16} y={16} width={8} height={8} fill={a > 0.5 ? ink.hot : ink.plate} stroke={ink.line} strokeWidth={cyber.line.hair} opacity={ink.lineOp} />
        {a > 0.02 ? <rect x={16 - 5 * a} y={16 - 5 * a} width={8 + 10 * a} height={8 + 10 * a} fill="none" stroke={ink.hot} strokeWidth={cyber.line.hair} opacity={0.5 * Math.sin(Math.PI * a)} /> : null}
      </g>
    </Frame>
  );
};

/* ------------------------------------------------------------------ store */

const PLATE_W = 84;
const PLATE_H = 13;
const PLATE_STEP = 22;

/** A database: three stacked plates. `act` pulls the middle plate out, lifts it and re-slots it on top, lit. */
export const DataStore: React.FC<PictogramProps> = (props) => {
  const {x, y, u, ink, appear, act, bracket, opacity} = resolve(props);
  const a = smooth(act);
  const lift = smooth(seg(act, 0.1, 0.9));
  const plates: readonly {readonly key: string; readonly px: number; readonly py: number; readonly hot: number}[] = [
    {key: 'c', px: 0, py: PLATE_STEP, hot: 0},
    {key: 'a', px: 0, py: -PLATE_STEP + PLATE_STEP * lift, hot: 0},
    {key: 'b', px: Math.sin(Math.PI * a) * 36, py: -PLATE_STEP * lift, hot: seg(act, 0.35, 0.75)},
  ];
  return (
    <Frame x={x} y={y} u={u} ink={ink} hw={42 * u} hh={29 * u} appear={appear} bracket={bracket} opacity={opacity}>
      <g transform={u === 1 ? undefined : `scale(${fx(u)})`}>
        {plates.map((p) => (
          <g key={p.key} transform={`translate(${fx(p.px)} ${fx(p.py)})`}>
            <rect x={-PLATE_W / 2} y={-PLATE_H / 2} width={PLATE_W} height={PLATE_H} rx={2} fill={p.hot > 0 ? tint(cyber.color.slate, props.color ?? cyber.color.blue, 0.4 + 0.5 * p.hot, 0.65 + 0.3 * p.hot) : ink.plate} stroke={p.hot > 0.5 ? ink.hot : ink.line} strokeWidth={cyber.line.hair} opacity={ink.lineOp} />
            {/* A short label hairline on each plate. */}
            <path d="M-34 0H-16" stroke={p.hot > 0.5 ? ink.hot : ink.line} strokeWidth={cyber.line.hair} opacity={0.8 * ink.lineOp} strokeLinecap="round" />
            {p.hot > 0 ? <circle cx={30} cy={0} r={2.2} fill={ink.hot} opacity={p.hot} /> : null}
          </g>
        ))}
      </g>
    </Frame>
  );
};

/* ------------------------------------------------------------------ queue */

const QUEUE_CELLS = 5;

/** A queue: a bracketed row of cells. `act` fills them left to right. */
export const Queue: React.FC<PictogramProps> = (props) => {
  const {x, y, u, ink, appear, act, bracket, opacity} = resolve(props);
  return (
    <Frame x={x} y={y} u={u} ink={ink} hw={52 * u} hh={16 * u} appear={appear} bracket={bracket} opacity={opacity}>
      <g transform={u === 1 ? undefined : `scale(${fx(u)})`}>
        <Outline d="M-45 -15H-52V15H-45M45 -15H52V15H45" ink={ink} />
        {Array.from({length: QUEUE_CELLS}, (_, i) => {
          const cx = -34 + i * 17;
          const fill = smooth(seg(act, i * 0.14, 0.4 + i * 0.14));
          return (
            <g key={i}>
              <path d={`M${cx} -9V9`} stroke={ink.line} strokeWidth={cyber.line.hair} opacity={ink.lineOp} />
              {fill > 0 ? <path d={`M${cx} ${fx(-9 * fill)}V${fx(9 * fill)}`} stroke={ink.hot} strokeWidth={6} opacity={ink.lineOp} /> : null}
            </g>
          );
        })}
        <path d="M-34 15H34" stroke={ink.line} strokeWidth={cyber.line.hair} opacity={0.5 * ink.lineOp} />
      </g>
    </Frame>
  );
};

/* ------------------------------------------------------------------ endpoint */

const ENDPOINT_RING = Curve2.arc(0, 0, 22, 0.62, Math.PI * 2 - 0.62).d;

/** An external system: an open ring with a line leaving it. `act` extends the line and flares its end. */
export const Endpoint: React.FC<PictogramProps> = (props) => {
  const {x, y, u, ink, appear, act, bracket, opacity} = resolve(props);
  const a = smooth(act);
  return (
    <Frame x={x} y={y} u={u} ink={ink} hw={36 * u} hh={22 * u} appear={appear} bracket={bracket} opacity={opacity}>
      <g transform={u === 1 ? undefined : `scale(${fx(u)})`}>
        <Outline d={ENDPOINT_RING} ink={ink} />
        <circle r={2.6} fill={ink.hot} opacity={ink.lineOp} />
        <path d={`M20 0H${fx(28 + 8 * a)}`} stroke={ink.line} strokeWidth={cyber.line.hair} opacity={ink.lineOp} strokeLinecap="round" />
        <circle cx={31 + 8 * a} cy={0} r={2.6 + 1.4 * a} fill={a > 0.5 ? ink.hot : ink.line} opacity={ink.lineOp} />
        {a > 0.02 ? <circle cx={31 + 8 * a} cy={0} r={5 + 7 * a} fill="none" stroke={ink.hot} strokeWidth={cyber.line.hair} opacity={0.6 * Math.sin(Math.PI * a) + 0.25 * a} /> : null}
      </g>
    </Frame>
  );
};

/* ------------------------------------------------------------------ ledger */

const LEDGER_D = 'M-25 -33H15L25 -23V33H-25Z';
const LEDGER_LINES = [
  {y: -18, len: 30},
  {y: -8, len: 22},
  {y: 2, len: 30},
  {y: 12, len: 18},
] as const;

/** A log or document: a tall plate with written lines. `act` writes one more, hot. */
export const Ledger: React.FC<PictogramProps> = (props) => {
  const {x, y, u, ink, appear, act, bracket, opacity} = resolve(props);
  const write = 26 * smooth(seg(act, 0.1, 0.9));
  return (
    <Frame x={x} y={y} u={u} ink={ink} hw={25 * u} hh={33 * u} appear={appear} bracket={bracket} opacity={opacity}>
      <g transform={u === 1 ? undefined : `scale(${fx(u)})`}>
        <Outline d={LEDGER_D} ink={ink} fill={ink.plate} />
        <path d="M15 -33V-23H25" stroke={ink.line} strokeWidth={cyber.line.hair} opacity={ink.lineOp} fill="none" />
        <path d={LEDGER_LINES.map((l) => `M-17 ${l.y}H${-17 + l.len}`).join('')} stroke={ink.line} strokeWidth={cyber.line.hair} opacity={ink.lineOp} strokeLinecap="round" />
        {write > 0 ? <path d={`M-17 22H${fx(-17 + write)}`} stroke={ink.hot} strokeWidth={cyber.line.thin} opacity={ink.lineOp} strokeLinecap="round" /> : null}
      </g>
    </Frame>
  );
};

/* ------------------------------------------------------------------ switch */

/** A lever between two posts. `act` closes it; the contact lights. */
export const Switch: React.FC<PictogramProps> = (props) => {
  const {x, y, u, ink, appear, act, bracket, opacity} = resolve(props);
  const a = smooth(act);
  const angle = (-30 * Math.PI) / 180 * (1 - a);
  const len = 50;
  const tip = {x: -26 + Math.cos(angle) * len, y: Math.sin(angle) * len};
  const closed = seg(act, 0.8, 1);
  return (
    <Frame x={x} y={y} u={u} ink={ink} hw={40 * u} hh={16 * u} appear={appear} bracket={bracket} opacity={opacity}>
      <g transform={u === 1 ? undefined : `scale(${fx(u)})`}>
        {/* Base and posts. */}
        <Outline d="M-40 16H40M-26 16V-16M26 16V-16M-30 -16H-22M22 -16H30" ink={ink} />
        {/* Lever. */}
        <path d={`M-26 0L${fx(tip.x)} ${fx(tip.y)}`} stroke={ink.line} strokeWidth={cyber.line.thin} opacity={ink.lineOp} strokeLinecap="round" />
        <circle cx={-26} cy={0} r={2.8} fill={ink.line} opacity={ink.lineOp} />
        <circle cx={26} cy={0} r={2.4} fill={closed > 0 ? ink.hot : ink.line} opacity={ink.lineOp} />
        {closed > 0 ? <circle cx={26} cy={0} r={5 + 3 * closed} fill="none" stroke={ink.hot} strokeWidth={cyber.line.hair} opacity={0.5 * closed} /> : null}
      </g>
    </Frame>
  );
};

/* ------------------------------------------------------------------ dispatcher */

const BY_KIND: Record<PictogramKind, React.FC<PictogramProps>> = {
  message: MessageCapsule,
  service: ServiceBlock,
  store: DataStore,
  queue: Queue,
  endpoint: Endpoint,
  ledger: Ledger,
  switch: Switch,
};

/** Any pictogram by kind; handy for data-driven diagrams. */
export const Pictogram: React.FC<PictogramProps & {readonly kind: PictogramKind}> = ({kind, ...props}) => {
  const C = BY_KIND[kind];
  return <C {...props} />;
};
