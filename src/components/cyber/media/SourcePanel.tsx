import React from 'react';
import {Easing, Img, staticFile} from 'remotion';
import {alpha, cyber, motion, type Tone} from '../../../styles/cyber';
import {useTheme} from '../../../styles/ThemeContext';
import {themeTone} from '../../../styles/themes';
import {CyberFrame, RegionHighlight} from '../frame/CyberFrame';
import {fitMedia, frameFor, type Rect} from '../frame/fit';

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const seg = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const f2 = (n: number) => n.toFixed(2);

/** The travel curve of an arriving panel: a visible approach, then a long soft landing. */
const approach = Easing.bezier(0.2, 0.72, 0.16, 1);
const SHADE = '3, 4, 9';

/* ------------------------------------------------------------------ geometry helpers */

/**
 * The content rect for a source of the given pixel size inside `bounds`
 * (largest fit, never stretched), snapped to whole pixels so hairlines and
 * text land on the pixel grid when the panel is at rest.
 */
export const sourceRect = (naturalWidth: number, naturalHeight: number, bounds: Rect, align: {x?: number; y?: number} = {}): Rect => {
  const r = frameFor(naturalWidth / naturalHeight, bounds, align);
  return {x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height)};
};

export type SourceView = {readonly zoom: number; readonly x: number; readonly y: number};

/**
 * The camera inside the frame, as numbers: content point c is drawn at
 * `c * zoom + (x, y)`. Same move as `reframe()` in ../frame/fit (log-space
 * zoom, clamped to the content edges), but `focus` only fills `fill` of the
 * box, and the numbers are returned so overlays can follow the content.
 */
export const sourceView = (focus: Rect, boxWidth: number, boxHeight: number, progress: number, fill = 0.72, maxZoom = 4): SourceView => {
  const p = clamp01(progress);
  const target = Math.max(1, Math.min(maxZoom, (boxWidth * fill) / focus.width, (boxHeight * fill) / focus.height));
  const zoom = Math.exp(Math.log(target) * p);
  const cx = focus.x + focus.width / 2;
  const cy = focus.y + focus.height / 2;
  return {
    zoom,
    x: Math.min(0, Math.max(boxWidth - boxWidth * zoom, (boxWidth / 2 - cx * zoom) * p)),
    y: Math.min(0, Math.max(boxHeight - boxHeight * zoom, (boxHeight / 2 - cy * zoom) * p)),
  };
};

const bounding = (rects: readonly Rect[]): Rect => {
  const x0 = Math.min(...rects.map((r) => r.x));
  const y0 = Math.min(...rects.map((r) => r.y));
  const x1 = Math.max(...rects.map((r) => r.x + r.width));
  const y1 = Math.max(...rects.map((r) => r.y + r.height));
  return {x: x0, y: y0, width: x1 - x0, height: y1 - y0};
};

/* ------------------------------------------------------------------ passage highlight */

/**
 * RegionHighlight for running text. Give it the line boxes of a passage (as
 * measured by `Range.getClientRects()`; see scripts/lab-capture.mjs) and it
 * lights exactly that passage: the first line starts where the passage
 * starts, the last line ends where it ends, full lines in between. Everything
 * else is dimmed; four brackets mark the reading corners. Nothing is drawn
 * over the text itself. Same look and `progress` behaviour as RegionHighlight.
 *
 * Coordinates are px in the element it is placed in.
 */
