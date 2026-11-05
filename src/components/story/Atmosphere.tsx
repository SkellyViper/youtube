import React from 'react';
import {AbsoluteFill} from 'remotion';
import {alpha} from '../../styles/cyber';
import {useTheme} from '../../styles/ThemeContext';

/**
 * Themed background: the base colour plus the theme's atmosphere
 * (horizon haze band, fine grid, fog wash or plain vignette). Static: it never
 * moves on its own, so holds stay frozen.
 */
export const StoryBackdrop: React.FC<{readonly horizon?: number; readonly intensity?: number}> = ({horizon = 0.62, intensity = 1}) => {
  const th = useTheme();
  const c = th.color;
  return (
    <AbsoluteFill style={{background: c.void}}>
      <AbsoluteFill style={{background: `radial-gradient(120% 90% at 50% 45%, ${c.abyss} 0%, ${c.void} 70%)`}} />
      {th.backdrop === 'horizon' ? (
        <AbsoluteFill
          style={{
            opacity: intensity,
            background: `linear-gradient(180deg, transparent ${(horizon - 0.12) * 100}%, ${alpha(c.haze, 0.55)} ${horizon * 100}%, transparent ${(horizon + 0.06) * 100}%)`,
          }}
        />
      ) : null}
      {th.backdrop === 'grid' ? (
        <AbsoluteFill
          style={{
            opacity: 0.5 * intensity,
            backgroundImage: `linear-gradient(${alpha(c.steel, 0.22)} 1px, transparent 1px), linear-gradient(90deg, ${alpha(c.steel, 0.22)} 1px, transparent 1px)`,
            backgroundSize: '64px 64px',
            maskImage: 'radial-gradient(80% 70% at 50% 50%, black 30%, transparent 85%)',
            WebkitMaskImage: 'radial-gradient(80% 70% at 50% 50%, black 30%, transparent 85%)',
          }}
        />
      ) : null}
      {th.backdrop === 'fog' ? (
        <AbsoluteFill
          style={{
            opacity: intensity,
            background: `radial-gradient(70% 45% at 30% 75%, ${alpha(c.haze, 0.38)} 0%, transparent 70%), radial-gradient(60% 40% at 75% 25%, ${alpha(c.haze, 0.26)} 0%, transparent 70%)`,
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};

/**
 * Themed finishing grade, the top layer of every redesign scene: vignette,
 * static grain, optional scanlines (Ghost Terminal) and a colour tint.
 * Static by construction (no animation), so holds stay pixel-identical.
 */
export const StoryGrade: React.FC = () => {
  const th = useTheme();
  const g = th.grade;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {g.tint ? <AbsoluteFill style={{background: g.tint, opacity: g.tintOpacity ?? 0.04, mixBlendMode: 'screen'}} /> : null}
      <AbsoluteFill style={{background: `radial-gradient(ellipse at center, transparent 52%, rgba(0,0,0,${g.vignette}) 100%)`}} />
      {g.scanlines > 0 ? (
        <AbsoluteFill
          style={{
            opacity: g.scanlines * 3,
            backgroundImage: 'repeating-linear-gradient(180deg, rgba(0,0,0,0.55) 0px, rgba(0,0,0,0.55) 1px, transparent 1px, transparent 3px)',
          }}
        />
      ) : null}
      <svg width="100%" height="100%" style={{position: 'absolute', inset: 0, opacity: g.grain, mixBlendMode: 'overlay'}}>
        <filter id="story-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#story-grain)" />
      </svg>
    </AbsoluteFill>
  );
};
