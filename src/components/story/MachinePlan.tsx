import React from 'react';
import {Curve2} from '../cyber/svg/curve';
import {createRandom} from '../random';
import {alpha} from '../../styles/cyber';
import {useTheme} from '../../styles/ThemeContext';
import {Cable, Packet} from './DataCenter';
import {GpuBox, Laptop, Rack, Tower} from './Machines';
import {clamp01, f2, type XY} from './math';

/**
 * MachinePlan (2D): the hypothetical network of S04 flattened to a plan. About
 * twenty small, recognisable machines (racks, towers, GPU boxes, laptops) on
 * a loose grid, joined by floor conduits into one tree, several of them with
 * the agent running inside. It is the "animated hypothetical" that evidence
 * scenes (S06, S09) step back from, so it must read as *our* world in one
 * glance: machines with LEDs, cables, purple irises.
 *
 * Cast:
 *   - machines   `Rack` / `Tower` / `GpuBox` / `Laptop` at half scale.
 *   - conduits   `Cable`s under the floor, parent -> child, in `system` tone.
 *   - agents     `AgentGlyph` inside the machines (via the machine's `agent` prop), `mind` tone.
 *   - pulses     small packets travelling the conduits: the network is alive.
 *
 * World units; the plan is centred on (0, 0). Nothing here keeps time: LEDs,
 * iris spin and pulses are functions of `time` (pass `useActiveTime()`).
 */
export type PlanKind = 'rack' | 'tower' | 'gpu' | 'laptop';

export type PlanNode = {
  readonly id: number;
  readonly kind: PlanKind;
  /** Floor point (bottom-centre of the silhouette), world units. */
  readonly x: number;
  readonly y: number;
  readonly s: number;
  readonly parent: number | null;
  /** Tree depth from the root (the root is 0). */
  readonly depth: number;
};

/** Where a process is drawn inside each machine, in machine units at s = 1 (see Machines.tsx). */
export const PLAN_BAY: Record<PlanKind, XY> = {rack: {x: 0, y: -332.6}, tower: {x: 0, y: -67}, gpu: {x: 30, y: -85}, laptop: {x: 0, y: -109}};
const HEIGHT: Record<PlanKind, number> = {rack: 600, tower: 300, gpu: 170, laptop: 196};
const WIDTH: Record<PlanKind, number> = {rack: 220, tower: 150, gpu: 300, laptop: 300};

/** World point of the agent inside a machine. */
export const planBay = (n: PlanNode): XY => ({x: n.x + PLAN_BAY[n.kind].x * n.s, y: n.y + PLAN_BAY[n.kind].y * n.s});
/** World rect of the silhouette. */
export const planBounds = (n: PlanNode) => ({x: n.x - (WIDTH[n.kind] * n.s) / 2, y: n.y - HEIGHT[n.kind] * n.s, width: WIDTH[n.kind] * n.s, height: HEIGHT[n.kind] * n.s});

const dist = (a: XY, b: XY) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * A deterministic plan: `count` machines on a jittered `cols` x `rows` grid.
 * The cell nearest the centre is always a rack and the root of the tree
 * (the machine S02 left the agent in). Every other machine's parent is the
 * nearest already-reached machine, so cables form one tree.
 */
export const buildPlan = (seed = 6, cols = 6, rows = 4, count = 20): PlanNode[] => {
  const rnd = createRandom(seed);
  const kinds: PlanKind[] = ['rack', 'tower', 'gpu', 'laptop', 'rack', 'tower', 'laptop', 'gpu'];
  type Raw = {x: number; y: number; kind: PlanKind; s: number};
  const raws: Raw[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = (c - (cols - 1) / 2) * 540 + rnd.range(-70, 70);
      const y = (r - (rows - 1) / 2) * 430 + rnd.range(-30, 30);
      const kind = rnd.pick(kinds);
      const s = 0.5 + rnd.range(-0.04, 0.06);
      if (rnd.next() < 0.86 && raws.length < count) raws.push({x, y, kind, s});
    }
  }
  // Root: the cell nearest the centre, forced to be a rack.
  let root = 0;
  raws.forEach((p, i) => {
    if (dist(p, {x: 0, y: 0}) < dist(raws[root], {x: 0, y: 0})) root = i;
  });
  raws[root] = {...raws[root], kind: 'rack', s: 0.54};
  // Tree: multi-pass nearest-neighbour BFS.
  const n = raws.length;
  const reached = new Array<boolean>(n).fill(false);
  const depth = new Array<number>(n).fill(Infinity);
  const parent = new Array<number | null>(n).fill(null);
  reached[root] = true;
  depth[root] = 0;
  const frontier = [root];
  while (frontier.length) {
    const cur = frontier.shift()!;
    const near = raws
      .map((q, i) => ({i, d: dist(raws[cur], q)}))
      .filter((o) => !reached[o.i] && o.d < 820)
      .sort((a, b) => a.d - b.d)
      .slice(0, 3);
    for (const o of near) {
      reached[o.i] = true;
      depth[o.i] = depth[cur] + 1;
      parent[o.i] = cur;
      frontier.push(o.i);
    }
  }
  for (let i = 0; i < n; i++) {
    if (reached[i]) continue;
    let best = root;
    for (let j = 0; j < n; j++) if (reached[j] && dist(raws[i], raws[j]) < dist(raws[i], raws[best])) best = j;
    parent[i] = best;
    depth[i] = depth[best] + 1;
    reached[i] = true;
  }
  return raws.map((r, id) => ({id, ...r, parent: parent[id], depth: depth[id]}));
};

