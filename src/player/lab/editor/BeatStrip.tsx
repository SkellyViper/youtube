import React from 'react';
import type {Timeline} from '../../../engine';
import type {Selection, ShotState} from '../../../shot';

/**
 * The beat strip under the viewport: one block per beat (width = animation
 * time; the hatched tail is the export-only hold), the cues and transform
 * motions inside each beat as bars at their start/end offsets, a mark when
 * the camera moves in that beat, and the playhead. Click a beat or a bar to
 * inspect it; double-click a beat to jump the presenter to its checkpoint.
 */
export const BeatStrip: React.FC<{
  readonly timeline: Timeline;
  readonly state: ShotState;
  readonly frame: number;
  readonly selection: Selection | null;
  readonly select: (s: Selection) => void;
  readonly goTo: (checkpoint: number) => void;
}> = ({timeline, state, frame, selection, select, goTo}) => {
  const total = timeline.durationInFrames;
  const pct = (f: number) => `${(100 * f) / total}%`;
  const current = timeline.beats.findIndex((b) => frame >= b.start && frame < b.end);
  const moving = !state.camera.locked;
  return (
    <div className="se-strip" data-testid="beat-strip">
      <div className="se-strip-track">
        {timeline.beats.map((b, i) => {
          const motions = Object.entries(state.motions).filter(([, m]) => m.beat === b.id);
          const len = b.durationInFrames;
          const camMove = moving && state.camera.moves[b.id]?.enabled;
          const selected = selection?.kind === 'beat' && selection.id === b.id;
          return (
            <div key={b.id} className="se-beat" style={{left: pct(b.start), width: pct(b.end - b.start)}} data-selected={selected ? 'true' : 'false'} data-current={i === current ? 'true' : 'false'}>
              <button type="button" className="se-beat-body" style={{width: `${(100 * len) / (b.end - b.start)}%`}} onClick={() => select({kind: 'beat', id: b.id})} onDoubleClick={() => goTo(i + 1)} data-testid={`beat-${b.id}`} title={`${b.label}: frames ${b.start}–${b.animEnd} (checkpoint), hold to ${b.end}`}>
                <span className="se-beat-name">
                  {i + 1}. {b.label}
                </span>
                {camMove ? <span className="se-cam-move" title="The camera moves in this beat">camera moves</span> : null}
              </button>
              <span className="se-beat-hold" style={{left: `${(100 * len) / (b.end - b.start)}%`}} />
              <div className="se-lanes" style={{width: `${(100 * len) / (b.end - b.start)}%`}}>
                {motions.map(([mid, m], k) => {
                  const dur = len / timeline.fps;
                  const from = Math.min(m.from, dur);
                  const until = Math.min(m.until ?? dur, dur);
                  return (
                    <button
                      key={mid}
                      type="button"
                      className="se-cue"
                      data-kind={m.kind}
                      data-enabled={m.enabled ? 'true' : 'false'}
                      data-selected={selection?.kind === 'motion' && selection.id === mid ? 'true' : 'false'}
                      style={{left: `${(100 * from) / dur}%`, width: `${Math.max(1.5, (100 * (until - from)) / dur)}%`, top: `${4 + (k % 3) * 9}px`}}
                      onClick={() => select({kind: 'motion', id: mid})}
                      title={`${m.label} (${from.toFixed(2)}–${until.toFixed(2)} s, ${m.easing})`}
                      data-testid={`cue-${mid}`}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
        <span className="se-playhead" style={{left: pct(frame)}} />
      </div>
      <div className="se-strip-meta">
        <span>
          frame <strong data-testid="strip-frame">{frame}</strong> / {total - 1}
        </span>
        <span>{(frame / timeline.fps).toFixed(2)} s</span>
        <span>{current >= 0 ? `beat ${current + 1}: ${timeline.beats[current].label}` : 'lead-in'}</span>
        <span className="se-dim">→ next beat · ← previous checkpoint · R replay · F fullscreen</span>
      </div>
    </div>
  );
};
