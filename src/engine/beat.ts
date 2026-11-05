import {interpolate, spring as remotionSpring} from 'remotion';
import type {Timeline, TimedBeat} from './types';

export type EasingFn = (t: number) => number;

export type SpringOptions = {
  /** Seconds the spring takes to settle. Default: the rest of the beat. */
  readonly duration?: number;
  readonly damping?: number;
  readonly mass?: number;
  readonly stiffness?: number;
  readonly overshootClamping?: boolean;
};

export type StaggerOptions = {
  /** Seconds into the beat the first item starts. Default 0. */
  readonly start?: number;
  /** Seconds between consecutive items. */
  readonly each: number;
  /** Seconds each item animates for. */
  readonly dur: number;
  readonly easing?: EasingFn;
};

/**
 * A frame-driven clock for one beat. All values are pure functions of the
 * absolute frame. The local frame is clamped to [0, durationInFrames], which
 * is what guarantees that a beat "holds" its completed state forever.
 */
export type BeatClock = {
  readonly beat: TimedBeat;
  readonly fps: number;
  /** Local frame, clamped to [0, durationInFrames]. */
  readonly frame: number;
  /** Local time in seconds, clamped. */
  readonly time: number;
  readonly durationInFrames: number;
  /** Beat duration in seconds. */
  readonly duration: number;
  /** Linear progress 0..1. */
  readonly progress: number;
  /** True once the first animation frame has been reached. */
  readonly started: boolean;
  /** True once the completed state has been reached. */
  readonly done: boolean;
  /** 0..1 over [from, to] seconds since the beat start (clamped, optionally eased). */
  at(from: number, to: number, easing?: EasingFn): number;
  /** A Remotion spring that starts `delay` seconds in and is guaranteed to reach exactly 1. */
  spring(delay?: number, options?: SpringOptions): number;
  /** Progress of item `i` in a staggered group. */
  stagger(i: number, options: StaggerOptions): number;
};

const warned = new Set<string>();
const warnOnce = (key: string, message: string) => {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(message);
};

export const getBeat = (timeline: Timeline, id: string): TimedBeat => {
  const beat = timeline.beatById.get(id);
  if (!beat) {
    throw new Error(`Unknown beat "${id}" in episode "${timeline.episodeId}"`);
  }
  return beat;
};

export const beatClock = (timeline: Timeline, id: string, absoluteFrame: number): BeatClock => {
  const beat = getBeat(timeline, id);
  const {fps} = timeline;
  const durationInFrames = beat.durationInFrames;
  const raw = absoluteFrame - beat.start;
  const frame = Math.min(Math.max(raw, 0), durationInFrames);
  const duration = durationInFrames / fps;

  const at = (from: number, to: number, easing?: EasingFn): number => {
    if (to > duration + 1e-6) {
      warnOnce(
        `${id}:${from}:${to}`,
        `[engine] beat "${id}": sub-animation ends at ${to}s but the beat is only ${duration.toFixed(3)}s long; it will be frozen before completing.`,
      );
    }
    if (to <= from) return frame >= from * fps ? 1 : 0;
    return interpolate(frame, [from * fps, to * fps], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing,
    });
  };

  const spring = (delay = 0, options: SpringOptions = {}): number => {
    const delayFrames = delay * fps;
    const settleFrames = Math.max(1, Math.round((options.duration ?? duration - delay) * fps));
    const f = frame - delayFrames;
    if (f <= 0) return 0;
    if (f >= settleFrames) return 1;
    return remotionSpring({
      frame: f,
      fps,
      durationInFrames: settleFrames,
      config: {
        damping: options.damping ?? 18,
        mass: options.mass ?? 1,
        stiffness: options.stiffness ?? 120,
        overshootClamping: options.overshootClamping ?? false,
      },
    });
  };

  const stagger = (i: number, options: StaggerOptions): number => {
    const start = (options.start ?? 0) + i * options.each;
    return at(start, start + options.dur, options.easing);
  };

  return {
    beat,
    fps,
    frame,
    time: frame / fps,
    durationInFrames,
    duration,
    progress: frame / durationInFrames,
    started: raw >= 0,
    done: raw >= durationInFrames,
    at,
    spring,
    stagger,
  };
};
