import type {PlayerRef} from '@remotion/player';
import {useCallback, useEffect, useRef, useState, type RefObject} from 'react';
import {beatIndexAtFrame, checkpointAtFrame, type Timeline} from '../engine';

/**
 * holding  resting on a checkpoint (the normal state between key presses)
 * playing  one beat is playing; it will stop on its checkpoint
 * timed    playing straight through like the exported video (beats + holds)
 * paused   stopped part-way by the user during `playing` / `timed`
 */
export type PresenterStatus = 'holding' | 'playing' | 'timed' | 'paused';

export type PresenterState = {
  /** Number of completed beats; the presentation rests on timeline.checkpoints[checkpoint]. */
  readonly checkpoint: number;
  readonly status: PresenterStatus;
  /** Index of the beat being played, if any. */
  readonly beat: number | null;
};

export type PresenterApi = {
  readonly state: PresenterState;
  /** Player `outFrame` prop: playback stops exactly on the beat's completed frame. */
  readonly outFrame: number | null;
  next: () => boolean;
  prev: () => void;
  replay: () => void;
  goTo: (checkpoint: number) => void;
  playBeat: (beat: number) => void;
  /** Play through beats and holds on the export timing, from the current position. */
  playTimed: () => void;
  /** Freeze where we are (during `playing` or `timed`). */
  pause: () => void;
  /** Space bar: timed play if resting / paused, pause if anything is playing. */
  togglePlay: () => void;
};

/** Minimum time between two accepted "next" presses (accidental double taps). */
export const ADVANCE_GUARD_MS = 280;

type Pending =
  | {readonly kind: 'beat'; readonly beat: number; readonly seek: boolean; readonly token: number}
  | {readonly kind: 'timed'; readonly from: number | null; readonly token: number};

/**
 * Beat-by-beat presentation controller on top of the Remotion Player.
 *
 * State machine:
 *   holding(c) --next--> playing(beat c) --ended--> holding(c + 1)
 *   playing(b) --prev--> holding(b)      (abort, snap back to the beat's start)
 *   holding(c) --prev--> holding(c - 1)  (instant)
 *   any        --replay-> playing(current or last beat)
 *   holding(c) --playTimed--> timed --end of video--> holding(N)
 *   playing / timed --pause--> paused --next--> playing (finishes the current beat)
 *
 * While a beat plays, "next" is ignored, so transitions are never interrupted
 * and two presses can never start two beats.
 */
