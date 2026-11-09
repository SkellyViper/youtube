import React from 'react';
import type {Rig} from '../../../components/cyber/three/rig';
import type {Timeline} from '../../../engine';
import {EASING_HINTS, EASING_NAMES, keyFrame, LIGHTING_PRESETS, leafPaths, sortedKeys, type CameraMode, type CameraPose, type MaterialLook, type Path, type Selection, type ShotDef, type ShotState} from '../../../shot';
import {ColorField, NumberField, Section, SelectField, TextField, ToggleField, Vec3Field} from './fields';
import type {ShotDraft} from './useShotDraft';

/**
 * The inspector: properties of whatever is selected (object, light, camera,
 * stage look, beat, motion). With nothing selected it lists every change the
 * draft makes, each one resettable on its own.
 */
export type InspectorProps = {
  readonly def: ShotDef;
  readonly state: ShotState;
  readonly draft: ShotDraft;
  readonly selection: Selection | null;
  readonly select: (s: Selection | null) => void;
  readonly looks: ReadonlyMap<string, Readonly<Record<string, Required<MaterialLook>>>>;
  readonly timeline: Timeline;
  readonly frame: number;
  readonly inspect: Rig | null;
  readonly applyPreset: (id: string) => void;
  /** Camera-track actions owned by the editor. */
  readonly camera: {
    addKey: (cut: boolean, pose?: CameraPose, label?: string) => string;
    seek: (frame: number) => void;
    bake: () => Promise<void>;
    baking: boolean;
    currentView: () => CameraPose;
  };
};

/** Binding helper: value + modified + change + reset for one patch path. */
const useBind = (draft: ShotDraft) =>
  function bind<T>(path: Path, value: T) {
    return {value, modified: draft.get(path) !== undefined, onChange: (v: T) => draft.set(path, v), onReset: () => draft.reset(path), testId: path.join('-')};
  };

const easingOptions = EASING_NAMES.map((e) => ({value: e, label: `${e} · ${EASING_HINTS[e]}`}));

export const Inspector: React.FC<InspectorProps> = (props) => {
  const {selection} = props;
  return (
    <aside className="se-inspector" aria-label="Inspector" data-testid="shot-inspector">
      {!selection ? <ChangesPanel {...props} /> : null}
      {selection?.kind === 'object' ? <ObjectInspector {...props} id={selection.id} /> : null}
      {selection?.kind === 'light' ? <LightInspector {...props} id={selection.id} /> : null}
      {selection?.kind === 'camera' ? <CameraInspector {...props} /> : null}
      {selection?.kind === 'stage' ? <StageInspector {...props} /> : null}
      {selection?.kind === 'beat' ? <BeatInspector {...props} id={selection.id} /> : null}
      {selection?.kind === 'motion' ? <MotionInspector {...props} id={selection.id} /> : null}
      {selection?.kind === 'key' ? <KeyInspector {...props} id={selection.id} /> : null}
      {selection?.kind === 'note' ? <NoteInspector {...props} id={selection.id} /> : null}
    </aside>
  );
};

const Head: React.FC<{readonly kicker: string; readonly title: string; readonly id?: string; readonly children?: React.ReactNode}> = ({kicker, title, id, children}) => (
  <header className="se-head">
    <span className="se-kicker">{kicker}</span>
    <h2>{title}</h2>
    {id ? <code className="se-id">{id}</code> : null}
    {children}
  </header>
);

/* ------------------------------------------------------------------ changes */

