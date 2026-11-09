import {isEasing} from './easing';
import type {ShotDef, ShotPatch} from './types';

/**
 * Immutable path helpers for sparse patches. A path is a list of keys, e.g.
 * ['objects', 'desk', 'position'] or ['lights', 'key', 'intensity'].
 *
 * Arrays are leaves (a Vec3 is replaced whole). Unsetting a leaf prunes the
 * parents it leaves empty, so "reset this property" really removes it from
 * the file instead of leaving `{}` behind.
 */

type Obj = Record<string, unknown>;
export type Path = readonly string[];

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

export const getIn = (root: unknown, path: Path): unknown => {
  let cur = root;
  for (const k of path) {
    if (!isObj(cur)) return undefined;
    cur = cur[k];
  }
  return cur;
};

export const hasIn = (root: unknown, path: Path): boolean => getIn(root, path) !== undefined;

export const setIn = <T>(root: T, path: Path, value: unknown): T => {
  if (path.length === 0) return value as T;
  const [k, ...rest] = path;
  const base: Obj = isObj(root) ? root : {};
  return {...base, [k]: setIn(base[k], rest, value)} as T;
};

export const unsetIn = <T>(root: T, path: Path): T => {
  if (!isObj(root) || path.length === 0) return root;
  const [k, ...rest] = path;
  if (!(k in root)) return root;
  const next: Obj = {...root};
  if (rest.length === 0) {
    delete next[k];
  } else {
    const child = unsetIn(root[k], rest);
    if (isObj(child) && Object.keys(child).length === 0) delete next[k];
    else next[k] = child;
  }
  return next as T;
};

/** Deep merge for plain objects; arrays and primitives in `over` replace. `undefined` keeps `base`. */
export const deepMerge = <T>(base: T, over: unknown): T => {
  if (over === undefined) return base;
  if (!isObj(base) || !isObj(over)) return over as T;
  const out: Obj = {...base};
  for (const [k, v] of Object.entries(over)) {
    out[k] = k in base ? deepMerge(base[k], v) : v;
  }
  return out as T;
};

/** Every leaf path of a patch (used by the editor to list changes). */
export const leafPaths = (root: unknown, prefix: string[] = []): string[][] => {
  if (!isObj(root)) return prefix.length ? [prefix] : [];
  const out: string[][] = [];
  for (const [k, v] of Object.entries(root)) {
    if (isObj(v)) out.push(...leafPaths(v, [...prefix, k]));
    else out.push([...prefix, k]);
  }
  return out;
};

