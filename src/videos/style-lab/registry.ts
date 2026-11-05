import type React from 'react';
import {buildTimeline, type EpisodeDef} from '../../engine';
import * as s01 from '../../scenes/style-lab/01-hero';
import * as s02 from '../../scenes/style-lab/02-agent';
import * as s03 from '../../scenes/style-lab/03-swarm';
import * as s04 from '../../scenes/style-lab/04-network';
import * as s05 from '../../scenes/style-lab/05-scan';
import * as s06 from '../../scenes/style-lab/06-cloud';
import * as s07 from '../../scenes/style-lab/07-source';
import * as s08 from '../../scenes/style-lab/08-media';
import * as s09 from '../../scenes/style-lab/09-diagram';
import * as s10 from '../../scenes/style-lab/10-ending';

/**
 * The ten original Style Lab samples ("legacy" since the redesign).
 *
 * NOTE: reconstructed on the style-lab-redesign branch. The original file was
 * never committed because `.gitignore` contained `videos/`, which matched
 * src/videos/. Titles and ideas come from docs/STYLE_LAB.md.
 */
export const LAB_FPS = 60;

export type LabKind = '2D' | '3D' | 'Hybrid';

export type LabSample = {
  /** Composition id, e.g. `lab-03-swarm`. */
  readonly id: string;
  /** URL slug, e.g. `03-swarm`. */
  readonly slug: string;
  readonly number: number;
  readonly title: string;
  readonly kind: LabKind;
  /** One sentence for the gallery. */
  readonly idea: string;
  readonly episode: EpisodeDef;
  readonly component: React.ComponentType;
};

type Mod = {readonly episode: EpisodeDef; readonly Sample: React.ComponentType};
const sample = (number: number, slug: string, mod: Mod, title: string, kind: LabKind, idea: string): LabSample => ({
  id: `lab-${slug}`,
  slug,
  number,
  title,
  kind,
  idea,
  episode: mod.episode,
  component: mod.Sample,
});

export const LAB_SAMPLES: readonly LabSample[] = [
  sample(1, '01-hero', s01, 'Cinematic opening', 'Hybrid', 'A dark city of compute wakes up, scales out, an agent ignites at its centre, then the camera flattens the world into a plan diagram.'),
  sample(2, '02-agent', s02, 'A single agent', '3D', 'The gimbal iris assembles, attends, reaches into three tools, uses them, turns red.'),
  sample(3, '03-swarm', s03, 'Replication', '3D', 'One agent divides into a 4x4 cell; the cell is one of hundreds; all turn to face you and the far edge goes red.'),
  sample(4, '04-network', s04, 'The network', '3D', 'A cluster forms, one signal hops, activity cascades, the camera pulls out to a web of clusters, then dives into another one.'),
  sample(5, '05-scan', s05, 'Scanning and detection', 'Hybrid', 'A scan verifies what it can see; under the floor, beneath a ticked module, hangs a red agent.'),
  sample(6, '06-cloud', s06, 'Cloud compute', 'Hybrid', 'Three islands of compute; an access token opens a gate; the workload moves across.'),
  sample(7, '07-source', s07, 'Source and citation panel', '2D', 'A real Wikipedia page arrives, becomes readable, a measured sentence is emphasised, it docks beside a NIST paper.'),
  sample(8, '08-media', s08, 'Image and video panel', '2D', 'A public-domain photo is framed and reframed, then shown beside a portrait NASA clip that plays in its beat.'),
  sample(9, '09-diagram', s09, 'Technical diagram', '2D', 'Prompt, agent, action, consequences; the far consequences turn red and loop back.'),
  sample(10, '10-ending', s10, 'Ominous hold', '3D', 'The system winds down and goes dark, one ember stays on, the camera finds a whole lit city on the horizon.'),
];

/** Accepts a slug (`03-swarm`) or a composition id (`lab-03-swarm`). */
export const findLabSample = (key: string | null | undefined): LabSample | undefined => {
  if (!key) return undefined;
  const slug = key.startsWith('lab-') ? key.slice(4) : key;
  return LAB_SAMPLES.find((s) => s.slug === slug);
};

/** Frame-accurate beat sheet (automation + scripts/lab.mjs). */
export const labInfo = (s: LabSample) => {
  const t = buildTimeline(s.episode, LAB_FPS);
  return {
    slug: s.slug,
    title: s.title,
    kind: s.kind,
    durationInFrames: t.durationInFrames,
    checkpoints: [...t.checkpoints],
    posterFrame: t.checkpoints[t.checkpoints.length - 1],
    beats: t.beats.map((b) => ({id: b.id, label: b.label, start: b.start, animEnd: b.animEnd, end: b.end})),
  };
};
