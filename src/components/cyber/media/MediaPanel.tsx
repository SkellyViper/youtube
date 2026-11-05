import {Video} from '@remotion/media';
import React from 'react';
import {Freeze, Img, staticFile, useVideoConfig} from 'remotion';
import {beatClock, useEpisodeFrame, useTimeline} from '../../../engine';
import {alpha, cyber, motion, type Tone} from '../../../styles/cyber';
import {useTheme} from '../../../styles/ThemeContext';
import {themeTone} from '../../../styles/themes';
import {CyberFrame} from '../frame/CyberFrame';
import {fitMedia, frameFor, reframe, type Rect} from '../frame/fit';

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const seg = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));

/** Room left around the frame inside the mirrored wrapper, so brackets and spine are reflected too. */
const PAD = 28;
/** Where CyberFrame puts its caption: this many px under the frame's bottom edge. */
const CAPTION_DROP = 28;

export type MediaPanelProps = {
  /** A still (`<Img>`) or a clip (`<Video>` from @remotion/media, always muted). */
  readonly kind: 'image' | 'video';
  /** Path inside `public/` (resolved with `staticFile`), or an absolute http(s) URL. */
  readonly src: string;
  /** Natural shape of the media: width / height (1340 / 1024, 9 / 16, ...). */
  readonly aspect: number;
  /**
   * The frame's content rectangle in composition px. Animate it with
   * `lerpRect` between two `frameFor(aspect, bounds)` results to move and
   * resize a panel. If its shape differs from `aspect`, `fit` decides.
   */
  readonly rect?: Rect;
  /** Alternative to `rect`: the panel becomes the largest frame of the media's shape inside these bounds. */
  readonly bounds?: Rect;
  /** Where the frame sits inside `bounds` (0..1 each, default centred). */
  readonly align?: {readonly x?: number; readonly y?: number};
  /** Only matters when `rect` is not the media's shape. contain = letterbox, cover = crop (default). Never stretches. */
  readonly fit?: 'contain' | 'cover';
  /** Which part survives a cover crop (0..1 each, default centre). */
  readonly focus?: {readonly x?: number; readonly y?: number};
  /** Colour role of the chrome. Blue = evidence (default). */
  readonly tone?: Tone;
  /** One short line under the frame, sentence case: what it is and the credit. */
  readonly caption?: React.ReactNode;
  /** Optional second caption, right-aligned and dimmer (a date, a source). */
  readonly meta?: React.ReactNode;
  /** Override the caption's visibility (default: follows `open`, leaves first on `exit`). */
  readonly captionOpacity?: number;

  /** 0 -> 1 builds the chrome: brackets, hairlines, spine, then the centre line the aperture opens from. */
  readonly build?: number;
  /** 0 -> 1 opens the aperture and reveals the media. */
  readonly open?: number;
  /**
   * 0 -> 1 plays the whole exit: caption out, aperture closes to a line, the
   * line collapses to a point, the chrome retracts into its corners.
   * Drive it linearly; the panel shapes the phases itself.
   */
  readonly exit?: number;

  /**
   * Focal region for a push-in, as fractions of the media (0..1): the "camera"
   * moves until this region fills the frame. Give it the frame's shape for an
   * exact fit.
   */
  readonly region?: Rect;
  /** 0 -> 1 progress of the push-in towards `region` (ease it in the scene, e.g. `motion.camera`). */
  readonly zoom?: number;
  /** Upper limit of the magnification (default 3). Keep it low for small sources. */
  readonly maxZoom?: number;
  /** 0..1 visibility of the hairline corner marks on `region` (announce the push-in, then fade). */
  readonly regionMarks?: number;

  /**
   * Video only: which moment of the clip is on screen, in seconds. It must be
   * a function of BEAT time, not of the timeline: use `useMediaTime()` below.
   * The clip is rendered frozen on exactly that frame, so a hold shows one
   * still picture and the preview equals the export.
   */
  readonly mediaTime?: number;
  /** Video only: start this many seconds into the file. */
  readonly startAt?: number;
  /** Video only: length of the clip in seconds; the playhead is clamped to its last frame. */
  readonly duration?: number;
  /**
   * Video only, needs `duration`: the frame's bottom edge lights up from the
   * left as the clip plays, so a clip reads as a clip even on a frozen hold
   * frame. Default true.
   */
  readonly progressEdge?: boolean;

  /** Multiplies the picture's brightness (use it to push a panel back in the hierarchy). */
  readonly brightness?: number;
  /** Strength of the light the panel throws around and under itself, 0..1. */
  readonly glow?: number;
  /**
   * Distance in px between the frame's bottom edge and its reflection in the
   * floor (the caption sits in that gap). `false` = no reflection, no pool:
   * use that when the panel is not standing over a floor.
   */
  readonly floor?: number | false;
  /** Whole-panel opacity. */
  readonly opacity?: number;
  /** Extra chrome above the picture, in frame px (e.g. a `RegionHighlight`). */
  readonly overlay?: React.ReactNode;
};

