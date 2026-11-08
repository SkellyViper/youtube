import * as THREE from 'three';
import {mix} from '../../../styles/cyber';
import type {Theme} from '../../../styles/themes';

/**
 * Physical palette of the cinematic scenes.
 *
 * The rule (docs/CINEMATIC_VISUAL_LANGUAGE.md, "Materials"): most of a frame is
 * ordinary dark matter (painted wall, wood, fabric, powder-coated steel) that
 * is lit by a few practical sources: screens, a lamp, LEDs, the night outside.
 * Neon is a signal, not a material. So these colours are deliberately dull,
 * and the theme only tints them: a theme changes what the lights are, not
 * what the room is made of.
 */
export type CineMaterials = {
  readonly wall: string;
  readonly wallDark: string;
  readonly floor: string;
  readonly plank: string;
  readonly rug: string;
  readonly desk: string;
  readonly deskEdge: string;
  readonly plastic: string;
  readonly plasticDark: string;
  readonly steel: string;
  readonly steelDark: string;
  readonly fabric: string;
  readonly denim: string;
  readonly skin: string;
  readonly hair: string;
  readonly paper: string;
  readonly ceramic: string;
  readonly rackBody: string;
  readonly rackFace: string;
  readonly rackRail: string;
  readonly hallFloor: string;
  readonly hallTile: string;
  readonly concrete: string;
};

export const cineMaterials = (th: Theme): CineMaterials => ({
  wall: mix(th.color.abyss, th.color.slate, 0.42),
  wallDark: mix(th.color.void, th.color.slate, 0.3),
  floor: mix(th.color.void, '#2A211C', 0.62),
  plank: mix(th.color.void, '#3A2C24', 0.55),
  rug: mix(th.color.abyss, '#2B2634', 0.6),
  desk: mix(th.color.abyss, '#2E2520', 0.72),
  deskEdge: mix(th.color.abyss, '#3B3028', 0.72),
  plastic: mix(th.color.slate, '#0C0D12', 0.6),
  plasticDark: mix(th.color.void, '#0A0B0F', 0.8),
  steel: mix(th.color.steel, '#8C94A6', 0.35),
  steelDark: mix(th.color.steel, '#1A1E28', 0.5),
  fabric: mix(th.color.slate, '#2E3442', 0.7),
  denim: mix(th.color.abyss, '#20273A', 0.75),
  skin: '#B88E72',
  hair: '#1C1612',
  paper: '#CFC8BC',
  ceramic: '#D7D2C8',
  rackBody: mix(th.color.void, '#15181F', 0.9),
  rackFace: mix(th.color.slate, '#3A4150', 0.65),
  rackRail: mix(th.color.steel, '#4A5468', 0.5),
  hallFloor: mix(th.color.void, '#1A1D24', 0.75),
  hallTile: mix(th.color.slate, '#2B3140', 0.5),
  concrete: mix(th.color.abyss, '#232730', 0.7),
});

/** Colour pushed above 1.0 so the stage's bloom picks it up (see cyber emissive levels). */
export const lit = (hex: string, intensity: number): THREE.Color => new THREE.Color(hex).multiplyScalar(Math.max(0, intensity));

/** Blend two hex colours in linear space, then scale. */
export const litMix = (a: string, b: string, t: number, intensity = 1): THREE.Color =>
  new THREE.Color(a).lerp(new THREE.Color(b), Math.min(1, Math.max(0, t))).multiplyScalar(Math.max(0, intensity));

const planks = new Map<string, THREE.DataTexture>();

/**
 * Procedural floorboards: a repeating strip of planks with staggered joints
 * and slightly different shades. Generated once per colour pair, no asset.
 * Deterministic (fixed hash), so renders are reproducible.
 */
export const plankTexture = (base: string, seam: string, repeat: [number, number] = [6, 6]): THREE.DataTexture => {
  const key = `${base}|${seam}`;
  const cached = planks.get(key);
  if (cached) return cached;
  const W = 256;
  const H = 256;
  const data = new Uint8Array(W * H * 4);
  const b = new THREE.Color(base);
  const s = new THREE.Color(seam);
  const rows = 8;
  const hash = (x: number, y: number) => {
    const v = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return v - Math.floor(v);
  };
  for (let y = 0; y < H; y++) {
    const row = Math.floor((y / H) * rows);
    const offset = Math.floor(hash(row, 3) * W);
    const shade = 0.85 + 0.3 * hash(row, 7);
    for (let x = 0; x < W; x++) {
      const yy = (y / H) * rows - row;
      const xx = ((x + offset) % W) / W;
      const joint = Math.abs(((xx * 2) % 1) - 0.5) > 0.485;
      const edge = yy < 0.035 || joint;
      const grain = 0.94 + 0.12 * hash(x * 0.37, row);
      const c = edge ? s : b.clone().multiplyScalar(shade * grain);
      const i = (y * W + x) * 4;
      data[i] = Math.min(255, c.r * 255);
      data[i + 1] = Math.min(255, c.g * 255);
      data[i + 2] = Math.min(255, c.b * 255);
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  planks.set(key, tex);
  return tex;
};

const tiles = new Map<string, THREE.DataTexture>();

/** Raised-floor tiles of a data hall: square tiles with a thin seam. */
export const tileTexture = (base: string, seam: string, repeat = 20): THREE.DataTexture => {
  const key = `${base}|${seam}|${repeat}`;
  const cached = tiles.get(key);
  if (cached) return cached;
  const W = 128;
  const data = new Uint8Array(W * W * 4);
  const b = new THREE.Color(base);
  const s = new THREE.Color(seam);
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const edge = x < 2 || y < 2;
      const v = Math.sin(x * 3.1 + y * 7.7) * 0.5 + 0.5;
      const c = edge ? s : b.clone().multiplyScalar(0.94 + 0.08 * v);
      const i = (y * W + x) * 4;
      data[i] = Math.min(255, c.r * 255);
      data[i + 1] = Math.min(255, c.g * 255);
      data[i + 2] = Math.min(255, c.b * 255);
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, W, W, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  tiles.set(key, tex);
  return tex;
};

let perforation: THREE.DataTexture | null = null;

/** Perforated steel (rack doors, vents): a hex grid of holes as an alpha-less shade map. */
export const perforationTexture = (): THREE.DataTexture => {
  if (perforation) return perforation;
  const W = 64;
  const data = new Uint8Array(W * W * 4);
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const row = Math.floor(y / 8);
      const cx = ((x + (row % 2) * 4) % 8) - 4;
      const cy = (y % 8) - 4;
      const hole = cx * cx + cy * cy < 6.5;
      const v = hole ? 22 : 150;
      const i = (y * W + x) * 4;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  perforation = new THREE.DataTexture(data, W, W, THREE.RGBAFormat);
  perforation.wrapS = THREE.RepeatWrapping;
  perforation.wrapT = THREE.RepeatWrapping;
  perforation.minFilter = THREE.LinearMipmapLinearFilter;
  perforation.needsUpdate = true;
  return perforation;
};
