import React from 'react';
import {AbsoluteFill} from 'remotion';
import {frameFor, lerpRect, SceneAtmosphere, type Rect} from '../../../components/cyber';
import {MediaPanel, useMediaTime} from '../../../components/cyber/media/MediaPanel';
import {useBeats} from '../../../engine';
import {motion} from '../../../styles/cyber';

/**
 * Sample 08: outside media in our world.
 *
 * A landscape photo enters, an editor's push-in picks out a detail, then the
 * photo makes room for a portrait clip that plays next to it, and both leave.
 * Everything visible is a `MediaPanel`; this file only decides where the
 * panels stand and when their progress values run.
 */

const BEATS = ['media-enter', 'media-reframe', 'media-pair', 'media-exit'] as const;

/** See public/lab/media/SOURCES-media.md for sources and licences. */
const PHOTO = {src: 'lab/media/eniac-us-army-c1947.jpg', aspect: 1340 / 1024, caption: 'ENIAC, c. 1947. US Army photo'};
const CLIP = {src: 'lab/media/earth-night-iss-nasa-portrait.mp4', aspect: 608 / 1080, duration: 6, caption: 'City lights from orbit. NASA'};

/** The detail the push-in lands on, in fractions of the photo: the programmer at the patch cables. */
const DETAIL: Rect = {x: 0.2, y: 0.27, width: 0.58, height: 0.58};

/** Both panels hover over one floor line, so they read as two objects in one room. */
const BASELINE = 822;
const TOP = 92;
const HERO = frameFor(PHOTO.aspect, {x: 120, y: TOP, width: 1680, height: BASELINE - TOP});
const PAIR_PHOTO = frameFor(PHOTO.aspect, {x: 350, y: BASELINE - 520, width: 700, height: 520}, {x: 0, y: 1});
const PAIR_CLIP = frameFor(CLIP.aspect, {x: 1160, y: TOP, width: 420, height: BASELINE - TOP}, {x: 0, y: 1});

export const MediaScene: React.FC = () => {
  const b = useBeats(BEATS);
  const enter = b['media-enter'];
  const push = b['media-reframe'];
  const pair = b['media-pair'];
  const out = b['media-exit'];

  // Photo: chrome, then aperture.
  const photoBuild = enter.at(0.05, 0.9, motion.arrive);
  const photoOpen = enter.at(0.68, 1.55, motion.glide);
  // The push-in, and its release when the photo steps aside.
  const zoom = push.at(0.25, 1.8, motion.camera) * (1 - pair.at(0, 1.0, motion.glide));
  const marks = push.at(0, 0.4, motion.arrive) * (1 - push.at(0.7, 1.3));
  const aside = pair.at(0, 1.05, motion.glide);
  const photoRect = lerpRect(HERO, PAIR_PHOTO, aside);

  // Clip: builds in the space the photo has just left, opens, and plays.
  const clipBuild = pair.at(0.62, 1.38, motion.arrive);
  const clipOpen = pair.at(1.1, 1.8, motion.glide);
  // Its playhead runs on beat time: from the moment the aperture starts to
  // open until the end of the beat, then on through the exit until it is shut.
  const clipTime = useMediaTime([{beat: 'media-pair', from: 1.1}, {beat: 'media-exit', until: 0.85}]);

  return (
    <AbsoluteFill>
      <SceneAtmosphere floorOpacity={0.8} focusX={0.5 + 0.08 * clipOpen * (1 - out.at(0.2, 1.2, motion.glide))} />
      <MediaPanel
        kind="image"
        src={PHOTO.src}
        aspect={PHOTO.aspect}
        rect={photoRect}
        caption={PHOTO.caption}
        build={photoBuild}
        open={photoOpen}
        region={DETAIL}
        zoom={zoom}
        maxZoom={2}
        regionMarks={marks}
        brightness={1 - 0.16 * clipOpen}
        glow={0.5 - 0.15 * clipOpen}
        exit={out.at(0, 1.2)}
      />
      <MediaPanel
        kind="video"
        src={CLIP.src}
        aspect={CLIP.aspect}
        duration={CLIP.duration}
        rect={PAIR_CLIP}
        caption={CLIP.caption}
        build={clipBuild}
        open={clipOpen}
        mediaTime={clipTime}
        glow={0.7}
        exit={out.at(0.2, 1.45)}
      />
    </AbsoluteFill>
  );
};