/**
 * MediaPanel: how outside media (a photo, a meme, a screenshot, a clip, a UI
 * recording) is shown in this channel. It is a `CyberFrame` that takes the
 * media's shape, so landscape and portrait assets both sit undistorted, with
 * the rest of the choreography built in and driven by plain 0..1 numbers:
 *
 *   build -> open            entrance (chrome, then aperture)
 *   region + zoom            an editor's push-in on a detail (`reframe`)
 *   rect                     move / resize (lerp between `frameFor` results)
 *   exit                     aperture to a line, line to a point, chrome away
 *   mediaTime                the clip's playhead, in seconds of beat time
 *
 * Nothing in here keeps time: every pixel is a pure function of the props,
 * so the scene decides the timing from its beats.
 *
 *   const enter = useBeat('enter');
 *   <MediaPanel kind="image" src="lab/media/eniac.jpg" aspect={1340 / 1024}
 *     bounds={{x: 120, y: 96, width: 1680, height: 760}}
 *     build={enter.at(0, 0.9, motion.arrive)} open={enter.at(0.7, 1.5, motion.glide)}
 *     caption="ENIAC, c. 1947. US Army photo" />
 *
 *   const t = useMediaTime([{beat: 'play', from: 0.6}, {beat: 'outro'}]);
 *   <MediaPanel kind="video" src="lab/media/clip.mp4" aspect={9 / 16} duration={6}
 *     rect={slot} build={...} open={...} mediaTime={t} />
 *
 * Video notes. The clip is wrapped in `<Freeze frame={mediaTime * fps}>`, so
 * it never follows the raw timeline: in the export the hold frames repeat one
 * picture, in the presenter the paused Player shows that same picture, and
 * the next beat continues from it. Rendering is frame-exact. Encode clips as
 * H.264 MP4, yuv420p, no audio, `+faststart`, a keyframe every 0.5 s or less
 * (`-g 15` at 30 fps) so that stepping through them is cheap. The panel is
 * mounted (and the clip loaded) for as long as the component is rendered, so
 * mount it before its beat with `build={0}` when you can.
 *
 * The media is never stretched and nothing is drawn over it, except the
 * optional `regionMarks` during a push-in and whatever you pass as `overlay`.
 */
