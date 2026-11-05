import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Node2D, SceneAtmosphere, type Rect} from '../../../components/cyber';
import {SourcePanel, sourceRect} from '../../../components/cyber/media/SourcePanel';
import {createRandom} from '../../../components/random';
import {useActiveTime, useBeats} from '../../../engine';
import {alpha, cyber, motion} from '../../../styles/cyber';
import {sources} from './sources.generated';

/**
 * Sample 07: an internet source brought into the world as evidence.
 *
 * A real web page arrives out of the distant network, opens, the camera inside
 * the frame finds one measured sentence, then the page docks as a citation
 * while a second (portrait) document takes the stage.
 *
 * Everything the viewer reads is the source's own text. The only words we add
 * are the caption and the date under each frame.
 */

const BEATS = ['source-enter', 'source-read', 'source-emphasis', 'source-dock'] as const;

const W = 1920;
const H = 1080;
const HORIZON = cyber.horizon * H;

const wiki = sources['source-morris-worm'];
const nist = sources['source-nist-ai-rmf-p1'];

/* ------------------------------------------------------------------ layout */

/** Room under a frame for its one-line caption. */
const CAPTION = 60;
const STAGE: Rect = {x: cyber.safe.x, y: cyber.safe.y, width: W - cyber.safe.x * 2, height: H - cyber.safe.y * 2 - CAPTION};
const WIKI_RECT = sourceRect(wiki.naturalWidth, wiki.naturalHeight, STAGE);
/** The citation corner: low left, brackets and caption inside the safe area. */
const WIKI_DOCK = sourceRect(wiki.naturalWidth, wiki.naturalHeight, {x: cyber.safe.x + 10, y: STAGE.y, width: 330, height: STAGE.height}, {x: 0, y: 1});
const NIST_RECT = sourceRect(nist.naturalWidth, nist.naturalHeight, {x: 700, y: STAGE.y, width: 720, height: STAGE.height});

const union = (a: Rect, b: Rect): Rect => {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {x, y, width: Math.max(a.x + a.width, b.x + b.width) - x, height: Math.max(a.y + a.height, b.y + b.height) - y};
};
/**
 * What the inner camera frames: the article column from its title down to the
 * sentence (both measured). Filling 93.5% of the frame width crops exactly in
 * the page's own gutters: the sidebar and the infobox fall outside, no word is cut.
 */
const WIKI_FOCUS = union(wiki.regions.title, wiki.regions.passage);
const WIKI_FOCUS_FILL = 0.935;

/* ------------------------------------------------------------------ the distant network */

/** A pinhole looking down the floor: X sideways, Z away, h above the floor. */
const FOCAL = 900;
const EYE = 600;
const project = (X: number, Z: number, h = 0) => ({x: W / 2 + (X / Z) * FOCAL, y: HORIZON + (EYE - h * FOCAL) / Z});

type FloorNode = {readonly X: number; readonly Z: number};

/** Masts: the few nodes that stand above the horizon. The first two hand over the sources. */
const MASTS = [
  {X: 4.7, Z: 19, h: 1.72},
  {X: 9.5, Z: 14, h: 1.46},
  {X: -7.6, Z: 16, h: 1.9},
  {X: -15.2, Z: 24, h: 2.55},
  {X: 16.4, Z: 30, h: 2.35},
  {X: -1.6, Z: 34, h: 2.15},
] as const;
const BACKBONE: readonly (readonly [number, number])[] = [
  [0, 1],
  [0, 5],
  [5, 2],
  [2, 3],
  [1, 4],
];

const NETWORK = (() => {
  const rnd = createRandom(4107);
  const rows = [8.4, 11, 14.5, 19.5, 26, 35];
  const cols = 15;
  const grid: (number | null)[][] = [];
  const nodes: FloorNode[] = [];
  rows.forEach((z) => {
    const row: (number | null)[] = [];
    for (let c = 0; c < cols; c++) {
      const X = (c - (cols - 1) / 2) * 4.2 + rnd.range(-1.2, 1.2);
      const Z = z * (1 + rnd.range(-0.07, 0.07));
      const keep = rnd.next() < 0.56 && Math.abs((X / Z) * FOCAL) < W / 2 + 80;
      row.push(keep ? nodes.push({X, Z}) - 1 : null);
    }
    grid.push(row);
  });
  const links: [number, number][] = [];
  grid.forEach((row, r) => {
    row.forEach((a, c) => {
      if (a === null) return;
      // Along the row: the next surviving node, if it is close.
      for (let d = 1; d <= 2; d++) {
        const b = row[c + d];
        if (b !== null && b !== undefined) {
          if (rnd.next() < 0.8) links.push([a, b]);
          break;
        }
      }
      // Away from us: the nearest node one row deeper.
      const next = grid[r + 1];
      if (!next) return;
      for (const d of [0, 1, -1]) {
        const b = next[c + d];
        if (b !== null && b !== undefined) {
          if (rnd.next() < 0.72) links.push([a, b]);
          break;
        }
      }
    });
  });
  return {nodes, links};
})();

