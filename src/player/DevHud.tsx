import type {PlayerRef} from '@remotion/player';
import React, {useEffect, useState, type RefObject} from 'react';
import {sceneIndexAtFrame, type Timeline} from '../engine';
import type {PresenterApi} from './usePresenter';

/**
 * Optional developer HUD (toggle with H, or open with ?hud). It lives outside
 * the Player, so it can never appear in rendered video frames.
 */
export const DevHud: React.FC<{
  readonly timeline: Timeline;
  readonly title: string;
  readonly presenter: PresenterApi;
  readonly playerRef: RefObject<PlayerRef | null>;
  readonly isFullscreen: boolean;
}> = ({timeline, title, presenter, playerRef, isFullscreen}) => {
  const {state} = presenter;
  const [frame, setFrame] = useState(() => playerRef.current?.getCurrentFrame() ?? 0);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const update = () => setFrame(player.getCurrentFrame());
    player.addEventListener('frameupdate', update);
    player.addEventListener('seeked', update);
    update();
    return () => {
      player.removeEventListener('frameupdate', update);
      player.removeEventListener('seeked', update);
    };
  }, [playerRef]);

  const N = timeline.beats.length;
  const activeBeat = state.beat ?? (state.checkpoint > 0 ? state.checkpoint - 1 : null);
  const scene = timeline.scenes[sceneIndexAtFrame(timeline, frame)];
  const upcoming = state.status === 'playing' ? timeline.beats[state.beat ?? 0] : timeline.beats[state.checkpoint];

  return (
    <div className="hud" data-testid="hud">
      <div className="hud-title">{title}</div>
      <div className="hud-grid">
        <span>scene</span>
        <b data-testid="hud-scene">
          {scene.index + 1}/{timeline.scenes.length} · {scene.title}
        </b>
        <span>beat</span>
        <b data-testid="hud-beat">
          {activeBeat === null ? '— (start)' : `${activeBeat + 1}/${N} · ${timeline.beats[activeBeat].label}`}
        </b>
        <span>checkpoint</span>
        <b data-testid="hud-checkpoint">
          {state.checkpoint}/{N}
        </b>
        <span>frame</span>
        <b data-testid="hud-frame">
          {frame} / {timeline.durationInFrames - 1} · {(frame / timeline.fps).toFixed(2)}s @ {timeline.fps}fps
        </b>
        <span>state</span>
        <b data-testid="hud-status" className={state.status === 'playing' || state.status === 'timed' ? 'hud-playing' : 'hud-holding'}>
          {state.status.toUpperCase()}
          {isFullscreen ? ' · FULLSCREEN' : ''}
        </b>
      </div>
      {upcoming ? (
        <div className="hud-notes">
          <span>{state.status === 'playing' ? 'now' : 'next →'}</span> {upcoming.notes || upcoming.label}
        </div>
      ) : (
        <div className="hud-notes">
          <span>end</span> last checkpoint reached
        </div>
      )}
      <ol className="hud-beats">
        {timeline.beats.map((b) => {
          const done = b.index < state.checkpoint;
          const playing = state.beat === b.index;
          return (
            <li key={b.id} className={playing ? 'is-playing' : done ? 'is-done' : ''}>
              <button type="button" onClick={() => presenter.goTo(b.index + 1)} title="Jump to this beat's completed state">
                <i>{String(b.index + 1).padStart(2, '0')}</i> {b.label}
                <em>{timeline.scenes[b.sceneIndex].title}</em>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="hud-keys">→ next · ← back · R replay · Space play/pause · F fullscreen · H hud · Home/End</div>
    </div>
  );
};
