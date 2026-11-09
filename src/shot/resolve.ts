import {beatClock} from '../engine/beat';
import {activeTimeAt} from '../engine/hooks';
import type {EpisodeDef, Timeline} from '../engine/types';
import {EASINGS} from './easing';
import {deepMerge} from './patch';
import type {
  CameraKey,
  CameraMode,
  CameraMove,
  CameraPatch,
  CameraState,
  EdgeLook,
  LightState,
  MotionState,
  ObjectState,
  ShotDef,
  ShotNote,
  ShotPatch,
  ShotState,
  StageState,
  Vec3,
} from './types';

/* ------------------------------------------------------------------ generic defaults */

export const DEFAULT_EDGES: EdgeLook = {enabled: false, color: '#2E9BFF', intensity: 1.5, threshold: 35};

export const DEFAULT_OBJECT: ObjectState = {
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: 1,
  visible: true,
  opacity: 1,
  variant: '',
  materials: {},
  edges: DEFAULT_EDGES,
};

export const DEFAULT_LIGHT: Omit<LightState, 'kind'> = {
  enabled: true,
  color: '#ffffff',
  groundColor: '#04050A',
  intensity: 1,
  position: [0, 4, 4],
  target: [0, 0, 0],
  castShadow: false,
  angle: 40,
  penumbra: 0.5,
  distance: 0,
};

/** New shots: a locked camera. */
export const DEFAULT_CAMERA: CameraState = {
  locked: true,
  projection: 'perspective',
  position: [0, 1.6, 6],
  target: [0, 1, 0],
  fov: 34,
  orthoHeight: 4,
  roll: 0,
  moves: {},
  mode: 'locked',
  keys: {},
  angles: {},
};

export const DEFAULT_KEY: Omit<CameraKey, 'beat' | 'position' | 'target' | 'fov'> = {t: 0, roll: 0, ease: 'inOut', cut: false, label: ''};

/**
 * The camera mode in effect. An explicit `mode` wins; the older `locked`
 * switch still works (true = locked); otherwise keys, if there are any;
 * otherwise the definition's default.
 */
export const effectiveCameraMode = (def: ShotDef, patch: CameraPatch | undefined, hasKeys: boolean): CameraMode => {
  if (patch?.mode) return patch.mode;
  if (patch?.locked === true) return 'locked';
  if (hasKeys) return 'keys';
  if (patch?.locked === false) return def.camera.mode && def.camera.mode !== 'locked' ? def.camera.mode : 'code';
  if (def.camera.mode) return def.camera.mode;
  return (def.camera.locked ?? DEFAULT_CAMERA.locked) ? 'locked' : 'code';
};

export const DEFAULT_STAGE: StageState = {
  exposure: 1,
  bloom: {enabled: true, strength: 0.85, radius: 0.72, threshold: 0.92},
  fog: 0.018,
  background: '',
  shadows: false,
  grade: true,
};

const DEFAULT_MOVE: Omit<CameraMove, 'position' | 'target' | 'fov'> = {enabled: true, from: 0, until: null, easing: 'camera'};
const DEFAULT_MOTION: Omit<MotionState, 'beat' | 'label'> = {kind: 'cue', from: 0, until: null, easing: 'inOut', enabled: true};

/* ------------------------------------------------------------------ code defaults */

/** The state a shot has with an empty patch: what the code alone says. */
export const codeState = (def: ShotDef, episode: EpisodeDef): ShotState => {
  const objects: Record<string, ObjectState> = {};
  for (const [id, o] of Object.entries(def.objects)) {
    const {edges, ...rest} = o.defaults ?? {};
    objects[id] = {
      ...DEFAULT_OBJECT,
      variant: o.variants?.[0]?.id ?? '',
      position: o.pivot ?? DEFAULT_OBJECT.position,
      ...rest,
      materials: {},
      edges: {...DEFAULT_EDGES, ...edges},
    };
  }
  const lights: Record<string, LightState> = {};
  for (const [id, l] of Object.entries(def.lights)) lights[id] = {...DEFAULT_LIGHT, ...l.defaults};

  const {moves = {}, mode: _mode, angles = {}, ...cam} = def.camera;
  const base: CameraState = {...DEFAULT_CAMERA, ...cam, moves: {}, keys: {}, angles: {...angles}, mode: effectiveCameraMode(def, undefined, false)};
  const camMoves: Record<string, CameraMove> = {};
  for (const [beat, m] of Object.entries(moves)) camMoves[beat] = {position: base.position, target: base.target, fov: base.fov, ...DEFAULT_MOVE, ...m};

  const beats: Record<string, ShotState['beats'][string]> = {};
  for (const scene of episode.scenes) for (const b of scene.beats) beats[b.id] = {duration: b.duration, hold: b.hold ?? episode.defaultHold ?? 1};

  const motions: Record<string, MotionState> = {};
  for (const [id, m] of Object.entries(def.motions ?? {})) motions[id] = {...DEFAULT_MOTION, ...m};

  const {bloom, ...stage} = def.stage ?? {};
  return {
    objects,
    lights,
    camera: {...base, moves: camMoves},
    stage: {...DEFAULT_STAGE, ...stage, bloom: {...DEFAULT_STAGE.bloom, ...bloom}},
    beats,
    motions,
    notes: {},
  };
};

