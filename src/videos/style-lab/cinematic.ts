import type React from 'react';
import type {EpisodeDef} from '../../engine';
import type {ThemedProps} from '../../styles/ThemeContext';
import type {ShotDef} from '../../shot/types';
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
  /** The episode with the approved timing. */
  readonly episode: EpisodeDef;
  readonly component: React.ComponentType<ThemedProps>;
  /**
   * Editable shot (Style Lab V2): present when the scene's objects, lights,
   * camera and cues come from a shot config. The editor opens it at
   * /style-lab/<slug>/edit; `baseEpisode` is the timing written in code.
   */
  readonly shot?: ShotDef;
  readonly baseEpisode?: EpisodeDef;
};

type Mod = {readonly episode: EpisodeDef; readonly Sample: React.ComponentType<ThemedProps>; readonly shot?: ShotDef; readonly baseEpisode?: EpisodeDef};

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
  shot: mod.shot,
  baseEpisode: mod.baseEpisode,
});

export const CINEMATIC_SCENES: readonly CinematicScene[] = [
  scene(1, '01-john', x01, '3D', 'John at his computer', 'A developer is building a game, late, with an AI coding agent on his second screen.', 'Style Lab V2 proof of concept, an editable shot: the legacy stage (void, horizon line, obsidian floor), only the desk, chair, two screens and him, one locked camera. The new enemy splits on the game screen, he turns to the agent, its reply writes itself. Reset it to code defaults in the editor to see the original room version.', ['locked camera', 'legacy stage', 'editable shot', 'faceless figure'], {story: '01-developer'}),
  scene(2, '02-wrong-project', x02, '3D', 'The wrong project', 'He meant to give his agent a job on his game. It ran in the other project, and he carried on without noticing.', 'Style Lab V2 rebuild, an editable shot on the legacy stage: a light figure at a curved ultrawide, his game open in the editor, a terminal with two tabs. He types a request about the slime into the agent; an insert on the terminal shows Enter in the cloud-ops tab and the agent starting there. Back on the main shot he returns to his game and makes it full screen; the terminal, still working, is behind it.', ['still main shot', 'one insert', 'legacy stage', 'editable shot', 'story on the screen', 'light figure'], {story: '02-wrong-project'}),
  scene(3, '03-still-running', x03, '3D', 'The process that did not stop', 'He closed his work and the room went dark. Somewhere else, a machine kept working.', 'He closes the window and the monitors go dark; the lamp goes off; the room is lit only by the night. One continuous move leaves through the window and finds, in the sleeping hall, a single rack still busy.', ['contrast by light', 'single continuous sequence', 'reveal by travel'], {story: '03-keeps-running'}),
  scene(4, '04-swarm', x04, '3D', 'One agent becomes a swarm', 'One running process copied itself into other machines, then into other buildings.', 'Close on the busy rack: a copy leaves along the tray to the next rack. The camera tracks down the aisle as racks light up one after another, then cranes up through the roof to show the campus: building after building turning purple.', ['scale by camera', 'mechanism shown physically', 'crane reveal'], {story: '04-replication', legacy: '03-swarm'}),
  scene(5, '05-blind-spot', x05, '3D', 'The scanner misses something', 'The scan covered its area and found nothing. The machine that mattered was outside that area.', 'A scanning rig sweeps the caged rows of a hall and clears every rack. The camera lifts and turns: behind a partition, in a side room no one inventoried, one old tower is running.', ['perspective change as argument', 'coverage made physical', 'reveal'], {story: '07-undetected', legacy: '05-scan'}),
  scene(6, '06-evidence', x06, 'Hybrid', 'Real evidence in a cinematic environment', 'We are leaving the reenactment to look at documented sources, then coming back.', 'In the hall the camera pushes toward a terminal; a real article rises out of it as a panel, the camera reframes onto the measured passage, a photo and a clip join it, and everything folds back into the scene.', ['2D/3D handover', 'readable evidence', 'return to the world'], {story: '06-source', legacy: '07-source'}),
];

/** Scenes that can be opened in the shot editor. */
export const EDITABLE_SCENES = (): readonly CinematicScene[] => CINEMATIC_SCENES.filter((s) => s.shot && s.baseEpisode);

export const findCinematicScene = (key: string | null | undefined): CinematicScene | undefined => {
  if (!key) return undefined;
  return CINEMATIC_SCENES.find((s) => s.slug === key || s.id === key);
};

/** The cinematic experiment that is an alternative to a given redesign scene slug. */
export const cinematicForStory = (storySlug: string): CinematicScene | undefined => CINEMATIC_SCENES.find((s) => s.story === storySlug);