export const MediaPanel: React.FC<MediaPanelProps> = ({
  kind,
  src,
  aspect,
  rect,
  bounds,
  align,
  fit = 'cover',
  focus,
  tone = 'system',
  caption,
  meta,
  captionOpacity,
  build = 1,
  open = 1,
  exit = 0,
  region,
  zoom = 0,
  maxZoom = 3,
  regionMarks = 0,
  mediaTime = 0,
  startAt = 0,
  duration,
  progressEdge = true,
  brightness = 1,
  glow = 0.5,
  floor = 96,
  opacity = 1,
  overlay,
}) => {
  const theme = useTheme();
  const {fps, width: compWidth, height: compHeight} = useVideoConfig();
  const t = themeTone(theme, tone);
  const frame = rect ?? frameFor(aspect, bounds ?? {x: cyber.safe.x, y: cyber.safe.y, width: compWidth - cyber.safe.x * 2, height: compHeight - cyber.safe.y * 2}, align);
  const {x, y, width, height} = frame;

  // Exit: the aperture closes during the first half, the chrome retracts during the second.
  const ex = clamp01(exit);
  const openNow = clamp01(open) * (1 - motion.glide(seg(ex, 0.04, 0.5)));
  const buildNow = clamp01(build) * (1 - seg(ex, 0.5, 1));
  const captionNow = (captionOpacity ?? seg(openNow, 0.55, 1)) * (1 - seg(ex, 0, 0.2));
  // A picture "warms up" as the aperture opens.
  const warm = 0.55 + 0.45 * seg(openNow, 0.15, 0.9);
  // The line the aperture opens from / closes to. It grows out of (and
  // collapses into) the centre point with the last part of the chrome.
  const lineHalf = openNow <= 0 ? (width / 2) * motion.glide(seg(buildNow, 0.55, 1)) : 0;
  const lit = seg(buildNow, 0.2, 0.9);
  // The chrome arrives out of depth: it lands the last few percent of its size.
  const settle = 0.965 + 0.035 * seg(buildNow, 0, 0.7);

  // Media placement inside the frame, in frame px. Never stretched.
  const m = fitMedia(aspect, width, height, fit, focus);
  const regionPx = region
    ? {x: m.x + region.x * m.width, y: m.y + region.y * m.height, width: region.width * m.width, height: region.height * m.height}
    : null;
  const z = clamp01(zoom);
  const camera = regionPx && z > 0 ? reframe(regionPx, width, height, z, maxZoom) : undefined;

  const mediaStyle: React.CSSProperties = {position: 'absolute', left: m.x, top: m.y, width: m.width, height: m.height, display: 'block'};
  const url = /^(https?:)?\/\//.test(src) ? src : staticFile(src);

  let picture: React.ReactNode;
  let played = 0;
  if (kind === 'image') {
    picture = <Img src={url} style={mediaStyle} />;
  } else {
    const lastFrame = duration === undefined ? Number.POSITIVE_INFINITY : Math.max(0, Math.round(duration * fps) - 1);
    const playhead = Math.min(lastFrame, Math.max(0, Math.round(mediaTime * fps)));
    played = duration !== undefined && progressEdge ? clamp01(playhead / Math.max(1, lastFrame)) : 0;
    picture = (
      <Freeze frame={playhead}>
        <Video src={url} muted trimBefore={startAt > 0 ? Math.round(startAt * fps) : undefined} objectFit="fill" showInTimeline={false} style={mediaStyle} />
      </Freeze>
    );
  }

  const marks = regionPx && regionMarks > 0.001 ? clamp01(regionMarks) : 0;
  const arm = regionPx ? Math.min(22, regionPx.width / 5, regionPx.height / 5) : 0;

  const reflectGap = floor === false ? 0 : Math.max(0, floor - PAD * 2);
  const hover = floor === false ? 0 : floor;

  // While the panel is invisible the tree stays exactly the same (only
  // hidden), so the media remains mounted, decoded and on the right frame:
  // the first visible frame never waits for a decoder.
  const visible = buildNow > 0.001 && opacity > 0.001;

  return (
    <div style={{position: 'absolute', inset: 0, visibility: visible ? 'visible' : 'hidden', pointerEvents: 'none'}}>
      {/* Light pooled on the floor under the panel. */}
      {floor !== false ? (
        <div
          style={{
            position: 'absolute',
            left: x - width * 0.2,
            top: y + height + hover * 0.5 - 60,
            width: width * 1.4,
            height: 120,
            opacity: opacity * glow * (0.35 * lit + 0.65 * openNow),
            background: `radial-gradient(ellipse 50% 50% at 50% 50%, ${alpha(t.base, 0.34)} 0%, ${alpha(t.deep, 0.2)} 45%, transparent 100%)`,
          }}
        />
      ) : null}
      {/* The panel and, in the obsidian floor, its mirror image. */}
      <div
        style={{
          position: 'absolute',
          left: x - PAD,
          top: y - PAD,
          width: width + PAD * 2,
          height: height + PAD * 2,
          opacity,
          transform: settle < 1 ? `scale(${settle.toFixed(4)})` : undefined,
          ...(floor !== false
            ? {WebkitBoxReflect: `below ${reflectGap}px linear-gradient(to bottom, transparent 0%, transparent 55%, rgba(0, 0, 0, 0.07) 76%, rgba(0, 0, 0, 0.34) 100%)`}
            : null),
        }}
      >
        <CyberFrame x={PAD} y={PAD} width={width} height={height} tone={tone} build={Math.max(buildNow, 0.002)} open={openNow} brightness={brightness * warm} glow={glow} overlay={overlay}>
          <div style={{position: 'absolute', inset: 0, transformOrigin: '0 0', transform: camera}}>
            {picture}
            {marks > 0 && regionPx ? (
              <svg width={width} height={height} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
                <g stroke={t.hot} strokeWidth={cyber.line.thin} fill="none" opacity={0.95 * marks} vectorEffect="non-scaling-stroke">
                  {(() => {
                    const {x: rx, y: ry, width: rw, height: rh} = regionPx;
                    // The marks close in on the region from slightly outside.
                    const s = (1 - marks) * 18;
                    return (
                      <>
                        <path vectorEffect="non-scaling-stroke" d={`M${rx - s} ${ry - s + arm}V${ry - s}H${rx - s + arm}`} />
                        <path vectorEffect="non-scaling-stroke" d={`M${rx + rw + s - arm} ${ry - s}H${rx + rw + s}V${ry - s + arm}`} />
                        <path vectorEffect="non-scaling-stroke" d={`M${rx + rw + s} ${ry + rh + s - arm}V${ry + rh + s}H${rx + rw + s - arm}`} />
                        <path vectorEffect="non-scaling-stroke" d={`M${rx - s + arm} ${ry + rh + s}H${rx - s}V${ry + rh + s - arm}`} />
                      </>
                    );
                  })()}
                </g>
              </svg>
            ) : null}
          </div>
        </CyberFrame>
        {/* A clip's bottom edge is its timeline: it lights up as the clip plays. */}
        {played > 0 && openNow > 0 ? (
          <div
            style={{
              position: 'absolute',
              left: PAD,
              top: PAD + height - cyber.line.thin / 2,
              width: width * played,
              height: cyber.line.thin,
              opacity: openNow,
              background: `linear-gradient(to right, ${alpha(t.base, 0.55)}, ${t.hot})`,
              boxShadow: `0 0 ${cyber.glow2d.soft}px ${alpha(t.base, 0.6)}`,
            }}
          />
        ) : null}
        {/* The closed aperture: one line, which collapses to a point. */}
        {lineHalf > 0.2 ? (
          <div
            style={{
              position: 'absolute',
              left: PAD + width / 2 - lineHalf,
              top: PAD + height / 2 - cyber.line.thin / 2,
              width: lineHalf * 2,
              height: cyber.line.thin,
              backgroundColor: t.hot,
              opacity: 0.9,
              boxShadow: `0 0 ${cyber.glow2d.soft}px ${alpha(t.base, 0.8)}`,
            }}
          />
        ) : null}
      </div>
      {caption || meta ? (
        <div
          style={{
            position: 'absolute',
            left: x,
            top: y + height + CAPTION_DROP,
            width,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: 32,
            opacity: opacity * captionNow,
            transform: captionNow < 1 ? `translateY(${((1 - captionNow) * 8).toFixed(2)}px)` : undefined,
            color: cyber.color.text,
            fontSize: cyber.size.label,
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
            ...cyber.labelStyle,
          }}
        >
          <span>{caption}</span>
          {meta ? <span style={{color: cyber.color.dim}}>{meta}</span> : null}
        </div>
      ) : null}
    </div>
  );
};

