import * as THREE from 'three';
import {createRandom} from '../../../components/random';
import {cyber} from '../../../styles/cyber';
import type {LightFieldData, StreakData} from './LightField';

/**
 * The rest of the world: an immense, ordered field of lights far behind the
 * system we watched shut down, laid out like a city grid seen at night.
 *
 *  - Rectangular districts on a grid turned 45 degrees to the final view, so
 *    both families of avenues run off to vanishing points outside the frame
 *    and read as a shallow cross-hatch instead of a runway.
 *  - Every third avenue is an arterial: a long, straight, continuous line of
 *    lights. The far comets travel along these.
 *  - Two "downtown" hotspots are brighter, denser and taller; a few lots are dark.
 *  - The ground rises gently with distance, so the whole field stacks up into
 *    a band just above the horizon.
 *
 * Every district is a system like ours, so every district has one light of
 * intelligence at its centre (purple). A very small number of them are red.
 *
 * Only the wedge the final camera can see is built. Deterministic: createRandom(seed) only.
 */

/** Final camera position (x, z) and the bearing of its view (0 = -z, positive towards +x). */
const EYE = new THREE.Vector2(4.2, 20.5);
const LOOK = Math.atan2(0.8 - 4.2, 20.5 + 20);
/** Half-angle of the wedge that gets built (the frame is about +-0.5 rad wide). */
const HALF = 0.66;
const NEAR = 150;
const REACH = 578;
/** The ground rises by this much per unit of distance beyond NEAR. */
const SLOPE = 0.072;

const BW = 44;
const BD = 34;
const AVE = 14;
const PX = BW + AVE;
const PZ = BD + AVE;
const ROT = Math.PI / 4;
const COS = Math.cos(ROT);
const SIN = Math.sin(ROT);

const polar = (bearing: number, dist: number) => new THREE.Vector2(EYE.x + Math.sin(bearing) * dist, EYE.y - Math.cos(bearing) * dist);
const PIVOT = polar(LOOK, 360);

/** Local grid coordinates -> world (x, z). */
const toWorld = (u: number, v: number) => new THREE.Vector2(PIVOT.x + u * COS - v * SIN, PIVOT.y + u * SIN + v * COS);

const distOf = (p: THREE.Vector2) => p.distanceTo(EYE);
const bearingOf = (p: THREE.Vector2) => Math.atan2(p.x - EYE.x, EYE.y - p.y);
const inWedge = (p: THREE.Vector2, margin = 0) => {
  const d = distOf(p);
  return d >= NEAR - margin && d <= REACH && Math.abs(bearingOf(p) - LOOK) <= HALF + margin * 0.002;
};
const ground = (p: THREE.Vector2) => SLOPE * Math.max(0, distOf(p) - NEAR);

const HOTSPOTS = [
  {p: polar(LOOK + 0.15, 320), r: 95},
  {p: polar(LOOK - 0.3, 455), r: 120},
];
/** 0..1: how "downtown" a place is. */
const heat = (p: THREE.Vector2) => Math.max(...HOTSPOTS.map((h) => Math.exp(-p.distanceToSquared(h.p) / (h.r * h.r))));

const linear = (hex: string): [number, number, number] => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
};

const BLUE = linear(cyber.color.blue);
const BLUE_HOT = linear(cyber.color.blueHot);
const PURPLE = linear(cyber.color.purple);
const PURPLE_HOT = linear(cyber.color.purpleHot);
const RED = linear(cyber.color.red);
const WHITE = linear(cyber.color.white);

const mix3 = (a: readonly number[], b: readonly number[], t: number): [number, number, number] => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

class Builder {
  readonly position: number[] = [];
  readonly color: number[] = [];
  readonly size: number[] = [];
  readonly dir: number[] = [];
  readonly k: number[] = [];

  get count() {
    return this.size.length;
  }

  light(p: THREE.Vector2, y: number, rgb: readonly number[], intensity: number, size: number) {
    this.position.push(p.x, y, p.y);
    this.color.push(rgb[0] * intensity, rgb[1] * intensity, rgb[2] * intensity);
    this.size.push(size);
  }

