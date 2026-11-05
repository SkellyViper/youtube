import React from 'react';
import {AbsoluteFill} from 'remotion';
import {DotGrid, Vignette} from '../../components/backdrop/Backdrop';
import {useBeat, useCamera} from '../../engine';
import {theme} from '../../styles/theme';
import {ease} from '../../styles/motion';
import {CAMERA_INITIAL, CAMERA_TRACK} from './layout';

/** Whole-episode backdrop: ink, a world-anchored dot grid, vignette and grain. */
export const BackdropLayer: React.FC = () => {
  const camera = useCamera(CAMERA_INITIAL, CAMERA_TRACK);
  const assemble = useBeat('assemble');
  // The grid recedes for the conclusion so the final statement owns the frame.
  const gridOpacity = 1 - 0.55 * assemble.at(0, 1.2, ease.inOut);
  return (
    <AbsoluteFill style={{backgroundColor: theme.color.ink}}>
      <DotGrid camera={camera} color={theme.color.paper} opacity={0.085 * gridOpacity} spacing={48} parallax={0.6} />
      <Vignette strength={0.34} />
    </AbsoluteFill>
  );
};
