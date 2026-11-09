import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {formatPatch, getIn, leafPaths, setIn, unsetIn, type Path, type ShotDef, type ShotPatch} from '../../../shot';

/**
 * The editor's working copy of a shot patch, with undo/redo and a local
 * draft in browser storage.
 *
 *   approved   the repo file (shot.json), what renders use by default
 *   draft      what the editor shows; starts as the stored draft, else approved
 *
 * Every edit is a single path change (`set(path, value)` / `reset(path)`), so
 * one property never overwrites another. Rapid changes to the same path
 * (dragging a slider, typing digits) coalesce into one undo step.
 */
const storageKey = (id: string) => `shot-draft:${id}`;
const COALESCE_MS = 700;

const readStored = (id: string): ShotPatch | null => {
  try {
    const raw = window.localStorage.getItem(storageKey(id));
    return raw ? (JSON.parse(raw) as ShotPatch) : null;
  } catch {
    return null;
  }
};
const writeStored = (id: string, patch: ShotPatch | null) => {
  try {
    if (patch) window.localStorage.setItem(storageKey(id), JSON.stringify(patch));
    else window.localStorage.removeItem(storageKey(id));
  } catch {
    /* private mode / blocked storage: the draft just is not remembered */
  }
};

const normalise = (def: ShotDef, p: ShotPatch): ShotPatch => ({...p, version: 1, shot: def.id});
export const samePatch = (a: ShotPatch, b: ShotPatch): boolean => formatPatch(a) === formatPatch(b);

export type ShotDraft = {
  readonly patch: ShotPatch;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /** Draft differs from the approved file. */
  readonly dirty: boolean;
  /** Number of properties the draft overrides (changes vs code). */
  readonly changes: number;
  /** True when the editor opened a stored draft rather than the approved file. */
  readonly restored: boolean;
  get(path: Path): unknown;
  set(path: Path, value: unknown): void;
  reset(path: Path): void;
  /** Replace the whole patch (presets, import, reset-all); one undo step. */
  replace(next: ShotPatch, label?: string): void;
  undo(): void;
  redo(): void;
  readonly lastAction: string;
};

export const useShotDraft = (def: ShotDef): ShotDraft => {
  const [state, setState] = useState(() => {
    const stored = readStored(def.id);
    return {patch: normalise(def, stored ?? def.approved), past: [] as ShotPatch[], future: [] as ShotPatch[], restored: Boolean(stored && !samePatch(normalise(def, stored), normalise(def, def.approved))), last: ''};
  });
  const lastEdit = useRef<{key: string; at: number} | null>(null);

  // Persist the draft (only when it differs from the approved file).
  useEffect(() => {
    writeStored(def.id, samePatch(state.patch, normalise(def, def.approved)) ? null : state.patch);
  }, [def, state.patch]);

  const commit = useCallback((next: ShotPatch, key: string | null, label: string) => {
    setState((s) => {
      const now = Date.now();
      const coalesce = key !== null && lastEdit.current?.key === key && now - lastEdit.current.at < COALESCE_MS;
      lastEdit.current = key === null ? null : {key, at: now};
      if (samePatch(next, s.patch)) return s;
      return {...s, patch: next, past: coalesce ? s.past : [...s.past.slice(-199), s.patch], future: [], last: label};
    });
  }, []);

  const set = useCallback((path: Path, value: unknown) => {
    const key = path.join('.');
    const now = Date.now();
    const coalesce = lastEdit.current?.key === key && now - lastEdit.current.at < COALESCE_MS;
    lastEdit.current = {key, at: now};
    setState((s) => {
      const next = setIn(s.patch, path, value);
      if (samePatch(next, s.patch)) return s;
      return {...s, patch: next, past: coalesce ? s.past : [...s.past.slice(-199), s.patch], future: [], last: `Set ${key}`};
    });
  }, []);

  const reset = useCallback((path: Path) => {
    lastEdit.current = null;
    setState((s) => {
      const next = unsetIn(s.patch, path);
      if (samePatch(next, s.patch)) return s;
      return {...s, patch: next, past: [...s.past.slice(-199), s.patch], future: [], last: `Reset ${path.join('.')}`};
    });
  }, []);

  const replace = useCallback((next: ShotPatch, label = 'Replace') => commit(normalise(def, next), null, label), [commit, def]);

  const undo = useCallback(() => {
    lastEdit.current = null;
    setState((s) => (s.past.length ? {...s, patch: s.past[s.past.length - 1], past: s.past.slice(0, -1), future: [s.patch, ...s.future], last: 'Undo'} : s));
  }, []);
  const redo = useCallback(() => {
    lastEdit.current = null;
    setState((s) => (s.future.length ? {...s, patch: s.future[0], past: [...s.past, s.patch], future: s.future.slice(1), last: 'Redo'} : s));
  }, []);

  const approved = useMemo(() => normalise(def, def.approved), [def]);
  const changes = useMemo(() => leafPaths(state.patch).filter((p) => !['version', 'shot', 'note'].includes(p[0])).length, [state.patch]);

  return {
    patch: state.patch,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    dirty: !samePatch(state.patch, approved),
    changes,
    restored: state.restored,
    get: (path) => getIn(state.patch, path),
    set,
    reset,
    replace,
    undo,
    redo,
    lastAction: state.last,
  };
};