export const PassageHighlight: React.FC<{
  readonly lines: readonly Rect[];
  /** 0..1 */
  readonly progress: number;
  readonly tone?: Tone;
  /** How much the rest is darkened at progress 1 (0..1). */
  readonly dim?: number;
  readonly pad?: number;
}> = ({lines, progress, tone = 'system', dim = 0.62, pad = 10}) => {
  const theme = useTheme();
  if (progress <= 0.001 || lines.length === 0) return null;
  const t = themeTone(theme, tone);
  const p = clamp01(progress);
  const rows = [...lines].sort((a, b) => a.y - b.y);
  const n = rows.length;
  const L = Math.min(...rows.map((r) => r.x));
  const R = Math.max(...rows.map((r) => r.x + r.width));
  // A passage that starts / ends within a few px of the column edge is treated as flush.
  const snap = 0.35 * rows[0].height;
  const startX = rows[0].x - L < snap ? L : rows[0].x;
  const lastRight = rows[n - 1].x + rows[n - 1].width;
  const endX = R - lastRight < snap ? R : lastRight;
  // Bands: each line owns the space up to half-way to its neighbours, so no glyph is cut.
  const top = rows.map((r, i) => (i === 0 ? r.y - pad : (rows[i - 1].y + rows[i - 1].height + r.y) / 2));
  const bottom = rows.map((r, i) => (i === n - 1 ? r.y + r.height + pad : (r.y + r.height + rows[i + 1].y) / 2));
  const left = rows.map((_, i) => (i === 0 ? startX : L) - pad);
  const right = rows.map((_, i) => (i === n - 1 ? endX : R) + pad);

  // Outline, clockwise from the start corner.
  const pts: [number, number][] = [
    [left[0], top[0]],
    [right[0], top[0]],
  ];
  for (let i = 0; i < n; i++) {
    pts.push([right[i], bottom[i]]);
    if (i < n - 1 && right[i + 1] !== right[i]) pts.push([right[i + 1], bottom[i]]);
  }
  pts.push([left[n - 1], bottom[n - 1]]);
  for (let i = n - 1; i > 0; i--) {
    pts.push([left[i], top[i]]);
    if (left[i - 1] !== left[i]) pts.push([left[i - 1], top[i]]);
  }
  const outline = `M${pts.map(([x, y]) => `${f2(x)} ${f2(y)}`).join('L')}Z`;

  const arm = Math.min(22, (right[0] - left[0]) / 3, (bottom[0] - top[0]) * 0.8);
  // The brackets close in from slightly outside.
  const s = (1 - p) * 26;
  const A = [left[0] - s, top[0] - s];
  const B = [right[0] + s, top[0] - s];
  const C = [right[n - 1] + s, bottom[n - 1] + s];
  const D = [left[n - 1] - s, bottom[n - 1] + s];
  return (
    <svg style={{position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none'}}>
      <path d={`M-20000 -20000H20000V20000H-20000Z${outline}`} fillRule="evenodd" fill={`rgba(${SHADE}, ${(dim * p).toFixed(3)})`} />
      <path d={outline} fill="none" stroke={alpha(t.hot, 0.35 * p)} strokeWidth={cyber.line.hair} />
      <g stroke={t.base} strokeWidth={cyber.line.medium} fill="none" opacity={p}>
        <path d={`M${f2(A[0])} ${f2(A[1] + arm)}V${f2(A[1])}H${f2(A[0] + arm)}`} />
        <path d={`M${f2(B[0] - arm)} ${f2(B[1])}H${f2(B[0])}V${f2(B[1] + arm)}`} />
        <path d={`M${f2(C[0])} ${f2(C[1] - arm)}V${f2(C[1])}H${f2(C[0] - arm)}`} />
        <path d={`M${f2(D[0] + arm)} ${f2(D[1])}H${f2(D[0])}V${f2(D[1] - arm)}`} />
      </g>
    </svg>
  );
};

/* ------------------------------------------------------------------ the panel */

export type SourcePanelProps = {
  /** Image path under public/ (given to `staticFile`), or an absolute URL. Capture web pages at 2x. */
  readonly src: string;
  /** Size of the image in its own pixels. Decides the frame's shape; the image is never stretched. */
  readonly naturalWidth: number;
  readonly naturalHeight: number;
  /** Content rect when presented, in composition px. Use `sourceRect(w, h, bounds)`. */
  readonly rect: Rect;
  /** Content rect when docked as a citation (`dock` = 1). */
  readonly dockRect?: Rect;
  /** Colour role of the chrome. Blue = evidence (default). */
  readonly tone?: Tone;
  /** One short line under the frame: the source name or domain. Sentence case. */
  readonly caption?: string;
  /** Secondary line, right-aligned: a date. Fades out when docked. */
  readonly meta?: string;
  /**
   * What `emphasis` points at, in SOURCE IMAGE pixels: one rect, or the line
   * boxes of a passage (lights exactly the sentence). Measure it, do not guess.
   */
  readonly highlight?: Rect | readonly Rect[];
  /** What the inner camera frames at emphasis 1 (image px). Default: the bounding box of `highlight`. */
  readonly focus?: Rect;

  /* Progress values, all LINEAR 0..1 (pass `beat.at(from, to)` without easing; the panel applies the house curves). */
  /** Arrival out of depth: small and tilted -> flat at `rect`, chrome building, page dormant, a seam of light at the end. */
  readonly enter?: number;
  /** The aperture opens from the centre line, the page reaches full brightness, caption and date appear. */
  readonly read?: number;
  /** A camera move inside the frame towards `highlight`, which is bracketed while the rest dims. */
  readonly emphasis?: number;
  /** Releases the emphasis and shrinks to `dockRect`: frame + one-line caption, a little dimmer. */
  readonly dock?: number;

  /* Tuning (all optional). */
  /** Where it arrives from: a point in composition px (e.g. a node on the horizon), its size there, its tilt. */
  readonly from?: {readonly x?: number; readonly y?: number; readonly scale?: number; readonly rotateY?: number; readonly rotateX?: number};
  /** CSS perspective distance in px for the tilt. Smaller = stronger keystone. */
  readonly perspective?: number;
  /** Fraction of the frame the focus fills at emphasis 1. */
  readonly focusFill?: number;
  readonly maxZoom?: number;
  /** How much everything but the highlight is darkened (0..1). */
  readonly highlightDim?: number;
  /** Brightness of the page before it is read (0..1). */
  readonly dormant?: number;
  /** Brightness of the page once docked (0..1). */
  readonly dockBrightness?: number;
  /** Sideways turn (degrees) at the middle of the docking move; flat again at rest. */
  readonly dockTilt?: number;
  /** Multiplied over the page so pure white sits in the palette. `null` = untouched. */
  readonly paper?: string | null;
};

/**
 * SourcePanel: a real web page, paper, post or document brought into the
 * world as evidence. A `CyberFrame` holding one image, with the four moves
 * every episode needs, each a plain 0..1 progress value:
 *
 *   enter     arrives out of depth (perspective tilt), chrome builds, page dormant
 *   read      aperture opens from the centre line, full brightness, caption + date
 *   emphasis  inner camera reframes to a measured passage; the rest dims, brackets land
 *   dock      releases, shrinks to a corner citation (frame + caption)
 *
 * Pure: progress in, pixels out. No clocks, no state. Typical use:
 *
 *   const b = useBeats(['src-enter', 'src-read', 'src-emphasis', 'src-dock']);
 *   <SourcePanel
 *     src="lab/media/source-morris-worm.png" naturalWidth={3000} naturalHeight={1880}
 *     rect={sourceRect(3000, 1880, bounds)} dockRect={corner}
 *     caption="en.wikipedia.org" meta="Retrieved 4 Nov 2026"
 *     highlight={measured.regions.passage.lines}
 *     enter={b['src-enter'].at(0, 1.8)} read={b['src-read'].at(0, 1.4)}
 *     emphasis={b['src-emphasis'].at(0, 2.2)} dock={b['src-dock'].at(0, 1.3)}
 *   />
 *
 * Any screenshot works: portrait or landscape, the frame takes its shape.
 * At rest (no tilt) nothing is transformed, so text and hairlines are pixel-crisp.
 * Arrival and dock both recompute the rect rather than CSS-scaling the panel,
 * so the chrome keeps its line weight at every size; only the tilt is a transform.
 */
export const SourcePanel: React.FC<SourcePanelProps> = ({
  src,
  naturalWidth,
  naturalHeight,
  rect,
  dockRect,
  tone = 'system',
  caption,
  meta,
  highlight,
  focus,
  enter = 1,
  read = 1,
  emphasis = 0,
  dock = 0,
  from,
  perspective = 1500,
  focusFill = 0.72,
  maxZoom = 4,
  highlightDim = 0.62,
  dormant = 0.2,
  dockBrightness = 0.74,
  dockTilt = 12,
  paper = '#E9F0FF',
}) => {
  const theme = useTheme();
  const url = /^(https?:|data:|blob:)/.test(src) ? src : staticFile(src);
  // Before it enters, keep the image loaded and decoded so the first frame of its arrival is never late in the live Player.
  if (enter <= 0.001) return <Img src={url} style={{position: 'absolute', left: 0, top: 0, width: 1, height: 1, opacity: 0, pointerEvents: 'none'}} />;
  const t = themeTone(theme, tone);

  /* ---- where the frame rests: presented rect -> docked rect ---- */
  const q = dockRect ? motion.glide(seg(dock, 0.1, 1)) : 0;
  const target = dockRect ?? rect;
  // Size in log space (an even shrink), centre along a straight line.
  const restW = rect.width * Math.pow(target.width / rect.width, q);
  const restH = rect.height * Math.pow(target.height / rect.height, q);
  const restX = lerp(rect.x + rect.width / 2, target.x + target.width / 2, q);
  const restY = lerp(rect.y + rect.height / 2, target.y + target.height / 2, q);

  /* ---- arrival: the rect itself grows from a small far one (never a CSS scale), so hairlines keep their weight ---- */
  const near = approach(clamp01(enter));
  const grow = Math.pow(from?.scale ?? 0.16, 1 - near);
  const width = restW * grow;
  const height = restH * grow;
  const cx = lerp(from?.x ?? restX, restX, near);
  const cy = lerp(from?.y ?? restY, restY, near);
  const settled = enter >= 1 && (q <= 0 || q >= 1);
  const x = settled ? Math.round(cx - width / 2) : cx - width / 2;
  const y = settled ? Math.round(cy - height / 2) : cy - height / 2;
  const turnIn = 1 - motion.glide(seg(enter, 0.06, 1));
  const rotateY = (from?.rotateY ?? -24) * turnIn + dockTilt * Math.sin(Math.PI * q);
  const rotateX = (from?.rotateX ?? 4) * turnIn;
  const tilted = Math.abs(rotateY) > 0.001 || Math.abs(rotateX) > 0.001;
  const transform = tilted ? `perspective(${perspective}px) rotateX(${rotateX.toFixed(3)}deg) rotateY(${rotateY.toFixed(3)}deg)` : undefined;

  /* ---- light: dormant page -> seam -> aperture ---- */
  const wake = seg(enter, 0.1, 0.55);
  const seam = motion.glide(seg(enter, 0.74, 1));
  const aperture = motion.glide(seg(read, 0, 0.84));
  const halfW = (width / 2) * seam;
  const halfH = lerp(2, height / 2, aperture) * (seam > 0 ? 1 : 0);
  const shade = 1 - dormant * wake;
  const edge = seam * (1 - seg(aperture, 0.8, 1));
  const captionIn = motion.arrive(seg(read, 0.45, 1));

  /* ---- the camera inside the frame ---- */
  const fit = fitMedia(naturalWidth / naturalHeight, width, height, 'contain');
  // A rect that matches the image's shape to within a pixel (whole-pixel rounding) is simply filled.
  const media = width - fit.width < 1 && height - fit.height < 1 ? {x: 0, y: 0, width, height} : fit;
  const k = media.width / naturalWidth;
  const toBox = (r: Rect): Rect => ({x: media.x + r.x * k, y: media.y + r.y * k, width: r.width * k, height: r.height * k});
  const lines = highlight ? (Array.isArray(highlight) ? (highlight as readonly Rect[]) : [highlight as Rect]).map(toBox) : [];
  const release = motion.glide(seg(dock, 0, 0.45));
  const viewP = lines.length > 0 ? motion.camera(clamp01(emphasis)) * (1 - release) : 0;
  const view = viewP > 0 ? sourceView(focus ? toBox(focus) : bounding(lines), width, height, viewP, focusFill, maxZoom) : {zoom: 1, x: 0, y: 0};
  const onScreen = (r: Rect): Rect => ({x: r.x * view.zoom + view.x, y: r.y * view.zoom + view.y, width: r.width * view.zoom, height: r.height * view.zoom});
  const mark = motion.arrive(seg(emphasis, 0.3, 0.95)) * (1 - seg(dock, 0, 0.22));
  const marked = lines.map(onScreen);

  const overlay = (
    <>
      {marked.length === 1 ? <RegionHighlight {...marked[0]} progress={mark} tone={tone} dim={highlightDim} /> : null}
      {marked.length > 1 ? <PassageHighlight lines={marked} progress={mark} tone={tone} dim={highlightDim} /> : null}
      {/* Docked: the page steps back in the hierarchy. */}
      {q > 0 ? <div style={{position: 'absolute', inset: 0, backgroundColor: `rgba(${SHADE}, ${((1 - dockBrightness) * q).toFixed(3)})`}} /> : null}
      {/* The shutter: everything outside the aperture stays dormant. */}
      {aperture < 1 ? (
        <div
          style={{
            position: 'absolute',
            left: width / 2 - halfW,
            top: height / 2 - halfH,
            width: halfW * 2,
            height: halfH * 2,
            boxShadow: `0 0 0 9999px rgba(${SHADE}, ${shade.toFixed(3)})`,
          }}
        />
      ) : null}
      {edge > 0.001 ? (
        <svg style={{position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none'}}>
          {[-1, 1].map((side) => {
            const d = `M${f2(width / 2 - halfW)} ${f2(height / 2 + side * halfH)}H${f2(width / 2 + halfW)}`;
            return (
              <g key={side} opacity={edge}>
                <path d={d} stroke={t.base} strokeWidth={9} opacity={0.2} />
                <path d={d} stroke={t.hot} strokeWidth={cyber.line.thin} />
              </g>
            );
          })}
        </svg>
      ) : null}
    </>
  );

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        opacity: seg(enter, 0, 0.1),
        transformOrigin: `${f2(cx)}px ${f2(cy)}px`,
        transform,
      }}
    >
      <CyberFrame
        x={x}
        y={y}
        width={width}
        height={height}
        tone={tone}
        build={seg(enter, 0.02, 0.8)}
        glow={0.18 + 0.42 * aperture - 0.3 * q}
        caption={caption ? <span style={{whiteSpace: 'nowrap'}}>{caption}</span> : undefined}
        meta={meta ? <span style={{whiteSpace: 'nowrap', opacity: 1 - seg(dock, 0, 0.3)}}>{meta}</span> : undefined}
        captionOpacity={captionIn}
        overlay={overlay}
      >
        <div style={{position: 'absolute', inset: 0, isolation: 'isolate'}}>
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width,
              height,
              transformOrigin: '0 0',
              transform: view.zoom !== 1 ? `translate(${view.x.toFixed(3)}px, ${view.y.toFixed(3)}px) scale(${view.zoom.toFixed(5)})` : undefined,
            }}
          >
            <Img
              src={url}
              style={{position: 'absolute', display: 'block', maxWidth: 'none', left: media.x, top: media.y, width: media.width, height: media.height}}
            />
          </div>
          {paper ? <div style={{position: 'absolute', inset: 0, backgroundColor: paper, mixBlendMode: 'multiply'}} /> : null}
        </div>
      </CyberFrame>
    </div>
  );
};
