import React from 'react';
import {AbsoluteFill} from 'remotion';
import type {Camera} from '../../engine/camera';

/** Static film grain. Rasterised once by the browser; it never animates. */
const GRAIN = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>`,
)}")`;

export const Grain: React.FC<{readonly opacity?: number}> = ({opacity = 0.05}) => (
  <AbsoluteFill style={{backgroundImage: GRAIN, backgroundSize: '256px 256px', opacity, pointerEvents: 'none', willChange: 'transform'}} />
);

export const Vignette: React.FC<{readonly strength?: number}> = ({strength = 0.55}) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(ellipse 75% 70% at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,${strength}) 100%)`,
      pointerEvents: 'none',
      // Static overlay: own compositor layer, rasterised once.
      willChange: 'transform',
    }}
  />
);

/**
 * A technical dot grid on the world plane. `parallax` < 1 makes it move and
 * scale less than the foreground, giving camera moves a sense of depth.
 */
export const DotGrid: React.FC<{
  readonly camera: Camera;
  readonly spacing?: number;
  readonly color: string;
  readonly radius?: number;
  readonly parallax?: number;
  readonly opacity?: number;
  readonly width?: number;
  readonly height?: number;
}> = ({camera, spacing = 48, color, radius = 1.15, parallax = 0.55, opacity = 1, width = 1920, height = 1080}) => {
  const zoom = Math.pow(camera.zoom, parallax);
  const size = spacing * zoom;
  const ox = width / 2 - camera.x * parallax * zoom;
  const oy = height / 2 - camera.y * parallax * zoom;
  const id = 'dotgrid';
  return (
    <svg width={width} height={height} style={{position: 'absolute', inset: 0, opacity}}>
      <defs>
        <pattern
          id={id}
          width={size}
          height={size}
          patternUnits="userSpaceOnUse"
          x={((ox % size) + size) % size}
          y={((oy % size) + size) % size}
        >
          <circle cx={size / 2} cy={size / 2} r={radius} fill={color} />
        </pattern>
      </defs>
      <rect width={width} height={height} fill={`url(#${id})`} />
    </svg>
  );
};
