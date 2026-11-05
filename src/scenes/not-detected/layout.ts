import type {Camera} from '../../engine/camera';
import type {TrackSegment} from '../../engine/track';
import {ease} from '../../styles/motion';

/**
 * Shared spatial layout for the "Not detected ≠ nonexistent" demo.
 * World units equal screen pixels at zoom 1; world (0, 0) is the frame centre
 * when the camera is at its rest position.
 */
export const FRAME = {width: 1920, height: 1080} as const;

/** The region the scanner examines (also the "core" module of the system). */
export const SCAN_BOX = {cx: 0, cy: 50, w: 1040, h: 560} as const;

/** Focus brackets around the opening claim, in world units. */
export const CLAIM_FRAME = {left: -660, top: -340, right: 660, bottom: 370} as const;

/** Screen positions of the opening title / evidence rows. */
export const CLAIM_LAYOUT = {
  titleCenterY: 452,
  evidenceCenterY: 800,
  header: {left: 120, top: 92, scale: 0.22},
  headerStatsRight: 1800,
} as const;

/** Final ≠ glyph, in screen space. */
export const GLYPH = {
  cx: 960,
  cy: 492,
  barLength: 640,
  barGap: 124, // distance between the two bar centre lines
  rows: 4,
  slashDx: 124, // half horizontal extent of the slash
  slashDy: 198, // half vertical extent of the slash
} as const;

/**
 * The story camera. Every layer that lives on the world plane (backdrop grid,
 * network, scan box) evaluates this same track, so they move as one.
 */
export const CAMERA_INITIAL: Camera = {x: 0, y: 26, zoom: 0.94};
export const CAMERA_TRACK: readonly TrackSegment<Camera>[] = [
  {beat: 'title', to: {x: 0, y: 0, zoom: 1}, easing: ease.out},
  {beat: 'zoom-out', to: {x: -40, y: -88, zoom: 0.31}, easing: ease.camera},
  {beat: 'recount', to: {x: -990, y: -40, zoom: 0.29}, easing: ease.inOut, from: 0, until: 0.85},
  {beat: 'assemble', to: {x: -990, y: 120, zoom: 0.24}, easing: ease.inOut},
];

/** The zoom reached at the end of the zoom-out beat (used to time reveals). */
export const ZOOM_OUT_TARGET = 0.31;