/** One stretch of beat time during which a clip plays. */
export type PlaySegment = {
  /** Beat id. */
  readonly beat: string;
  /** Seconds into the beat at which the clip starts (or resumes). Default 0. */
  readonly from?: number;
  /** Seconds into the beat at which it stops. Default: the end of the beat. */
  readonly until?: number;
  /** Playback speed during this stretch. Default 1. */
  readonly rate?: number;
};

/**
 * The playhead of a clip, in seconds, as a function of BEAT time: it runs
 * while the listed beats play and stands still in between, so a hold shows a
 * frozen picture and the next beat picks up exactly where the last one
 * stopped. Pass the result to `<MediaPanel mediaTime>`.
 *
 *   const t = useMediaTime([{beat: 'media-pair', from: 0.7}, {beat: 'media-exit'}]);
 */
export const useMediaTime = (segments: readonly PlaySegment[]): number => {
  const timeline = useTimeline();
  const frame = useEpisodeFrame();
  let seconds = 0;
  for (const s of segments) {
    const clock = beatClock(timeline, s.beat, frame);
    const from = Math.max(0, s.from ?? 0);
    const until = Math.min(clock.duration, s.until ?? clock.duration);
    if (until <= from) continue;
    seconds += Math.min(until - from, Math.max(0, clock.time - from)) * (s.rate ?? 1);
  }
  return seconds;
};