const FarNetwork: React.FC<{readonly drift: number; readonly lit: readonly number[]}> = ({drift, lit}) => {
  const floor = NETWORK.nodes.map((n) => ({...project(n.X + drift, n.Z), Z: n.Z}));
  const masts = MASTS.map((m) => ({top: project(m.X + drift, m.Z, m.h), base: project(m.X + drift, m.Z), Z: m.Z}));
  // Further away = fainter: depth comes from haze, not blur.
  const far = (Z: number) => Math.max(0.25, 1 - (Z - 8) / 40);
  return (
    <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
      <g fill="none" strokeWidth={cyber.line.hair} strokeLinecap="round">
        {NETWORK.links.map(([a, b], i) => (
          <path
            key={i}
            d={`M${floor[a].x.toFixed(1)} ${floor[a].y.toFixed(1)}L${floor[b].x.toFixed(1)} ${floor[b].y.toFixed(1)}`}
            stroke={cyber.color.blue}
            opacity={0.2 * far((floor[a].Z + floor[b].Z) / 2)}
          />
        ))}
        {BACKBONE.map(([a, b], i) => (
          <path
            key={`b${i}`}
            d={`M${masts[a].top.x.toFixed(1)} ${masts[a].top.y.toFixed(1)}L${masts[b].top.x.toFixed(1)} ${masts[b].top.y.toFixed(1)}`}
            stroke={cyber.color.blue}
            opacity={0.16}
          />
        ))}
        {masts.map((m, i) => (
          <path key={`m${i}`} d={`M${m.base.x.toFixed(1)} ${m.base.y.toFixed(1)}V${m.top.y.toFixed(1)}`} stroke={cyber.color.blue} opacity={0.3 * far(m.Z) + 0.3 * Math.min(1, lit[i] ?? 0)} />
        ))}
      </g>
      {floor.map((n, i) => (
        <circle key={i} cx={n.x} cy={n.y} r={1.2 + 10 / n.Z} fill={cyber.color.blue} opacity={0.5 * far(n.Z)} />
      ))}
      {masts.map((m, i) => (
        <Node2D key={i} x={m.top.x} y={m.top.y} r={2.4 + 22 / m.Z} color={cyber.color.blue} level={0.42 * far(m.Z) + (lit[i] ?? 0)} />
      ))}
    </svg>
  );
};

/** The page's light landing on the obsidian floor in front of it. */
const FloorPool: React.FC<{readonly rect: Rect; readonly level: number}> = ({rect, level}) => {
  if (level <= 0.001) return null;
  const width = rect.width * 1.22;
  const height = 150;
  return (
    <div
      style={{
        position: 'absolute',
        left: rect.x + rect.width / 2 - width / 2,
        top: H - 62 - height / 2,
        width,
        height,
        opacity: level,
        background: `radial-gradient(ellipse 50% 50% at 50% 50%, ${alpha(cyber.color.blueHot, 0.17)}, ${alpha(cyber.color.blue, 0.08)} 42%, ${alpha(cyber.color.blueDeep, 0)} 72%)`,
      }}
    />
  );
};

/* ------------------------------------------------------------------ scene */

export const SourceScene: React.FC = () => {
  const b = useBeats(BEATS);
  const time = useActiveTime();
  const enterBeat = b['source-enter'];
  const readBeat = b['source-read'];
  const emphasisBeat = b['source-emphasis'];
  const dockBeat = b['source-dock'];

  // First source: one progress value per beat.
  const enter = enterBeat.at(0.1, 1.8);
  const read = readBeat.at(0, 1.4);
  const emphasis = emphasisBeat.at(0, 2.2);
  const dock = dockBeat.at(0, 1.3);
  // Second source: arrives and opens inside the last beat.
  const enter2 = dockBeat.at(0.45, 1.7);
  const read2 = dockBeat.at(1.45, 2.2);

  // The network drifts a few pixels while beats play (parallax), and stands still in holds.
  const drift = -0.016 * time;
  const origin = MASTS.slice(0, 2).map((m) => project(m.X + drift, m.Z, m.h));
  // A mast flares when it hands over a source, then stays a little brighter: it has been visited.
  const flare = (t: number, settle: number) => Math.sin(Math.PI * Math.min(1, t)) * 1.1 + 0.42 * settle;
  const lit = [flare(enterBeat.at(0, 0.7), enterBeat.at(0.3, 0.7)), flare(dockBeat.at(0.35, 1.05), dockBeat.at(0.65, 1.05))];

  const light = motion.glide(read) * (1 - dock);
  const light2 = motion.glide(read2);

  return (
    <AbsoluteFill>
      <SceneAtmosphere intensity={0.9 + 0.12 * light + 0.1 * light2} floorOpacity={0.55} />
      <FarNetwork drift={drift} lit={lit} />
      <FloorPool rect={WIKI_RECT} level={light} />
      <FloorPool rect={NIST_RECT} level={light2} />

      <SourcePanel
        src={wiki.src}
        naturalWidth={wiki.naturalWidth}
        naturalHeight={wiki.naturalHeight}
        rect={WIKI_RECT}
        dockRect={WIKI_DOCK}
        caption="en.wikipedia.org"
        meta="Retrieved 4 Nov 2026"
        highlight={wiki.regions.passage.lines}
        focus={WIKI_FOCUS}
        focusFill={WIKI_FOCUS_FILL}
        from={{x: origin[0].x, y: origin[0].y, rotateY: -26, rotateX: 4}}
        enter={enter}
        read={read}
        emphasis={emphasis}
        dock={dock}
      />
      <SourcePanel
        src={nist.src}
        naturalWidth={nist.naturalWidth}
        naturalHeight={nist.naturalHeight}
        rect={NIST_RECT}
        caption="nvlpubs.nist.gov"
        meta="Published Jan 2023"
        from={{x: origin[1].x, y: origin[1].y, rotateY: -22, rotateX: 4}}
        enter={enter2}
        read={read2}
      />
    </AbsoluteFill>
  );
};
