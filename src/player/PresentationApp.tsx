import {Player, type PlayerRef} from '@remotion/player';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {buildTimeline, type Timeline} from '../engine';
import {DEFAULT_FPS, EPISODES, type EpisodeEntry} from '../videos/registry';
import {DevHud} from './DevHud';
import {usePresenter, type PresenterApi} from './usePresenter';

const readParams = () => {
  const params = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const entry = EPISODES.find((e) => e.id === params.get('episode')) ?? EPISODES[0];
  const fps = Number(params.get('fps')) || DEFAULT_FPS;
  const checkpoint = Number(hash.get('c') ?? params.get('c') ?? 0) || 0;
  return {entry, fps, checkpoint, hud: params.has('hud')};
};

const isTypingTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

/** What extra UI (rendered via `chrome`) gets to work with. */
export type PresenterContext = {
  readonly presenter: PresenterApi;
  readonly timeline: Timeline;
  readonly hud: boolean;
  readonly toggleHud: () => void;
  readonly isFullscreen: boolean;
  readonly toggleFullscreen: () => void;
  /** False after 1.5 s without mouse movement: hide your chrome too. */
  readonly cursorVisible: boolean;
  /** Show an arbitrary frame, paused (scrubbing in the shot editor's timeline). */
  readonly seek: (frame: number) => void;
};

/**
 * The beat-by-beat presenter for one episode: a full-window Player showing the
 * exact composition component that the renderer exports, plus the keyboard
 * controls. `chrome` lets a host (the Style Lab viewer) add its own overlay UI
 * outside the composition; `onKey` lets it claim extra keys.
 */
