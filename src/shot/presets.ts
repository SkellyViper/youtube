import {cyber} from '../styles/cyber';
import {video01} from '../styles/video01';
import type {LightDef, LightState, ShotDef, ShotPatch, StagePatch} from './types';

/**
 * The reusable light rig every shot gets: key, fill, rim, ambient, sky.
 * Positions are for a subject around the origin at desk height (metres);
 * directional lights only care about direction, so they suit any scale.
 *
 * Scenes pass the starting intensities (an old shot can start with the rig
 * off and its own environment lights on, so its code defaults still look
 * like they always did).
 */
export const rigLights = (on: Partial<Record<'key' | 'fill' | 'rim' | 'ambient' | 'sky', number>> = {}): Record<string, LightDef> => ({
  key: {
    label: 'Key light',
    role: 'rig',
    defaults: {kind: 'directional', color: '#C9D6FF', intensity: on.key ?? 0, position: [2.6, 4.6, 3.4], target: [0, 0.8, 0], castShadow: true, enabled: (on.key ?? 0) > 0},
  },
  fill: {
    label: 'Fill light',
    role: 'rig',
    defaults: {kind: 'directional', color: '#B8C6FF', intensity: on.fill ?? 0, position: [-4, 2.4, 4.5], target: [0, 0.8, 0], enabled: (on.fill ?? 0) > 0},
  },
  rim: {
    label: 'Rim / accent light',
    role: 'rig',
    defaults: {kind: 'directional', color: cyber.color.blue, intensity: on.rim ?? 0, position: [-3, 4.2, -5], target: [0, 1, 0], enabled: (on.rim ?? 0) > 0},
  },
  ambient: {
    label: 'Ambient',
    role: 'rig',
    defaults: {kind: 'ambient', color: '#8FA4FF', intensity: on.ambient ?? 0, enabled: (on.ambient ?? 0) > 0},
  },
  sky: {
    label: 'Sky / ground bounce',
    role: 'rig',
    defaults: {kind: 'hemisphere', color: '#1C2A5C', groundColor: cyber.color.void, intensity: on.sky ?? 0, enabled: (on.sky ?? 0) > 0},
  },
});

/**
 * The Video 01 rig (Legacy / Digital Noir), as the `lights` of a shot: the
 * standard rig at the episode's levels, with the rim brought down and behind
 * so it grazes silhouettes instead of washing a desk top. Spread it into a
 * ShotDef and add the scene's practicals:
 *
 *   lights: {...noirRig(), 'glow-screen': {...}}
 */
export const noirRig = (): Record<string, LightDef> => {
  const L = video01.light;
  const rig = rigLights({key: L.key.intensity, fill: L.fill.intensity, rim: L.rim.intensity, ambient: L.ambient.intensity, sky: L.sky.intensity});
  return {...rig, rim: {...rig.rim, defaults: {...rig.rim.defaults, position: L.rim.position, target: L.rim.target}}};
};

/** The Video 01 stage look, as the `stage` of a shot. */
export const noirStage = (): StagePatch => ({...video01.stage, bloom: {...video01.stage.bloom}});

export type LightingPreset = {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly rig: Readonly<Record<'key' | 'fill' | 'rim' | 'ambient' | 'sky', Partial<LightState>>>;
  /** What happens to environment lights (window, room bounce): off for the legacy look. */
  readonly environment: 'off' | 'keep';
  readonly stage: StagePatch;
};

/**
 * Lighting presets. "Legacy neon" is the look of the original Style Lab
 * samples (src/styles/cyber.ts, Environment.tsx StageLights): almost no fill,
 * a cold blue rim that draws silhouettes, a faint blue-violet ambient, bloom
 * 0.85 / 0.72 / 0.92 so only emissive accents glow, fog in the void colour.
 * A soft key is added so a figure and furniture read as solid matter.
 */
