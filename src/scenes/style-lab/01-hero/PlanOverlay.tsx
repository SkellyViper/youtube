import React from 'react';
import {projectPoint, type Rig} from '../../../components/cyber/three';
import {alpha, cyber} from '../../../styles/cyber';
import {BLOCK, blockCentre} from './city';

/**
 * The 2D half of the hybrid shot: hairline instrument marks that land on the
 * world once it has flattened into a plan. Corner brackets round the agent's
 * node and round one block, each with a thin leader. Everything is pinned
 * with projectPoint(), so the marks belong to the drawing underneath.
 */

type Pt = readonly [number, number];

/** Four L-shaped corners standing `off` px outside a screen rectangle. */
const corners = (x0: number, y0: number, x1: number, y1: number, len: number, off: number): string => {
  const a = x0 - off;
  const b = y0 - off;
  const c = x1 + off;
  const d = y1 + off;
  const f = (n: number) => n.toFixed(2);
  return (
    `M${f(a)} ${f(b + len)}V${f(b)}H${f(a + len)}` +
    `M${f(c - len)} ${f(b)}H${f(c)}V${f(b + len)}` +
    `M${f(c)} ${f(d - len)}V${f(d)}H${f(c - len)}` +
    `M${f(a + len)} ${f(d)}H${f(a)}V${f(d - len)}`
  );
};

/** The first `fraction` of a polyline, by length. */
const partial = (pts: readonly Pt[], fraction: number): string => {
  const lengths = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
  let left = lengths.reduce((s, l) => s + l, 0) * Math.min(1, Math.max(0, fraction));
  let d = `M${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < lengths.length && left > 0; i++) {
    const k = Math.min(1, left / lengths[i]);
    d += `L${(pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k).toFixed(2)} ${(pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k).toFixed(2)}`;
    left -= lengths[i];
  }
  return d;
};

/** The block the overlay singles out (grid indices), and the node's bracket size in world units. */
const MARKED_BLOCK: Pt = [2, -1];
const NODE_HALF = 10.8;
const BLOCK_HALF = BLOCK / 2 + 1.1;

export const PlanOverlay: React.FC<{
  readonly rig: Rig;
  /** 0..1: the brackets land. */
  readonly land: number;
  /** 0..1: the leaders draw out from them. */
  readonly lead: number;
}> = ({rig, land, lead}) => {
  if (land <= 0) return null;
  const rect = (cx: number, cz: number, half: number) => {
    const a = projectPoint(rig, [cx - half, 0, cz - half]);
    const b = projectPoint(rig, [cx + half, 0, cz + half]);
    return {x0: Math.min(a.x, b.x), y0: Math.min(a.y, b.y), x1: Math.max(a.x, b.x), y1: Math.max(a.y, b.y)};
  };
  const node = rect(0, 0, NODE_HALF);
  const block = rect(blockCentre(MARKED_BLOCK[0]), blockCentre(MARKED_BLOCK[1]), BLOCK_HALF);
  // Brackets arrive from slightly outside and settle on their subject.
  const off = 26 * (1 - land);

  // Leaders leave a corner at 45 degrees, then run level to a small terminal.
  const nodeLeader: Pt[] = [
    [node.x0, node.y1],
    [node.x0 - 54, node.y1 + 54],
    [node.x0 - 54 - 210, node.y1 + 54],
  ];
  const blockLeader: Pt[] = [
    [block.x1, block.y0],
    [block.x1 + 44, block.y0 - 44],
    [block.x1 + 44 + 170, block.y0 - 44],
  ];
  const nodeEnd = nodeLeader[2];
  const blockEnd = blockLeader[2];
  const terminal = Math.min(1, Math.max(0, (lead - 0.8) / 0.2));

  // Short ticks on the node bracket's centre lines: the reticle from the agent sample, squared off.
  const mx = (node.x0 + node.x1) / 2;
  const my = (node.y0 + node.y1) / 2;
  const tick = 16 * land;
  const ticks =
    `M${mx.toFixed(2)} ${(node.y0 - off).toFixed(2)}v${(-tick).toFixed(2)}` +
    `M${mx.toFixed(2)} ${(node.y1 + off).toFixed(2)}v${tick.toFixed(2)}` +
    `M${(node.x0 - off).toFixed(2)} ${my.toFixed(2)}h${(-tick).toFixed(2)}` +
    `M${(node.x1 + off).toFixed(2)} ${my.toFixed(2)}h${tick.toFixed(2)}`;

  const mind = cyber.color.purpleHot;
  const system = cyber.color.blueHot;
  return (
    <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
      <g fill="none" strokeLinecap="square" opacity={land}>
        <path d={corners(node.x0, node.y0, node.x1, node.y1, 30, off)} stroke={alpha(mind, 0.9)} strokeWidth={cyber.line.thin} />
        <path d={ticks} stroke={alpha(mind, 0.6)} strokeWidth={cyber.line.hair} />
        <path d={corners(block.x0, block.y0, block.x1, block.y1, 22, off)} stroke={alpha(system, 0.85)} strokeWidth={cyber.line.thin} />
      </g>
      {lead > 0 ? (
        <g fill="none" strokeLinecap="butt">
          <path d={partial(nodeLeader, lead / 0.8)} stroke={alpha(mind, 0.55)} strokeWidth={cyber.line.hair} />
          <path d={partial(blockLeader, lead / 0.8)} stroke={alpha(system, 0.5)} strokeWidth={cyber.line.hair} />
          {terminal > 0 ? (
            <g opacity={terminal}>
              <path d={`M${nodeEnd[0].toFixed(2)} ${(nodeEnd[1] - 9).toFixed(2)}v18`} stroke={alpha(mind, 0.9)} strokeWidth={cyber.line.thin} />
              <path d={`M${blockEnd[0].toFixed(2)} ${(blockEnd[1] - 9).toFixed(2)}v18`} stroke={alpha(system, 0.85)} strokeWidth={cyber.line.thin} />
            </g>
          ) : null}
        </g>
      ) : null}
    </svg>
  );
};