export const Presenter: React.FC<{
  readonly entry: EpisodeEntry;
  readonly fps?: number;
  readonly initialCheckpoint?: number;
  readonly initialHud?: boolean;
  readonly chrome?: (ctx: PresenterContext) => React.ReactNode;
  /** Return true if the key was handled. Called before the built-in keys. */
  readonly onKey?: (e: KeyboardEvent, ctx: PresenterContext) => boolean;
  /** Composition input props (e.g. `{theme}`); the same object a render passes as `inputProps`. */
  readonly inputProps?: Record<string, unknown>;
  /** Called with every frame the Player shows (for synchronised compare views). */
  readonly onFrame?: (frame: number) => void;
}> = ({entry, fps = DEFAULT_FPS, initialCheckpoint = 0, initialHud = false, chrome, onKey, inputProps, onFrame}) => {
  const timeline = useMemo(() => buildTimeline(entry.episode, fps), [entry, fps]);
  const width = entry.episode.width ?? 1920;
  const height = entry.episode.height ?? 1080;

  const playerRef = useRef<PlayerRef>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const presenter = usePresenter(playerRef, timeline, initialCheckpoint);
  const {state} = presenter;
  // Stable handle for event listeners (presenter is a new object each render).
  const presenterRef = useRef(presenter);
  presenterRef.current = presenter;
  const [hud, setHud] = useState(initialHud);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cursorVisible, setCursorVisible] = useState(true);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void stageRef.current?.requestFullscreen();
    }
  }, []);
  const toggleHud = useCallback(() => setHud((v) => !v), []);
  const seek = useCallback(
    (frame: number) => {
      presenterRef.current.pause();
      playerRef.current?.pause();
      playerRef.current?.seekTo(Math.max(0, Math.min(timeline.durationInFrames - 1, Math.round(frame))));
    },
    [timeline],
  );

  const context: PresenterContext = {presenter, timeline, hud, toggleHud, isFullscreen, toggleFullscreen, cursorVisible, seek};
  const contextRef = useRef(context);
  contextRef.current = context;
  const onKeyRef = useRef(onKey);
  onKeyRef.current = onKey;
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const handler = (e: {detail: {frame: number}}) => onFrameRef.current?.(e.detail.frame);
    player.addEventListener('frameupdate', handler);
    onFrameRef.current?.(player.getCurrentFrame());
    return () => player.removeEventListener('frameupdate', handler);
  }, [timeline]);

  // Keyboard controls.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const presenter = presenterRef.current;
      if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
      if (onKeyRef.current && !e.repeat && onKeyRef.current(e, contextRef.current)) {
        e.preventDefault();
        return;
      }
      const handled = ['ArrowRight', 'ArrowLeft', 'PageDown', 'PageUp', 'Home', 'End', 'r', 'R', 'f', 'F', 'h', 'H', ' '];
      if (!handled.includes(e.key)) return;
      e.preventDefault();
      // Held keys auto-repeat: only the physical press counts.
      if (e.repeat) return;
      switch (e.key) {
        case 'ArrowRight':
        case 'PageDown':
          presenter.next();
          break;
        case 'ArrowLeft':
        case 'PageUp':
          presenter.prev();
          break;
        case 'r':
        case 'R':
          presenter.replay();
          break;
        case 'f':
        case 'F':
          toggleFullscreen();
          break;
        case 'h':
        case 'H':
          setHud((v) => !v);
          break;
        case ' ':
          presenter.togglePlay();
          break;
        case 'Home':
          presenter.goTo(0);
          break;
        case 'End':
          presenter.goTo(timeline.beats.length);
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggleFullscreen, timeline]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === stageRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // Seek to the initial checkpoint (from #c=N) once the Player is mounted.
  useEffect(() => {
    presenterRef.current.goTo(initialCheckpoint);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the current checkpoint in the URL so a reload resumes in place.
  useEffect(() => {
    if (state.status !== 'holding') return;
    const url = new URL(window.location.href);
    url.hash = state.checkpoint > 0 ? `c=${state.checkpoint}` : '';
    window.history.replaceState(window.history.state, '', url);
  }, [state]);

  // Hide the mouse cursor while presenting.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onMove = () => {
      setCursorVisible(true);
      clearTimeout(timer);
      timer = setTimeout(() => setCursorVisible(false), 1500);
    };
    window.addEventListener('mousemove', onMove);
    timer = setTimeout(() => setCursorVisible(false), 1500);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousemove', onMove);
    };
  }, []);

  // Automation / debugging hook (used by the Playwright tests).
  useEffect(() => {
    (window as unknown as {__presenter: unknown}).__presenter = {
      get state() {
        return presenterRef.current.state;
      },
      get frame() {
        return playerRef.current?.getCurrentFrame() ?? -1;
      },
      get isPlaying() {
        return playerRef.current?.isPlaying() ?? false;
      },
      episode: entry.id,
      timeline: {
        fps: timeline.fps,
        durationInFrames: timeline.durationInFrames,
        checkpoints: timeline.checkpoints,
        beats: timeline.beats.map((b) => ({id: b.id, sceneId: b.sceneId, start: b.start, animEnd: b.animEnd, end: b.end})),
      },
      next: () => presenterRef.current.next(),
      prev: () => presenterRef.current.prev(),
      replay: () => presenterRef.current.replay(),
      goTo: (c: number) => presenterRef.current.goTo(c),
      /** Automation only: show an arbitrary frame (paused). Used by preview tooling and tests. */
      seek: (frame: number) => {
        presenterRef.current.pause();
        playerRef.current?.pause();
        playerRef.current?.seekTo(Math.max(0, Math.min(timeline.durationInFrames - 1, Math.round(frame))));
      },
      playTimed: () => presenterRef.current.playTimed(),
      pause: () => presenterRef.current.pause(),
    };
    return () => {
      delete (window as unknown as {__presenter?: unknown}).__presenter;
    };
  }, [timeline, entry.id]);

  return (
    <div
      ref={stageRef}
      className="stage"
      data-status={state.status}
      data-checkpoint={state.checkpoint}
      data-fullscreen={isFullscreen ? 'true' : 'false'}
      style={{cursor: cursorVisible || hud ? 'default' : 'none'}}
    >
      <Player
        ref={playerRef}
        component={entry.component as React.ComponentType<Record<string, unknown>>}
        inputProps={inputProps}
        durationInFrames={timeline.durationInFrames}
        fps={fps}
        compositionWidth={width}
        compositionHeight={height}
        initialFrame={timeline.checkpoints[Math.max(0, Math.min(timeline.beats.length, initialCheckpoint))]}
        outFrame={presenter.outFrame}
        controls={false}
        clickToPlay={false}
        doubleClickToFullscreen={false}
        spaceKeyToPlayOrPause={false}
        moveToBeginningWhenEnded={false}
        loop={false}
        numberOfSharedAudioTags={0}
        style={{width: '100%', height: '100%'}}
      />
      {chrome ? chrome(context) : null}
      {hud ? <DevHud timeline={timeline} title={entry.episode.title} presenter={presenter} playerRef={playerRef} isFullscreen={isFullscreen} /> : null}
    </div>
  );
};

/**
 * Clean, full-window presentation view for the episode chosen by the URL
 * (`?episode=`, `?fps=`, `#c=`, `?hud`).
 */
export const PresentationApp: React.FC = () => {
  const [{entry, fps, checkpoint, hud}] = useState(readParams);
  return <Presenter entry={entry} fps={fps} initialCheckpoint={checkpoint} initialHud={hud} />;
};
