import {beatClock} from '../engine/beat';
import type {EpisodeDef, Timeline} from '../engine/types';
import {EASINGS} from './easing';
import {deepMerge} from './patch';
import type {
  CameraMove,
  CameraState,
  EdgeLook,
  LightState,
  MotionState,
  ObjectState,
  ShotDef,
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

  const {moves = {}, ...cam} = def.camera;
  const base: CameraState = {...DEFAULT_CAMERA, ...cam, moves: {}};
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
  const {moves: moveOver, ...camOver} = patch.camera ?? {};
  const camera = deepMerge({...code.camera, moves: {}}, camOver) as CameraState;
  const moves: Record<string, CameraMove> = {...code.camera.moves};
  for (const [beat, m] of Object.entries(moveOver ?? {})) {
    if (!code.beats[beat]) continue;
    moves[beat] = deepMerge(moves[beat] ?? {position: camera.position, target: camera.target, fov: camera.fov, ...DEFAULT_MOVE}, m);
  }
  return {
    objects: pick(code.objects, patch.objects),
    lights: pick(code.lights, patch.lights),
    camera: {...camera, moves},
    stage: deepMerge(code.stage, patch.stage),
    beats: pick(code.beats, patch.beats),
    motions,
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

/** Camera pose at a frame: fixed when locked, else the beat-bound moves from the base pose. */
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
