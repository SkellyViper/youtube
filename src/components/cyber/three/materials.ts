import * as THREE from 'three';
import {cyber} from '../../../styles/cyber';

/**
 * "GlowMaterial" is not a class here; it is a convention. Neon in this look
 * is an unlit colour pushed above 1.0 so that the stage's bloom picks it up:
 *
 *   <meshBasicMaterial color={hdr(cyber.color.purple, cyber.emissive.strong)} />
 *
 * Intensity <= ~0.9 never blooms (lit structure), 1.5 has a faint halo,
 * 2.6 reads as "active", 4.5 is reserved for signal heads and core centres.
 */
export const hdr = (hex: string, intensity: number = cyber.emissive.base): THREE.Color =>
  new THREE.Color(hex).multiplyScalar(Math.max(0, intensity));

/** Blend two hex colours in linear space, then scale. */
export const hdrMix = (a: string, b: string, t: number, intensity = 1): THREE.Color =>
  new THREE.Color(a).lerp(new THREE.Color(b), Math.min(1, Math.max(0, t))).multiplyScalar(Math.max(0, intensity));

/** Control-loss ramp in 3D: 0 blue (system) -> 1 purple (intelligence) -> 2 red (threat). */
export const hdrRamp = (v: number, intensity = 1): THREE.Color => {
  const x = Math.min(2, Math.max(0, v));
  return x <= 1
    ? hdrMix(cyber.color.blue, cyber.color.purple, x, intensity)
    : hdrMix(cyber.color.purple, cyber.color.red, x - 1, intensity);
};

/** Props for unlit dark structure (slabs, plates): a strong silhouette with a faint sheen. */
export const structureProps = {
  color: cyber.color.slate,
  metalness: 0.3,
  roughness: 0.55,
} as const;

let haloTexture: THREE.DataTexture | null = null;

/** Soft radial falloff sprite texture (generated once, no image asset, deterministic). */
export const getHaloTexture = (): THREE.DataTexture => {
  if (haloTexture) return haloTexture;
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5) / size - 0.5;
      const dy = (y + 0.5) / size - 0.5;
      const d = Math.min(1, Math.sqrt(dx * dx + dy * dy) * 2);
      // Smooth, long-tailed falloff.
      const a = Math.pow(1 - d, 2.6);
      const i = (y * size + x) * 4;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = Math.round(a * 255);
    }
  }
  haloTexture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  haloTexture.magFilter = THREE.LinearFilter;
  haloTexture.minFilter = THREE.LinearFilter;
  haloTexture.needsUpdate = true;
  return haloTexture;
};
