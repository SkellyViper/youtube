import React from 'react';
import {AbsoluteFill} from 'remotion';
import {alpha, cyber} from '../../../styles/cyber';
import {Grain, Vignette} from '../../backdrop/Backdrop';

/**
 * 2D backdrop that matches the 3D stage: blue-black void, a low band of haze
 * on the horizon, and (optionally) the suggestion of the obsidian floor as a
 * few receding hairlines. Static unless you animate its props.
 */
export const SceneAtmosphere: React.FC<{
  /** Horizon height as a fraction of the frame (0 top .. 1 bottom). */
  readonly horizon?: number;
  /** Haze colour. */
  readonly haze?: string;
  /** 0..1.5 */
  readonly intensity?: number;
  /** Draw receding floor hairlines below the horizon. */
  readonly floor?: boolean;
  readonly floorOpacity?: number;
  /** Horizontal position of the brightest part of the haze (0..1). */
  readonly focusX?: number;
}> = ({horizon = cyber.horizon, haze = cyber.color.haze, intensity = 1, floor = true, floorOpacity = 0.5, focusX = 0.5}) => {
  const h = horizon * 100;
  const lines: number[] = [];
  if (floor) {
    // Perspective spacing: dense at the horizon, opening towards the viewer.
    for (let i = 1; i <= 9; i++) lines.push(horizon + (1 - horizon) * Math.pow(i / 9.5, 2.1));
  }
  return (
    <AbsoluteFill style={{backgroundColor: cyber.color.void}}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 85% 75% at ${focusX * 100}% ${h * 0.62}%, ${cyber.color.abyss} 0%, ${cyber.color.void} 72%)`,
        }}
      />
      {/* Haze band: a tall faint breath above the line, a short one below. */}
      <AbsoluteFill
        style={{
          opacity: Math.min(1, intensity),
          background: `linear-gradient(to bottom, transparent ${h - 26}%, ${alpha(haze, 0.1)} ${h - 12}%, ${alpha(haze, 0.42)} ${h}%, ${alpha(haze, 0.14)} ${h + 3.5}%, transparent ${h + 14}%)`,
          maskImage: `radial-gradient(ellipse 75% 100% at ${focusX * 100}% ${h}%, #000 25%, transparent 100%)`,
          WebkitMaskImage: `radial-gradient(ellipse 75% 100% at ${focusX * 100}% ${h}%, #000 25%, transparent 100%)`,
        }}
      />
      {/* The horizon line itself. */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: `${h}%`,
          height: 2,
          opacity: 0.75 * Math.min(1.2, intensity),
          background: `radial-gradient(ellipse 46% 100% at ${focusX * 100}% 50%, ${alpha(cyber.color.blueHot, 0.55)}, ${alpha(haze, 0.5)} 55%, transparent 100%)`,
        }}
      />
      {floor
        ? lines.map((y, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: `${y * 100}%`,
                height: 1,
                opacity: floorOpacity * (0.16 + 0.05 * i),
                background: `radial-gradient(ellipse ${38 + i * 6}% 100% at ${focusX * 100}% 50%, ${cyber.color.steel}, transparent 100%)`,
              }}
            />
          ))
        : null}
    </AbsoluteFill>
  );
};

/**
 * The shared finishing layer: vignette + static grain. Mount it as the top
 * layer of every sample (`layers: [{id: 'grade', component: CyberGrade, z: 100}]`).
 * The grain also hides banding in the dark gradients after H.264 encoding.
 */
export const CyberGrade: React.FC<{readonly vignette?: number; readonly grain?: number}> = ({vignette = 0.5, grain = 0.055}) => (
  <AbsoluteFill style={{pointerEvents: 'none'}}>
    <Vignette strength={vignette} />
    <Grain opacity={grain} />
  </AbsoluteFill>
);
