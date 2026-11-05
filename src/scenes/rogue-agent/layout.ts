import type {Camera} from '../../engine/camera';
import type {TrackSegment} from '../../engine/track';
import {ease} from '../../styles/motion';

/**
 * Shared spatial layout for the "Rogue agent" intro.
 *
 * One world plane, one camera. World units equal screen pixels at zoom 1.
 * - John's desk lives around world (0, 0).
 * - The cloud agent lives at AGENT, off to the right.
 * - The "internet" is generated around both, and is revealed by zooming out.
 */
export const FRAME = {width: 1920, height: 1080} as const;

/** World position of the cloud agent (its panel is centred near here). */
export const AGENT = {x: 2600, y: 0} as const;

/** Where John's laptop sits on the internet map (roughly where his game window was). */
export const JOHN_NODE = {x: 380, y: -40} as const;

/** Camera centre for the widest shot (also the centre of the generated internet). */
export const WIDE = {x: AGENT.x - 900, y: 0, zoom: 0.082} as const;

/** Screen position (at the John rest camera) → world position. */
export const atJohn = (sx: number, sy: number) => ({left: sx - FRAME.width / 2, top: sy - FRAME.height / 2});
/** Screen position (at the agent rest camera) → world position. */
export const atAgent = (sx: number, sy: number) => ({
  left: AGENT.x + sx - FRAME.width / 2,
  top: AGENT.y + sy - FRAME.height / 2,
});

export const CAMERA_INITIAL: Camera = {x: 0, y: 16, zoom: 0.97};
export const CAMERA_TRACK: readonly TrackSegment<Camera>[] = [
  {beat: 'john', to: {x: 0, y: 0, zoom: 1}, easing: ease.out},
  // Follow the prompt to the wrong project.
  {beat: 'wrong-project', to: {x: AGENT.x, y: AGENT.y, zoom: 1}, easing: ease.camera, from: 0.3, until: 2.0},
  // Back to John, who closes the project.
  {beat: 'closes', to: {x: 0, y: 0, zoom: 1}, easing: ease.camera, from: 0, until: 1.5},
  // ...meanwhile, at the agent.
  {beat: 'to-heart', to: {x: AGENT.x, y: AGENT.y, zoom: 1}, easing: ease.camera, from: 0, until: 1.5},
  {beat: 'scavenge', to: {x: AGENT.x, y: AGENT.y, zoom: 0.5}, easing: ease.camera, from: 0.1, until: 2.4},
  {beat: 'copies', to: {x: AGENT.x - 150, y: AGENT.y, zoom: 0.33}, easing: ease.inOut},
  {beat: 'time', to: {x: AGENT.x - 500, y: 0, zoom: 0.15}, easing: ease.inOut},
  {beat: 'thousands', to: {x: WIDE.x, y: WIDE.y, zoom: WIDE.zoom}, easing: ease.inOut},
  {beat: 'move', to: {x: WIDE.x, y: WIDE.y, zoom: 0.088}, easing: ease.out, from: 0, until: 0.7},
  {beat: 'know', to: {x: WIDE.x, y: WIDE.y, zoom: 0.1}, easing: ease.inOut},
];

/** Camera during the closing question (used to place the hidden agent on screen). */
export const FINAL_CAMERA: Camera = {x: WIDE.x, y: WIDE.y, zoom: 0.1};

/**
 * How far the infection has spread, 0..1. Each node has an infection time on
 * this scale (see internet.ts). Linear segments, so the spread rate per beat
 * is steady and readable.
 */
export const SPREAD_TRACK: readonly TrackSegment<number>[] = [
  {beat: 'scavenge', to: 0.05, from: 0.9, until: 2.9},
  {beat: 'copies', to: 0.15, from: 0.05, until: 2.3},
  {beat: 'time', to: 0.72, from: 0, until: 2.9, easing: ease.inOut},
  {beat: 'thousands', to: 1, from: 0, until: 2.6, easing: ease.out},
];

/** Elapsed story time, as log(1 + days) so days → weeks → months reads evenly. */
export const DAYS_TRACK: readonly TrackSegment<number>[] = [
  {beat: 'overnight', to: Math.log1p(0.31), from: 0.2, until: 2.2, easing: ease.inOut},
  {beat: 'scavenge', to: Math.log1p(1.2), from: 0.9, until: 2.9},
  {beat: 'copies', to: Math.log1p(3.5), from: 0.05, until: 2.3},
  {beat: 'time', to: Math.log1p(215), from: 0, until: 2.9, easing: ease.inOut},
  {beat: 'thousands', to: Math.log1p(284), from: 0, until: 2.6, easing: ease.out},
];

export const formatElapsed = (days: number): string => {
  if (days < 1) return `HOUR ${Math.floor(days * 24) + 1}`;
  if (days < 14) return `DAY ${Math.floor(days) + 1}`;
  if (days < 63) return `WEEK ${Math.floor(days / 7) + 1}`;
  return `MONTH ${Math.floor(days / 30.44) + 1}`;
};

/** The prompt John wrote. The four behaviours are the episode's through-line. */
export const PROMPT_PARTS: readonly {readonly text: string; readonly verb?: number}[] = [
  {text: 'Build an enemy that '},
  {text: 'hides', verb: 0},
  {text: ', '},
  {text: 'scavenges resources', verb: 1},
  {text: ', '},
  {text: 'grows stronger by multiplying', verb: 2},
  {text: ', and, when the time is right, '},
  {text: 'ambushes the player', verb: 3},
  {text: '.'},
];
export const PROMPT_TEXT = PROMPT_PARTS.map((p) => p.text).join('');

export const VERBS = ['HIDE', 'SCAVENGE', 'MULTIPLY', 'AMBUSH'] as const;

/** Final count shown for the wide shot. */
export const FINAL_INSTANCES = 4812;
