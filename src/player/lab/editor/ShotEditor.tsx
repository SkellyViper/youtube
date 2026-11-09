import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {Rig} from '../../../components/cyber/three/rig';
import {buildTimeline} from '../../../engine';
import {
  applyLightingPreset,
  cameraAt,
  formatPatch,
  resolveShot,
  sanitizePatch,
  shotEpisode,
  ShotEditorContext,
  type MaterialLook,
  type Selection,
  type ShotEditorApi,
} from '../../../shot';
import {THEME_IDS, type ThemeId} from '../../../styles/themes';
import type {CinematicScene} from '../../../videos/style-lab/cinematic';
import {LAB_FPS} from '../../../videos/style-lab/registry';
import {Presenter, type PresenterContext} from '../../PresentationApp';
import {BeatStrip} from './BeatStrip';
import {Hierarchy} from './Hierarchy';
import {Inspector} from './Inspector';
import {samePatch, useShotDraft} from './useShotDraft';
import './editor.css';

/**
 * Style Lab → scene → Edit: a small shot editor around the same Presenter
 * (same Player, same keys, same checkpoints) the viewer uses. The composition
 * receives the draft as its `shot` input prop, exactly what a render receives
 * with `--shot=draft.json`, so what you see here is what the MP4 will be.
 *
 *   left     hierarchy: objects, lights, camera, stage look
 *   centre   the shot (the real composition) + the beat strip
 *   right    inspector for the selection, or the list of changes
 *
 * The free inspection camera orbits the scene in this viewport only; the
 * shot camera (and therefore the render) does not change unless you press
 * "Use inspection view as shot camera".
 */
