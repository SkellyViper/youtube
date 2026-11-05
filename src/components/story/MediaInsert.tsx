import React from 'react';
import {AbsoluteFill} from 'remotion';
import {frameFor, lerpRect, type Rect} from '../cyber/frame/fit';
import {MediaPanel} from '../cyber/media/MediaPanel';
import {cyber, motion, type Tone} from '../../styles/cyber';
import {useTheme} from '../../styles/ThemeContext';
import {clamp01, seg} from './math';

/**
 * Evidence stepping in: how the animated world steps back while real material
 * (a page, a photo, a clip) is on screen. Two halves, used together:
 *
 *   worldStepBack(dim)   a style for the element that holds the world: it
 *                        desaturates and darkens with `dim` (0..1). No style
 *                        at 0, so resting frames stay pixel-identical.
 *   <EvidenceVeil dim>   a flat veil in the theme's void colour, drawn between
 *                        the world and the evidence.
 */
export const worldStepBack = (dim: number): React.CSSProperties => {
  const d = clamp01(dim);
  if (d <= 0.001) return {};
  return {filter: `saturate(${(1 - 0.85 * d).toFixed(3)}) brightness(${(1 - 0.4 * d).toFixed(3)})`};
};

export const EvidenceVeil: React.FC<{readonly dim: number; readonly strength?: number}> = ({dim, strength = 0.58}) => {
  const th = useTheme();
  const d = clamp01(dim);
  if (d <= 0.001) return null;
  return <AbsoluteFill style={{backgroundColor: th.color.void, opacity: d * strength, pointerEvents: 'none'}} />;
};

/* ------------------------------------------------------------------ MediaInsert */

export type MediaInsertItem = {
  readonly kind: 'image' | 'video';
  /** Path under public/ or an absolute URL. */
  readonly src: string;
  /** Natural width / height. The frame takes this shape; the media is never stretched. */
  readonly aspect: number;
  /** What it is and the credit, sentence case. */
  readonly caption: React.ReactNode;
  /** Right-aligned secondary line (a date, a source). */
  readonly meta?: React.ReactNode;
  /** Push-in target as fractions of the media (0..1). Only the first item is pushed into. */
  readonly region?: Rect;
  readonly maxZoom?: number;
  /** Video: clip length in seconds (clamps the playhead, draws the progress edge). */
  readonly duration?: number;
  /** Video: playhead in seconds of BEAT time (from `useMediaTime`). */
  readonly mediaTime?: number;
  readonly startAt?: number;
};

export type MediaInsertLayout = 'single' | 'pair';

/** Default stage: the safe area, with room under the frames for a reflection and a caption. */
export const MEDIA_STAGE: Rect = {x: cyber.safe.x, y: 92, width: 1920 - cyber.safe.x * 2, height: 730};

export type MediaInsertProps = {
  readonly items: readonly MediaInsertItem[];
  /** single: the first item alone. pair: all items side by side (the first glides over from its single position as `pair` runs). */
  readonly layout: MediaInsertLayout;
  readonly stage?: Rect;
  /** Gap between paired frames, px. */
  readonly gap?: number;
  /* Progress values, all LINEAR 0..1; the insert applies the house curves. */
  /** The first item arrives: chrome builds, then the aperture opens. */
  readonly enter?: number;
  /** An editor's push-in on the first item's `region` (released when `pair` runs). */
  readonly emphasis?: number;
  /** The move from one frame to the pair: the first steps aside, the others build and open. */
  readonly pair?: number;
  /** Everything leaves, staggered. */
  readonly exit?: number;
  /** 0..1 how far the world behind has stepped back; draws the veil. (Put `worldStepBack(worldDim)` on the world itself.) */
  readonly worldDim?: number;
  readonly tone?: Tone;
  /** Passed to each MediaPanel: reflection distance, or false. */
  readonly floor?: number | false;
  /** Anything to draw in composition space relative to the frames (connectors, notes). */
  readonly children?: (rects: readonly Rect[]) => React.ReactNode;
};

/**
 * Where each item's frame sits, in composition px. Pure, so a scene can place
 * other things relative to the frames with the same numbers the insert uses.
 */
