import {cyber} from './cyber';

/**
 * Visual identities for the Style Lab redesign.
 *
 * A theme is more than a palette: it also decides glow budget, bloom, grain,
 * line weight, panel treatment, background atmosphere and how transitions are
 * detailed. Scenes never read hexes directly; they read *roles*:
 *
 *   system  infrastructure, neutral computation, evidence
 *   mind    AI, agents, anything an agent touches
 *   threat  compromise, loss of control
 *   safe    verified / passed / healthy (tests, scans)
 *   human   the developer's world: the game, the desk lamp, the room
 *
 * The explanatory motion is identical across themes; only the look changes.
 * `neon` reproduces the original "obsidian neon" tokens in src/styles/cyber.ts
 * exactly, so legacy samples rendered under it are unchanged.
 */

export type ToneTriplet = {readonly base: string; readonly hot: string; readonly deep: string};

export type ThemeId = 'neon' | 'infrared' | 'glacial' | 'ghost' | 'spectral';

export type Theme = {
  readonly id: ThemeId;
  readonly name: string;
  readonly mood: string;
  readonly color: {
    /** Base of every frame. */
    readonly void: string;
    /** Lifted background, panel backing. */
    readonly abyss: string;
    /** Unlit structure (racks, desks, walls). */
    readonly slate: string;
    /** Hairlines on structure, inactive marks. */
    readonly steel: string;
    /** Horizon haze / atmosphere band. */
    readonly haze: string;
    /** Signal heads and core centres only. */
    readonly white: string;
    readonly text: string;
    readonly dim: string;
  };
  readonly tone: {
    readonly system: ToneTriplet;
    readonly mind: ToneTriplet;
    readonly threat: ToneTriplet;
    readonly safe: ToneTriplet;
    readonly human: ToneTriplet;
    readonly inert: ToneTriplet;
  };
  /** Multiplies every glow / halo opacity (2D) and emissive level (3D). */
  readonly glow: number;
  readonly bloom: {readonly strength: number; readonly radius: number; readonly threshold: number};
  /** 3D fog colour and density. */
  readonly fog: {readonly color: string; readonly density: number};
  /** Film grain amount and vignette strength of the finishing grade. */
  readonly grade: {readonly grain: number; readonly vignette: number; readonly scanlines: number; readonly tint?: string; readonly tintOpacity?: number};
  /** Base hairline width (px at 1080p). */
  readonly line: number;
  /** Panel chrome: corner brackets (instrument), rounded glass, or terminal box rules. */
  readonly panel: 'brackets' | 'glass' | 'terminal' | 'plate';
  /** Corner radius for panels and windows (px). */
  readonly radius: number;
  /** Background atmosphere: horizon haze band, flat vignette, dot grid, or volumetric fog wash. */
  readonly backdrop: 'horizon' | 'vignette' | 'grid' | 'fog';
  /** Label typeface. */
  readonly font: string;
  /** How mirror-like floors are in 3D (0 matte .. 1 obsidian). */
  readonly reflect: number;
  /** Transition detail on panels and reveals. */
  readonly transition: 'bracket' | 'scan' | 'ember' | 'shimmer' | 'mist';
};

const label = cyber.font.label;
const mono = cyber.font.mono;

