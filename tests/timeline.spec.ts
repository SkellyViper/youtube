import {expect, test} from '@playwright/test';
import {beatClock} from '../src/engine/beat';
import {activeTimeAt} from '../src/engine/hooks';
import {beatIndexAtFrame, buildTimeline, checkpointAtFrame, resolveRange, sceneIndexAtFrame} from '../src/engine/timeline';
import {evaluateScalarTrack, evaluateTrack} from '../src/engine/track';
import type {EpisodeDef} from '../src/engine/types';
import {notDetectedEpisode} from '../src/videos/not-detected/episode';

/** Pure engine tests: no browser involved. */

const episode: EpisodeDef = {
  id: 'Synthetic',
  title: 'Synthetic',
  leadIn: 0.5,
  defaultHold: 1,
  tail: 0.25,
  scenes: [
    {
      id: 'a',
      title: 'A',
      beats: [
        {id: 'a1', duration: 1},
        {id: 'a2', duration: 0.5, hold: 2},
      ],
    },
    {
      id: 'b',
      title: 'B',
      beats: [
        {id: 'b1', duration: 2, hold: 0},
        {id: 'b2', duration: 1.5, auto: true},
      ],
    },
  ],
};

test.describe('buildTimeline', () => {
  test('frame math at 60 fps', () => {
    const t = buildTimeline(episode, 60);
    expect(t.beats.map((b) => [b.start, b.animEnd, b.end])).toEqual([
      [30, 90, 150],
      [150, 180, 300],
      [300, 420, 420],
      [420, 510, 570],
    ]);
    expect(t.checkpoints).toEqual([0, 90, 180, 420, 510]);
    // 570 (last end) + 15 (tail)
    expect(t.durationInFrames).toBe(585);
    expect(t.beats[3].auto).toBe(true);
  });

  test('same timing at 30 fps (half the frames)', () => {
    const t60 = buildTimeline(episode, 60);
    const t30 = buildTimeline(episode, 30);
    t30.beats.forEach((b, i) => {
      expect(b.start * 2).toBe(t60.beats[i].start);
      expect(b.animEnd * 2).toBe(t60.beats[i].animEnd);
    });
    expect(t30.durationInFrames / 30).toBeCloseTo(t60.durationInFrames / 60, 1);
  });

  test('beats are contiguous and checkpoints are valid frames', () => {
    for (const fps of [24, 30, 60]) {
      const t = buildTimeline(notDetectedEpisode, fps);
      for (let i = 1; i < t.beats.length; i++) {
        expect(t.beats[i].start).toBe(t.beats[i - 1].end);
      }
      for (const b of t.beats) {
        expect(b.animEnd - b.start).toBe(b.durationInFrames);
        expect(b.end - b.animEnd).toBe(b.holdInFrames);
        expect(b.durationInFrames).toBeGreaterThan(0);
      }
      expect(t.checkpoints[0]).toBe(0);
      expect(t.checkpoints.length).toBe(t.beats.length + 1);
      // Every checkpoint must be a renderable frame and a valid Player outFrame.
      expect(t.checkpoints[t.checkpoints.length - 1]).toBeLessThanOrEqual(t.durationInFrames - 1);
      // Scenes tile the timeline.
      expect(t.scenes[0].start).toBe(0);
      for (let i = 1; i < t.scenes.length; i++) expect(t.scenes[i].start).toBe(t.scenes[i - 1].end);
      expect(t.scenes[t.scenes.length - 1].end).toBe(t.durationInFrames);
    }
  });

  test('scene end extends to the end of the video', () => {
    const t = buildTimeline(episode, 60);
    expect(t.scenes.map((s) => [s.start, s.end])).toEqual([
      [0, 300],
      [300, 585],
    ]);
  });

  test('final checkpoint is always < durationInFrames even with zero hold/tail', () => {
    const t = buildTimeline(
      {id: 'z', title: 'z', scenes: [{id: 's', title: 's', beats: [{id: 'x', duration: 1, hold: 0}]}]},
      60,
    );
    expect(t.checkpoints[1]).toBe(60);
    expect(t.durationInFrames).toBe(61);
  });

  test('duplicate ids are rejected (scene and beat ids share a namespace)', () => {
    expect(() =>
      buildTimeline({id: 'd', title: 'd', scenes: [{id: 'x', title: 'x', beats: [{id: 'x', duration: 1}]}]}, 60),
    ).toThrow(/Duplicate/);
    expect(() =>
      buildTimeline(
        {
          id: 'd',
          title: 'd',
          scenes: [
            {id: 's1', title: '1', beats: [{id: 'b', duration: 1}]},
            {id: 's2', title: '2', beats: [{id: 'b', duration: 1}]},
          ],
        },
        60,
      ),
    ).toThrow(/Duplicate/);
  });

  test('empty scenes / invalid fps are rejected', () => {
    expect(() => buildTimeline({id: 'e', title: 'e', scenes: [{id: 's', title: 's', beats: []}]}, 60)).toThrow();
    expect(() => buildTimeline(episode, 0)).toThrow();
  });

  test('resolveRange accepts scene and beat ids', () => {
    const t = buildTimeline(episode, 60);
    expect(resolveRange(t, undefined, undefined)).toEqual({start: 0, end: 585});
    expect(resolveRange(t, 'a', 'a')).toEqual({start: 0, end: 300});
    expect(resolveRange(t, 'a2', 'b1')).toEqual({start: 150, end: 420});
    // Ending on the last beat runs to the end of the video (tail included).
    expect(resolveRange(t, 'b', 'b2')).toEqual({start: 300, end: 585});
    expect(() => resolveRange(t, 'nope', undefined)).toThrow(/Unknown/);
  });

  test('frame lookups', () => {
    const t = buildTimeline(episode, 60);
    expect(beatIndexAtFrame(t, 0)).toBe(-1);
    expect(beatIndexAtFrame(t, 30)).toBe(0);
    expect(beatIndexAtFrame(t, 149)).toBe(0);
    expect(beatIndexAtFrame(t, 150)).toBe(1);
    expect(sceneIndexAtFrame(t, 299)).toBe(0);
    expect(sceneIndexAtFrame(t, 300)).toBe(1);
    expect(checkpointAtFrame(t, 89)).toBe(0);
    expect(checkpointAtFrame(t, 90)).toBe(1);
    expect(checkpointAtFrame(t, 584)).toBe(4);
  });
});