export const ShotEditor: React.FC<{readonly scene: CinematicScene; readonly navigate: (slug: string | null) => void}> = ({scene, navigate}) => {
  const def = scene.shot!;
  const base = scene.baseEpisode!;
  const draft = useShotDraft(def);
  const [theme] = useState<ThemeId>(() => {
    const t = new URLSearchParams(window.location.search).get('theme');
    return t && (THEME_IDS as readonly string[]).includes(t) ? (t as ThemeId) : 'neon';
  });
  const [selection, setSelection] = useState<Selection | null>(null);
  const [inspect, setInspect] = useState<Rig | null>(null);
  const [helpers, setHelpers] = useState(true);
  const [frame, setFrame] = useState(0);
  const [status, setStatus] = useState<{text: string; tone: 'ok' | 'warn' | 'error'} | null>(null);
  const presenterRef = useRef<PresenterContext | null>(null);

  const episode = useMemo(() => shotEpisode(def, base, draft.patch), [def, base, draft.patch]);
  const timeline = useMemo(() => buildTimeline(episode, LAB_FPS), [episode]);
  const state = useMemo(() => resolveShot(def, base, draft.patch), [def, base, draft.patch]);
  const entry = useMemo(() => ({id: scene.id, episode, component: scene.component as React.ComponentType}), [scene, episode]);
  const inputProps = useMemo(() => ({theme, shot: draft.patch}), [theme, draft.patch]);

  // Material values reported by the running composition (useLook), for the inspector.
  const looksRef = useRef(new Map<string, Record<string, Required<MaterialLook>>>());
  const [, setLooksVersion] = useState(0);
  const bumpScheduled = useRef(false);
  const report = useCallback((objectId: string, slot: string, look: Required<MaterialLook>) => {
    const cur = looksRef.current.get(objectId) ?? {};
    if (JSON.stringify(cur[slot]) === JSON.stringify(look)) return;
    looksRef.current.set(objectId, {...cur, [slot]: look});
    if (bumpScheduled.current) return;
    bumpScheduled.current = true;
    requestAnimationFrame(() => {
      bumpScheduled.current = false;
      setLooksVersion((v) => v + 1);
    });
  }, []);
  const select = useCallback((s: Selection | null) => setSelection(s), []);
  const api = useMemo<ShotEditorApi>(() => ({selected: selection, select, inspect, helpers, report}), [selection, select, inspect, helpers, report]);

  /* ---------------------------------------------------------------- actions */

  const toggleInspect = useCallback(() => {
    setInspect((cur) => {
      if (cur) return null;
      const pose = cameraAt(state.camera, timeline, frame);
      return {position: pose.position, target: pose.target, fov: pose.fov, projection: 'perspective'};
    });
  }, [state.camera, timeline, frame]);

  const applyPreset = useCallback((id: string) => draft.replace(applyLightingPreset(def, draft.patch, id), `Preset ${id}`), [def, draft]);

  const exportJson = () => {
    const blob = new Blob([formatPatch(draft.patch)], {type: 'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${def.id}.shot.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    setStatus({text: `Exported ${def.id}.shot.json. Render it with: npm run cine:render -- ${scene.slug.replace(/^cine-/, '')} --shot=<path to the file>`, tone: 'ok'});
  };

  const fileRef = useRef<HTMLInputElement>(null);
  const importJson = async (file: File) => {
    try {
      const {patch, problems} = sanitizePatch(def, JSON.parse(await file.text()));
      draft.replace(patch, `Import ${file.name}`);
      setStatus(problems.length ? {text: `Imported ${file.name} with ${problems.length} note(s): ${problems.slice(0, 4).join('; ')}`, tone: 'warn'} : {text: `Imported ${file.name}.`, tone: 'ok'});
    } catch (err) {
      setStatus({text: `Could not import ${file.name}: ${err instanceof Error ? err.message : String(err)}`, tone: 'error'});
    }
  };

  const saveToRepo = async () => {
    try {
      const res = await fetch('/__shot/save', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({file: def.approvedPath, content: formatPatch(draft.patch)})});
      const body = (await res.json()) as {ok: boolean; error?: string};
      if (!body.ok) throw new Error(body.error ?? res.statusText);
      setStatus({text: `Saved to ${def.approvedPath}. Review and commit it with git; renders now use it.`, tone: 'ok'});
    } catch (err) {
      setStatus({text: `Save failed: ${err instanceof Error ? err.message : String(err)} (only the dev server can write files).`, tone: 'error'});
    }
  };

  /* ---------------------------------------------------------------- keys */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));
      if ((e.ctrlKey || e.metaKey) && !typing && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) draft.redo();
        else draft.undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && !typing && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        draft.redo();
        return;
      }
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Escape' && !document.fullscreenElement) setSelection(null);
      if (e.key === 'i' || e.key === 'I') toggleInspect();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [draft, toggleInspect]);

  /* ---------------------------------------------------------------- free camera */

  const viewportRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{x: number; y: number; button: number; shift: boolean} | null>(null);
  useEffect(() => {
    const el = viewportRef.current;
    if (!el || !inspect) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setInspect((r) => (r ? dolly(r, Math.exp(e.deltaY * 0.0012)) : r));
    };
    el.addEventListener('wheel', onWheel, {passive: false});
    return () => el.removeEventListener('wheel', onWheel);
  }, [inspect]);
  const onPointerDown = (e: React.PointerEvent) => {
    if (!inspect) return;
    drag.current = {x: e.clientX, y: e.clientY, button: e.button, shift: e.shiftKey};
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !inspect) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    d.x = e.clientX;
    d.y = e.clientY;
    setInspect((r) => (r ? (d.button === 2 || d.button === 1 || d.shift ? pan(r, dx, dy) : orbit(r, dx, dy)) : r));
  };
  const onPointerUp = () => (drag.current = null);

  /* ---------------------------------------------------------------- automation */

  useEffect(() => {
    (window as unknown as {__shotEditor: unknown}).__shotEditor = {
      id: def.id,
      get patch() {
        return draft.patch;
      },
      get state() {
        return state;
      },
      get selection() {
        return selection;
      },
      set: draft.set,
      reset: draft.reset,
      replace: draft.replace,
      select,
      undo: draft.undo,
      redo: draft.redo,
    };
    return () => {
      delete (window as unknown as {__shotEditor?: unknown}).__shotEditor;
    };
  }, [def.id, draft, state, selection, select]);

  const approvedSame = samePatch(draft.patch, {...def.approved, version: 1, shot: def.id});
  const slug = scene.slug.replace(/^cine-/, '');

  return (
    <div className="shot-editor" data-testid="shot-editor" data-inspect={inspect ? 'true' : 'false'}>
      <header className="se-bar">
        <div className="se-title">
          <a
            href="/style-lab"
            className="se-back"
            onClick={(e) => {
              e.preventDefault();
              navigate(null);
            }}
          >
            Style Lab
          </a>
          <span className="se-sep">/</span>
          <a
            href={`/style-lab/${scene.slug}`}
            className="se-back"
            onClick={(e) => {
              e.preventDefault();
              navigate(scene.slug);
            }}
          >
            X{String(scene.number).padStart(2, '0')} {scene.title}
          </a>
          <span className="se-sep">/</span>
          <strong>Edit shot</strong>
          <span className="se-draft" data-state={approvedSame ? 'clean' : 'dirty'} data-testid="draft-state">
            {approvedSame ? 'Matches shot.json' : `Draft · ${draft.changes} change${draft.changes === 1 ? '' : 's'} vs code`}
          </span>
        </div>
        <div className="se-actions">
          <button type="button" className="se-btn" onClick={draft.undo} disabled={!draft.canUndo} title="Undo (Ctrl+Z)" data-testid="undo">
            Undo
          </button>
          <button type="button" className="se-btn" onClick={draft.redo} disabled={!draft.canRedo} title="Redo (Ctrl+Shift+Z)" data-testid="redo">
            Redo
          </button>
          <span className="se-gap" />
          <button type="button" className="se-btn" aria-pressed={Boolean(inspect)} onClick={toggleInspect} title="Free camera for looking around (I). Never changes the render." data-testid="inspect-toggle">
            {inspect ? 'Back to shot camera' : 'Free camera'}
          </button>
          <button type="button" className="se-btn" aria-pressed={helpers} onClick={() => setHelpers((h) => !h)} title="Selection box and light markers in the viewport">
            Helpers
          </button>
          <span className="se-gap" />
          <button type="button" className="se-btn" onClick={() => draft.replace(def.approved, 'Revert to shot.json')} disabled={approvedSame} data-testid="revert">
            Revert
          </button>
          <button type="button" className="se-btn" onClick={() => draft.replace({}, 'Reset to code defaults')} data-testid="reset-code" title="Empty patch: the shot exactly as written in code">
            Code defaults
          </button>
          <button type="button" className="se-btn" onClick={() => fileRef.current?.click()} data-testid="import">
            Import
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            data-testid="import-file"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importJson(f);
              e.target.value = '';
            }}
          />
          <button type="button" className="se-btn" onClick={exportJson} data-testid="export">
            Export JSON
          </button>
          {import.meta.env.DEV ? (
            <button type="button" className="se-btn se-primary" onClick={() => void saveToRepo()} disabled={approvedSame} data-testid="save-repo" title={`Write the draft to ${def.approvedPath}`}>
              Save to repo
            </button>
          ) : null}
        </div>
      </header>

      <div className="se-body">
        <Hierarchy def={def} state={state} draft={draft} selection={selection} select={select} />

        <main className="se-center">
          <div className="se-viewport-wrap">
            <div
              ref={viewportRef}
              className="se-viewport"
              data-testid="shot-viewport"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onContextMenu={(e) => inspect && e.preventDefault()}
            >
              <ShotEditorContext.Provider value={api}>
                <Presenter
                  key={scene.id}
                  entry={entry}
                  fps={LAB_FPS}
                  inputProps={inputProps}
                  onFrame={setFrame}
                  chrome={(ctx) => {
                    presenterRef.current = ctx;
                    return null;
                  }}
                />
              </ShotEditorContext.Provider>
              {inspect ? <span className="se-badge">Free camera · drag to orbit, right-drag to pan, wheel to zoom · not rendered</span> : state.camera.locked ? <span className="se-badge se-badge-quiet">Shot camera · locked</span> : <span className="se-badge se-badge-warn">Shot camera · moves on beats</span>}
            </div>
          </div>
          <BeatStrip timeline={timeline} state={state} frame={frame} selection={selection} select={select} goTo={(c) => presenterRef.current?.presenter.goTo(c)} />
          <footer className="se-foot">
            {status ? (
              <span className={`se-status se-status-${status.tone}`} data-testid="status" role="status">
                {status.text}
              </span>
            ) : (
              <span className="se-dim">
                Render this draft: export it, then <code>npm run cine:render -- {slug} --shot=&lt;file&gt;</code>. Render the approved shot: <code>npm run cine:render -- {slug}</code>.
              </span>
            )}
            {draft.restored ? <span className="se-dim"> · Restored your unsaved draft from this browser.</span> : null}
          </footer>
        </main>

        <Inspector def={def} state={state} draft={draft} selection={selection} select={select} looks={looksRef.current} timeline={timeline} frame={frame} inspect={inspect} applyPreset={applyPreset} />
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ free-camera math */

