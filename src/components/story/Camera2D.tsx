import React from 'react';
import {f2} from './math';

/**
 * MotionCameraRig for 2D scenes: a camera over an infinite world plane.
 * World point (x, y) is drawn at the centre of the frame, scaled by `zoom`,
 * optionally rolled. Every 2D redesign scene draws its whole world inside one
 * <World>, so a camera move is a real move through one continuous space and
 * objects keep their place between beats.
 */
export type Cam2 = {readonly x: number; readonly y: number; readonly zoom: number; readonly roll?: number};

export const W = 1920;
export const H = 1080;

export const worldTransform = (cam: Cam2, depth = 1) => {
  // Parallax: a layer at depth d moves d times as much as the world plane.
  const z = Math.pow(cam.zoom, depth);
  return `translate(${f2(W / 2)} ${f2(H / 2)}) rotate(${f2(cam.roll ?? 0)}) scale(${z.toFixed(5)}) translate(${f2(-cam.x * depth)} ${f2(-cam.y * depth)})`;
};

/** World -> screen. */
export const toScreen = (cam: Cam2, x: number, y: number) => ({x: W / 2 + (x - cam.x) * cam.zoom, y: H / 2 + (y - cam.y) * cam.zoom});

export const World: React.FC<{readonly cam: Cam2; readonly depth?: number; readonly children?: React.ReactNode}> = ({cam, depth = 1, children}) => (
  <g transform={worldTransform(cam, depth)}>{children}</g>
);

/** A full-frame SVG canvas at composition size. */
export const Canvas: React.FC<{readonly children?: React.ReactNode; readonly style?: React.CSSProperties}> = ({children, style}) => (
  <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{position: 'absolute', inset: 0, overflow: 'hidden', ...style}}>
    {children}
  </svg>
);
