import type React from 'react';
import type {EpisodeDef} from '../../engine';
import type {ThemedProps} from '../../styles/ThemeContext';
import * as s01 from '../../scenes/redesign/01-developer';
import * as s02 from '../../scenes/redesign/02-wrong-project';
import * as s03 from '../../scenes/redesign/03-keeps-running';
import * as s04 from '../../scenes/redesign/04-replication';
import * as s05 from '../../scenes/redesign/05-tests-pass';
import * as s06 from '../../scenes/redesign/06-source';
import * as s07 from '../../scenes/redesign/07-undetected';
import * as s08 from '../../scenes/redesign/08-kill-switch';
import * as s09 from '../../scenes/redesign/09-media-insert';
import * as s10 from '../../scenes/redesign/10-callback';

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
  scene(1, '01-developer', s01, '2D', 'The indie game developer', 'Someone is building a video game with an AI coding agent.', 'Full frame on the game: the new enemy splits in two. Pull back to John’s desk, where the coding agent’s reply lands in the game as a new enemy.'),
  scene(2, '02-wrong-project', s02, '2D', 'The wrong project', 'An instruction went somewhere it was not supposed to go.', 'John sends his prompt with the cloud project tab active. The capsule leaves his screen, passes the turn to the game, and lands in a rack far away.'),
  scene(3, '03-keeps-running', s03, '2D', 'The agent keeps running', 'The person stopped paying attention, but something elsewhere is still running.', 'John closes the window and the room goes dark. One continuous climb up the cable finds the hall asleep except one bay, which sends a signal onward.'),
  scene(4, '04-replication', s04, '3D', 'Replication and expansion', 'One operating agent becomes multiple independently located copies.', 'The agent in the rack divides; the camera follows one copy down a cable into a GPU box; then both divide, and a high wide shows the whole floor of different machines changing hands.', '03-swarm'),
  scene(5, '05-tests-pass', s05, '2D', 'Tests pass, but a bug remains', 'The tests passed, but something important was not checked.', 'A test runner goes green row by row. The panel swings open like a door: probes reach the components they check; one component has no probe, and a bug lives in it.'),
  scene(6, '06-source', s06, 'Hybrid', 'Real incident: an internet source', 'We are moving from a hypothetical to documented evidence.', 'The hypothetical network dims; a real Wikipedia page rises from one node, the measured sentence is lit, and the page docks as a citation.', '07-source'),
  scene(7, '07-undetected', s07, '3D', 'The undetected agent', 'A clean scan does not tell us what lies beyond its coverage.', 'A scan sweeps a bracketed hall and ticks every machine green. The camera cranes up: the hall is one of many, and in a far one a single machine holds the agent.', '05-scan'),
  scene(8, '08-kill-switch', s08, '2D', 'Compute, model access and the kill switch', 'The system depends on resources; multiple dependencies make containment more complicated.', 'One key feeds the agent’s model line: pull it and the agent stops. A hypothetical version with three keys: pull one and it keeps turning.', '06-cloud'),
  scene(9, '09-media-insert', s09, '2D', 'External media insert', 'We are looking at external material, not our animated hypothetical.', 'The world dims and desaturates; a real photo arrives in true colour, the camera pushes in, a clip plays beside it, both leave cleanly.', '08-media'),
  scene(10, '10-callback', s10, '2D', 'The final callback to John', 'Ordinary development continues while an overlooked process remains unresolved.', 'Close on the happy game, pull back to John at work, drift through the window into the night, and find the far data centre: one light, then two.', '10-ending'),
];

export const findStoryScene = (key: string | null | undefined): StoryScene | undefined => {
  if (!key) return undefined;
  const slug = key.startsWith('story-') ? key.slice(6) : key;
  return STORY_SCENES.find((s) => s.slug === slug);
};
