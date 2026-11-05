import {Curve2, type Pt} from '../../../components/cyber';
import {pictogramExtent, type PictogramKind} from '../../../components/cyber/svg/Pictograms';

/**
 * World layout of the diagram, in px at camera zoom 1. The floor line is
 * world y = 0 and is pinned to the screen horizon by the camera; everything
 * stands above it (negative y) on a 55 px grid. Three zones read left to
 * right: where the prompt comes from, the agent, the world it acts on.
 */
export const HORIZON = 0.7;
export const ROW = -360;
export const SIZE = 96;
const PAD = 10;

export type ObjDef = {
  readonly id: string;
  readonly kind: PictogramKind;
  readonly x: number;
  readonly y: number;
  /** Index of the parent in the previous order. */
  readonly from: number;
};

export const PROMPT: Pt = {x: 100, y: ROW};
export const AGENT = {x: 500, y: ROW, r: 90} as const;
export const PRIMARY: ObjDef = {id: 'p', kind: 'store', x: 880, y: ROW, from: 0};
export const SECOND: readonly ObjDef[] = [
  {id: 's1', kind: 'service', x: 1190, y: -500, from: 0},
  {id: 's2', kind: 'queue', x: 1190, y: ROW, from: 0},
  {id: 's3', kind: 'switch', x: 1190, y: -220, from: 0},
];
export const THIRD: readonly ObjDef[] = [
  {id: 't1', kind: 'endpoint', x: 1500, y: -600, from: 0},
  {id: 't2', kind: 'ledger', x: 1500, y: -480, from: 0},
  {id: 't3', kind: 'store', x: 1500, y: ROW, from: 1},
  {id: 't4', kind: 'endpoint', x: 1500, y: -240, from: 2},
  {id: 't5', kind: 'ledger', x: 1500, y: -120, from: 2},
];
/** Third-order objects that turn red in the last beat. */
export const LOST: readonly number[] = [3, 4];

const rightOf = (o: ObjDef): Pt => ({x: o.x + pictogramExtent(o.kind, SIZE).w + PAD, y: o.y});
const leftOf = (o: ObjDef): Pt => ({x: o.x - pictogramExtent(o.kind, SIZE).w - PAD, y: o.y});

/** A cable between two points at the same height: a gentle sag. */
const cable = (a: Pt, b: Pt, drop: number) =>
  Curve2.bezier(a, {x: a.x + (b.x - a.x) * 0.36, y: a.y + drop}, {x: b.x - (b.x - a.x) * 0.36, y: b.y + drop}, b);

export const PROMPT_LINK = cable({x: PROMPT.x + pictogramExtent('message', SIZE).w + PAD, y: ROW}, {x: AGENT.x - AGENT.r - 8, y: ROW}, 18);
export const ACTION_LINK = cable({x: AGENT.x + AGENT.r + 8, y: ROW}, leftOf(PRIMARY), 18);
export const SECOND_LINKS = SECOND.map((o) => Curve2.link(rightOf(PRIMARY), leftOf(o)));
export const THIRD_LINKS = THIRD.map((o) => Curve2.link(rightOf(SECOND[o.from]), leftOf(o)));

/** The feedback: from the last lost object, under the floor, back to just below the agent. */
const lost = THIRD[LOST[LOST.length - 1]];
export const FEEDBACK = Curve2.route(
  [
    {x: lost.x, y: lost.y + pictogramExtent(lost.kind, SIZE).h + 6},
    {x: lost.x, y: 58},
    {x: AGENT.x, y: 58},
    {x: AGENT.x, y: AGENT.y + AGENT.r + 30},
  ],
  64,
  14,
);

/** Zone ground lines (just above the floor) and the columns they tick. */
export const GROUND_Y = -8;
export const ZONES = {
  prompt: {x0: 40, x1: 160},
  agent: {x0: 410, x1: 590},
  world: {x0: 810, x1Initial: 1260, x1Final: 1570},
} as const;
export const COLUMNS = [PRIMARY.x, SECOND[0].x, THIRD[0].x] as const;

/**
 * Camera: the world is laid out at poster scale (zoom 1 shows the whole
 * chain). Beats 1-3 are framed closer on the prompt, the agent and the
 * primary object; beat 4 pulls back and pans right as the chain grows.
 */
export const CAMERA = {
  startX: 640,
  startZoom: 1.25,
  endX: 810,
  endZoom: 1,
} as const;

/** Seconds into a comet's pass at which its head lands (see Comet2D). */
export const landing = (curve: Curve2, tail: number) => curve.length / (curve.length + tail);
