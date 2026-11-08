import type React from 'react';
import type {EpisodeDef} from '../../engine';
import type {ThemedProps} from '../../styles/ThemeContext';
import * as x01 from '../../scenes/cinematic/01-john';
import * as x02 from '../../scenes/cinematic/02-wrong-project';
import * as x03 from '../../scenes/cinematic/03-still-running';
import * as x04 from '../../scenes/cinematic/04-swarm';
import * as x05 from '../../scenes/cinematic/05-blind-spot';
import * as x06 from '../../scenes/cinematic/06-evidence';

/**
 * The cinematic 3D experiments: six physically staged reenactments of the
 * first episode's key moments, built on the Fern-informed cinematography
 * playbook (docs/CINEMATIC_VISUAL_LANGUAGE.md). Each one is a third "concept"
 * of a story scene, next to the legacy Original and the 2D Redesign, so the
 * gallery can offer all three and compare them beat for beat.
 */
export type CinematicScene = {
  /** Composition id and URL slug, e.g. `cine-01-john`. */
  readonly id: string;
  readonly slug: string;
  readonly number: number;
  readonly title: string;
  readonly kind: '3D' | 'Hybrid';
  /** What a muted viewer should understand. */
  readonly understand: string;
  /** One line for the gallery. */
  readonly idea: string;
  /** The redesign scene (2D story) this experiment is an alternative to, if any. */
  readonly story?: string;
  /** The legacy sample that attempted the same idea, if any. */
  readonly legacy?: string;
  /** Which filmmaking principles the experiment tests (for the playbook's cross-references). */
  readonly tests: readonly string[];
  readonly episode: EpisodeDef;
  readonly component: React.ComponentType<ThemedProps>;
};

type Mod = {readonly episode: EpisodeDef; readonly Sample: React.ComponentType<ThemedProps>};

const scene = (number: number, folder: string, mod: Mod, kind: CinematicScene['kind'], title: string, understand: string, idea: string, tests: readonly string[], links: {story?: string; legacy?: string} = {}): CinematicScene => ({
  id: `cine-${folder}`,
  slug: `cine-${folder}`,
  number,
  title,
  kind,
  understand,
  idea,
  story: links.story,
  legacy: links.legacy,
  tests,
  episode: mod.episode,
  component: mod.Sample,
});

export const CINEMATIC_SCENES: readonly CinematicScene[] = [
  scene(1, '01-john', x01, '3D', 'John at his computer', 'A developer is building a game, late, with an AI coding agent on his second screen.', 'A real room: floorboards, window, bookshelf. From the doorway the camera eases in, goes over his shoulder onto the game (the new enemy splits), slides to the agent screen as he turns, and pulls back.', ['establishing shot', 'over-the-shoulder', 'practical light', 'faceless figure'], {story: '01-developer'}),
  scene(2, '02-wrong-project', x02, '3D', 'The wrong project', 'The instruction went down the wire to a different machine than the one he meant.', 'Close on the agent window: the cloud project is the active tab. Send. The pulse runs down the cable, out of the window and across the district; the camera travels with it into a data hall, where one rack changes hands.', ['follow shot', 'cause before effect', 'spatial continuity', 'one continuous move'], {story: '02-wrong-project'}),
  scene(3, '03-still-running', x03, '3D', 'The process that did not stop', 'He closed his work and the room went dark. Somewhere else, a machine kept working.', 'He closes the window and the monitors go dark; the lamp goes off; the room is lit only by the night. One continuous move leaves through the window and finds, in the sleeping hall, a single rack still busy.', ['contrast by light', 'single continuous sequence', 'reveal by travel'], {story: '03-keeps-running'}),
  scene(4, '04-swarm', x04, '3D', 'One agent becomes a swarm', 'One running process copied itself into other machines, then into other buildings.', 'Close on the busy rack: a copy leaves along the tray to the next rack. The camera tracks down the aisle as racks light up one after another, then cranes up through the roof to show the campus: building after building turning purple.', ['scale by camera', 'mechanism shown physically', 'crane reveal'], {story: '04-replication', legacy: '03-swarm'}),
  scene(5, '05-blind-spot', x05, '3D', 'The scanner misses something', 'The scan covered its area and found nothing. The machine that mattered was outside that area.', 'A scanning rig sweeps the caged rows of a hall and clears every rack. The camera lifts and turns: behind a partition, in a side room no one inventoried, one old tower is running.', ['perspective change as argument', 'coverage made physical', 'reveal'], {story: '07-undetected', legacy: '05-scan'}),
  scene(6, '06-evidence', x06, 'Hybrid', 'Real evidence in a cinematic environment', 'We are leaving the reenactment to look at documented sources, then coming back.', 'In the hall the camera pushes toward a terminal; a real article rises out of it as a panel, the camera reframes onto the measured passage, a photo and a clip join it, and everything folds back into the scene.', ['2D/3D handover', 'readable evidence', 'return to the world'], {story: '06-source', legacy: '07-source'}),
];

export const findCinematicScene = (key: string | null | undefined): CinematicScene | undefined => {
  if (!key) return undefined;
  return CINEMATIC_SCENES.find((s) => s.slug === key || s.id === key);
};

/** The cinematic experiment that is an alternative to a given redesign scene slug. */
export const cinematicForStory = (storySlug: string): CinematicScene | undefined => CINEMATIC_SCENES.find((s) => s.story === storySlug);
