import * as THREE from 'three';

/**
 * A route: straight runs joined by small fillets, parametrised exactly by
 * arc length. A `Comet3D` on it moves at constant speed, `getPointAt` needs
 * no sampling, and `GlowTube` draws it on with even spacing. Use it for
 * signals that follow avenues, racks, bus lines: anything that turns corners.
 *
 *   new RouteCurve([[x, y, z], ...], fillet)
 *   RouteCurve.onFloor([[x, z], ...], y, fillet)   waypoints on the floor at height y
 */
export class RouteCurve extends THREE.Curve<THREE.Vector3> {
  private readonly pts: THREE.Vector3[] = [];
  private readonly cum: number[] = [];
  /** Total length in world units. */
  readonly total: number;

  constructor(waypoints: readonly (readonly [number, number, number])[], fillet = 1.8) {
    super();
    const v = waypoints.map(([x, y, z]) => new THREE.Vector3(x, y, z));
    this.pts.push(v[0]);
    for (let i = 1; i < v.length - 1; i++) {
      const a = v[i].clone().sub(v[i - 1]);
      const b = v[i + 1].clone().sub(v[i]);
      const r = Math.min(fillet, a.length() / 2, b.length() / 2);
      const p0 = v[i].clone().addScaledVector(a.normalize(), -r);
      const p1 = v[i].clone().addScaledVector(b.normalize(), r);
      for (let k = 0; k <= 8; k++) {
        const t = k / 8;
        // Quadratic Bezier with the corner as control point.
        this.pts.push(
          p0
            .clone()
            .multiplyScalar((1 - t) * (1 - t))
            .addScaledVector(v[i], 2 * t * (1 - t))
            .addScaledVector(p1, t * t),
        );
      }
    }
    this.pts.push(v[v.length - 1]);
    let total = 0;
    this.cum.push(0);
    for (let i = 1; i < this.pts.length; i++) {
      total += this.pts[i].distanceTo(this.pts[i - 1]);
      this.cum.push(total);
    }
    this.total = total;
  }

  static onFloor(waypoints: readonly (readonly [number, number])[], y = 0.06, fillet = 1.8): RouteCurve {
    return new RouteCurve(
      waypoints.map(([x, z]) => [x, y, z] as const),
      fillet,
    );
  }

  getPoint(t: number, target = new THREE.Vector3()): THREE.Vector3 {
    const s = Math.min(1, Math.max(0, t)) * this.total;
    let lo = 0;
    let hi = this.cum.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (this.cum[mid] <= s) lo = mid;
      else hi = mid;
    }
    const span = this.cum[hi] - this.cum[lo];
    return target.copy(this.pts[lo]).lerp(this.pts[hi], span > 0 ? (s - this.cum[lo]) / span : 0);
  }

  /** Already arc-length parametrised. */
  getUtoTmapping(u: number): number {
    return u;
  }

  getLength(): number {
    return this.total;
  }
}