test.describe('beatClock', () => {
  const t = buildTimeline(episode, 60);

  test('progress is clamped: hold frames equal the completed state', () => {
    const b = t.beatById.get('a1')!;
    for (let f = 0; f <= b.start; f++) {
      const c = beatClock(t, 'a1', f);
      expect(c.progress).toBe(0);
      expect(c.at(0, 1)).toBe(0);
    }
    const done = beatClock(t, 'a1', b.animEnd);
    for (let f = b.animEnd; f <= t.durationInFrames; f++) {
      const c = beatClock(t, 'a1', f);
      expect(c.progress).toBe(1);
      expect(c.done).toBe(true);
      expect(c.frame).toBe(done.frame);
      expect(c.at(0.2, 0.9)).toBe(1);
      expect(c.spring(0.1)).toBe(1);
      expect(c.stagger(3, {start: 0.1, each: 0.05, dur: 0.4})).toBe(1);
    }
    expect(beatClock(t, 'a1', b.start + 30).progress).toBeCloseTo(0.5, 5);
  });

  test('spring reaches exactly 1 at its settle time and is 0 before its delay', () => {
    const b = t.beatById.get('b1')!; // 2s = 120 frames
    expect(beatClock(t, 'b1', b.start + 30).spring(0.5)).toBe(0);
    expect(beatClock(t, 'b1', b.start + 30 + 60).spring(0.5, {duration: 1})).toBe(1);
    const mid = beatClock(t, 'b1', b.start + 60).spring(0.5, {duration: 1});
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1.2);
  });

  test('at() is eased and monotonic over its sub-range', () => {
    const b = t.beatById.get('b1')!;
    let prev = -1;
    for (let f = b.start; f <= b.animEnd; f++) {
      const v = beatClock(t, 'b1', f).at(0.5, 1.5, (x) => x * x);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
    expect(beatClock(t, 'b1', b.start + 60).at(0.5, 1.5, (x) => x * x)).toBeCloseTo(0.25, 5);
  });

  test('unknown beat throws', () => {
    expect(() => beatClock(t, 'missing', 0)).toThrow(/Unknown beat/);
  });
});

