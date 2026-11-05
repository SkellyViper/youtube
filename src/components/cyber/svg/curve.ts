/**
 * Deterministic 2D curves with arc-length parameterisation, so signals move
 * at constant speed and lines can be drawn on / sliced without measuring the
 * DOM (which would differ between preview and export timing).
 */
export type Pt = {readonly x: number; readonly y: number};

const fx = (n: number) => n.toFixed(2);

export class Curve2 {
  readonly points: readonly Pt[];
  /** Cumulative length at each point. */
  private readonly lengths: number[];
  readonly length: number;

  constructor(points: readonly Pt[]) {
    if (points.length < 2) throw new Error('Curve2 needs at least two points');
    this.points = points;
    this.lengths = [0];
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      this.lengths.push(this.lengths[i - 1] + Math.hypot(dx, dy));
    }
    this.length = this.lengths[this.lengths.length - 1];
  }

  /** Straight segments through the given points. */
  static polyline(points: readonly Pt[]): Curve2 {
    return new Curve2(points);
  }

  /** Cubic Bezier from p0 to p1 with control points c0, c1. */
  static bezier(p0: Pt, c0: Pt, c1: Pt, p1: Pt, samples = 64): Curve2 {
    const pts: Pt[] = [];
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const u = 1 - t;
      pts.push({
        x: u * u * u * p0.x + 3 * u * u * t * c0.x + 3 * u * t * t * c1.x + t * t * t * p1.x,
        y: u * u * u * p0.y + 3 * u * u * t * c0.y + 3 * u * t * t * c1.y + t * t * t * p1.y,
      });
    }
    return new Curve2(pts);
  }

  /** A soft S-curve between two points (horizontal tangents by default). */
  static link(a: Pt, b: Pt, axis: 'x' | 'y' = 'x', bend = 0.5): Curve2 {
    const c0 = axis === 'x' ? {x: a.x + (b.x - a.x) * bend, y: a.y} : {x: a.x, y: a.y + (b.y - a.y) * bend};
    const c1 = axis === 'x' ? {x: b.x - (b.x - a.x) * bend, y: b.y} : {x: b.x, y: b.y - (b.y - a.y) * bend};
    return Curve2.bezier(a, c0, c1, b);
  }

  /** Circuit-style route: straight runs through `points` with rounded corners. */
  static route(points: readonly Pt[], radius = 24, cornerSamples = 10): Curve2 {
    if (points.length < 3) return new Curve2(points);
    const out: Pt[] = [points[0]];
    for (let i = 1; i < points.length - 1; i++) {
      const p = points[i];
      const a = points[i - 1];
      const b = points[i + 1];
      const la = Math.hypot(p.x - a.x, p.y - a.y);
      const lb = Math.hypot(b.x - p.x, b.y - p.y);
      const r = Math.min(radius, la / 2, lb / 2);
      const start = {x: p.x + ((a.x - p.x) / la) * r, y: p.y + ((a.y - p.y) / la) * r};
      const end = {x: p.x + ((b.x - p.x) / lb) * r, y: p.y + ((b.y - p.y) / lb) * r};
      for (let s = 0; s <= cornerSamples; s++) {
        const t = s / cornerSamples;
        const u = 1 - t;
        out.push({x: u * u * start.x + 2 * u * t * p.x + t * t * end.x, y: u * u * start.y + 2 * u * t * p.y + t * t * end.y});
      }
    }
    out.push(points[points.length - 1]);
    return new Curve2(out);
  }

  /** Circular arc around (cx, cy) from angle a0 to a1 (radians, clockwise positive in screen space). */
  static arc(cx: number, cy: number, r: number, a0: number, a1: number, samples = 48): Curve2 {
    const pts: Pt[] = [];
    for (let i = 0; i <= samples; i++) {
      const a = a0 + ((a1 - a0) * i) / samples;
      pts.push({x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r});
    }
    return new Curve2(pts);
  }

  private locate(t: number): {i: number; f: number} {
    const target = Math.min(1, Math.max(0, t)) * this.length;
    const L = this.lengths;
    let lo = 0;
    let hi = L.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (L[mid] <= target) lo = mid;
      else hi = mid;
    }
    const span = L[hi] - L[lo];
    return {i: lo, f: span > 0 ? (target - L[lo]) / span : 0};
  }

  /** Point at fraction t (0..1) of the curve's length. */
  pointAt(t: number): Pt {
    const {i, f} = this.locate(t);
    const a = this.points[i];
    const b = this.points[Math.min(i + 1, this.points.length - 1)];
    return {x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f};
  }

  /** Direction of travel at t, in radians. */
  angleAt(t: number): number {
    const {i} = this.locate(t);
    const a = this.points[i];
    const b = this.points[Math.min(i + 1, this.points.length - 1)];
    return Math.atan2(b.y - a.y, b.x - a.x);
  }

  /** SVG path data for the part of the curve between fractions t0 and t1. */
  slice(t0: number, t1: number): string {
    const a = Math.min(1, Math.max(0, Math.min(t0, t1)));
    const b = Math.min(1, Math.max(0, Math.max(t0, t1)));
    if (b - a <= 1e-5) return '';
    const A = this.locate(a);
    const B = this.locate(b);
    const start = this.pointAt(a);
    const end = this.pointAt(b);
    let d = `M${fx(start.x)} ${fx(start.y)}`;
    for (let i = A.i + 1; i <= B.i; i++) d += `L${fx(this.points[i].x)} ${fx(this.points[i].y)}`;
    d += `L${fx(end.x)} ${fx(end.y)}`;
    return d;
  }

  /** SVG path data for the whole curve. */
  get d(): string {
    return this.slice(0, 1);
  }
}