export const THEMES: Readonly<Record<ThemeId, Theme>> = {
  neon: {
    id: 'neon',
    name: 'Neon Protocol',
    mood: 'Cinematic cyberpunk. Blue systems, purple minds, red threat on near-black.',
    color: {
      void: cyber.color.void,
      abyss: cyber.color.abyss,
      slate: cyber.color.slate,
      steel: cyber.color.steel,
      haze: cyber.color.haze,
      white: cyber.color.white,
      text: cyber.color.text,
      dim: cyber.color.dim,
    },
    tone: {
      system: cyber.tone.system,
      mind: cyber.tone.mind,
      threat: cyber.tone.threat,
      safe: {base: '#2FE39A', hot: '#B5FFDD', deep: '#0C5A3C'},
      human: {base: '#FFB45C', hot: '#FFE1B8', deep: '#7A4410'},
      inert: cyber.tone.inert,
    },
    glow: 1,
    bloom: cyber.bloom,
    fog: cyber.fog,
    grade: {grain: 0.055, vignette: 0.5, scanlines: 0},
    line: 1.25,
    panel: 'brackets',
    radius: 6,
    backdrop: 'horizon',
    font: label,
    reflect: 0.8,
    transition: 'bracket',
  },
  infrared: {
    id: 'infrared',
    name: 'Infrared',
    mood: 'Industrial and tense. Ember orange minds, warning red, cold steel machines.',
    color: {
      void: '#070504',
      abyss: '#0E0907',
      slate: '#221915',
      steel: '#4A3A31',
      haze: '#4A1606',
      white: '#FFF1E2',
      text: '#E9D6C6',
      dim: '#8A7466',
    },
    tone: {
      system: {base: '#9FB0BF', hot: '#E2ECF5', deep: '#34414D'},
      mind: {base: '#FF7A1F', hot: '#FFC48F', deep: '#7A2E05'},
      threat: {base: '#FF1F2D', hot: '#FF8C8C', deep: '#6E070E'},
      safe: {base: '#C8D86A', hot: '#F1F8C4', deep: '#4D5718'},
      human: {base: '#FFD08A', hot: '#FFF0D6', deep: '#7D5A22'},
      inert: {base: '#4A3A31', hot: '#8A7466', deep: '#221915'},
    },
    glow: 1.15,
    bloom: {strength: 1.0, radius: 0.6, threshold: 0.88},
    fog: {color: '#0A0604', density: 0.022},
    grade: {grain: 0.08, vignette: 0.62, scanlines: 0, tint: '#FF5A1F', tintOpacity: 0.035},
    line: 1.6,
    panel: 'plate',
    radius: 2,
    backdrop: 'fog',
    font: label,
    reflect: 0.45,
    transition: 'ember',
  },
  glacial: {
    id: 'glacial',
    name: 'Glacial',
    mood: 'Precise, clinical, holographic. Ice cyan on dark navy, silver structure.',
    color: {
      void: '#040A14',
      abyss: '#08121F',
      slate: '#16263A',
      steel: '#38506B',
      haze: '#123C5E',
      white: '#F4FBFF',
      text: '#D6E6F2',
      dim: '#7891A8',
    },
    tone: {
      system: {base: '#A9BED1', hot: '#EEF5FB', deep: '#3A5068'},
      mind: {base: '#3FD8FF', hot: '#C2F3FF', deep: '#0B5570'},
      threat: {base: '#FF4F78', hot: '#FFB3C5', deep: '#6E1027'},
      safe: {base: '#7CF2C8', hot: '#D6FFF0', deep: '#1D5E4A'},
      human: {base: '#FFC98A', hot: '#FFEBD1', deep: '#7A5524'},
      inert: {base: '#38506B', hot: '#7891A8', deep: '#16263A'},
    },
    glow: 0.8,
    bloom: {strength: 0.6, radius: 0.5, threshold: 0.95},
    fog: {color: '#06101C', density: 0.014},
    grade: {grain: 0.03, vignette: 0.38, scanlines: 0},
    line: 1.1,
    panel: 'glass',
    radius: 14,
    backdrop: 'grid',
    font: label,
    reflect: 0.95,
    transition: 'shimmer',
  },
  ghost: {
    id: 'ghost',
    name: 'Ghost Terminal',
    mood: 'Retro-futuristic computing. Phosphor green on graphite, amber-red alarms.',
    color: {
      void: '#060807',
      abyss: '#0B0F0C',
      slate: '#1A211C',
      steel: '#38453B',
      haze: '#16301C',
      white: '#ECFFE0',
      text: '#C9D9C4',
      dim: '#6F8070',
    },
    tone: {
      system: {base: '#7E9784', hot: '#CFE0D2', deep: '#2C3A30'},
      mind: {base: '#A8FF3E', hot: '#E2FFBE', deep: '#3C6410'},
      threat: {base: '#FF5A2E', hot: '#FFB49E', deep: '#6B1C08'},
      safe: {base: '#4FE0B0', hot: '#C6FFEA', deep: '#14543F'},
      human: {base: '#F5D27A', hot: '#FFF0C8', deep: '#6E5518'},
      inert: {base: '#38453B', hot: '#6F8070', deep: '#1A211C'},
    },
    glow: 0.9,
    bloom: {strength: 0.75, radius: 0.4, threshold: 0.9},
    fog: {color: '#070A08', density: 0.02},
    grade: {grain: 0.07, vignette: 0.55, scanlines: 0.07},
    line: 1.5,
    panel: 'terminal',
    radius: 0,
    backdrop: 'grid',
    font: mono,
    reflect: 0.35,
    transition: 'scan',
  },
  spectral: {
    id: 'spectral',
    name: 'Spectral',
    mood: 'Atmospheric and mysterious. Ultraviolet minds, teal systems, magenta threat in fog.',
    color: {
      void: '#06040D',
      abyss: '#0C0818',
      slate: '#1D1730',
      steel: '#3D3360',
      haze: '#2A1460',
      white: '#F7EEFF',
      text: '#DCD2F0',
      dim: '#857BA6',
    },
    tone: {
      system: {base: '#2EE6C8', hot: '#BFFFF3', deep: '#0B5A50'},
      mind: {base: '#9D5CFF', hot: '#D9C2FF', deep: '#3A1580'},
      threat: {base: '#FF2FA8', hot: '#FFA6DA', deep: '#6E0A47'},
      safe: {base: '#6DF0A0', hot: '#CFFFE0', deep: '#1D5E36'},
      human: {base: '#FFB97A', hot: '#FFE6CC', deep: '#7A4A1C'},
      inert: {base: '#3D3360', hot: '#857BA6', deep: '#1D1730'},
    },
    glow: 1.25,
    bloom: {strength: 1.1, radius: 0.85, threshold: 0.86},
    fog: {color: '#0A0616', density: 0.026},
    grade: {grain: 0.05, vignette: 0.6, scanlines: 0, tint: '#7A2CFF', tintOpacity: 0.04},
    line: 1.25,
    panel: 'brackets',
    radius: 10,
    backdrop: 'fog',
    font: label,
    reflect: 0.7,
    transition: 'mist',
  },
};

export const THEME_IDS: readonly ThemeId[] = ['neon', 'infrared', 'glacial', 'ghost', 'spectral'];
export const DEFAULT_THEME: ThemeId = 'neon';

export const isThemeId = (v: unknown): v is ThemeId => typeof v === 'string' && (THEME_IDS as readonly string[]).includes(v);
export const getTheme = (id: unknown): Theme => THEMES[isThemeId(id) ? id : DEFAULT_THEME];

export type ToneRole = keyof Theme['tone'];

/** Tone triplet by role (legacy `Tone` names included) for an explicit theme. */
export const themeTone = (theme: Theme, role: ToneRole): ToneTriplet => theme.tone[role];

/** The agent's colours in a theme, under the legacy names AgentGlyph / AgentCore3D use. */
export const agentPalette = (theme: Theme) => ({
  purple: theme.tone.mind.base,
  purpleHot: theme.tone.mind.hot,
  red: theme.tone.threat.base,
  redHot: theme.tone.threat.hot,
  blue: theme.tone.system.base,
  blueHot: theme.tone.system.hot,
  white: theme.color.white,
});