  field(): LightFieldData {
    return {
      count: this.count,
      position: new Float32Array(this.position),
      color: new Float32Array(this.color),
      size: new Float32Array(this.size),
    };
  }

  streaks(): StreakData {
    return {...this.field(), dir: new Float32Array(this.dir), k: new Float32Array(this.k)};
  }
}

export type FarField = {readonly lights: LightFieldData; readonly streaks: StreakData; readonly districts: number};

const GRID = 12;
const ARTERIAL_EVERY = 3;
const ARTERIAL_STEP = 1.9;

export const buildFarField = (seed = 11): FarField => {
  const rnd = createRandom(seed);
  const b = new Builder();
  let districts = 0;

  /* ---------------------------------------------------------------- districts */
  for (let i = -GRID; i <= GRID; i++) {
    for (let j = -GRID; j <= GRID; j++) {
      const centre = toWorld(i * PX, j * PZ);
      if (!inWedge(centre)) continue;
      districts++;
      const h = heat(centre);
      const dark = rnd.next() < 0.17 && h < 0.4;
      const spacing = rnd.pick([2.4, 2.8, 2.8, 3.3]);
      const nu = Math.floor(BW / spacing);
      const nv = Math.floor(BD / spacing);
      const u0 = i * PX - ((nu - 1) * spacing) / 2;
      const v0 = j * PZ - ((nv - 1) * spacing) / 2;
      const level = (0.5 + 0.85 * h) * rnd.range(0.75, 1.15) * (dark ? 0.5 : 1);
      const density = dark ? 0 : Math.min(0.9, rnd.range(0.22, 0.5) + 0.38 * h);
      const edgeDensity = dark ? 0.22 : 0.9;
      // Dark service streets inside a district: every `street`-th column or row stays empty.
      const street = 3 + Math.floor(rnd.next() * 3);
      const alongU = rnd.next() < 0.5;
      const whiteShare = 0.08 + 0.3 * h;

      for (let iv = 0; iv < nv; iv++) {
        for (let iu = 0; iu < nu; iu++) {
          const edge = iu === 0 || iv === 0 || iu === nu - 1 || iv === nv - 1;
          const roll = rnd.next();
          const tint = rnd.next();
          const gain = rnd.range(0.6, 1.3);
          if (!edge && (alongU ? iu : iv) % street === street - 1) continue;
          if (roll > (edge ? edgeDensity : density)) continue;
          const p = toWorld(u0 + iu * spacing, v0 + iv * spacing);
          if (!inWedge(p, 8)) continue;
          const white = tint < whiteShare;
          b.light(p, ground(p) + 0.4, white ? mix3(BLUE, BLUE_HOT, 0.7) : BLUE, level * gain * (white ? 1.25 : 0.9), white ? 3.3 : 3);
        }
      }

      // Towers: storeys of lights on a small footprint. Downtown has more of them, and taller.
      const towers = dark ? 0 : h > 0.35 ? 2 + Math.floor(rnd.next() * 3) : rnd.next() < 0.3 ? 1 : 0;
      for (let t = 0; t < towers; t++) {
        const w = 2 + Math.floor(rnd.next() * 3);
        const d = 2 + Math.floor(rnd.next() * 2);
        const iu0 = 1 + Math.floor(rnd.next() * Math.max(1, nu - w - 2));
        const iv0 = 1 + Math.floor(rnd.next() * Math.max(1, nv - d - 2));
        const tall = rnd.next();
        const storeys = 2 + Math.floor(tall * tall * (5 + 9 * h));
        const lit = rnd.range(0.5, 0.85);
        for (let s = 1; s <= storeys; s++) {
          for (let iv = 0; iv < d; iv++) {
            for (let iu = 0; iu < w; iu++) {
              const roll = rnd.next();
              const gain = rnd.range(0.6, 1.3);
              const shell = iu === 0 || iv === 0 || iu === w - 1 || iv === d - 1;
              if (!shell || roll > lit) continue;
              const p = toWorld(u0 + (iu0 + iu) * spacing, v0 + (iv0 + iv) * spacing);
              b.light(p, ground(p) + 0.4 + s * 2.3, mix3(BLUE, BLUE_HOT, 0.35), level * gain * 1.05, 3);
            }
          }
        }
      }

      // The district's own intelligence: one light at its centre, a little above the grid.
      const fate = rnd.next();
      const turned = fate < 0.05 && Math.abs(bearingOf(centre) - LOOK) < HALF - 0.12;
      if (!dark) {
        b.light(centre, ground(centre) + 3.2, turned ? RED : mix3(PURPLE, PURPLE_HOT, 0.25), turned ? 2.4 : 3.2, turned ? 4.4 : 4.6);
      }
    }
  }

  /* ---------------------------------------------------------------- arterials */
  const span = GRID * Math.max(PX, PZ);
  const arterials: {readonly fixed: 'u' | 'v'; readonly at: number}[] = [];
  for (let i = -GRID; i <= GRID; i++) {
    if (((i % ARTERIAL_EVERY) + ARTERIAL_EVERY) % ARTERIAL_EVERY === 0) arterials.push({fixed: 'u', at: (i + 0.5) * PX});
    if (((i % ARTERIAL_EVERY) + ARTERIAL_EVERY) % ARTERIAL_EVERY === 1) arterials.push({fixed: 'v', at: (i + 0.5) * PZ});
  }
  const onArterial = (a: (typeof arterials)[number], s: number) => (a.fixed === 'u' ? toWorld(a.at, s) : toWorld(s, a.at));
  for (const a of arterials) {
    for (let s = -span; s <= span; s += ARTERIAL_STEP) {
      const p = onArterial(a, s);
      if (!inWedge(p, 8)) continue;
      const gain = rnd.range(0.7, 1.15);
      b.light(p, ground(p) + 0.5, mix3(BLUE, BLUE_HOT, 0.45), (0.62 + 0.4 * heat(p)) * gain, 2.6);
    }
  }

  /* ---------------------------------------------------------------- comets on the arterials */
  const c = new Builder();
  const POINTS = 30;
  const LENGTH = 170;
  const comet = (start: THREE.Vector2, end: THREE.Vector2, phase: number, speed: number, mind: boolean) => {
    const y0 = ground(start) + 1.2;
    const y1 = ground(end) + 1.2;
    for (let i = 0; i < POINTS; i++) {
      const f = i / (POINTS - 1);
      const head = i === 0;
      // The tail tapers in brightness and size, like Comet3D.
      const fall = Math.pow(1 - f, 1.7);
      c.light(start, y0, head ? WHITE : mind ? PURPLE : BLUE, head ? 3.8 : 2.2 * fall, head ? 5 : 2.2 + 1.6 * fall);
      c.dir.push(end.x - start.x, y1 - y0, end.y - start.y);
      c.k.push(phase, speed, f * 0.07);
    }
  };
  // Pick arterials that cross the middle of the view and put one comet on each.
  const candidates = arterials
    .map((a) => {
      const hits: number[] = [];
      for (let s = -span; s <= span; s += 6) {
        const p = onArterial(a, s);
        if (inWedge(p) && distOf(p) > 190 && distOf(p) < 480 && Math.abs(bearingOf(p) - LOOK) < 0.42) hits.push(s);
      }
      return {a, hits};
    })
    .filter((x) => x.hits.length > 6);
  candidates.forEach(({a, hits}, n) => {
    if (n % 2 === 1 && n > 6) return;
    const mid = hits[Math.floor(rnd.range(0.3, 0.7) * hits.length)];
    const forward = rnd.next() < 0.5 ? 1 : -1;
    const start = onArterial(a, mid - (forward * LENGTH) / 2);
    const end = onArterial(a, mid + (forward * LENGTH) / 2);
    comet(start, end, rnd.range(0.18, 0.5), rnd.range(0.24, 0.32), n % 3 !== 2);
  });

  return {lights: b.field(), streaks: c.streaks(), districts};
};