/* ------------------------------------------------------------------ validation */

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isVec3 = (v: unknown): boolean => Array.isArray(v) && v.length === 3 && v.every(isNum);
const isColor = (v: unknown): boolean => typeof v === 'string' && (v === '' || /^#[0-9a-fA-F]{6}$/.test(v));

/** Leaf validators by key name; unknown keys are dropped. */
const LEAF: Readonly<Record<string, (v: unknown) => boolean>> = {
  position: isVec3,
  rotation: isVec3,
  target: isVec3,
  scale: isNum,
  visible: (v) => typeof v === 'boolean',
  opacity: isNum,
  variant: (v) => typeof v === 'string',
  color: isColor,
  emissive: isColor,
  groundColor: isColor,
  background: isColor,
  emissiveIntensity: isNum,
  roughness: isNum,
  metalness: isNum,
  enabled: (v) => typeof v === 'boolean',
  intensity: isNum,
  threshold: isNum,
  kind: (v) => typeof v === 'string',
  castShadow: (v) => typeof v === 'boolean',
  angle: isNum,
  penumbra: isNum,
  distance: isNum,
  locked: (v) => typeof v === 'boolean',
  projection: (v) => v === 'perspective' || v === 'orthographic',
  fov: isNum,
  orthoHeight: isNum,
  roll: isNum,
  from: isNum,
  until: (v) => v === null || isNum(v),
  easing: isEasing,
  exposure: isNum,
  strength: isNum,
  radius: isNum,
  fog: isNum,
  shadows: (v) => typeof v === 'boolean',
  grade: (v) => typeof v === 'boolean',
  duration: (v) => isNum(v) && v > 0,
  hold: (v) => isNum(v) && v >= 0,
  label: (v) => typeof v === 'string',
  beat: (v) => typeof v === 'string',
  object: (v) => typeof v === 'string',
  t: (v) => isNum(v) && v >= 0,
  ease: (v) => v === 'smooth' || isEasing(v),
  cut: (v) => typeof v === 'boolean',
  mode: (v) => v === 'locked' || v === 'keys' || v === 'code',
  text: (v) => typeof v === 'string',
  done: (v) => typeof v === 'boolean',
};

/** Sections whose children are free-form maps of id -> record. */
const MAPS = new Set(['objects', 'lights', 'beats', 'motions', 'materials', 'moves', 'keys', 'angles', 'notes']);
/** Nested records (not maps) allowed inside a record. */
const RECORDS = new Set(['edges', 'bloom', 'to', 'camera', 'stage']);

const clean = (v: unknown, key: string, problems: string[], where: string): unknown => {
  if (MAPS.has(key)) {
    if (!isObj(v)) return problems.push(`${where}: expected an object`), undefined;
    const out: Obj = {};
    for (const [id, rec] of Object.entries(v)) {
      const c = cleanRecord(rec, problems, `${where}.${id}`);
      if (c && Object.keys(c).length) out[id] = c;
    }
    return out;
  }
  if (RECORDS.has(key)) return cleanRecord(v, problems, where);
  const check = LEAF[key];
  if (!check) return problems.push(`${where}: unknown property dropped`), undefined;
  if (!check(v)) return problems.push(`${where}: invalid value ${JSON.stringify(v)} dropped`), undefined;
  return v;
};

const cleanRecord = (v: unknown, problems: string[], where: string): Obj | undefined => {
  if (!isObj(v)) {
    problems.push(`${where}: expected an object`);
    return undefined;
  }
  const out: Obj = {};
  for (const [k, val] of Object.entries(v)) {
    const c = clean(val, k, problems, `${where}.${k}`);
    if (c !== undefined && !(isObj(c) && Object.keys(c).length === 0)) out[k] = c;
  }
  return out;
};

/**
 * Validate an imported / loaded patch: keeps known, well-typed properties,
 * drops the rest, and reports what it dropped. Ids that the shot does not
 * declare are reported (they stay in the file but have no effect, except
 * motions, which a patch may add).
 */
export const sanitizePatch = (def: ShotDef, raw: unknown): {patch: ShotPatch; problems: string[]} => {
  const problems: string[] = [];
  if (!isObj(raw)) return {patch: {}, problems: ['not a JSON object']};
  if (typeof raw.shot === 'string' && raw.shot !== def.id) problems.push(`file is for shot "${raw.shot}", not "${def.id}"`);
  const out: ShotPatch = {version: 1, shot: def.id};
  if (typeof raw.note === 'string') out.note = raw.note;
  for (const section of ['objects', 'lights', 'camera', 'stage', 'beats', 'motions', 'notes'] as const) {
    if (raw[section] === undefined) continue;
    const c = clean(raw[section], section, problems, section);
    if (isObj(c) && Object.keys(c).length) (out as Obj)[section] = c;
  }
  for (const id of Object.keys(out.objects ?? {})) if (!def.objects[id]) problems.push(`objects.${id}: not in this shot (ignored)`);
  for (const id of Object.keys(out.lights ?? {})) if (!def.lights[id]) problems.push(`lights.${id}: not in this shot (ignored)`);
  return {patch: out, problems};
};

/** Stable, readable JSON for the repo file (sorted keys, 2-space indent, trailing newline). */
export const formatPatch = (patch: ShotPatch): string => {
  const sort = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map((x) => (isNum(x) ? Math.round(x * 10000) / 10000 : x));
    if (!isObj(v)) return isNum(v) ? Math.round(v * 10000) / 10000 : v;
    const head = ['version', 'shot', 'note'];
    const keys = Object.keys(v).sort((a, b) => {
      const ia = head.indexOf(a);
      const ib = head.indexOf(b);
      if (ia >= 0 || ib >= 0) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      return a.localeCompare(b);
    });
    const out: Obj = {};
    for (const k of keys) out[k] = sort(v[k]);
    return out;
  };
  // Vec3 arrays on one line keep the diff readable.
  return JSON.stringify(sort(patch), null, 2).replace(/\[\s+(-?[\d.e-]+),\s+(-?[\d.e-]+),\s+(-?[\d.e-]+)\s+\]/g, '[$1, $2, $3]') + '\n';
};
