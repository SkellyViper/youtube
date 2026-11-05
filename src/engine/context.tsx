import {createContext, useContext} from 'react';
import {useCurrentFrame} from 'remotion';
import type {Timeline} from './types';

export const TimelineContext = createContext<Timeline | null>(null);

/**
 * Scenes and layers are mounted inside Remotion <Sequence>s, where
 * useCurrentFrame() is relative to the sequence. This context stores the
 * sequence offset so engine hooks can always work in absolute episode frames.
 */
export const MountOffsetContext = createContext<number>(0);

export const useTimeline = (): Timeline => {
  const timeline = useContext(TimelineContext);
  if (!timeline) {
    throw new Error('useTimeline() must be used inside an <EpisodeComposition>.');
  }
  return timeline;
};

/** Absolute frame within the episode, regardless of the Sequence nesting. */
export const useEpisodeFrame = (): number => {
  const frame = useCurrentFrame();
  const offset = useContext(MountOffsetContext);
  return frame + offset;
};
