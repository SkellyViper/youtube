/** Small helpers for building SVG path strings. Batching many marks into one
 * <path> keeps per-frame DOM work tiny, which keeps the live Player smooth. */

export const circlePath = (x: number, y: number, r: number): string => {
  if (r <= 0.01) return '';
  const d = r * 2;
  return `M${(x - r).toFixed(2)} ${y.toFixed(2)}a${r.toFixed(2)} ${r.toFixed(2)} 0 1 0 ${d.toFixed(2)} 0a${r.toFixed(2)} ${r.toFixed(2)} 0 1 0 ${(-d).toFixed(2)} 0`;
};

export const linePath = (x1: number, y1: number, x2: number, y2: number): string =>
  `M${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}`;

/** A segment from (x1, y1) towards (x2, y2), drawn to fraction `p`. */
export const partialLinePath = (x1: number, y1: number, x2: number, y2: number, p: number): string => {
  if (p <= 0.001) return '';
  return linePath(x1, y1, x1 + (x2 - x1) * p, y1 + (y2 - y1) * p);
};

/** Corner bracket "L" shapes for a rectangle (camera focus frame / scan area). */
export const bracketPath = (
  left: number,
  top: number,
  right: number,
  bottom: number,
  arm: number,
): string => {
  const a = Math.min(arm, (right - left) / 2, (bottom - top) / 2);
  return [
    `M${left} ${top + a}V${top}H${left + a}`,
    `M${right - a} ${top}H${right}V${top + a}`,
    `M${right} ${bottom - a}V${bottom}H${right - a}`,
    `M${left + a} ${bottom}H${left}V${bottom - a}`,
  ].join('');
};

export const roundedRectPath = (x: number, y: number, w: number, h: number, r: number): string => {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  return `M${x + rr} ${y}H${x + w - rr}A${rr} ${rr} 0 0 1 ${x + w} ${y + rr}V${y + h - rr}A${rr} ${rr} 0 0 1 ${x + w - rr} ${y + h}H${x + rr}A${rr} ${rr} 0 0 1 ${x} ${y + h - rr}V${y + rr}A${rr} ${rr} 0 0 1 ${x + rr} ${y}Z`;
};