const ChangesPanel: React.FC<InspectorProps> = ({def, state, draft, select, timeline, camera}) => {
  const paths = leafPaths(draft.patch).filter((p) => !['version', 'shot', 'note', 'notes'].includes(p[0]) && !(p[0] === 'camera' && p[1] === 'keys' && p.length > 3));
  const notes = Object.entries(state.notes).sort(([, a], [, b]) => keyFrame(timeline, a) - keyFrame(timeline, b));
  return (
    <>
      <Head kicker="Shot" title={def.title} id={def.id}>
        <p className="se-purpose">Scrub the timeline, key or cut the camera (K / C), pin notes (N). Select anything to edit it. Below: your review notes, then every property the draft overrides; everything else comes from code.</p>
      </Head>
      <Section title={`Review notes (${notes.length})`}>
        {notes.length === 0 ? <p className="se-empty">No notes yet. Press N on the timeline to pin one at the playhead.</p> : null}
        <ul className="se-list" data-testid="notes-list">
          {notes.map(([id, n]) => (
            <li key={id}>
              <button
                type="button"
                className="se-link"
                onClick={() => {
                  camera.seek(keyFrame(timeline, n));
                  select({kind: 'note', id});
                }}
              >
                {n.done ? '✓ ' : '⚑ '}
                {n.text || 'Empty note'}
              </button>
              <span className="se-dim">
                {n.beat} +{n.t.toFixed(2)} s
              </span>
            </li>
          ))}
        </ul>
      </Section>
      <Section title={`Changes vs code (${paths.length})`}>
        {paths.length === 0 ? <p className="se-empty">No changes: the shot is exactly as written in code.</p> : null}
        <ul className="se-changes" data-testid="shot-changes">
          {paths.map((p) => {
            const v = draft.get(p);
            const target: Selection =
              p[0] === 'objects' ? {kind: 'object', id: p[1]} : p[0] === 'lights' ? {kind: 'light', id: p[1]} : p[0] === 'camera' ? (p[1] === 'keys' && p[2] ? {kind: 'key', id: p[2]} : {kind: 'camera'}) : p[0] === 'stage' ? {kind: 'stage'} : p[0] === 'beats' ? {kind: 'beat', id: p[1]} : p[0] === 'notes' ? {kind: 'note', id: p[1]} : {kind: 'motion', id: p[1]};
            return (
              <li key={p.join('.')}>
                <button type="button" className="se-link" onClick={() => select(target)}>
                  {p.join(' › ')}
                </button>
                <code>{JSON.stringify(v)}</code>
                <button type="button" className="se-reset" onClick={() => draft.reset(p)} aria-label={`Reset ${p.join('.')}`}>
                  ↺
                </button>
              </li>
            );
          })}
        </ul>
      </Section>
    </>
  );
};

/* ------------------------------------------------------------------ objects */

