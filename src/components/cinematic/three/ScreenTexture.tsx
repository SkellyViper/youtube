import {useLayoutEffect, useMemo} from 'react';
import * as THREE from 'three';

export type Painter = (ctx: CanvasRenderingContext2D, width: number, height: number) => void;

/**
 * A screen as a texture: a 2D canvas painted every frame by a pure painter
 * function, uploaded to the GPU as the monitor's picture.
 *
 * Determinism: the painter receives only values derived from the Remotion
 * frame (beat progress, active time), never a clock, so a given frame always
 * paints the same pixels in the Player and in the renderer. Painting happens
 * in a layout effect, which runs before @remotion/three advances the R3F
 * frame, so the texture is current when the frame is drawn.
 */
export const useScreenTexture = (width: number, height: number, paint: Painter): THREE.CanvasTexture => {
  const {canvas, texture} = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = 8;
    texture.generateMipmaps = true;
    return {canvas, texture};
  }, [width, height]);

  useLayoutEffect(() => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    paint(ctx, width, height);
    texture.needsUpdate = true;
  });

  useLayoutEffect(() => () => texture.dispose(), [texture]);

  return texture;
};
