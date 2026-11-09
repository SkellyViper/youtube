import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {Rig} from '../../../components/cyber/three/rig';
import {buildTimeline} from '../../../engine';
import {
  applyLightingPreset,
  formatPatch,
  frameToBeatTime,
  keyFrame,
  resolveShot,
  sanitizePatch,
  shotCameraAt,
  shotEpisode,
  ShotEditorContext,
  sortedKeys,
  type CameraKey,
  type CameraPose,
  type MaterialLook,
  type Selection,
  type ShotEditorApi,
  type ShotPatch,
  type Vec3,
} from '../../../shot';
import {THEME_IDS, type ThemeId} from '../../../styles/themes';
import type {CinematicScene} from '../../../videos/style-lab/cinematic';
import {LAB_FPS} from '../../../videos/style-lab/registry';
import {Presenter, type PresenterContext} from '../../PresentationApp';
import {Hierarchy} from './Hierarchy';
import {Inspector} from './Inspector';
import {Timeline} from './Timeline';
import {samePatch, useShotDraft} from './useShotDraft';
import './editor.css';

/**
 * Style Lab → scene → Edit: the same Presenter (same Player, keys and
 * checkpoints) the viewer uses, with a video-editor timeline for the camera.
 * The composition receives the draft as its `shot` input prop, exactly what
 * a render receives with `--shot=draft.json`, so the preview is the MP4.
 *
 * View modes:
 *   Shot   look through the shot camera (what renders)
 *   Fly    look through the shot camera and drag to move it: the drag edits
 *          the keyframe at the playhead (one is created if there is none)
 *   Free   an inspection camera that never changes the shot; K / C then key
 *          the shot camera to the view you found
 */
type ViewMode = 'shot' | 'fly' | 'free';

