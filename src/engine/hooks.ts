import {useMemo} from 'react';
import {beatClock, type BeatClock} from './beat';
import {useEpisodeFrame, useTimeline} from './context';
import {evaluateScalarTrack, evaluateTrack, type TrackSegment} from './track';
import type {Timeline} from './types';

/** Frame-driven clock for one beat (see BeatClock). */
export const useBeat = (id: string): BeatClock => {
  const timeline = useTimeline();
  const frame = useEpisodeFrame();
  return beatClock(timeline, id, frame);
};

/** Several beat clocks at once, keyed by id. */
export const useBeats = <K extends string>(ids: readonly K[]): Record<K, BeatClock> => {
  const timeline = useTimeline();
  const frame = useEpisodeFrame();
  const result = {} as Record<K, BeatClock>;
  for (const id of ids) {
    result[id] = beatClock(timeline, id, frame);
  }
  return result;
};

/** A multi-beat numeric vector property (see evaluateTrack). */
export const useTrack = (
  initial: readonly number[],
  segments: readonly TrackSegment<readonly number[]>[],
): number[] => {
  const timeline = useTimeline();
  const frame = useEpisodeFrame();
  return evaluateTrack(timeline, frame, initial, segments);
};

export const useScalarTrack = (initial: number, segments: readonly TrackSegment<number>[]): number => {
  const timeline = useTimeline();
  const frame = useEpisodeFrame();
  return evaluateScalarTrack(timeline, frame, initial, segments);
};

/**
 * Seconds of *animation* that have elapsed: the sum of every beat's clamped
 * local time, so it advances while a beat plays and stands still during
 * holds. Use it for ambient motion (slow rotation, drift) that should keep
 * moving across beats: because it ignores hold frames, a beat's completed
 * frame and the next beat's first frame are still identical, which is what
 * lets presentation mode rest on a checkpoint indefinitely.
 */
export const useActiveTime = (): number => {
  const timeline = useTimeline();
  const frame = useEpisodeFrame();
  return activeTimeAt(timeline, frame);
};

export const activeTimeAt = (timeline: Timeline, frame: number): number => {
  let frames = 0;
  for (const b of timeline.beats) {
    if (frame <= b.start) break;
    frames += Math.min(frame - b.start, b.durationInFrames);
  }
  return frames / timeline.fps;
};

/** Memoize expensive static data (e.g. generated diagram geometry) once per mount. */
export const useStatic = <T,>(factory: () => T): T => useMemo(factory, []); // eslint-disable-line react-hooks/exhaustive-deps
