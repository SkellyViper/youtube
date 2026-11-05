import React from 'react';
import {AbsoluteFill} from 'remotion';
import type {Rect} from '../../../components/cyber/frame/fit';
import {SourcePanel, sourceRect} from '../../../components/cyber/media/SourcePanel';
import {
  Canvas,
  EvidenceVeil,
  H,
  MachinePlan,
  PLAN_ROOT,
  StoryBackdrop,
  W,
  World,
  bump,
  ease,
  lerp,
  planBay,
  toScreen,
  worldStepBack,
} from '../../../components/story';
import {useActiveTime, useBeats, useCamera} from '../../../engine';
import {alpha, cyber} from '../../../styles/cyber';
import {useTheme} from '../../../styles/ThemeContext';
import {SOURCE} from './source';

/**
 * S06 · Real incident: an internet source (hybrid: a 2D world, a real page).
 *
 * Cast (what each object stands for, and why it is here):
 *   - the plan          the hypothetical network of S04, flattened: ~20 small
 *                       machines joined by floor conduits, several holding the
 *                       agent. This is "what we imagined".
 *   - the target rack   the root of that network. The camera heads for it, and
 *                       the real document comes out of it: the hypothetical
 *                       hands over to the documented.
 *   - the source panel  a real web page (Wikipedia, "Morris worm"), captured
 *                       and measured by scripts/lab-capture.mjs. The only words
 *                       on screen are its own, plus its domain and capture date.
 *   - the passage       one measured sentence of the lead, lit exactly.
 *   - the citation      the same page, docked small beside the rack, with a
 *                       hairline leader: the evidence stays attached to the node.
 *
 * Beats:
 *   sr-plan   the dim plan; the camera pushes slowly toward the root rack.
 *   sr-rise   the world steps back (desaturates, veils); the page rises out of
 *             the rack, opens, and the inner camera lands on the sentence.
 *   sr-read   hold on the sentence, then the inner camera eases off so the
 *             article column is seen whole.
 *   sr-dock   the page shrinks to a citation beside the rack; the world regains
 *             its colour; the camera settles with both in frame.
 */

const BEATS = ['sr-plan', 'sr-rise', 'sr-read', 'sr-dock'] as const;

/* ------------------------------------------------------------------ the page's geometry */

/** Room under the frame for its one-line caption. */
const CAPTION = 60;
const STAGE: Rect = {x: cyber.safe.x, y: 72, width: W - cyber.safe.x * 2, height: H - 72 - cyber.safe.y - CAPTION};
const RECT = sourceRect(SOURCE.naturalWidth, SOURCE.naturalHeight, STAGE);

const union = (a: Rect, b: Rect): Rect => {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {x, y, width: Math.max(a.x + a.width, b.x + b.width) - x, height: Math.max(a.y + a.height, b.y + b.height) - y};
};
/** What the inner camera frames: the column from the title to the sentence; 93.5% of the width crops in the page's own gutters. */
const FOCUS = SOURCE.regions.title ? union(SOURCE.regions.title, SOURCE.regions.passage) : SOURCE.regions.passage;
const FOCUS_FILL = 0.935;
/** How far the inner camera eases off in sr-read: 0 = all the way out, 1 = stays on the sentence. */
const RELAXED = 0.28;

/* ------------------------------------------------------------------ the world and the camera */

const TARGET = PLAN_ROOT;
const BAY = planBay(TARGET);

const CAM_START = {x: 0, y: -40, zoom: 0.52};
const CAM_PUSH = {x: lerp(0, BAY.x, 0.7), y: lerp(-40, BAY.y, 0.7), zoom: 0.78};
const CAM_RISE = {x: BAY.x, y: BAY.y + 30, zoom: 0.95};
/** At the end the rack stands here on screen, with the citation to its right. */
const NODE_AT = {x: 600, y: 600};
const END_ZOOM = 0.9;
const CAM_END = {x: BAY.x - (NODE_AT.x - W / 2) / END_ZOOM, y: BAY.y - (NODE_AT.y - H / 2) / END_ZOOM, zoom: END_ZOOM};
const CAM_TRACK = [
  {beat: 'sr-plan', to: CAM_PUSH, from: 0.15, until: 2.4, easing: ease.camera},
  {beat: 'sr-rise', to: CAM_RISE, from: 0, until: 1.4, easing: ease.camera},
  {beat: 'sr-dock', to: CAM_END, from: 0.1, until: 2.0, easing: ease.camera},
];

