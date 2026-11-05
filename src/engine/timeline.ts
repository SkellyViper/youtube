import type {EpisodeDef, Timeline, TimedBeat, TimedScene} from './types';

/**
 * Pure, deterministic conversion of an episode definition (seconds) into a
 * frame-accurate timeline. Presentation mode, export mode, the developer HUD
 * and the tests all derive from this single function.
 *
 * Layout of one beat on the timeline:
 *
 *   start ─── animation (duration) ───► animEnd ─── hold ───► end (= next start)
 *
 * Every visual is a pure function of beat progress, and beat progress is
 * clamped to [0, 1], so every frame in [animEnd, nextStart] renders exactly
 * the completed state. Presentation mode can therefore rest on `animEnd` and
 * later jump to `nextStart` without any visible change.
 */
export const buildTimeline = (episode: EpisodeDef, fps: number): Timeline => {
  if (!Number.isFinite(fps) || fps <= 0) {
    throw new Error(`Invalid fps: ${fps}`);
  }
  const toFrames = (seconds: number) => Math.max(0, Math.round(seconds * fps));

  const defaultHold = episode.defaultHold ?? 1;
  const beats: TimedBeat[] = [];
  const scenes: TimedScene[] = [];
  const seenIds = new Set<string>();

  let cursor = toFrames(episode.leadIn ?? 0);

  episode.scenes.forEach((scene, sceneIndex) => {
    if (seenIds.has(scene.id)) {
      throw new Error(`Duplicate scene/beat id "${scene.id}" in episode "${episode.id}"`);
    }
    seenIds.add(scene.id);
    if (scene.beats.length === 0) {
      throw new Error(`Scene "${scene.id}" has no beats`);
    }
    const sceneStart = sceneIndex === 0 ? 0 : cursor;
    const firstBeat = beats.length;

    scene.beats.forEach((beat, indexInScene) => {
      if (seenIds.has(beat.id)) {
        throw new Error(`Duplicate scene/beat id "${beat.id}" in episode "${episode.id}"`);
      }
      seenIds.add(beat.id);
      const durationInFrames = Math.max(1, toFrames(beat.duration));
      const holdInFrames = toFrames(beat.hold ?? defaultHold);
      const start = cursor;
      const animEnd = start + durationInFrames;
      const end = animEnd + holdInFrames;
      beats.push({
        index: beats.length,
        id: beat.id,
        label: beat.label ?? beat.id,
        notes: beat.notes ?? '',
        auto: beat.auto ?? false,
        sceneId: scene.id,
        sceneIndex,
        indexInScene,
        start,
        animEnd,
        end,
        durationInFrames,
        holdInFrames,
      });
      cursor = end;
    });

    scenes.push({
      index: sceneIndex,
      id: scene.id,
      title: scene.title,
      start: sceneStart,
      end: cursor,
      firstBeat,
      lastBeat: beats.length - 1,
    });
  });

  if (beats.length === 0) {
    throw new Error(`Episode "${episode.id}" has no beats`);
  }

  const last = beats[beats.length - 1];
  // At least one frame after the final checkpoint so that it is a valid
  // frame (< durationInFrames) and a valid Player `outFrame`.
  const durationInFrames = Math.max(cursor + toFrames(episode.tail ?? 0), last.animEnd + 1);

  // The final scene extends to the end of the video (tail included).
  const lastScene = scenes[scenes.length - 1];
  scenes[scenes.length - 1] = {...lastScene, end: durationInFrames};

  const checkpoints = [0, ...beats.map((b) => b.animEnd)];

  return {
    episodeId: episode.id,
    fps,
    durationInFrames,
    beats,
    scenes,
    checkpoints,
    beatById: new Map(beats.map((b) => [b.id, b])),
    sceneById: new Map(scenes.map((s) => [s.id, s])),
  };
};

/** Resolve a scene id or beat id to a frame range [start, end). */
export const resolveRange = (
  timeline: Timeline,
  from: string | undefined,
  to: string | undefined,
): {start: number; end: number} => {
  const lookup = (id: string) => {
    const scene = timeline.sceneById.get(id);
    if (scene) return {start: scene.start, end: scene.end};
    const beat = timeline.beatById.get(id);
    if (beat) return {start: beat.start, end: beat.end};
    throw new Error(`Unknown scene or beat id "${id}" in episode "${timeline.episodeId}"`);
  };
  const start = from === undefined ? 0 : lookup(from).start;
  let end = to === undefined ? timeline.durationInFrames : lookup(to).end;
  // A range ending on the final beat/scene runs to the end of the video.
  if (end >= timeline.beats[timeline.beats.length - 1].end) {
    end = timeline.durationInFrames;
  }
  if (end <= start) {
    throw new Error(`Empty range from "${from}" to "${to}"`);
  }
  return {start, end};
};

/** Which beat a frame belongs to (the beat whose [start, end) contains it). -1 during lead-in. */
export const beatIndexAtFrame = (timeline: Timeline, frame: number): number => {
  const {beats} = timeline;
  if (frame < beats[0].start) return -1;
  for (let i = beats.length - 1; i >= 0; i--) {
    if (frame >= beats[i].start) return i;
  }
  return -1;
};

/** Which scene a frame belongs to. */
export const sceneIndexAtFrame = (timeline: Timeline, frame: number): number => {
  const {scenes} = timeline;
  for (let i = scenes.length - 1; i >= 0; i--) {
    if (frame >= scenes[i].start) return i;
  }
  return 0;
};

/** The checkpoint index that best describes a frame (number of completed beats). */
export const checkpointAtFrame = (timeline: Timeline, frame: number): number => {
  let c = 0;
  for (let i = 1; i < timeline.checkpoints.length; i++) {
    if (frame >= timeline.checkpoints[i]) c = i;
  }
  return c;
};

export const timelineSeconds = (timeline: Timeline) => timeline.durationInFrames / timeline.fps;