export const PLAN: readonly PlanNode[] = buildPlan();
export const PLAN_ROOT: PlanNode = PLAN.find((n) => n.parent === null)!;
/** The machines that hold a copy of the agent by default: the root and the nearest of its tree. */
export const PLAN_AGENT_IDS: ReadonlySet<number> = new Set(
  [...PLAN]
    .sort((a, b) => a.depth - b.depth || a.id - b.id)
    .slice(0, 7)
    .map((n) => n.id),
);

export type PlanCable = {readonly child: PlanNode; readonly parent: PlanNode; readonly curve: Curve2; readonly phase: number};

/** Floor conduits, parent -> child: down out of the parent's base, along a tray under its row, up or down into the child. */
export const planCables = (nodes: readonly PlanNode[]): PlanCable[] => {
  const rnd = createRandom(91);
  return nodes
    .filter((n) => n.parent !== null)
    .map((child) => {
      const parent = nodes[child.parent!];
      const tray = parent.y + 60 + rnd.range(0, 26);
      const curve = Curve2.route([{x: parent.x, y: parent.y}, {x: parent.x, y: tray}, {x: child.x, y: tray}, {x: child.x, y: child.y}], 34);
      return {child, parent, curve, phase: rnd.next()};
    });
};

export const PLAN_CABLES: readonly PlanCable[] = planCables(PLAN);

export type MachinePlanProps = {
  readonly nodes?: readonly PlanNode[];
  readonly cables?: readonly PlanCable[];
  /** Seconds of motion (`useActiveTime()`). */
  readonly time: number;
  /** 0..1 agent presence per machine. Default: `PLAN_AGENT_IDS`. */
  readonly agent?: (n: PlanNode) => number;
  readonly threat?: (n: PlanNode) => number;
  /** 0..1 LED power per machine. Default 1. */
  readonly power?: (n: PlanNode) => number;
  /** 0..1 visibility of the packets travelling the conduits. */
  readonly pulses?: number;
  /** One machine picked out with a soft halo (the one the camera is heading for). */
  readonly focus?: {readonly id: number; readonly level: number};
  /** Whole-plan opacity. */
  readonly opacity?: number;
};

const defaultAgent = (n: PlanNode) => (PLAN_AGENT_IDS.has(n.id) ? 1 : 0);

export const MachinePlan: React.FC<MachinePlanProps> = ({nodes = PLAN, cables = PLAN_CABLES, time, agent = defaultAgent, threat = () => 0, power = () => 1, pulses = 1, focus, opacity = 1}) => {
  const th = useTheme();
  const sys = th.tone.system;
  const mind = th.tone.mind;
  const focusNode = focus && focus.level > 0.001 ? nodes.find((n) => n.id === focus.id) : undefined;
  return (
    <g opacity={opacity}>
      {/* Floor pools: each machine stands on something. */}
      {nodes.map((n) => (
        <ellipse key={`p${n.id}`} cx={n.x} cy={n.y + 10} rx={WIDTH[n.kind] * n.s * 0.9 + 30} ry={16} fill={alpha(agent(n) > 0.5 ? mind.base : sys.base, 0.09 * power(n))} />
      ))}
      {/* Conduits and their traffic (under the machines). */}
      {cables.map((c, i) => {
        const a = agent(c.child) > 0.5 && agent(c.parent) > 0.5;
        const color = a ? mind.base : sys.base;
        const t = ((time / 2.6 + c.phase) % 1) * 1.7;
        return (
          <g key={i}>
            <Cable curve={c.curve} color={color} width={5} lit={a ? 1 : 0} glow={0.6} opacity={0.9} />
            {pulses > 0.001 && t < 1 ? <Packet curve={c.curve} t={t} color={a ? mind.hot : sys.hot} tail={0.08} size={3.2 * pulses} /> : null}
          </g>
        );
      })}
      {focusNode ? (
        <circle cx={planBay(focusNode).x} cy={planBay(focusNode).y} r={150 * (0.6 + 0.4 * clamp01(focus!.level))} fill={alpha(mind.base, 0.16 * clamp01(focus!.level) * th.glow)} />
      ) : null}
      {nodes.map((n) => {
        const props = {x: n.x, y: n.y, s: n.s, time, power: power(n), agent: agent(n), threat: threat(n), seed: n.id * 1.7 + 1};
        switch (n.kind) {
          case 'rack':
            return <Rack key={n.id} {...props} />;
          case 'tower':
            return <Tower key={n.id} {...props} />;
          case 'gpu':
            return <GpuBox key={n.id} {...props} />;
          default:
            return <Laptop key={n.id} {...props} />;
        }
      })}
      {/* A hairline under each row of machines, so the plan has a ground. */}
      {nodes.map((n) => (
        <path key={`g${n.id}`} d={`M${f2(n.x - 150 * n.s - 60)} ${f2(n.y + 6)}H${f2(n.x + 150 * n.s + 60)}`} stroke={alpha(th.color.steel, 0.5)} strokeWidth={1.5} />
      ))}
    </g>
  );
};