/**
 * Effective state: code defaults <- patch. Unknown object / light / beat ids
 * in the patch are ignored; motions may be added by a patch (transform
 * motions created in the editor) and are completed with defaults.
 */
export const resolveShot = (def: ShotDef, episode: EpisodeDef, patch: ShotPatch | undefined): ShotState => {
  const code = codeState(def, episode);
  if (!patch) return code;
  const pick = <T>(base: Readonly<Record<string, T>>, over: Record<string, unknown> | undefined): Record<string, T> => {
    const out: Record<string, T> = {...base};
    for (const [id, v] of Object.entries(over ?? {})) if (id in base) out[id] = deepMerge(base[id], v);
    return out;
  };
  const motions: Record<string, MotionState> = {...code.motions};
  for (const [id, m] of Object.entries(patch.motions ?? {})) {
    if (id in code.motions) motions[id] = deepMerge(code.motions[id], m);
    else if (m.beat && code.beats[m.beat]) motions[id] = {...DEFAULT_MOTION, kind: 'transform', label: id, ...m, beat: m.beat} as MotionState;
  }
  const {moves: moveOver, keys: keyOver, angles: angleOver, mode: _mode, ...camOver} = patch.camera ?? {};
  const camera = deepMerge({...code.camera, moves: {}}, camOver) as CameraState;
  const keys: Record<string, CameraKey> = {};
  for (const [id, k] of Object.entries(keyOver ?? {})) {
    if (!k || !code.beats[k.beat]) continue;
    keys[id] = {position: camera.position, target: camera.target, fov: camera.fov, ...DEFAULT_KEY, ...(k as Partial<CameraKey>), beat: k.beat};
  }
  const notes: Record<string, ShotNote> = {};
  for (const [id, n] of Object.entries(patch.notes ?? {})) if (n && code.beats[n.beat]) notes[id] = {text: '', done: false, t: 0, ...(n as Partial<ShotNote>), beat: n.beat};
  const moves: Record<string, CameraMove> = {...code.camera.moves};
  for (const [beat, m] of Object.entries(moveOver ?? {})) {
    if (!code.beats[beat]) continue;
    moves[beat] = deepMerge(moves[beat] ?? {position: camera.position, target: camera.target, fov: camera.fov, ...DEFAULT_MOVE}, m);
  }
  return {
    objects: pick(code.objects, patch.objects),
    lights: pick(code.lights, patch.lights),
    camera: {...camera, moves, keys, angles: {...code.camera.angles, ...(angleOver ?? {})}, mode: effectiveCameraMode(def, patch.camera, Object.keys(keys).length > 0)},
    stage: deepMerge(code.stage, patch.stage),
    beats: pick(code.beats, patch.beats),
    motions,
    notes,
  };
};

/** The episode with the patch's beat durations / holds applied (timing edits change the timeline). */
export const applyShotBeats = (episode: EpisodeDef, patch: ShotPatch | undefined): EpisodeDef => {
  const beats = patch?.beats;
  if (!beats || Object.keys(beats).length === 0) return episode;
  return {
    ...episode,
    scenes: episode.scenes.map((s) => ({
      ...s,
      beats: s.beats.map((b) => {
        const p = beats[b.id];
        return p ? {...b, duration: p.duration ?? b.duration, hold: p.hold ?? b.hold} : b;
      }),
    })),
  };
};