const round3 = (v: readonly number[]): Vec3 => [Math.round(v[0] * 1000) / 1000, Math.round(v[1] * 1000) / 1000, Math.round(v[2] * 1000) / 1000];
let idSeq = 0;
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(idSeq++).toString(36)}`;

/** Tracks presenter status and hands its context to the editor without setting state during render. */
const PresenterBridge: React.FC<{readonly ctx: PresenterContext; readonly sink: React.MutableRefObject<PresenterContext | null>; readonly onStatus: (s: string) => void}> = ({ctx, sink, onStatus}) => {
  sink.current = ctx;
  const status = ctx.presenter.state.status;
  useEffect(() => onStatus(status), [status, onStatus]);
  return null;
};

export const ShotEditor: React.FC<{readonly scene: CinematicScene; readonly navigate: (slug: string | null) => void}> = ({scene, navigate}) => {
  const def = scene.shot!;
  const base = scene.baseEpisode!;
  const draft = useShotDraft(def);
  const [theme] = useState<ThemeId>(() => {
    const t = new URLSearchParams(window.location.search).get('theme');
    return t && (THEME_IDS as readonly string[]).includes(t) ? (t as ThemeId) : 'neon';
  });
  const [selection, setSelection] = useState<Selection | null>(null);
  const [view, setView] = useState<ViewMode>('shot');
  const [inspect, setInspect] = useState<Rig | null>(null);
  const [helpers, setHelpers] = useState(true);
  const [frame, setFrame] = useState(0);
  const [status, setStatus] = useState<{text: string; tone: 'ok' | 'warn' | 'error'} | null>(null);
  const [playStatus, setPlayStatus] = useState('holding');
  const presenterRef = useRef<PresenterContext | null>(null);

  const episode = useMemo(() => shotEpisode(def, base, draft.patch), [def, base, draft.patch]);
  const timeline = useMemo(() => buildTimeline(episode, LAB_FPS), [episode]);
  const state = useMemo(() => resolveShot(def, base, draft.patch), [def, base, draft.patch]);
  const entry = useMemo(() => ({id: scene.id, episode, component: scene.component as React.ComponentType}), [scene, episode]);
  const inputProps = useMemo(() => ({theme, shot: draft.patch}), [theme, draft.patch]);

  // Material values and the scene's own camera, reported by the running composition.
  const looksRef = useRef(new Map<string, Record<string, Required<MaterialLook>>>());
  const codeRef = useRef(new Map<number, CameraPose>());
  const [, setVersion] = useState(0);
  const bump = useRef(false);
  const scheduleBump = useCallback(() => {
    if (bump.current) return;
    bump.current = true;
    requestAnimationFrame(() => {
      bump.current = false;
      setVersion((v) => v + 1);
    });
  }, []);
  const report = useCallback(
    (objectId: string, slot: string, look: Required<MaterialLook>) => {
      const cur = looksRef.current.get(objectId) ?? {};
      if (JSON.stringify(cur[slot]) === JSON.stringify(look)) return;
      looksRef.current.set(objectId, {...cur, [slot]: look});
      scheduleBump();
    },
    [scheduleBump],
  );
  const reportCode = useCallback((f: number, pose: {position: readonly number[]; target: readonly number[]; fov: number; roll: number}) => {
    codeRef.current.set(f, {position: round3(pose.position), target: round3(pose.target), fov: pose.fov, roll: pose.roll});
  }, []);

  /** The shot camera at a frame (code mode uses the reported code camera when known). */
  const poseAt = useCallback((f: number): CameraPose => shotCameraAt(state.camera, timeline, f, codeRef.current.get(f) ?? null), [state.camera, timeline]);
  const shotPose = useMemo(() => poseAt(frame), [poseAt, frame]);
  const select = useCallback((s: Selection | null) => setSelection(s), []);
  const api = useMemo<ShotEditorApi>(() => ({selected: selection, select, inspect: view === 'free' ? inspect : null, helpers, report, reportCode, shotPose}), [selection, select, view, inspect, helpers, report, reportCode, shotPose]);

  /* ---------------------------------------------------------------- camera track */

  const seek = useCallback((f: number) => presenterRef.current?.seek(f), []);
  const cam = state.camera;

  /** The view a new key should take: the free camera's while inspecting, else the shot camera here. */
  const currentView = useCallback((): CameraPose => (view === 'free' && inspect ? {position: round3(inspect.position), target: round3(inspect.target), fov: Math.round(inspect.fov * 10) / 10, roll: 0} : poseAt(frame)), [view, inspect, poseAt, frame]);

  /** The key sitting on the playhead's frame, if any. */
  const keyAtPlayhead = useCallback((): string | null => {
    if (cam.mode !== 'keys') return null;
    for (const [id, k] of sortedKeys(cam, timeline)) if (Math.abs(keyFrame(timeline, k) - frame) <= 1) return id;
    return null;
  }, [cam, timeline, frame]);

  /**
   * Key (or cut) the camera at the playhead. Taking over from a locked or code
   * camera also keys its pose at the very start, so everything before the new
   * key keeps the shot's opening frame.
   */
  const addKey = useCallback(
    (cut: boolean, pose?: CameraPose, label = ''): string => {
      const at = frameToBeatTime(timeline, frame);
      const v = pose ?? currentView();
      const existing = keyAtPlayhead();
      const keys: Record<string, CameraKey> = {...((draft.patch.camera?.keys ?? {}) as Record<string, CameraKey>)};
      if (cam.mode !== 'keys' && Object.keys(keys).length === 0) {
        const first = frameToBeatTime(timeline, 0);
        const p0 = poseAt(0);
        if (at.beat !== first.beat || at.t > 0.01) keys[newId('key')] = {beat: first.beat, t: 0, ...p0, ease: 'inOut', cut: false, label: 'Opening'};
      }
      const id = existing ?? newId('key');
      keys[id] = {...(existing ? keys[id] : {ease: 'inOut', label}), beat: at.beat, t: at.t, position: v.position, target: v.target, fov: v.fov, roll: v.roll, cut, ...(label ? {label} : {})} as CameraKey;
      draft.replace({...draft.patch, camera: {...(draft.patch.camera ?? {}), mode: 'keys', locked: false, keys}}, cut ? 'Cut camera' : 'Key camera');
      setSelection({kind: 'key', id});
      return id;
    },
    [timeline, frame, currentView, keyAtPlayhead, draft, cam.mode, poseAt],
  );

  const moveKey = useCallback((id: string, f: number) => draft.set(['camera', 'keys', id], {...cam.keys[id], ...frameToBeatTime(timeline, f)}), [draft, cam.keys, timeline]);
  const moveNote = useCallback((id: string, f: number) => draft.set(['notes', id], {...state.notes[id], ...frameToBeatTime(timeline, f)}), [draft, state.notes, timeline]);
  const addNote = useCallback(() => {
    const id = newId('note');
    draft.set(['notes', id], {...frameToBeatTime(timeline, frame), text: '', done: false});
    setSelection({kind: 'note', id});
  }, [draft, timeline, frame]);

  const removeSelected = useCallback(() => {
    if (selection?.kind === 'key') draft.reset(['camera', 'keys', selection.id]);
    else if (selection?.kind === 'note') draft.reset(['notes', selection.id]);
    else return;
    setSelection(null);
  }, [selection, draft]);

  /**
   * Bake the scene's own (code) camera into keyframes: step through the
   * animation, read the camera the scene reports at each sample, and keep the
   * samples where it is not standing still. Then every move is editable.
   */
  const [baking, setBaking] = useState<string | null>(null);
  const bake = useCallback(async () => {
    const ctx = presenterRef.current;
    if (!ctx) return;
    const frames: number[] = [0];
    for (const b of timeline.beats) {
      for (let f = b.start; f < b.animEnd; f += 12) frames.push(f);
      frames.push(b.animEnd);
    }
    const unique = Array.from(new Set(frames)).sort((a, b) => a - b);
    const saved = {...draft.patch, camera: {...(draft.patch.camera ?? {}), mode: 'code' as const, locked: false}};
    draft.replace(saved, 'Bake: code camera');
    const got: [number, CameraPose][] = [];
    for (let i = 0; i < unique.length; i++) {
      const f = unique[i];
      setBaking(`Baking the code camera… ${i + 1}/${unique.length}`);
      ctx.seek(f);
      const t0 = performance.now();
      while (!codeRef.current.has(f) && performance.now() - t0 < 4000) await new Promise((r) => requestAnimationFrame(r));
      const p = codeRef.current.get(f);
      if (p) got.push([f, p]);
    }
    // Drop samples in the middle of a still stretch.
    const same = (a: CameraPose, b: CameraPose) => a.position.every((v, k) => Math.abs(v - b.position[k]) < 0.002) && a.target.every((v, k) => Math.abs(v - b.target[k]) < 0.002) && Math.abs(a.fov - b.fov) < 0.05;
    const kept = got.filter(([, p], i) => i === 0 || i === got.length - 1 || !(same(got[i - 1][1], p) && same(p, got[i + 1][1])));
    const keys: Record<string, CameraKey> = {};
    kept.forEach(([f, p], i) => {
      keys[`bake-${String(i).padStart(3, '0')}`] = {...frameToBeatTime(timeline, f), ...p, ease: 'smooth', cut: false, label: i === 0 ? 'Baked from code' : ''};
    });
    draft.replace({...saved, camera: {...saved.camera, mode: 'keys', keys}}, 'Bake code camera into keys');
    setBaking(null);
    setStatus({text: `Baked the scene's camera into ${kept.length} keyframes (from ${got.length} samples). Edit, drag or delete them; Undo restores the code camera.`, tone: 'ok'});
    ctx.seek(0);
  }, [timeline, draft]);

  /* ---------------------------------------------------------------- other actions */

  const setViewMode = useCallback(
    (m: ViewMode) => {
      setView(m);
      if (m === 'free') setInspect((cur) => cur ?? {position: shotPose.position, target: shotPose.target, fov: shotPose.fov, projection: 'perspective'});
    },
    [shotPose],
  );
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
      if (typing || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const k = e.key;
      if (k === 'Escape' && !document.fullscreenElement) setSelection(null);
      else if (k === 'i' || k === 'I') setViewMode(view === 'free' ? 'shot' : 'free');
      else if (k === 'k' || k === 'K') addKey(false);
      else if (k === 'c' || k === 'C') addKey(true);
      else if (k === 'n' || k === 'N') addNote();
      else if (k === 'Delete' || k === 'Backspace') removeSelected();
      else if (k === ',' || k === '<') seek(frame - (e.shiftKey ? 10 : 1));
      else if (k === '.' || k === '>') seek(frame + (e.shiftKey ? 10 : 1));
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [draft, setViewMode, view, addKey, addNote, removeSelected, seek, frame]);

  /* ---------------------------------------------------------------- viewport: free camera + fly */

  const viewportRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{x: number; y: number; button: number; shift: boolean; key?: string} | null>(null);
  /** Apply an orbit/pan/dolly to the shot camera's key at the playhead (Fly mode). */
  const flyKey = useCallback(
    (fn: (r: Rig) => Rig, keyId: string) => {
      const k = cam.keys[keyId];
      if (!k) return;
      const r = fn({position: k.position, target: k.target, fov: k.fov});
      draft.set(['camera', 'keys', keyId], {...k, position: round3(r.position), target: round3(r.target), fov: Math.round(r.fov * 10) / 10});
    },
    [cam.keys, draft],
  );
  useEffect(() => {
    const el = viewportRef.current;
    if (!el || view === 'shot') return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const f = Math.exp(e.deltaY * 0.0012);
      const lens = (r: Rig): Rig => ({...r, fov: Math.max(8, Math.min(90, r.fov * f))});
      if (view === 'free') setInspect((r) => (r ? (e.altKey ? lens(r) : dolly(r, f)) : r));
      else {
        const id = keyAtPlayhead() ?? addKey(false);
        flyKey((r) => (e.altKey ? lens(r) : dolly(r, f)), id);
      }
    };
    el.addEventListener('wheel', onWheel, {passive: false});
    return () => el.removeEventListener('wheel', onWheel);
  }, [view, keyAtPlayhead, addKey, flyKey]);
  const onPointerDown = (e: React.PointerEvent) => {
    if (view === 'shot') return;
    const key = view === 'fly' ? (keyAtPlayhead() ?? addKey(false)) : undefined;
    drag.current = {x: e.clientX, y: e.clientY, button: e.button, shift: e.shiftKey, key};
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    d.x = e.clientX;
    d.y = e.clientY;
    // Fly is for small, deliberate adjustments: half the free camera's speed.
    const k = view === 'fly' ? 0.5 : 1;
    const op = (r: Rig) => (d.button === 2 || d.button === 1 || d.shift ? pan(r, dx * k, dy * k) : orbit(r, dx * k, dy * k));
    if (view === 'free') setInspect((r) => (r ? op(r) : r));
    else if (d.key) flyKey(op, d.key);
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
      get shotPose() {
        return shotPose;
      },
      set: draft.set,
      reset: draft.reset,
      replace: draft.replace,
      select,
      undo: draft.undo,
      redo: draft.redo,
      seek,
      setView: setViewMode,
      addKey: (cut: boolean) => addKey(cut),
      bake,
    };
    return () => {
      delete (window as unknown as {__shotEditor?: unknown}).__shotEditor;
    };
  }, [def.id, draft, state, selection, select, shotPose, seek, setViewMode, addKey, bake]);

  const approvedSame = samePatch(draft.patch, {...def.approved, version: 1, shot: def.id} as ShotPatch);
  const slug = scene.slug.replace(/^cine-/, '');
  const camLabel = cam.mode === 'locked' ? 'locked' : cam.mode === 'keys' ? `keyframed (${Object.keys(cam.keys).length} keys)` : 'the scene’s own moves';

  return (
    <div className="shot-editor" data-testid="shot-editor" data-inspect={view === 'free' ? 'true' : 'false'} data-view={view}>
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
          <strong>Edit</strong>
          <span className="se-draft" data-state={approvedSame ? 'clean' : 'dirty'} data-testid="draft-state">
            {approvedSame ? 'Matches shot.json' : `Draft · ${draft.changes} change${draft.changes === 1 ? '' : 's'} vs code`}
          </span>
        </div>
        <div className="se-actions">
          <div className="se-modes" role="group" aria-label="Viewport">
            {(['shot', 'fly', 'free'] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={view === m}
                onClick={() => setViewMode(m)}
                data-testid={`view-${m}`}
                title={m === 'shot' ? 'Look through the shot camera (what renders)' : m === 'fly' ? 'Drag in the viewport to move the shot camera at the playhead (edits or creates a key)' : 'Free inspection camera (I): look around without changing the shot; K / C key the shot to this view'}
              >
                {m === 'shot' ? 'Shot' : m === 'fly' ? 'Fly' : 'Free'}
              </button>
            ))}
          </div>
          <button type="button" className="se-btn" aria-pressed={helpers} onClick={() => setHelpers((h) => !h)} title="Selection box, light markers, camera path">
            Helpers
          </button>
          <span className="se-gap" />
          <button type="button" className="se-btn" onClick={draft.undo} disabled={!draft.canUndo} title="Undo (Ctrl+Z)" data-testid="undo">
            Undo
          </button>
          <button type="button" className="se-btn" onClick={draft.redo} disabled={!draft.canRedo} title="Redo (Ctrl+Shift+Z)" data-testid="redo">
            Redo
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
              onContextMenu={(e) => view !== 'shot' && e.preventDefault()}
            >
              <ShotEditorContext.Provider value={api}>
                <Presenter key={scene.id} entry={entry} fps={LAB_FPS} inputProps={inputProps} onFrame={setFrame} chrome={(ctx) => <PresenterBridge ctx={ctx} sink={presenterRef} onStatus={setPlayStatus} />} />
              </ShotEditorContext.Provider>
              {view === 'free' ? (
                <span className="se-badge">Free camera · drag to orbit, right-drag to pan, wheel to zoom, Alt+wheel lens · not rendered · K / C key the shot to this view</span>
              ) : view === 'fly' ? (
                <span className="se-badge se-badge-warn">Fly · dragging moves the shot camera at the playhead (keyframe) · wheel dolly, Alt+wheel lens</span>
              ) : (
                <span className="se-badge se-badge-quiet" data-testid="cam-badge">
                  Shot camera · {camLabel}
                </span>
              )}
              {baking ? <span className="se-badge se-badge-bottom">{baking}</span> : null}
            </div>
          </div>
          <Timeline
            timeline={timeline}
            state={state}
            frame={frame}
            playing={playStatus === 'playing' || playStatus === 'timed'}
            selection={selection}
            select={select}
            seek={seek}
            togglePlay={() => presenterRef.current?.presenter.togglePlay()}
            moveKey={moveKey}
            moveNote={moveNote}
            addKey={(cut) => addKey(cut)}
            addNote={addNote}
          />
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

        <Inspector
          def={def}
          state={state}
          draft={draft}
          selection={selection}
          select={select}
          looks={looksRef.current}
          timeline={timeline}
          frame={frame}
          inspect={view === 'free' ? inspect : null}
          applyPreset={applyPreset}
          camera={{addKey, seek, bake, baking: Boolean(baking), currentView}}
        />
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ free-camera / fly math */

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
  const d = Math.max(0.15, Math.min(400, len(off) * factor));
  return {...r, position: add(r.target, scale(norm(off), d))};
};
