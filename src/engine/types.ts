import type {ComponentType} from 'react';

/**
 * A beat is the smallest independently-triggered unit of animation.
 *
 * - In presentation mode, one ArrowRight press plays one beat and the
 *   animation then holds on the beat's completed state indefinitely.
 * - In export mode, the beat plays for `duration` seconds and its completed
 *   state is held for `hold` seconds before the next beat starts.
 *
 * Both modes read the same timeline, so the visuals are identical.
 */
export type BeatDef = {
  /** Unique id within the episode. Scenes and layers look beats up by id. */
  readonly id: string;
  /** Human readable name shown in the developer HUD. */
  readonly label?: string;
  /** Animation length in seconds. */
  readonly duration: number;
  /** Export-only: seconds to hold the completed state. Defaults to `episode.defaultHold`. */
  readonly hold?: number;
  /**
   * Presentation-only: start this beat automatically as soon as the previous
   * beat finishes (no key press). Useful for chaining an intro sequence.
   */
  readonly auto?: boolean;
  /** Speaker notes, shown in the developer HUD. */
  readonly notes?: string;
};

export type SceneDef = {
  readonly id: string;
  readonly title: string;
  readonly beats: readonly BeatDef[];
  /**
   * Optional visual component. It is mounted for exactly the scene's time
   * range. Visuals that must persist across scenes belong in `layers`.
   */
  readonly component?: ComponentType;
};

/**
 * A layer is a visual mounted across an arbitrary range of the episode,
 * e.g. a diagram that keeps evolving through several scenes. This is how
 * spatial continuity between scenes is achieved without hard cuts.
 */
export type LayerDef = {
  readonly id: string;
  readonly component: ComponentType;
  /** Scene id or beat id. Layer mounts at its start. Default: episode start. */
  readonly from?: string;
  /** Scene id or beat id. Layer unmounts at its end. Default: episode end. */
  readonly to?: string;
  /** Stacking order. Scenes use z = 0. Higher is in front. Default 1. */
  readonly z?: number;
};

export type EpisodeDef = {
  readonly id: string;
  readonly title: string;
  readonly width?: number;
  readonly height?: number;
  /** Export-only: seconds the initial state is shown before the first beat. */
  readonly leadIn?: number;
  /** Export-only: default hold (seconds) after each beat. */
  readonly defaultHold?: number;
  /** Export-only: extra seconds appended after the last beat's hold. */
  readonly tail?: number;
  readonly background?: string;
  readonly scenes: readonly SceneDef[];
  readonly layers?: readonly LayerDef[];
};

export type TimedBeat = {
  readonly index: number;
  readonly id: string;
  readonly label: string;
  readonly notes: string;
  readonly auto: boolean;
  readonly sceneId: string;
  readonly sceneIndex: number;
  readonly indexInScene: number;
  /** First frame of the animation (progress 0). */
  readonly start: number;
  /** Frame on which the animation is complete (progress 1). This is the checkpoint frame. */
  readonly animEnd: number;
  /** Exclusive end of the beat including its hold. Equals the next beat's start. */
  readonly end: number;
  readonly durationInFrames: number;
  readonly holdInFrames: number;
};

export type TimedScene = {
  readonly index: number;
  readonly id: string;
  readonly title: string;
  readonly start: number;
  /** Exclusive. */
  readonly end: number;
  readonly firstBeat: number;
  readonly lastBeat: number;
};

export type Timeline = {
  readonly episodeId: string;
  readonly fps: number;
  readonly durationInFrames: number;
  readonly beats: readonly TimedBeat[];
  readonly scenes: readonly TimedScene[];
  /**
   * checkpoints[0] is the initial state (frame 0). checkpoints[i] (i >= 1) is
   * the completed state of beat i - 1. Presentation mode only ever rests on
   * these frames.
   */
  readonly checkpoints: readonly number[];
  readonly beatById: ReadonlyMap<string, TimedBeat>;
  readonly sceneById: ReadonlyMap<string, TimedScene>;
};
