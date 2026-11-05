/**
 * PROVISIONAL design tokens. Swap this file (or add another theme object and
 * pass it around) to experiment with channel aesthetics. Scenes must read
 * colours / type from here instead of hard-coding values.
 */
export const theme = {
  color: {
    /** Background: warm near-black "ink". */
    ink: '#0C0D0F',
    inkRaised: '#15171B',
    /** Primary foreground: warm off-white "paper". */
    paper: '#ECE7DD',
    paperSoft: 'rgba(236, 231, 221, 0.62)',
    paperFaint: 'rgba(236, 231, 221, 0.22)',
    paperGhost: 'rgba(236, 231, 221, 0.08)',
    muted: '#80858D',
    /** Signal colour 1: what the instrument sees / verified. */
    scan: '#8FE3CF',
    scanSoft: 'rgba(143, 227, 207, 0.35)',
    scanGhost: 'rgba(143, 227, 207, 0.10)',
    /** Signal colour 2: what is really there / undetected problems. */
    alert: '#FF5B35',
    alertSoft: 'rgba(255, 91, 53, 0.35)',
  },
  font: {
    /** Variable grotesk: weight 100–900, width 62–125%. */
    display: "'Archivo', 'Arial Narrow', sans-serif",
    /** Editorial serif voice for asides and quotations. */
    serif: "'Instrument Serif', Georgia, serif",
    /** Technical readouts. */
    mono: "'JetBrains Mono', ui-monospace, monospace",
  },
  /** Type scale for a 1920×1080 frame. Nothing important goes below `label`. */
  size: {
    hero: 214,
    display: 150,
    title: 96,
    stat: 92,
    body: 48,
    label: 26,
  },
  /** Safe area (px) for important content in a 1920×1080 frame. */
  safe: {x: 120, y: 96},
} as const;

export type Theme = typeof theme;
