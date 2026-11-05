import type React from 'react';
import type {EpisodeDef} from '../../engine';
import type {ThemedProps} from '../../styles/ThemeContext';
import * as s02 from '../../scenes/redesign/02-wrong-project';

/**
 * The redesigned, story-driven scenes. Each one is a "concept" of a scene in
 * the first episode; some have an original (legacy) counterpart in the first
 * Style Lab, listed under `legacy` so the gallery can offer Original | Redesign.
 * Legacy samples that match no brief stay in the gallery under "Legacy
 * experiments" and are never relabelled as a scene's original version.
 */
export type StoryKind = '2D' | '3D' | 'Hybrid';

export type StoryScene = {
  /** Composition id, e.g. `story-02-wrong-project`. */
  readonly id: string;
  readonly slug: string;
  readonly number: number;
  readonly title: string;
  readonly kind: StoryKind;
  /** What a muted viewer should understand. */
  readonly understand: string;
  /** One line for the gallery. */
  readonly idea: string;
  /** Slug of the legacy sample that attempted the same idea, if any. */
  readonly legacy?: string;
  readonly episode: EpisodeDef;
  readonly component: React.ComponentType<ThemedProps>;
  /** Built yet? Unbuilt scenes show as planned in the gallery. */
  readonly status: 'built' | 'planned';
};

type Mod = {readonly episode: EpisodeDef; readonly Sample: React.ComponentType<ThemedProps>};

const scene = (number: number, slug: string, mod: Mod, kind: StoryKind, title: string, understand: string, idea: string, legacy?: string): StoryScene => ({
  id: `story-${slug}`,
  slug,
  number,
  title,
  kind,
  understand,
  idea,
  legacy,
  episode: mod.episode,
  component: mod.Sample,
  status: 'built',
});

export const STORY_SCENES: readonly StoryScene[] = [
  scene(
    2,
    '02-wrong-project',
    s02,
    '2D',
    'The wrong project',
    'An instruction went somewhere it was not supposed to go.',
    'John sends his prompt with the cloud project tab active. The capsule leaves his screen, passes the turn to the game, and lands in a rack far away.',
    '06-cloud',
  ),
];

export const findStoryScene = (key: string | null | undefined): StoryScene | undefined => {
  if (!key) return undefined;
  const slug = key.startsWith('story-') ? key.slice(6) : key;
  return STORY_SCENES.find((s) => s.slug === slug);
};