const ObjectInspector: React.FC<InspectorProps & {readonly id: string}> = ({def, state, draft, looks, id, timeline, frame, select}) => {
  const bind = useBind(draft);
  const o = state.objects[id];
  const d = def.objects[id];
  if (!o || !d) return <p className="se-empty">Unknown object “{id}”.</p>;
  const p = (...k: string[]): Path => ['objects', id, ...k];
  const reported = looks.get(id) ?? {};
  const slots = Array.from(new Set([...Object.keys(d.slots ?? {}), ...Object.keys(reported)]));
  const motions = Object.entries(state.motions).filter(([, m]) => m.kind === 'transform' && m.object === id);
  const beatNow = timeline.beats.find((b) => frame >= b.start && frame < b.end) ?? timeline.beats[0];

  const addMotion = () => {
    const mid = `${id}-${beatNow.id}-${Object.keys(state.motions).length + 1}`;
    draft.replace(
      {...draft.patch, motions: {...(draft.patch.motions ?? {}), [mid]: {kind: 'transform', label: `${d.label} moves`, beat: beatNow.id, object: id, from: 0, until: null, easing: 'inOut', enabled: true, to: {position: [o.position[0], o.position[1], o.position[2]]}}}},
      `Add motion ${mid}`,
    );
    select({kind: 'motion', id: mid});
  };

  return (
    <>
      <Head kicker={`Object · ${d.group}`} title={d.label} id={id}>
        {d.purpose ? <p className="se-purpose">{d.purpose}</p> : null}
      </Head>
      <Section title="Presence">
        <ToggleField label="Visible" on="Shown" off="Hidden" {...bind(p('visible'), o.visible)} />
        <NumberField label="Opacity" min={0} max={1} step={0.01} slider {...bind(p('opacity'), o.opacity)} hint="Applies to the object's material slots." />
        {d.variants?.length ? <SelectField label="Model" options={d.variants.map((v) => ({value: v.id, label: v.label}))} {...bind(p('variant'), o.variant)} /> : null}
      </Section>
      <Section title="Transform" aside={<span className="se-note">around the pivot</span>}>
        <Vec3Field label="Position" step={0.01} {...bind(p('position'), o.position as [number, number, number])} />
        <Vec3Field label="Rotation °" step={1} {...bind(p('rotation'), o.rotation as [number, number, number])} />
        <NumberField label="Scale" step={0.01} min={0.01} max={10} {...bind(p('scale'), o.scale)} />
      </Section>
      {slots.length ? (
        <Section title="Materials">
          {slots.map((slot) => {
            const eff = reported[slot];
            const patch = o.materials[slot] ?? {};
            const val = <K extends keyof MaterialLook>(k: K, fallback: NonNullable<MaterialLook[K]>) => (patch[k] ?? eff?.[k] ?? fallback) as NonNullable<MaterialLook[K]>;
            return (
              <div className="se-slot" key={slot} data-testid={`slot-${slot}`}>
                <h4>{d.slots?.[slot] ?? slot}</h4>
                <ColorField label="Colour" {...bind(p('materials', slot, 'color'), val('color', '#808080'))} />
                <ColorField label="Emissive" {...bind(p('materials', slot, 'emissive'), val('emissive', '#000000'))} />
                <NumberField label="Emissive ×" min={0} max={8} step={0.05} slider {...bind(p('materials', slot, 'emissiveIntensity'), val('emissiveIntensity', 1))} />
                <NumberField label="Roughness" min={0} max={1} step={0.01} slider {...bind(p('materials', slot, 'roughness'), val('roughness', 0.8))} />
                <NumberField label="Metalness" min={0} max={1} step={0.01} slider {...bind(p('materials', slot, 'metalness'), val('metalness', 0))} />
              </div>
            );
          })}
        </Section>
      ) : null}
      <Section title="Luminous edges" aside={<span className="se-note">legacy hairlines</span>}>
        <ToggleField label="Edges" {...bind(p('edges', 'enabled'), o.edges.enabled)} />
        <ColorField label="Colour" {...bind(p('edges', 'color'), o.edges.color)} />
        <NumberField label="Intensity" min={0} max={6} step={0.05} slider {...bind(p('edges', 'intensity'), o.edges.intensity)} hint="Above ~1 the lines bloom (0.55 dim, 1.5 base, 2.6 strong)." />
        <NumberField label="Crease °" min={1} max={89} step={1} {...bind(p('edges', 'threshold'), o.edges.threshold)} hint="Only edges sharper than this angle are drawn." />
      </Section>
      <Section title="Animation" aside={<button type="button" className="se-btn se-btn-small" onClick={addMotion} data-testid="add-motion">Animate in “{beatNow.label}”</button>}>
        {motions.length === 0 ? <p className="se-empty">No transform motions. Code-driven cues are listed under each beat.</p> : null}
        <ul className="se-list">
          {motions.map(([mid, m]) => (
            <li key={mid}>
              <button type="button" className="se-link" onClick={() => select({kind: 'motion', id: mid})}>
                {m.label} <span className="se-dim">· {m.beat}</span>
              </button>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
};

/* ------------------------------------------------------------------ lights */

const MAX_INTENSITY: Record<string, number> = {ambient: 2, hemisphere: 2, directional: 6, point: 200, spot: 200, practical: 4};

const LightInspector: React.FC<InspectorProps & {readonly id: string}> = ({def, state, draft, id}) => {
  const bind = useBind(draft);
  const l = state.lights[id];
  const d = def.lights[id];
  if (!l || !d) return <p className="se-empty">Unknown light “{id}”.</p>;
  const p = (...k: string[]): Path => ['lights', id, ...k];
  const positioned = l.kind === 'directional' || l.kind === 'point' || l.kind === 'spot';
  return (
    <>
      <Head kicker={`Light · ${d.role} · ${l.kind}`} title={d.label} id={id}>
        {l.kind === 'practical' ? <p className="se-purpose">A light that belongs to an object (a screen, the lamp, the window). Intensity multiplies the object’s own light; an empty colour keeps the object’s.</p> : null}
      </Head>
      <Section title="Light">
        <ToggleField label="Enabled" {...bind(p('enabled'), l.enabled)} />
        <NumberField label={l.kind === 'practical' ? 'Multiplier' : 'Intensity'} min={0} max={MAX_INTENSITY[l.kind]} step={l.kind === 'point' || l.kind === 'spot' ? 1 : 0.01} slider {...bind(p('intensity'), l.intensity)} />
        <ColorField label="Colour" placeholder="object’s own" {...bind(p('color'), l.color)} />
        {l.kind === 'hemisphere' ? <ColorField label="Ground" {...bind(p('groundColor'), l.groundColor)} /> : null}
      </Section>
      {positioned ? (
        <Section title="Placement">
          <Vec3Field label="Position" step={0.05} {...bind(p('position'), l.position as [number, number, number])} />
          {l.kind !== 'point' ? <Vec3Field label="Target" step={0.05} {...bind(p('target'), l.target as [number, number, number])} /> : null}
          <ToggleField label="Shadows" {...bind(p('castShadow'), l.castShadow)} />
          {l.kind === 'spot' ? (
            <>
              <NumberField label="Cone °" min={1} max={89} step={1} {...bind(p('angle'), l.angle)} />
              <NumberField label="Penumbra" min={0} max={1} step={0.01} slider {...bind(p('penumbra'), l.penumbra)} />
            </>
          ) : null}
          {l.kind === 'spot' || l.kind === 'point' ? <NumberField label="Range m" min={0} max={60} step={0.1} {...bind(p('distance'), l.distance)} /> : null}
        </Section>
      ) : null}
    </>
  );
};

/* ------------------------------------------------------------------ camera */

const MODES: readonly {readonly id: CameraMode; readonly label: string; readonly hint: string}[] = [
  {id: 'keys', label: 'Keyframes', hint: 'The camera track on the timeline: keys, moves and cuts you place.'},
  {id: 'locked', label: 'Locked', hint: 'One fixed pose for the whole shot.'},
  {id: 'code', label: 'Code', hint: 'The camera the scene was written with.'},
];

const CameraInspector: React.FC<InspectorProps> = ({def, state, draft, timeline, select, camera, frame}) => {
  const bind = useBind(draft);
  const c = state.camera;
  const p = (...k: string[]): Path => ['camera', ...k];
  const keys = sortedKeys(c, timeline);
  const setMode = (m: CameraMode) => draft.replace({...draft.patch, camera: {...(draft.patch.camera ?? {}), mode: m, locked: m === 'locked'}}, `Camera: ${m}`);
  const [angleName, setAngleName] = React.useState('');
  const saveAngle = () => {
    const v = camera.currentView();
    const id = (angleName || `Angle ${Object.keys(c.angles).length + 1}`).trim();
    draft.set(['camera', 'angles', id.toLowerCase().replace(/[^a-z0-9]+/g, '-')], {label: id, position: v.position, target: v.target, fov: v.fov, roll: v.roll});
    setAngleName('');
  };
  const hasMoves = Object.keys(def.camera.moves ?? {}).length > 0;
  return (
    <>
      <Head kicker="Camera" title="Shot camera">
        <p className="se-purpose">Direct the camera like an editor: scrub to a moment, find the view (Fly or Free), press K for a move or C for a cut. Keys live on the timeline; drag them to retime. The free camera never changes the render.</p>
      </Head>
      <Section title="Mode">
        <div className="se-modes" role="group" aria-label="Camera mode" data-testid="cam-mode">
          {MODES.map((m) => (
            <button key={m.id} type="button" aria-pressed={c.mode === m.id} title={m.hint} onClick={() => setMode(m.id)} data-testid={`cam-mode-${m.id}`}>
              {m.label}
            </button>
          ))}
        </div>
        {c.mode === 'code' ? (
          <div className="se-row">
            <button type="button" className="se-btn" onClick={() => void camera.bake()} disabled={camera.baking} data-testid="bake" title="Sample the scene's own camera into keyframes so every move becomes editable">
              Convert the code camera to keyframes
            </button>
          </div>
        ) : null}
      </Section>
      {c.mode === 'keys' || keys.length ? (
        <Section title={`Keyframes (${keys.length})`} aside={<span className="se-note">{c.mode === 'keys' ? 'active' : 'inactive in this mode'}</span>}>
          <div className="se-row">
            <button type="button" className="se-btn se-btn-small" onClick={() => camera.addKey(false)} data-testid="insp-key">
              ◆ Key at playhead
            </button>
            <button type="button" className="se-btn se-btn-small" onClick={() => camera.addKey(true)} data-testid="insp-cut">
              ✂ Cut at playhead
            </button>
          </div>
          <ul className="se-list" data-testid="key-list">
            {keys.map(([id, k]) => (
              <li key={id}>
                <button
                  type="button"
                  className="se-link"
                  onClick={() => {
                    camera.seek(keyFrame(timeline, k));
                    select({kind: 'key', id});
                  }}
                >
                  {k.cut ? '✂' : '◆'} {k.label || (k.cut ? 'Cut' : 'Key')}
                </button>
                <span className="se-dim">
                  f{keyFrame(timeline, k)} · {k.beat} +{k.t.toFixed(2)} s · {k.cut ? 'cut' : k.ease}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
      <Section title={`Angle bin (${Object.keys(c.angles).length})`}>
        <div className="se-row">
          <input className="se-text" style={{flex: 1}} placeholder="Name this view" value={angleName} onChange={(e) => setAngleName(e.target.value)} aria-label="Angle name" />
          <button type="button" className="se-btn se-btn-small" onClick={saveAngle} data-testid="save-angle">
            Save view
          </button>
        </div>
        <ul className="se-list">
          {Object.entries(c.angles).map(([id, a]) => (
            <li key={id}>
              <span>{a.label}</span>
              <button type="button" className="se-link" onClick={() => camera.addKey(false, a, a.label)}>
                key here
              </button>
              <button type="button" className="se-link" onClick={() => camera.addKey(true, a, a.label)}>
                cut here
              </button>
              <button type="button" className="se-link" onClick={() => draft.reset(['camera', 'angles', id])}>
                remove
              </button>
            </li>
          ))}
        </ul>
      </Section>
      {c.mode === 'locked' ? (
        <Section title="Locked pose">
          <Vec3Field label="Position" step={0.01} {...bind(p('position'), c.position as [number, number, number])} />
          <Vec3Field label="Target" step={0.01} {...bind(p('target'), c.target as [number, number, number])} />
          <NumberField label="FOV °" min={5} max={100} step={0.5} slider {...bind(p('fov'), c.fov)} />
          <NumberField label="Roll °" min={-45} max={45} step={0.5} {...bind(p('roll'), c.roll)} />
        </Section>
      ) : null}
      <Section title="Lens">
        <SelectField label="Projection" options={[{value: 'perspective', label: 'Perspective'}, {value: 'orthographic', label: 'Orthographic'}]} {...bind<string>(p('projection'), c.projection)} />
        {c.projection === 'orthographic' ? <NumberField label="Ortho height m" min={0.2} max={40} step={0.05} {...bind(p('orthoHeight'), c.orthoHeight)} /> : null}
      </Section>
      {c.mode === 'code' && hasMoves ? (
        <Section title="Code moves per beat">
          {timeline.beats
            .filter((b) => c.moves[b.id])
            .map((b) => {
              const m = c.moves[b.id];
              const mp = (...k: string[]): Path => ['camera', 'moves', b.id, ...k];
              return (
                <div className="se-slot" key={b.id}>
                  <h4>{b.label}</h4>
                  <ToggleField label="Move" {...bind(mp('enabled'), m.enabled)} />
                  <Vec3Field label="To position" {...bind(mp('position'), m.position as [number, number, number])} />
                  <Vec3Field label="To target" {...bind(mp('target'), m.target as [number, number, number])} />
                  <NumberField label="To FOV °" min={5} max={100} step={0.5} {...bind(mp('fov'), m.fov)} />
                  <NumberField label="From s" min={0} step={0.05} {...bind(mp('from'), m.from)} />
                  <NumberField label="Until s" min={0} step={0.05} {...bind(mp('until'), m.until ?? b.durationInFrames / timeline.fps)} />
                  <SelectField label="Easing" options={easingOptions} {...bind<string>(mp('easing'), m.easing)} />
                </div>
              );
            })}
        </Section>
      ) : null}
      <p className="se-note">Playhead: frame {frame}.</p>
    </>
  );
};

const keyEaseOptions = [{value: 'smooth', label: 'smooth · a path through the neighbouring keys'}, ...easingOptions];

const KeyInspector: React.FC<InspectorProps & {readonly id: string}> = ({state, draft, id, timeline, camera, select}) => {
  const bind = useBind(draft);
  const k = state.camera.keys[id];
  if (!k) return <p className="se-empty">This keyframe no longer exists.</p>;
  const p = (...x: string[]): Path => ['camera', 'keys', id, ...x];
  const beatLen = (timeline.beatById.get(k.beat)?.durationInFrames ?? 0) / timeline.fps;
  const f = keyFrame(timeline, k);
  return (
    <>
      <Head kicker={`Camera ${k.cut ? 'cut' : 'keyframe'} · frame ${f}`} title={k.label || (k.cut ? 'Cut' : 'Keyframe')} id={id}>
        <div className="se-row">
          <button type="button" className="se-btn se-btn-small" onClick={() => camera.seek(f)} data-testid="key-goto">
            Go to key
          </button>
          <button
            type="button"
            className="se-btn se-btn-small"
            onClick={() => {
              const v = camera.currentView();
              draft.set(['camera', 'keys', id], {...k, position: v.position, target: v.target, fov: v.fov, roll: v.roll});
            }}
            title="Free mode: the free camera's view. Otherwise: the shot camera at the playhead."
          >
            Set from current view
          </button>
          <button
            type="button"
            className="se-btn se-btn-small se-danger"
            onClick={() => {
              draft.reset(['camera', 'keys', id]);
              select({kind: 'camera'});
            }}
            data-testid="key-delete"
          >
            Delete
          </button>
        </div>
      </Head>
      <Section title="Timing">
        <TextField label="Name" value={k.label} onChange={(v) => draft.set(p('label'), v)} />
        <SelectField label="Beat" options={timeline.beats.map((b) => ({value: b.id, label: b.label}))} {...bind<string>(p('beat'), k.beat)} />
        <NumberField label="At s" min={0} max={beatLen} step={0.05} slider {...bind(p('t'), k.t)} hint="Seconds into the beat's animation." />
        <ToggleField label="Transition" on="Cut" off="Move" {...bind(p('cut'), k.cut)} testId="key-cut" />
        {!k.cut ? <SelectField label="Ease in" options={keyEaseOptions} {...bind<string>(p('ease'), k.ease)} /> : null}
      </Section>
      <Section title="Pose">
        <Vec3Field label="Position" step={0.01} {...bind(p('position'), k.position as [number, number, number])} />
        <Vec3Field label="Target" step={0.01} {...bind(p('target'), k.target as [number, number, number])} />
        <NumberField label="FOV °" min={5} max={100} step={0.5} slider {...bind(p('fov'), k.fov)} />
        <NumberField label="Roll °" min={-45} max={45} step={0.5} {...bind(p('roll'), k.roll)} />
      </Section>
    </>
  );
};

const NoteInspector: React.FC<InspectorProps & {readonly id: string}> = ({state, draft, id, timeline, camera, select}) => {
  const n = state.notes[id];
  if (!n) return <p className="se-empty">This note no longer exists.</p>;
  const f = keyFrame(timeline, n);
  return (
    <>
      <Head kicker={`Review note · frame ${f} · ${n.beat} +${n.t.toFixed(2)} s`} title={n.done ? 'Resolved note' : 'Note'} id={id}>
        <p className="se-purpose">Notes are saved with the shot (shot.json) and never rendered. Use them for feedback to address later, by you or by Claude.</p>
      </Head>
      <Section title="Note">
        <textarea className="se-textarea" value={n.text} placeholder="What should change here? e.g. the camera arrives too late; hold on the screen longer" onChange={(e) => draft.set(['notes', id, 'text'], e.target.value)} data-testid="note-text" autoFocus />
        <div className="se-row">
          <button type="button" className="se-btn se-btn-small" onClick={() => camera.seek(f)}>
            Go to note
          </button>
          <button type="button" className="se-btn se-btn-small" onClick={() => draft.set(['notes', id, 'done'], !n.done)} data-testid="note-done">
            {n.done ? 'Reopen' : 'Mark resolved'}
          </button>
          <button
            type="button"
            className="se-btn se-btn-small se-danger"
            onClick={() => {
              draft.reset(['notes', id]);
              select(null);
            }}
          >
            Delete
          </button>
        </div>
      </Section>
    </>
  );
};

/* ------------------------------------------------------------------ stage */

const StageInspector: React.FC<InspectorProps> = ({state, draft, applyPreset}) => {
  const bind = useBind(draft);
  const s = state.stage;
  const p = (...k: string[]): Path => ['stage', ...k];
  return (
    <>
      <Head kicker="Look" title="Lighting + stage">
        <p className="se-purpose">A preset sets the key / fill / rim / ambient rig, switches environment lights and sets bloom, fog and exposure. Fine-tune any light afterwards.</p>
      </Head>
      <Section title="Lighting presets">
        <div className="se-presets">
          {LIGHTING_PRESETS.map((pr) => (
            <button type="button" key={pr.id} className="se-preset" onClick={() => applyPreset(pr.id)} data-testid={`preset-${pr.id}`}>
              <strong>{pr.label}</strong>
              <span>{pr.description}</span>
            </button>
          ))}
        </div>
      </Section>
      <Section title="Glow">
        <ToggleField label="Bloom" {...bind(p('bloom', 'enabled'), s.bloom.enabled)} />
        <NumberField label="Strength" min={0} max={3} step={0.01} slider {...bind(p('bloom', 'strength'), s.bloom.strength)} />
        <NumberField label="Radius" min={0} max={1} step={0.01} slider {...bind(p('bloom', 'radius'), s.bloom.radius)} />
        <NumberField label="Threshold" min={0} max={2} step={0.01} slider {...bind(p('bloom', 'threshold'), s.bloom.threshold)} hint="Only colours brighter than this glow." />
      </Section>
      <Section title="Stage">
        <NumberField label="Exposure" min={0.2} max={3} step={0.01} slider {...bind(p('exposure'), s.exposure)} />
        <NumberField label="Fog" min={0} max={0.1} step={0.001} slider {...bind(p('fog'), s.fog)} />
        <ColorField label="Background" placeholder="theme void" {...bind(p('background'), s.background)} />
        <ToggleField label="Shadows" {...bind(p('shadows'), s.shadows)} />
        <ToggleField label="Grade" on="Vignette + grain" off="None" {...bind(p('grade'), s.grade)} />
      </Section>
    </>
  );
};

/* ------------------------------------------------------------------ beats + motions */

const BeatInspector: React.FC<InspectorProps & {readonly id: string}> = ({state, draft, id, timeline, select}) => {
  const bind = useBind(draft);
  const b = timeline.beatById.get(id);
  const beat = state.beats[id];
  if (!b || !beat) return <p className="se-empty">Unknown beat “{id}”.</p>;
  const p = (...k: string[]): Path => ['beats', id, ...k];
  const motions = Object.entries(state.motions).filter(([, m]) => m.beat === id);
  const animated = Array.from(new Set(motions.filter(([, m]) => m.kind === 'transform' && m.object).map(([, m]) => m.object!)));
  const move = state.camera.moves[id];
  return (
    <>
      <Head kicker={`Beat ${b.index + 1} of ${timeline.beats.length}`} title={b.label} id={id}>
        {b.notes ? <p className="se-purpose">{b.notes}</p> : null}
      </Head>
      <Section title="Frames">
        <dl className="se-frames" data-testid="beat-frames">
          <dt>Start</dt>
          <dd>{b.start}</dd>
          <dt>Checkpoint</dt>
          <dd>{b.animEnd}</dd>
          <dt>End (with hold)</dt>
          <dd>{b.end}</dd>
          <dt>fps</dt>
          <dd>{timeline.fps}</dd>
        </dl>
      </Section>
      <Section title="Timing">
        <NumberField label="Duration s" min={0.1} max={30} step={0.05} {...bind(p('duration'), beat.duration)} />
        <NumberField label="Export hold s" min={0} max={10} step={0.05} {...bind(p('hold'), beat.hold)} hint="Rendered MP4 only. The live presenter holds a checkpoint until you press →." />
      </Section>
      <Section title="What happens in this beat">
        {motions.length === 0 && !move ? <p className="se-empty">Nothing is cued in this beat.</p> : null}
        <ul className="se-list">
          {motions.map(([mid, m]) => (
            <li key={mid}>
              <button type="button" className="se-link" onClick={() => select({kind: 'motion', id: mid})}>
                {m.label}
              </button>
              <span className="se-dim">
                {m.kind} · {m.from.toFixed(2)}–{(m.until ?? beat.duration).toFixed(2)} s · {m.easing}
                {m.enabled ? '' : ' · off'}
              </span>
            </li>
          ))}
          {move ? (
            <li>
              <button type="button" className="se-link" onClick={() => select({kind: 'camera'})}>
                Camera move
              </button>
              <span className="se-dim">{state.camera.locked ? 'ignored: camera locked' : move.enabled ? 'plays' : 'off'}</span>
            </li>
          ) : null}
        </ul>
        {animated.length ? <p className="se-note">Objects animated: {animated.join(', ')}</p> : null}
      </Section>
    </>
  );
};

const MotionInspector: React.FC<InspectorProps & {readonly id: string}> = ({def, state, draft, id, timeline, select}) => {
  const bind = useBind(draft);
  const m = state.motions[id];
  if (!m) return <p className="se-empty">Unknown motion “{id}”.</p>;
  const p = (...k: string[]): Path => ['motions', id, ...k];
  const beatLen = state.beats[m.beat]?.duration ?? 1;
  const fromCode = Boolean(def.motions?.[id]);
  const to = m.to ?? {};
  return (
    <>
      <Head kicker={`Motion · ${m.kind === 'cue' ? 'cue (code reads its progress)' : `transform of ${m.object}`}`} title={m.label} id={id}>
        <button type="button" className="se-link" onClick={() => select({kind: 'beat', id: m.beat})}>
          in beat {m.beat}
        </button>
      </Head>
      <Section title="Timing">
        <ToggleField label="Enabled" {...bind(p('enabled'), m.enabled)} />
        <SelectField label="Beat" options={timeline.beats.map((b) => ({value: b.id, label: b.label}))} {...bind(p('beat'), m.beat)} />
        <NumberField label="Start s" min={0} max={beatLen} step={0.05} slider {...bind(p('from'), m.from)} hint="Seconds into the beat." />
        <NumberField label="End s" min={0} max={beatLen} step={0.05} slider {...bind(p('until'), m.until ?? beatLen)} />
        <SelectField label="Easing" options={easingOptions} {...bind<string>(p('easing'), m.easing)} />
      </Section>
      {m.kind === 'transform' ? (
        <Section title="Target" aside={fromCode ? null : <button type="button" className="se-btn se-btn-small se-danger" onClick={() => { draft.reset(['motions', id]); select(m.object ? {kind: 'object', id: m.object} : null); }}>Delete motion</button>}>
          <Vec3Field label="Position" {...bind(p('to', 'position'), (to.position ?? state.objects[m.object ?? '']?.position ?? [0, 0, 0]) as [number, number, number])} />
          <Vec3Field label="Rotation °" step={1} {...bind(p('to', 'rotation'), (to.rotation ?? state.objects[m.object ?? '']?.rotation ?? [0, 0, 0]) as [number, number, number])} />
          <NumberField label="Scale" min={0.01} max={10} step={0.01} {...bind(p('to', 'scale'), to.scale ?? state.objects[m.object ?? '']?.scale ?? 1)} />
          <NumberField label="Opacity" min={0} max={1} step={0.01} slider {...bind(p('to', 'opacity'), to.opacity ?? state.objects[m.object ?? '']?.opacity ?? 1)} />
          <SelectField
            label="Visibility"
            options={[
              {value: 'keep', label: 'Unchanged'},
              {value: 'show', label: 'Appears when it starts'},
              {value: 'hide', label: 'Disappears when it ends'},
            ]}
            value={to.visible === undefined ? 'keep' : to.visible ? 'show' : 'hide'}
            modified={to.visible !== undefined}
            onReset={() => draft.reset(p('to', 'visible'))}
            onChange={(v) => (v === 'keep' ? draft.reset(p('to', 'visible')) : draft.set(p('to', 'visible'), v === 'show'))}
          />
        </Section>
      ) : (
        <p className="se-note">What this cue does is code (see the scene file); here you choose when and how fast.</p>
      )}
    </>
  );
};