test.describe('evaluateTrack', () => {
  const t = buildTimeline(episode, 60);
  const segments = [
    {beat: 'a1', to: [10, 100]},
    {beat: 'b1', to: [20, 0]},
  ];

  test('applies segments in sequence and holds between them', () => {
    const at = (f: number) => evaluateTrack(t, f, [0, 0], segments);
    const a1 = t.beatById.get('a1')!;
    const b1 = t.beatById.get('b1')!;
    expect(at(0)).toEqual([0, 0]);
    expect(at(a1.start)).toEqual([0, 0]);
    expect(at(a1.start + 30)[0]).toBeCloseTo(5, 5);
    // Held exactly between the two segments.
    for (const f of [a1.animEnd, a1.end, b1.start]) expect(at(f)).toEqual([10, 100]);
    // Second segment blends from the first segment's result.
    const mid = at(b1.start + b1.durationInFrames / 2);
    expect(mid[0]).toBeCloseTo(15, 5);
    expect(mid[1]).toBeCloseTo(50, 5);
    expect(at(b1.animEnd)).toEqual([20, 0]);
    expect(at(t.durationInFrames - 1)).toEqual([20, 0]);
  });

  test('scalar track with sub-range and easing', () => {
    const a2 = t.beatById.get('a2')!; // 0.5 s = 30 frames
    const v = (f: number) =>
      evaluateScalarTrack(t, f, 1, [{beat: 'a2', to: 3, from: 0.25, until: 0.5, easing: (x) => x}]);
    expect(v(a2.start + 10)).toBe(1);
    expect(v(a2.start + 15)).toBe(1);
    expect(v(a2.start + 22.5)).toBeCloseTo(2, 5);
    expect(v(a2.animEnd)).toBe(3);
  });
});

test.describe('activeTimeAt (ambient motion clock)', () => {
  const t = buildTimeline(episode, 60);

  test('advances while beats play and stands still during lead-in and holds', () => {
    // beats: a1 [30..90], a2 [150..180], b1 [300..420], b2 [420..510]
    expect(activeTimeAt(t, 0)).toBe(0);
    expect(activeTimeAt(t, 30)).toBe(0);
    expect(activeTimeAt(t, 60)).toBeCloseTo(0.5, 6);
    expect(activeTimeAt(t, 90)).toBeCloseTo(1, 6);
    expect(activeTimeAt(t, 120)).toBeCloseTo(1, 6);
    expect(activeTimeAt(t, 165)).toBeCloseTo(1.25, 6);
    expect(activeTimeAt(t, 180)).toBeCloseTo(1.5, 6);
    expect(activeTimeAt(t, 360)).toBeCloseTo(2.5, 6);
    expect(activeTimeAt(t, 510)).toBeCloseTo(5, 6);
    expect(activeTimeAt(t, t.durationInFrames - 1)).toBeCloseTo(5, 6);
  });

  test('a checkpoint and the next beat start share the same value (invisible jump in presentation)', () => {
    for (const fps of [24, 30, 60]) {
      const tl = buildTimeline(notDetectedEpisode, fps);
      for (let i = 0; i < tl.beats.length - 1; i++) {
        expect(activeTimeAt(tl, tl.beats[i].animEnd)).toBe(activeTimeAt(tl, tl.beats[i + 1].start));
      }
      // Monotonic.
      let prev = -1;
      for (let f = 0; f < tl.durationInFrames; f += 7) {
        const v = activeTimeAt(tl, f);
        expect(v).toBeGreaterThanOrEqual(prev);
        prev = v;
      }
    }
  });
});

test.describe('real demo episode', () => {
  test('meets the brief: 4 scenes, >= 8 beats, 25-40 s at 60 fps', () => {
    const t = buildTimeline(notDetectedEpisode, 60);
    expect(t.scenes.length).toBe(4);
    expect(t.beats.length).toBeGreaterThanOrEqual(8);
    const seconds = t.durationInFrames / 60;
    expect(seconds).toBeGreaterThanOrEqual(25);
    expect(seconds).toBeLessThanOrEqual(40);
    // Every layer range resolves.
    for (const layer of notDetectedEpisode.layers ?? []) {
      const r = resolveRange(t, layer.from, layer.to);
      expect(r.end).toBeGreaterThan(r.start);
    }
  });
});
