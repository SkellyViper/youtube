import React from 'react';
import {AbsoluteFill} from 'remotion';
import {CyberFrame} from '../../../components/cyber/frame/CyberFrame';
import type {Rect} from '../../../components/cyber/frame/fit';
import {MediaPanel, useMediaTime} from '../../../components/cyber/media/MediaPanel';
import {SourcePanel, sourceRect} from '../../../components/cyber/media/SourcePanel';
import {projectPoint} from '../../../components/cyber/three/rig';
import {EvidenceVeil, mediaInsertRects, type MediaInsertItem} from '../../../components/story/MediaInsert';
import {ease, lerp} from '../../../components/story/math';
import {useBeats, useScalarTrack} from '../../../engine';
import {alpha, cyber, motion} from '../../../styles/cyber';
import {useTheme} from '../../../styles/ThemeContext';
import {SOURCE} from '../../redesign/06-source/source';
import {BAY, BEATS, evidenceDim, handoffFlare, useEvidenceRig} from './stage';

/**
 * X06, the evidence layer: everything 2D above the hall. The veil, the seed
 * frame pinned to the bay, the real page (SourcePanel), the photo and the clip
 * (two MediaPanels on the MediaInsert pair geometry), all driven by the beats
 * and pinned to the 3D camera through the shared rig. See ./stage.ts.
 *
 * The media are not tinted: the page is shown without the house paper tint,
 * the photo and the clip in true colour.
 */

const W = 1920;
const H = 1080;

/* ------------------------------------------------------------------ the page */

/** Room under the frame for its one-line caption. */
const CAPTION = 60;
const STAGE: Rect = {x: cyber.safe.x, y: 72, width: W - cyber.safe.x * 2, height: H - 72 - cyber.safe.y - CAPTION};
/** The readable rect: the page at the largest size that fits the stage (1360 x 852 for this capture). */
const RECT = sourceRect(SOURCE.naturalWidth, SOURCE.naturalHeight, STAGE);

const union = (a: Rect, b: Rect): Rect => {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {x, y, width: Math.max(a.x + a.width, b.x + b.width) - x, height: Math.max(a.y + a.height, b.y + b.height) - y};
};
/** What the inner camera frames: the column from the title to the sentence (as the 2D source scene does). */
const FOCUS = SOURCE.regions.title ? union(SOURCE.regions.title, SOURCE.regions.passage) : SOURCE.regions.passage;
const FOCUS_FILL = 0.935;

/** The seed: the page's chrome at the size it has inside the bay before it leaves (page shape). */
const SEED = {width: 150, height: Math.round(150 / (SOURCE.naturalWidth / SOURCE.naturalHeight))};

/* ------------------------------------------------------------------ the shelf: photo, clip, citation on one baseline */

const BASELINE = 820;
const SHELF: Rect = {x: cyber.safe.x, y: 112, width: 1290, height: BASELINE - 112};
/** The citation: the page docked small at the bottom-right corner, its bottom on the shelf's baseline. */
const DOCK = sourceRect(SOURCE.naturalWidth, SOURCE.naturalHeight, {x: W - cyber.safe.x - 360, y: BASELINE - 300, width: 360, height: 300}, {x: 1, y: 1});
/** How wide the citation is when it has gone back into the bay. */
const HOME_WIDTH = 44;
/** The citation's way home: from the corner to a point-sized frame on the bay, size in log space (an even shrink), centre on a straight line. */
const flightRect = (from: Rect, to: {readonly x: number; readonly y: number}, p: number): Rect => {
  const width = from.width * Math.pow(HOME_WIDTH / from.width, p);
  const height = width * (from.height / from.width);
  const cx = lerp(from.x + from.width / 2, to.x, p);
  const cy = lerp(from.y + from.height / 2, to.y, p);
  return {x: cx - width / 2, y: cy - height / 2, width, height};
};

/** See public/lab/media/SOURCES-media.md for provenance, licences and the captions. */
/** The two operators (Glen Beck, Betty Snyder) at the machine, as fractions of the photo; the frame's own shape, so the push-in fits exactly. */
const OPERATORS: Rect = {x: 0.38, y: 0.36, width: 0.62, height: 0.474};
const PHOTO: MediaInsertItem = {kind: 'image', src: 'lab/media/eniac-us-army-c1947.jpg', aspect: 1340 / 1024, caption: 'ENIAC, c. 1947. US Army photo', region: OPERATORS, maxZoom: 2};
const CLIP: MediaInsertItem = {kind: 'video', src: 'lab/media/earth-night-iss-nasa-portrait.mp4', aspect: 608 / 1080, duration: 6, caption: 'City lights from orbit. NASA'};
/** The MediaInsert pair geometry, fully formed: the photo in the left column, the clip in the right, both standing on the baseline. */
const [PHOTO_RECT, CLIP_RECT] = mediaInsertRects([PHOTO, CLIP], 'pair', SHELF, 1, 60);