export const usePresenter = (
  playerRef: RefObject<PlayerRef | null>,
  timeline: Timeline,
  initialCheckpoint: number,
): PresenterApi => {
  const N = timeline.beats.length;
  const clampC = (c: number) => Math.max(0, Math.min(N, Math.round(c)));

  const [state, setState] = useState<PresenterState>({
    checkpoint: clampC(initialCheckpoint),
    status: 'holding',
    beat: null,
  });
  const stateRef = useRef(state);
  const commit = useCallback((next: PresenterState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const [outFrame, setOutFrame] = useState<number | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const tokenRef = useRef(0);
  const lastAdvanceRef = useRef(0);

  const currentFrame = useCallback(
    () => playerRef.current?.getCurrentFrame() ?? timeline.checkpoints[stateRef.current.checkpoint],
    [playerRef, timeline],
  );

  const goTo = useCallback(
    (c: number) => {
      const target = clampC(c);
      commit({checkpoint: target, status: 'holding', beat: null});
      setPending(null);
      setOutFrame(null);
      const player = playerRef.current;
      if (!player) return;
      player.pause();
      player.seekTo(timeline.checkpoints[target]);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [timeline, commit, playerRef],
  );

  /** Play beat `i`; `seek: false` resumes it from the current frame (after a pause). */
  const startBeat = useCallback(
    (i: number, seek: boolean) => {
      if (i < 0 || i >= N) return;
      const player = playerRef.current;
      if (!player) return;
      player.pause();
      commit({checkpoint: i, status: 'playing', beat: i});
      // Bound playback to the beat; seek + play happen in the effect below,
      // after the Player has received the new outFrame prop.
      setOutFrame(timeline.beats[i].animEnd);
      tokenRef.current += 1;
      setPending({kind: 'beat', beat: i, seek, token: tokenRef.current});
    },
    [N, timeline, commit, playerRef],
  );

  const playBeat = useCallback((i: number) => startBeat(i, true), [startBeat]);

  useEffect(() => {
    if (!pending) return;
    const s = stateRef.current;
    const player = playerRef.current;
    if (!player) return;
    if (pending.kind === 'beat') {
      if (s.status !== 'playing' || s.beat !== pending.beat) return;
      if (pending.seek) player.seekTo(timeline.beats[pending.beat].start);
      player.play();
    } else {
      if (s.status !== 'timed') return;
      if (pending.from !== null) player.seekTo(pending.from);
      player.play();
    }
  }, [pending, timeline, playerRef]);

  const finish = useCallback(
    (i: number) => {
      const s = stateRef.current;
      if (s.status !== 'playing' || s.beat !== i) return;
      // Commit first: seeking to the last frame of the video re-emits "ended".
      commit({checkpoint: i + 1, status: 'holding', beat: null});
      setPending(null);
      const player = playerRef.current;
      const end = timeline.beats[i].animEnd;
      if (player) {
        player.pause();
        if (player.getCurrentFrame() !== end) player.seekTo(end);
      }
      const nextBeat = timeline.beats[i + 1];
      if (nextBeat?.auto) playBeat(i + 1);
    },
    [timeline, commit, playBeat, playerRef],
  );

  // Player events: stop exactly on beat boundaries.
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const onEnded = () => {
      const s = stateRef.current;
      if (s.status === 'playing' && s.beat !== null) finish(s.beat);
      else if (s.status === 'timed') goTo(N);
    };
    const onFrame = (e: {detail: {frame: number}}) => {
      const f = e.detail.frame;
      const s = stateRef.current;
      if (s.status === 'playing' && s.beat !== null && f >= timeline.beats[s.beat].animEnd) {
        finish(s.beat);
      } else if (s.status === 'timed') {
        // Keep the checkpoint counter (HUD, beat dots) in step with the timeline.
        const c = checkpointAtFrame(timeline, f);
        if (c !== s.checkpoint) commit({checkpoint: c, status: 'timed', beat: null});
      }
    };
    player.addEventListener('ended', onEnded);
    player.addEventListener('frameupdate', onFrame);
    return () => {
      player.removeEventListener('ended', onEnded);
      player.removeEventListener('frameupdate', onFrame);
    };
  }, [playerRef, timeline, finish, goTo, commit, N]);

  const next = useCallback((): boolean => {
    const s = stateRef.current;
    if (s.status === 'playing' || s.status === 'timed') return false;
    const now = performance.now();
    if (now - lastAdvanceRef.current < ADVANCE_GUARD_MS) return false;
    if (s.status === 'paused') {
      // Finish the beat we stopped inside; if we stopped during a hold, start the next one.
      const f = currentFrame();
      const bi = beatIndexAtFrame(timeline, f);
      if (bi >= 0 && f < timeline.beats[bi].animEnd) {
        lastAdvanceRef.current = now;
        startBeat(bi, false);
        return true;
      }
      const c = checkpointAtFrame(timeline, f);
      if (c >= N) return false;
      lastAdvanceRef.current = now;
      playBeat(c);
      return true;
    }
    if (s.checkpoint >= N) return false;
    lastAdvanceRef.current = now;
    playBeat(s.checkpoint);
    return true;
  }, [N, playBeat, startBeat, currentFrame, timeline]);

  const prev = useCallback(() => {
    const s = stateRef.current;
    if (s.status === 'playing') {
      goTo(s.checkpoint);
      return;
    }
    if (s.status === 'timed' || s.status === 'paused') {
      // Inside a beat: back to the state before it. Otherwise (during a hold,
      // which looks exactly like its checkpoint): timed playback stops on that
      // checkpoint, a paused presentation steps back one.
      const f = currentFrame();
      const bi = beatIndexAtFrame(timeline, f);
      if (bi >= 0 && f > timeline.beats[bi].start && f < timeline.beats[bi].animEnd) goTo(bi);
      else goTo(checkpointAtFrame(timeline, f) - (s.status === 'paused' ? 1 : 0));
      return;
    }
    goTo(s.checkpoint - 1);
  }, [goTo, currentFrame, timeline]);

  const replay = useCallback(() => {
    const s = stateRef.current;
    if (s.status === 'playing' && s.beat !== null) {
      playBeat(s.beat);
      return;
    }
    if (s.status === 'timed' || s.status === 'paused') {
      const f = currentFrame();
      const bi = beatIndexAtFrame(timeline, f);
      if (bi >= 0) playBeat(bi);
      return;
    }
    if (s.checkpoint > 0) playBeat(s.checkpoint - 1);
  }, [playBeat, currentFrame, timeline]);

  const playTimed = useCallback(() => {
    const s = stateRef.current;
    const player = playerRef.current;
    if (!player || s.status === 'timed') return;
    player.pause();
    // From the last checkpoint, start over; from a pause, carry on in place.
    const restart = s.status === 'holding' && s.checkpoint >= N;
    const from = restart ? 0 : s.status === 'holding' ? timeline.checkpoints[s.checkpoint] : null;
    const frame = from ?? currentFrame();
    commit({checkpoint: checkpointAtFrame(timeline, frame), status: 'timed', beat: null});
    setOutFrame(null);
    tokenRef.current += 1;
    setPending({kind: 'timed', from, token: tokenRef.current});
  }, [N, timeline, commit, playerRef, currentFrame]);

  const pause = useCallback(() => {
    const s = stateRef.current;
    if (s.status !== 'playing' && s.status !== 'timed') return;
    const player = playerRef.current;
    player?.pause();
    const f = currentFrame();
    commit({checkpoint: checkpointAtFrame(timeline, f), status: 'paused', beat: null});
    setPending(null);
    setOutFrame(null);
  }, [timeline, commit, playerRef, currentFrame]);

  const togglePlay = useCallback(() => {
    const s = stateRef.current;
    if (s.status === 'playing' || s.status === 'timed') pause();
    else playTimed();
  }, [pause, playTimed]);

  return {state, outFrame, next, prev, replay, goTo, playBeat, playTimed, pause, togglePlay};
};
