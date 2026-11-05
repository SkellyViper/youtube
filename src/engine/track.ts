import {beatClock, type EasingFn} from './beat';
import type {Timeline} from './types';

/**
 * One keyframe transition of a property, bound to a beat.
 * `from` / `until` are seconds relative to the beat start (default: whole beat).
 */
export type TrackSegment<T> = {
  readonly beat: string;
  readonly to: T;
  readonly from?: number;
  readonly until?: number;
  readonly easing?: EasingFn;
};

/**
 * Evaluate a property that changes across many beats (camera position,
 * a diagram's layout, a colour...). Segments are applied in order; each one
 * blends from the value produced by the previous segments towards its `to`.
 * Before a segment's beat starts it has no effect; after it completes it has
 * fully applied. The result is deterministic and seekable to any frame.
 */
export const evaluateTrack = (
  timeline: Timeline,
  frame: number,
  initial: readonly number[],
  segments: readonly TrackSegment<readonly number[]>[],
): number[] => {
  const value = initial.slice();
  for (const segment of segments) {
    const clock = beatClock(timeline, segment.beat, frame);
    const p = clock.at(segment.from ?? 0, segment.until ?? clock.duration, segment.easing);
    if (p <= 0) continue;
    for (let i = 0; i < value.length; i++) {
      value[i] = value[i] + (segment.to[i] - value[i]) * p;
    }
  }
  return value;
};

export const evaluateScalarTrack = (
  timeline: Timeline,
  frame: number,
  initial: number,
  segments: readonly TrackSegment<number>[],
): number =>
  evaluateTrack(
    timeline,
    frame,
    [initial],
    segments.map((s) => ({...s, to: [s.to]})),
  )[0];
