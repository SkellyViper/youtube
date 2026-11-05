import type {Timeline} from '../../engine';

/**
 * Map a frame of one timeline onto the *matching* frame of another: same beat
 * index, same fraction of that beat's animation (holds map to the beat's
 * completed frame). This is how the compare view keeps an original and a
 * redesign, or two themes, on equivalent moments even when their beat
 * lengths differ.
 */
export const matchFrame = (from: Timeline, frame: number, to: Timeline): number => {
  if (from === to) return Math.max(0, Math.min(to.durationInFrames - 1, Math.round(frame)));
  const a = from.beats;
  const b = to.beats;
  if (frame < a[0].start) return Math.round((frame / Math.max(1, a[0].start)) * b[0].start);
  let i = a.length - 1;
  while (i > 0 && frame < a[i].start) i--;
  const beat = a[i];
  const p = Math.min(1, (frame - beat.start) / Math.max(1, beat.animEnd - beat.start));
  const target = b[Math.min(i, b.length - 1)];
  const mapped = i < b.length ? target.start + p * (target.animEnd - target.start) : target.animEnd;
  return Math.max(0, Math.min(to.durationInFrames - 1, Math.round(mapped)));
};