export const mediaInsertRects = (items: readonly MediaInsertItem[], layout: MediaInsertLayout, stage: Rect = MEDIA_STAGE, pair = 0, gap = 60): Rect[] => {
  if (items.length === 0) return [];
  const hero = frameFor(items[0].aspect, stage, {y: 1});
  const n = Math.max(1, items.length);
  const colW = (stage.width - gap * (n - 1)) / n;
  const slots = items.map((it, i) => frameFor(it.aspect, {x: stage.x + i * (colW + gap), y: stage.y, width: colW, height: stage.height}, {x: n === 1 ? 0.5 : i === 0 ? 1 : i === n - 1 ? 0 : 0.5, y: 1}));
  if (layout === 'single') return items.map((_, i) => (i === 0 ? hero : slots[i]));
  const q = motion.glide(clamp01(pair));
  return items.map((_, i) => (i === 0 ? lerpRect(hero, slots[0], q) : slots[i]));
};

/**
 * MediaInsert: any image, clip, meme or screenshot dropped into a scene as
 * external material. It composes `MediaPanel`s (true colour, aspect-correct,
 * credit line) and owns the choreography every such insert needs:
 *
 *   enter      the first frame arrives (chrome, then aperture)
 *   emphasis   push-in on a detail of the first item
 *   pair       the first frame steps aside and the next one(s) join it
 *   exit       all frames leave, staggered
 *   worldDim   the veil over the world behind
 *
 * Pure: numbers in, pixels out. Videos stay mounted (hidden) before their
 * beat so their first visible frame is never late; drive their playhead with
 * `useMediaTime` in the scene and pass it as `mediaTime` on the item.
 */
export const MediaInsert: React.FC<MediaInsertProps> = ({items, layout, stage = MEDIA_STAGE, gap = 60, enter = 1, emphasis = 0, pair = 0, exit = 0, worldDim = 0, tone = 'system', floor, children}) => {
  const rects = mediaInsertRects(items, layout, stage, layout === 'pair' ? pair : 0, gap);
  const pairQ = layout === 'pair' ? clamp01(pair) : 0;
  const exitQ = clamp01(exit);
  // First item: chrome, then aperture.
  const build0 = motion.arrive(seg(enter, 0, 0.55));
  const open0 = motion.glide(seg(enter, 0.4, 1));
  // The push-in and its release when the pair forms.
  const zoom = motion.camera(clamp01(emphasis)) * (1 - motion.glide(seg(pairQ, 0, 0.7)));
  const marks = motion.arrive(seg(emphasis, 0, 0.25)) * (1 - seg(emphasis, 0.5, 0.85));
  // Joiners: build in the space the first frame has just left, then open.
  const joinOpen = motion.glide(seg(pairQ, 0.65, 1));
  return (
    <>
      <EvidenceVeil dim={worldDim} />
      {items.map((it, i) => {
        const k = Math.max(0, i - 1);
        const build = i === 0 ? build0 : motion.arrive(seg(pairQ, 0.35 + 0.1 * k, 0.8 + 0.1 * k));
        const open = i === 0 ? open0 : motion.glide(seg(pairQ, 0.65 + 0.1 * k, 1));
        const out = seg(exitQ, 0.1 * i, 0.75 + 0.1 * i);
        return (
          <MediaPanel
            key={i}
            kind={it.kind}
            src={it.src}
            aspect={it.aspect}
            rect={rects[i]}
            tone={tone}
            caption={it.caption}
            meta={it.meta}
            build={build}
            open={open}
            exit={out}
            region={i === 0 ? it.region : undefined}
            zoom={i === 0 ? zoom : 0}
            maxZoom={it.maxZoom ?? 2}
            regionMarks={i === 0 ? marks : 0}
            mediaTime={it.mediaTime}
            startAt={it.startAt}
            duration={it.duration}
            brightness={i === 0 ? 1 - 0.14 * joinOpen : 1}
            glow={i === 0 ? 0.5 - 0.15 * joinOpen : 0.65}
            floor={floor}
          />
        );
      })}
      {children ? children(rects) : null}
    </>
  );
};