/* ------------------------------------------------------------------ evaluation */

/** 0..1 progress of a motion at an absolute frame (0 before, 1 after). Disabled motions stay at 0. */
export const motionProgress = (m: MotionState, timeline: Timeline, frame: number): number => {
  if (!m.enabled || !timeline.beatById.has(m.beat)) return 0;
  const clock = beatClock(timeline, m.beat, frame);
  const until = m.until ?? clock.duration;
  return clock.at(Math.min(m.from, until), until, EASINGS[m.easing]);
};

const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Transform motions that act on `objectId`, in timeline order. */
export const motionsFor = (state: ShotState, objectId: string, timeline: Timeline): [string, MotionState][] =>
  Object.entries(state.motions)
    .filter(([, m]) => m.kind === 'transform' && m.object === objectId && m.to && timeline.beatById.has(m.beat))
    .sort(([, a], [, b]) => timeline.beatById.get(a.beat)!.start + a.from * timeline.fps - (timeline.beatById.get(b.beat)!.start + b.from * timeline.fps));

/** An object's state at a frame: its configured state with its transform motions applied. */
export const objectAt = (state: ShotState, objectId: string, timeline: Timeline, frame: number): ObjectState => {
  let o = state.objects[objectId];
  if (!o) return DEFAULT_OBJECT;
  for (const [, m] of motionsFor(state, objectId, timeline)) {
    const p = motionProgress(m, timeline, frame);
    if (p <= 0) continue;
    const to = m.to!;
    o = {
      ...o,
      position: to.position ? lerp3(o.position, to.position, p) : o.position,
      rotation: to.rotation ? lerp3(o.rotation, to.rotation, p) : o.rotation,
      scale: to.scale !== undefined ? o.scale + (to.scale - o.scale) * p : o.scale,
      opacity: to.opacity !== undefined ? o.opacity + (to.opacity - o.opacity) * p : o.opacity,
      // Visibility is a state change: it flips when the motion starts (show) or completes (hide).
      visible: to.visible === undefined ? o.visible : to.visible ? true : p >= 1 ? false : o.visible,
    };
  }
  return o;
};

/* ------------------------------------------------------------------ camera track */

export type CameraPose = {readonly position: Vec3; readonly target: Vec3; readonly fov: number; readonly roll: number};

/** Seconds of animation before a beat starts (holds excluded): the camera track's clock. */
export const beatActiveStart = (timeline: Timeline, beatId: string): number => {
  let frames = 0;
  for (const b of timeline.beats) {
    if (b.id === beatId) return frames / timeline.fps;
    frames += b.durationInFrames;
  }
  return frames / timeline.fps;
};

const beatSeconds = (timeline: Timeline, beatId: string) => (timeline.beatById.get(beatId)?.durationInFrames ?? 0) / timeline.fps;

/** A key's position on the animation clock (seconds). */
export const keyActiveTime = (timeline: Timeline, k: {beat: string; t: number}): number => beatActiveStart(timeline, k.beat) + Math.min(Math.max(0, k.t), beatSeconds(timeline, k.beat));

/** The export frame a key (or note) sits on. */
export const keyFrame = (timeline: Timeline, k: {beat: string; t: number}): number => {
  const b = timeline.beatById.get(k.beat);
  if (!b) return 0;
  return b.start + Math.round(Math.min(Math.max(0, k.t), b.durationInFrames / timeline.fps) * timeline.fps);
};

/** (beat, seconds into its animation) for an export frame. Frames in a hold map to the beat's end; the lead-in to the first beat's start. */
export const frameToBeatTime = (timeline: Timeline, frame: number): {beat: string; t: number} => {
  const beats = timeline.beats;
  let b = beats[0];
  for (const x of beats) if (frame >= x.start) b = x;
  const local = Math.min(Math.max(0, frame - b.start), b.durationInFrames);
  return {beat: b.id, t: Math.round((local / timeline.fps) * 1000) / 1000};
};

/** Keys in time order (ties: cuts last, so a cut at t lands on the new shot). */
export const sortedKeys = (cam: CameraState, timeline: Timeline): [string, CameraKey][] =>
  Object.entries(cam.keys)
    .filter(([, k]) => timeline.beatById.has(k.beat))
    .sort(([, a], [, b]) => keyActiveTime(timeline, a) - keyActiveTime(timeline, b) || Number(a.cut) - Number(b.cut));