export const EvidenceLayer: React.FC = () => {
  const th = useTheme();
  const b = useBeats(BEATS);
  const rig = useEvidenceRig();
  const app = b['ev-approach'];
  const src = b['ev-source'];
  const med = b['ev-media'];
  const ret = b['ev-return'];
  const dim = evidenceDim(b);
  const flare = handoffFlare(b);

  // The bay on screen, from the same rig the stage renders with: everything pinned here rides the 3D camera.
  const bay = projectPoint(rig, BAY, W, H);

  // ---- the page: one linear progress per move (the panel applies the house curves) ----
  // `enter` runs across beats: out of the bay in ev-source; part of the way back in ev-return, so the chrome and the
  // caption retract and the card turns back toward the machine while the docked rect itself flies home (below).
  const enter = useScalarTrack(0, [
    {beat: 'ev-source', to: 1, from: 0, until: 1.35, easing: ease.linear},
    {beat: 'ev-return', to: 0.4, from: 0.75, until: 1.15, easing: ease.linear},
  ]);
  const read = src.at(1.15, 2.0);
  const emphasis = src.at(1.8, 3.1);
  const dock = med.at(0, 1.1);
  // The way home: the citation's rect travels from the corner to the bay and the page fades as it arrives (the flare takes over).
  const flight = ret.at(0.75, 1.65, ease.inOut);
  const dockRect = flight > 0 ? flightRect(DOCK, bay, flight) : DOCK;
  const home = ret.at(1.45, 1.7);
  // The seed: the chrome forms in the bay while the camera is still pushing in, and hands over to the page as it leaves.
  const seed = app.at(1.45, 2.6, ease.out) * (1 - src.at(0, 0.07));

  // ---- the photo and the clip ----
  const photoBuild = med.at(0.2, 0.85, motion.arrive);
  const photoOpen = med.at(0.6, 1.1, motion.glide);
  const zoom = med.at(1.6, 3.0, motion.camera);
  const marks = med.at(1.45, 1.8, motion.arrive) * (1 - med.at(2.3, 2.8));
  const clipBuild = med.at(0.4, 1.0, motion.arrive);
  const clipOpen = med.at(0.75, 1.2, motion.glide);
  // The clip's playhead runs on beat time only: from its aperture opening to the end of the beat (frozen on the hold), then on through its exit until it is shut.
  const clipTime = useMediaTime([{beat: 'ev-media', from: 0.85}, {beat: 'ev-return', until: 0.6}]);
  // The exits, in order: the photo, the clip, then the citation flies home (above).
  const photoExit = ret.at(0, 1.0);
  const clipExit = ret.at(0.1, 1.15);

  const t = th.tone.system;
  const flareBackground = 'radial-gradient(circle, ' + alpha(t.hot, 0.36 * flare) + ' 0%, ' + alpha(t.base, 0.15 * flare) + ' 28%, transparent 68%)';

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <EvidenceVeil dim={dim} />

      {/* The document's light at the bay: the page leaving the machine, and coming back. */}
      {flare > 0.001 ? <div style={{position: 'absolute', left: bay.x - 200, top: bay.y - 200, width: 400, height: 400, borderRadius: '50%', background: flareBackground}} /> : null}

      {/* The seed: the evidence frame forming in the open bay, pinned to it. */}
      {seed > 0.001 ? <CyberFrame x={bay.x - SEED.width / 2} y={bay.y - SEED.height / 2} width={SEED.width} height={SEED.height} build={seed} open={0} glow={0.6} /> : null}

      {home < 1 ? (
        <div style={{position: 'absolute', inset: 0, opacity: 1 - home}}>
          <SourcePanel
            src={SOURCE.src}
            naturalWidth={SOURCE.naturalWidth}
            naturalHeight={SOURCE.naturalHeight}
            rect={RECT}
            dockRect={dockRect}
            caption={SOURCE.caption}
            meta={SOURCE.meta}
            highlight={SOURCE.regions.passage.lines}
            focus={FOCUS}
            focusFill={FOCUS_FILL}
            from={{x: bay.x, y: bay.y, scale: SEED.width / RECT.width, rotateY: -22, rotateX: 5}}
            enter={enter}
            read={read}
            emphasis={emphasis}
            dock={dock}
            paper={null}
          />
        </div>
      ) : null}

      <MediaPanel
        kind="image"
        src={PHOTO.src}
        aspect={PHOTO.aspect}
        rect={PHOTO_RECT}
        caption={PHOTO.caption}
        build={photoBuild}
        open={photoOpen}
        region={OPERATORS}
        zoom={zoom}
        maxZoom={PHOTO.maxZoom}
        regionMarks={marks}
        exit={photoExit}
        floor={false}
      />
      <MediaPanel
        kind="video"
        src={CLIP.src}
        aspect={CLIP.aspect}
        duration={CLIP.duration}
        rect={CLIP_RECT}
        caption={CLIP.caption}
        build={clipBuild}
        open={clipOpen}
        mediaTime={clipTime}
        exit={clipExit}
        glow={0.65}
        floor={false}
      />
    </AbsoluteFill>
  );
};