export const LIGHTING_PRESETS: readonly LightingPreset[] = [
  {
    id: 'digital-noir',
    label: 'Legacy / Digital Noir · Video 01',
    description: 'The approved Wrong Project rig: soft cold key, almost no fill, a low blue rim from behind, faint ambient. Screens and the light figure carry the frame.',
    rig: {
      key: {enabled: true, intensity: video01.light.key.intensity, color: video01.light.key.color, position: video01.light.key.position, target: video01.light.key.target, castShadow: true},
      fill: {enabled: true, intensity: video01.light.fill.intensity, color: video01.light.fill.color},
      rim: {enabled: true, intensity: video01.light.rim.intensity, color: video01.light.rim.color, position: video01.light.rim.position, target: video01.light.rim.target},
      ambient: {enabled: true, intensity: video01.light.ambient.intensity, color: video01.light.ambient.color},
      sky: {enabled: true, intensity: video01.light.sky.intensity, color: video01.light.sky.color, groundColor: video01.light.sky.groundColor},
    },
    environment: 'off',
    stage: {...video01.stage, bloom: {...video01.stage.bloom}, background: ''},
  },
  {
    id: 'legacy-neon',
    label: 'Legacy neon',
    description: 'The original samples: dark matter drawn by a cold blue rim, faint blue ambient, controlled glow. Practicals (screens) stay.',
    rig: {
      key: {enabled: true, intensity: 0.9, color: '#C9D6FF', castShadow: true},
      fill: {enabled: true, intensity: 0.25, color: '#B8C6FF'},
      rim: {enabled: true, intensity: 2.6, color: cyber.color.blue},
      ambient: {enabled: true, intensity: 0.32, color: '#8FA4FF'},
      sky: {enabled: true, intensity: 0.35, color: '#1C2A5C', groundColor: cyber.color.void},
    },
    environment: 'off',
    stage: {exposure: 1, bloom: {enabled: true, strength: cyber.bloom.strength, radius: cyber.bloom.radius, threshold: cyber.bloom.threshold}, fog: cyber.fog.density, background: '', shadows: true, grade: true},
  },
  {
    id: 'legacy-night',
    label: 'Legacy night',
    description: 'Same palette, darker: the screens carry the scene, the rim only separates silhouettes from the void.',
    rig: {
      key: {enabled: true, intensity: 0.35, color: '#C9D6FF', castShadow: true},
      fill: {enabled: false, intensity: 0},
      rim: {enabled: true, intensity: 1.9, color: cyber.color.blue},
      ambient: {enabled: true, intensity: 0.16, color: '#8FA4FF'},
      sky: {enabled: true, intensity: 0.2, color: '#1C2A5C', groundColor: cyber.color.void},
    },
    environment: 'off',
    stage: {exposure: 1, bloom: {enabled: true, strength: cyber.bloom.strength, radius: cyber.bloom.radius, threshold: cyber.bloom.threshold}, fog: cyber.fog.density, background: '', shadows: true, grade: true},
  },
  {
    id: 'practicals',
    label: 'Practicals only',
    description: 'Rig off: only the scene’s own sources (screens, lamp, window). For checking what the practicals do on their own.',
    rig: {
      key: {enabled: false},
      fill: {enabled: false},
      rim: {enabled: false},
      ambient: {enabled: false},
      sky: {enabled: false},
    },
    environment: 'keep',
    stage: {},
  },
];

/** Apply a preset to a patch: sets the rig lights, switches environment lights per the preset, sets the stage look. */
export const applyLightingPreset = (def: ShotDef, patch: ShotPatch, presetId: string): ShotPatch => {
  const preset = LIGHTING_PRESETS.find((p) => p.id === presetId);
  if (!preset) return patch;
  const lights: Record<string, Partial<LightState>> = {...(patch.lights ?? {})};
  for (const [id, values] of Object.entries(preset.rig)) {
    if (def.lights[id]) lights[id] = {...lights[id], ...values};
  }
  for (const [id, l] of Object.entries(def.lights)) {
    if (l.role === 'environment') lights[id] = {...lights[id], enabled: preset.environment === 'keep'};
  }
  const stage = {...(patch.stage ?? {}), ...preset.stage, bloom: {...(patch.stage?.bloom ?? {}), ...(preset.stage.bloom ?? {})}};
  return {...patch, lights, stage: Object.keys(preset.stage).length ? stage : patch.stage};
};
