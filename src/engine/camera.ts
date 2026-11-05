import {useEpisodeFrame, useTimeline} from './context';
import {evaluateTrack, type TrackSegment} from './track';
import type {Timeline} from './types';

/**
 * A 2D camera over an infinite "world" plane. World point (x, y) is shown at
 * the centre of the frame, scaled by `zoom`.
 */
export type Camera = {
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
};

export type Projector = {
  readonly camera: Camera;
  /** World -> screen. */
  readonly sx: (wx: number) => number;
  readonly sy: (wy: number) => number;
  /** World length -> screen length. */
  readonly len: (l: number) => number;
  /**
   * "Semantic zoom" for marks (node radii, labels...): shrinks more slowly
   * than geometry so detail stays legible when zoomed out.
   */
  readonly mark: (size: number, exponent?: number) => number;
};

export const makeProjector = (camera: Camera, width: number, height: number): Projector => ({
  camera,
  sx: (wx) => width / 2 + (wx - camera.x) * camera.zoom,
  sy: (wy) => height / 2 + (wy - camera.y) * camera.zoom,
  len: (l) => l * camera.zoom,
  mark: (size, exponent = 0.7) => size * Math.pow(camera.zoom, exponent),
});

/**
 * Camera keyframes bound to beats. Zoom is interpolated in log space so that
 * zooming feels perceptually uniform (each halving takes the same time).
 */
export const evaluateCamera = (
  timeline: Timeline,
  frame: number,
  initial: Camera,
  segments: readonly TrackSegment<Camera>[],
): Camera => {
  const [x, y, logZoom] = evaluateTrack(
    timeline,
    frame,
    [initial.x, initial.y, Math.log(initial.zoom)],
    segments.map((s) => ({...s, to: [s.to.x, s.to.y, Math.log(s.to.zoom)]})),
  );
  return {x, y, zoom: Math.exp(logZoom)};
};

export const useCamera = (initial: Camera, segments: readonly TrackSegment<Camera>[]): Camera => {
  const timeline = useTimeline();
  const frame = useEpisodeFrame();
  return evaluateCamera(timeline, frame, initial, segments);
};