type V3 = [number, number, number];
const sub = (a: readonly number[], b: readonly number[]): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: readonly number[], b: readonly number[]): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: readonly number[], k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const len = (a: readonly number[]) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: readonly number[]): V3 => scale(a, 1 / Math.max(1e-9, len(a)));
const cross = (a: readonly number[], b: readonly number[]): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

const orbit = (r: Rig, dx: number, dy: number): Rig => {
  const off = sub(r.position, r.target);
  const dist = len(off);
  let az = Math.atan2(off[0], off[2]);
  let el = Math.asin(Math.max(-1, Math.min(1, off[1] / dist)));
  az -= dx * 0.006;
  el = Math.max(-1.45, Math.min(1.45, el + dy * 0.006));
  const pos = add(r.target, [dist * Math.cos(el) * Math.sin(az), dist * Math.sin(el), dist * Math.cos(el) * Math.cos(az)]);
  return {...r, position: pos};
};
const pan = (r: Rig, dx: number, dy: number): Rig => {
  const fwd = norm(sub(r.target, r.position));
  const right = norm(cross(fwd, [0, 1, 0]));
  const up = cross(right, fwd);
  const k = len(sub(r.position, r.target)) * 0.0016;
  const delta = add(scale(right, -dx * k), scale(up, dy * k));
  return {...r, position: add(r.position, delta), target: add(r.target, delta)};
};
const dolly = (r: Rig, factor: number): Rig => {
  const off = sub(r.position, r.target);
  const d = Math.max(0.15, Math.min(200, len(off) * factor));
  return {...r, position: add(r.target, scale(norm(off), d))};
};
