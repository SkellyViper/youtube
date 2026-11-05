import React from 'react';
import {AbsoluteFill} from 'remotion';
import type {Rect} from '../../../components/cyber/frame/fit';
import {useMediaTime} from '../../../components/cyber/media/MediaPanel';
import {Canvas, MachinePlan, MediaInsert, StoryBackdrop, World, ease, worldStepBack, type MediaInsertItem} from '../../../components/story';
import {useActiveTime, useBeats, useCamera} from '../../../engine';

/**
 * S09 · External media insert (2D).
 *
 * Cast (what each object stands for, and why it is here):
 *   - the plan        our animated hypothetical (the S04 network as a plan),
 *                     alive with pulses and spinning irises. It steps back:
 *                     desaturates, darkens, a veil comes over it.
 *   - the photo       real external material: the public-domain ENIAC photo,
 *                     in true colour inside an evidence frame with its credit.
 *   - the detail      the two operators at the machine; the editor's push-in.
 *   - the clip        a second, moving piece of external material beside the
 *                     photo. It is a screen recording of this project's own
 *                     gallery, made in this environment, and is labelled as a
 *                     demo asset (no other footage was reachable here).
 *
 * Beats:
 *   mi-world    the plan dims and desaturates while the photo enters.
 *   mi-detail   push-in on the two operators.
 *   mi-pair     the photo steps aside; the clip joins it and plays.
 *   mi-return   both frames exit cleanly; the world returns.
 *
 * Everything in theme roles except the media, which is never tinted.
 */

const BEATS = ['mi-world', 'mi-detail', 'mi-pair', 'mi-return'] as const;

/** See public/lab/media/SOURCES-media.md for provenance and licences. */
/** The two operators (Glen Beck, Betty Snyder) at the machine, as fractions of the photo; the frame's own shape, so the push-in fits exactly. */
const OPERATORS: Rect = {x: 0.38, y: 0.36, width: 0.62, height: 0.474};
const PHOTO: MediaInsertItem = {
  kind: 'image',
  src: 'lab/media/eniac-us-army-c1947.jpg',
  aspect: 1340 / 1024,
  caption: 'ENIAC, c. 1947. US Army photo',
  region: OPERATORS,
  maxZoom: 2,
};
const CLIP = {
  src: 'lab/media/style-lab-gallery-demo.mp4',
  aspect: 1280 / 720,
  duration: 6,
  // No meta line: with the caption it would not fit the pair slot (see SOURCES-media.md for the recording date).
  caption: "Screen recording of this project's gallery (demo asset)",
} as const;

const CAM_START = {x: 0, y: -60, zoom: 0.6};
const CAM_TRACK = [
  // The world recedes a little as it steps back, and comes forward again when the evidence has left.
  {beat: 'mi-world', to: {x: 0, y: -60, zoom: 0.55}, from: 0.2, until: 2.4, easing: ease.camera},
  {beat: 'mi-return', to: {x: 0, y: -60, zoom: 0.6}, from: 0.6, until: 2.4, easing: ease.camera},
];

export const MediaInsertScene: React.FC = () => {
  const time = useActiveTime();
  const b = useBeats(BEATS);
  const cam = useCamera(CAM_START, CAM_TRACK);
  const world = b['mi-world'];
  const detail = b['mi-detail'];
  const pair = b['mi-pair'];
  const back = b['mi-return'];

  const worldDim = world.at(0.2, 1.6, ease.inOut) * (1 - back.at(0.7, 2.3, ease.inOut));
  const enter = world.at(0.45, 2.5);
  const emphasis = detail.at(0.1, 2.1);
  const pairP = pair.at(0, 1.9);
  const exit = back.at(0, 1.7);
  // The clip's playhead runs on beat time: from just after its aperture starts to open, through the start of the exit.
  const clipTime = useMediaTime([{beat: 'mi-pair', from: 1.35}, {beat: 'mi-return', until: 0.9}]);

  return (
    <AbsoluteFill>
      <StoryBackdrop intensity={0.6} />
      <AbsoluteFill style={worldStepBack(worldDim)}>
        <Canvas>
          <World cam={cam}>
            <MachinePlan time={time} pulses={1 - worldDim} />
          </World>
        </Canvas>
      </AbsoluteFill>
      <MediaInsert
        items={[PHOTO, {kind: 'video', ...CLIP, mediaTime: clipTime}]}
        layout="pair"
        enter={enter}
        emphasis={emphasis}
        pair={pairP}
        exit={exit}
        worldDim={worldDim}
      />
    </AbsoluteFill>
  );
};
