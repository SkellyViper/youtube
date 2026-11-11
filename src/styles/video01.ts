import {cyber} from './cyber';

/**
 * Video 01 · "Legacy / Digital Noir": the visual language of the first
 * episode, extracted from its approved reference shot, X02 The wrong project
 * (src/scenes/cinematic/02-wrong-project). Guide: docs/VIDEO_01_VISUAL_LANGUAGE.md.
 *
 * This file is the single place the episode's numbers live. The reference
 * shot reads them (it does not carry its own copies), so a scene built from
 * these tokens matches it by construction:
 *
 *   palette   the `noir` theme (src/styles/themes.ts): the lab's obsidian-neon
 *             hexes, locked for this episode
 *   figure    the light person's material levels            -> HoloPerson defaults
 *   light     the rig around a subject at desk height        -> noirRig() / the "Legacy / Digital Noir" lighting preset
 *   stage     exposure, bloom, fog, shadows, grade           -> noirStage()
 *   edges     luminous hairlines on dark furniture           -> ShotObject edge defaults
 *   camera    lens and movement limits                       -> shot.ts cameras, checked in review
 *   motion    how long things take                           -> cue timings
 *
 * Episode-scoped on purpose: other videos may define their own file next to
 * this one. Nothing here depends on the browser; it is plain data, so the
 * live Player and the MP4 export read the same values.
 */
export const video01 = {
  id: 'video-01',
  name: 'Legacy / Digital Noir',
  /** Theme id to pass to a composition (`--theme=noir`, `?theme=noir`). */
  theme: 'noir',

  /**
   * Colour roles. Hexes come from the theme (`useTheme().tone.*`); this is the
   * rule for choosing one.
   */
  roles: {
    /** Cyan / blue: people, ordinary activity, neutral systems, evidence. */
    system: cyber.tone.system,
    /** Purple: AI agents, autonomous processes, active computation. */
    mind: cyber.tone.mind,
    /** Red: compromise, danger, escalation. Never decoration. */
    threat: cyber.tone.threat,
    /** Unlit structure. */
    inert: cyber.tone.inert,
  },

  /**
   * The light person (HoloPerson). Levels multiply the theme's system tone:
   * `core` fills the body, `rim` draws the silhouette and the contour lines.
   *
   * The approved render used rim 2.0 / core 0.4; with bloom at 0.85 the figure
   * then read brighter than the monitor it was looking at. 1.25 / 0.32 keeps
   * him luminous (the rim still crosses the bloom threshold at the silhouette)
   * while the screen stays the brightest thing in the frame.
   */
  figure: {
    core: 0.32,
    rim: 1.25,
    /** Contour-line, sparkle and scan-band strength (1 = as approved). */
    lines: 1,
    sparkle: 1,
    scan: 1,
    /** Point light he throws on the chair and desk edge around him (multiplies the `figure-glow` practical). */
    spill: 0.35,
  },

  /**
   * The rig: a soft cold key for form and contact shadows, almost no fill, a
   * low blue rim that grazes silhouettes from behind-left, faint blue ambient.
   * Intensities are three.js physical units for directional lights.
   */
  light: {
    key: {intensity: 0.75, color: '#C9D6FF', position: [2.6, 4.6, 3.4], target: [0, 0.8, 0]},
    fill: {intensity: 0.18, color: '#B8C6FF', position: [-4, 2.4, 4.5], target: [0, 0.8, 0]},
    rim: {intensity: 2.2, color: cyber.color.blue, position: [-2.6, 2.1, -4.4], target: [0, 0.95, 0.6]},
    ambient: {intensity: 0.28, color: '#8FA4FF'},
    sky: {intensity: 0.3, color: '#1C2A5C', groundColor: cyber.color.void},
    /** Practicals (multipliers on the object's own light): a screen's glow, the purple agent accent. */
    screenGlow: 1,
    agentAccent: 1,
  },

  /** Stage look. Bloom is the lab's budget: only colours above ~0.92 glow. */
  stage: {
    exposure: 1,
    bloom: {enabled: true, strength: cyber.bloom.strength, radius: cyber.bloom.radius, threshold: cyber.bloom.threshold},
    fog: cyber.fog.density,
    shadows: true,
    grade: true,
  },

  /** Luminous hairlines on dark furniture (ShotObject `edges`): system blue, well under the bloom threshold. */
  edges: {
    color: cyber.color.blue,
    /** The object the story is on (monitor). */
    primary: 0.55,
    /** Supporting furniture (chair). */
    secondary: 0.45,
    threshold: 40,
  },

  /**
   * Camera conventions. A scene has one locked wide shot; a close-up is a cut
   * to an insert, never a travel. The only movement allowed inside a shot is a
   * push of at most `maxPush` metres over a whole beat.
   */
  camera: {
    /** Wide / establishing: a long-ish lens from a three-quarter position, slightly above eye level. */
    wide: {fov: 28, minFov: 24, maxFov: 34},
    /** Insert on a screen or an object: near-frontal, the subject fills 70 to 85 % of the frame width. */
    insert: {fov: 26, minFov: 20, maxFov: 30},
    /** Metres of travel allowed within one shot (X02's insert pushes 0.062 m in 4.5 s). */
    maxPush: 0.07,
    /** Seconds after a beat starts before a cut lands (keeps each checkpoint hold on its own shot). */
    cutOffset: 0.01,
  },

  /** Seconds. Cue lengths the reference shot uses; compose new beats from these. */
  motion: {
    /** A state flip: Enter, a click, a tab pulse starting. */
    flip: 0.25,
    /** A hand or head moving to a new place. */
    gesture: 1.0,
    /** A posture change (leaning back). */
    posture: 2.0,
    /** Reading time in front of an insert before anything changes. */
    read: 1.4,
    /** The still tail of an ominous hold in the export (the live presenter holds as long as the narrator wants). */
    hold: 1.0,
  },
} as const;

export type Video01 = typeof video01;