const catmull = (p0: number, p1: number, p2: number, p3: number, s: number) =>
  0.5 * (2 * p1 + (-p0 + p2) * s + (2 * p0 - 5 * p1 + 4 * p2 - p3) * s * s + (-p0 + 3 * p1 - 3 * p2 + p3) * s * s * s);
const catmull3 = (a: Vec3, b: Vec3, c: Vec3, d: Vec3, s: number): Vec3 => [catmull(a[0], b[0], c[0], d[0], s), catmull(a[1], b[1], c[1], d[1], s), catmull(a[2], b[2], c[2], d[2], s)];

/**
 * The keyed camera at a frame. Before the first key: the first key. Between
 * key i and key j: a cut holds i until j's time; otherwise j's ease blends
 * i -> j (`smooth` follows a Catmull-Rom path through the neighbours that
 * belong to the same shot). Driven by the animation clock, so holds freeze.
 */
export const keysPoseAt = (cam: CameraState, timeline: Timeline, frame: number): CameraPose | null => {
  const list = sortedKeys(cam, timeline).map(([, k]) => k);
  if (list.length === 0) return null;
  const T = activeTimeAt(timeline, frame);
  const time = list.map((k) => keyActiveTime(timeline, k));
  let i = -1;
  for (let n = 0; n < list.length; n++) if (time[n] <= T + 1e-9) i = n;
  const pose = (k: CameraKey): CameraPose => ({position: k.position, target: k.target, fov: k.fov, roll: k.roll});
  if (i < 0) return pose(list[0]);
  const j = i + 1;
  if (j >= list.length || list[j].cut || time[j] - time[i] < 1e-6) return pose(list[i]);
  const a = list[i];
  const b = list[j];
  const raw = (T - time[i]) / (time[j] - time[i]);
  if (b.ease === 'smooth') {
    const prev = i > 0 && !a.cut ? list[i - 1] : a;
    const next = j + 1 < list.length && !list[j + 1].cut ? list[j + 1] : b;
    return {
      position: catmull3(prev.position, a.position, b.position, next.position, raw),
      target: catmull3(prev.target, a.target, b.target, next.target, raw),
      fov: a.fov + (b.fov - a.fov) * raw,
      roll: a.roll + (b.roll - a.roll) * raw,
    };
  }
  const p = EASINGS[b.ease](Math.min(1, Math.max(0, raw)));
  return {position: lerp3(a.position, b.position, p), target: lerp3(a.target, b.target, p), fov: a.fov + (b.fov - a.fov) * p, roll: a.roll + (b.roll - a.roll) * p};
};

/**
 * The shot camera at a frame, for every mode. `code` uses the scene's own
 * camera when it has one (`codePose`), else the definition's beat moves.
 */
export const shotCameraAt = (cam: CameraState, timeline: Timeline, frame: number, codePose?: CameraPose | null): CameraPose => {
  if (cam.mode === 'locked') return {position: cam.position, target: cam.target, fov: cam.fov, roll: cam.roll};
  if (cam.mode === 'keys') {
    const k = keysPoseAt(cam, timeline, frame);
    if (k) return k;
  }
  if (codePose) return codePose;
  const m = cameraAt({...cam, locked: false}, timeline, frame);
  return {...m, roll: cam.roll};
};

/** The beat-bound moves of the definition (the "code" camera of scenes written as shots). */
export const cameraAt = (cam: CameraState, timeline: Timeline, frame: number): {position: Vec3; target: Vec3; fov: number} => {
  let pose = {position: cam.position, target: cam.target, fov: cam.fov};
  if (cam.locked) return pose;
  const moves = Object.entries(cam.moves)
    .filter(([beat, m]) => m.enabled && timeline.beatById.has(beat))
    .sort(([a], [b]) => timeline.beatById.get(a)!.start - timeline.beatById.get(b)!.start);
  for (const [beat, m] of moves) {
    const clock = beatClock(timeline, beat, frame);
    const until = m.until ?? clock.duration;
    const p = clock.at(Math.min(m.from, until), until, EASINGS[m.easing]);
    if (p <= 0) continue;
    pose = {position: lerp3(pose.position, m.position, p), target: lerp3(pose.target, m.target, p), fov: pose.fov + (m.fov - pose.fov) * p};
  }
  return pose;
};