/** The citation slot: a small frame of the page's shape to the right of the rack, centred on it. */
const dockRectBeside = (node: {x: number; y: number}): Rect =>
  sourceRect(SOURCE.naturalWidth, SOURCE.naturalHeight, {x: node.x + 120, y: node.y - 240, width: 340, height: 480}, {x: 0, y: 0.5});

export const SourceScene: React.FC = () => {
  const th = useTheme();
  const time = useActiveTime();
  const b = useBeats(BEATS);
  const cam = useCamera(CAM_START, CAM_TRACK);
  const plan = b['sr-plan'];
  const rise = b['sr-rise'];
  const read = b['sr-read'];
  const dock = b['sr-dock'];

  // ---- the page: one linear progress per move (the panel applies the house curves) ----
  const enter = rise.at(0.15, 1.75);
  const readP = rise.at(1.35, 2.3);
  const landed = rise.at(1.95, 3.0);
  const relax = read.at(0.8, 2.0, ease.inOut);
  const emphasis = landed * lerp(1, RELAXED, relax);
  const dockP = dock.at(0.2, 1.8);

  // ---- the world steps back while the evidence is up, and returns as it docks ----
  const stepBack = rise.at(0.1, 1.5, ease.inOut) * (1 - dock.at(0.4, 2.0, ease.inOut));
  // The rack the camera is heading for brightens as it is approached, flares as it hands over the page.
  const approach = plan.at(0.5, 2.3, ease.out);
  const handoff = bump(rise.time, 0.1, 1.0);

  const node = toScreen(cam, BAY.x, BAY.y);
  const DOCK = dockRectBeside(node);
  const leader = dock.at(1.3, 1.9, ease.out);

  return (
    <AbsoluteFill>
      <StoryBackdrop intensity={0.6} />
      <AbsoluteFill style={worldStepBack(stepBack)}>
        <Canvas>
          <World cam={cam}>
            <MachinePlan time={time} pulses={1 - stepBack} focus={{id: TARGET.id, level: approach * (1 - 0.5 * stepBack)}} />
            {handoff > 0.001 ? <circle cx={BAY.x} cy={BAY.y} r={40 + 220 * handoff} fill={alpha(th.tone.system.hot, 0.35 * (1 - handoff))} /> : null}
          </World>
        </Canvas>
      </AbsoluteFill>
      <EvidenceVeil dim={stepBack} />

      {/* The citation's leader: from the rack to the docked frame. */}
      {leader > 0.001 ? (
        <svg width={W} height={H} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
          <path
            d={`M${node.x.toFixed(1)} ${node.y.toFixed(1)}H${(node.x + (DOCK.x - 14 - node.x) * leader).toFixed(1)}`}
            stroke={th.tone.system.base}
            strokeWidth={cyber.line.hair}
            opacity={0.8}
          />
          <circle cx={node.x} cy={node.y} r={5 * leader} fill={th.tone.system.base} />
        </svg>
      ) : null}

      <SourcePanel
        src={SOURCE.src}
        naturalWidth={SOURCE.naturalWidth}
        naturalHeight={SOURCE.naturalHeight}
        rect={RECT}
        dockRect={DOCK}
        caption={SOURCE.caption}
        meta={SOURCE.meta}
        highlight={SOURCE.regions.passage.lines}
        focus={FOCUS}
        focusFill={FOCUS_FILL}
        from={{x: node.x, y: node.y, scale: 0.1, rotateY: -22, rotateX: 5}}
        enter={enter}
        read={readP}
        emphasis={emphasis}
        dock={dockP}
      />
    </AbsoluteFill>
  );
};
