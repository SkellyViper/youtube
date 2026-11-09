import React, {useRef, useState} from 'react';
import type {Timeline as EngineTimeline} from '../../../engine';
import {keyFrame, sortedKeys, type Selection, type ShotState} from '../../../shot';

/**
 * The editor's timeline, laid out like a video editor's:
 *
 *   ruler    seconds; click or drag anywhere to scrub (the playhead seeks any frame)
 *   beats    the beat sheet; hatched = export-only hold (the presenter waits for →)
 *   camera   the camera track: clips are shots (a cut starts a new clip), diamonds
 *            are keyframes; drag a diamond to retime it, click to select it
 *   cues     the scene's timed actions (click to retime / re-ease)
 *   notes    review notes pinned to a moment (N adds one at the playhead)
 *
 * Time is drawn on the export timeline (frames at 60 fps). Keys and notes are
 * stored as (beat, seconds into the beat), so dragging one into a hold snaps
 * it to the end of that beat: the camera never moves while the presenter holds.
 */
export type TimelineProps = {
  readonly timeline: EngineTimeline;
  readonly state: ShotState;
  readonly frame: number;
  readonly playing: boolean;
  readonly selection: Selection | null;
  readonly select: (s: Selection) => void;
  readonly seek: (frame: number) => void;
  readonly togglePlay: () => void;
  readonly moveKey: (id: string, frame: number) => void;
  readonly moveNote: (id: string, frame: number) => void;
  readonly addKey: (cut: boolean) => void;
  readonly addNote: () => void;
};

const fmt = (frame: number, fps: number) => {
  const s = Math.floor(frame / fps);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}.${String(frame % fps).padStart(2, '0')}`;
};

export const Timeline: React.FC<TimelineProps> = (p) => {
  const {timeline, state, frame, selection} = p;
  const total = timeline.durationInFrames;
  const fps = timeline.fps;
  const [zoom, setZoom] = useState(1);
  const inner = useRef<HTMLDivElement>(null);
  const pct = (f: number) => `${(100 * f) / total}%`;
  const frameAt = (clientX: number) => {
    const r = inner.current!.getBoundingClientRect();
    return Math.max(0, Math.min(total - 1, Math.round(((clientX - r.left) / r.width) * total)));
  };
  /** Drag helper: calls `on(frame)` on down and on every move until release. */
  const dragFrom = (e: React.PointerEvent, on: (f: number) => void) => {
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    on(frameAt(e.clientX));
    const move = (ev: PointerEvent) => on(frameAt(ev.clientX));
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  };

  const cam = state.camera;
  const keys = cam.mode === 'keys' ? sortedKeys(cam, timeline) : [];
  // Clips: a new clip starts at the first key and at every cut.
  const clips: {start: number; end: number; label: string; keyId: string}[] = [];
  keys.forEach(([id, k], i) => {
    const f = keyFrame(timeline, k);
    if (i === 0 || k.cut) clips.push({start: i === 0 ? 0 : f, end: total, label: k.label, keyId: id});
    else if (!clips[clips.length - 1].label && k.label) clips[clips.length - 1].label = k.label;
  });
  for (let i = 0; i < clips.length - 1; i++) clips[i].end = clips[i + 1].start;
  const seconds = Math.ceil(total / fps);
  const tickEvery = zoom >= 3 ? 0.5 : 1;
  const current = timeline.beats.findIndex((b) => frame >= b.start && frame < b.end);
  const isSel = (kind: string, id: string) => selection?.kind === kind && 'id' in selection && selection.id === id;

  return (
    <div className="se-timeline" data-testid="timeline">
      <div className="se-tl-bar">
        <button type="button" className="se-btn se-play" onClick={p.togglePlay} aria-label={p.playing ? 'Pause' : 'Play'} data-testid="tl-play" title="Play / pause on the export timing (Space)">
          {p.playing ? '❚❚' : '▶'}
        </button>
        <span className="se-timecode" data-testid="tl-timecode">
          {fmt(frame, fps)}
        </span>
        <span className="se-dim">
          frame <strong data-testid="strip-frame">{frame}</strong> / {total - 1} · {current >= 0 ? `beat ${current + 1}: ${timeline.beats[current].label}` : 'lead-in'}
        </span>
        <span className="se-gap" />
        <button type="button" className="se-btn se-btn-small" onClick={() => p.addKey(false)} data-testid="tl-key" title="Keyframe the camera here from the current view (K)">
          ◆ Key
        </button>
        <button type="button" className="se-btn se-btn-small" onClick={() => p.addKey(true)} data-testid="tl-cut" title="Cut to the current view here (C)">
          ✂ Cut
        </button>
        <button type="button" className="se-btn se-btn-small" onClick={p.addNote} data-testid="tl-note" title="Pin a review note here (N)">
          ⚑ Note
        </button>
        <label className="se-zoom">
          <span className="se-dim">Zoom</span>
          <input type="range" min={1} max={6} step={0.25} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} aria-label="Timeline zoom" />
        </label>
      </div>

      <div className="se-tl-body">
        <div className="se-tl-heads">
          <span>Time</span>
          <span>Beats</span>
          <span>Camera</span>
          <span>Cues</span>
          <span>Notes</span>
        </div>
        <div className="se-tl-scroll">
          <div className="se-tl-inner" ref={inner} style={{width: `${zoom * 100}%`}}>
            {/* Ruler: scrub */}
            <div className="se-lane se-ruler" onPointerDown={(e) => dragFrom(e, p.seek)} data-testid="tl-ruler">
              {Array.from({length: Math.floor(seconds / tickEvery) + 1}, (_, i) => i * tickEvery).map((s) => (
                <span key={s} className="se-tick" style={{left: pct(s * fps)}}>
                  {Number.isInteger(s) ? `${s}s` : ''}
                </span>
              ))}
            </div>
            {/* Beats */}
            <div className="se-lane se-beats" onPointerDown={(e) => dragFrom(e, p.seek)}>
              {timeline.beats.map((b, i) => (
                <div
                  key={b.id}
                  className="se-tl-beat"
                  style={{left: pct(b.start), width: pct(b.end - b.start)}}
                  data-selected={isSel('beat', b.id) ? 'true' : 'false'}
                  data-current={i === current ? 'true' : 'false'}
                  data-testid={`beat-${b.id}`}
                  title={`${b.label}: frames ${b.start}–${b.animEnd} (checkpoint), hold to ${b.end}`}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    p.select({kind: 'beat', id: b.id});
                    dragFrom(e, p.seek);
                  }}
                >
                  <span className="se-tl-beat-anim" style={{width: `${(100 * b.durationInFrames) / (b.end - b.start)}%`}}>
                    {i + 1}. {b.label}
                  </span>
                </div>
              ))}
            </div>
            {/* Camera track */}
            <div className="se-lane se-camlane" onPointerDown={(e) => dragFrom(e, p.seek)} data-testid="tl-camera">
              {cam.mode !== 'keys' ? (
                <div className="se-clip se-clip-static" style={{left: 0, width: '100%'}}>
                  {cam.mode === 'locked' ? 'Locked camera' : 'Code camera (the scene’s own moves)'} · press K or C to take over
                </div>
              ) : (
                clips.map((c, i) => (
                  <div key={c.keyId} className="se-clip" style={{left: pct(c.start), width: pct(c.end - c.start)}} data-testid={`tl-clip-${i}`}>
                    {c.label || `Shot ${i + 1}`}
                  </div>
                ))
              )}
              {keys.map(([id, k]) => (
                <button
                  key={id}
                  type="button"
                  className="se-key"
                  data-cut={k.cut ? 'true' : 'false'}
                  data-selected={isSel('key', id) ? 'true' : 'false'}
                  data-testid={`tl-key-${id}`}
                  style={{left: pct(keyFrame(timeline, k))}}
                  title={`${k.label || 'Key'} · ${k.beat} +${k.t.toFixed(2)} s${k.cut ? ' · cut' : ` · ${k.ease}`}`}
                  onPointerDown={(e) => {
                    p.select({kind: 'key', id});
                    let moved = false;
                    const start = keyFrame(timeline, k);
                    dragFrom(e, (f) => {
                      if (!moved && f === start) return;
                      moved = true;
                      p.moveKey(id, f);
                    });
                  }}
                  onDoubleClick={() => p.seek(keyFrame(timeline, k))}
                />
              ))}
            </div>
            {/* Cues */}
            <div className="se-lane se-cues" onPointerDown={(e) => dragFrom(e, p.seek)}>
              {timeline.beats.map((b) =>
                Object.entries(state.motions)
                  .filter(([, m]) => m.beat === b.id)
                  .map(([mid, m], k) => {
                    const dur = b.durationInFrames / fps;
                    const from = Math.min(m.from, dur);
                    const until = Math.min(m.until ?? dur, dur);
                    return (
                      <button
                        key={mid}
                        type="button"
                        className="se-cue"
                        data-kind={m.kind}
                        data-enabled={m.enabled ? 'true' : 'false'}
                        data-selected={isSel('motion', mid) ? 'true' : 'false'}
                        style={{left: pct(b.start + from * fps), width: pct(Math.max(2, (until - from) * fps)), top: `${3 + (k % 3) * 7}px`}}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => p.select({kind: 'motion', id: mid})}
                        title={`${m.label} (${from.toFixed(2)}–${until.toFixed(2)} s, ${m.easing})`}
                        data-testid={`cue-${mid}`}
                      />
                    );
                  }),
              )}
            </div>
            {/* Notes */}
            <div className="se-lane se-notes" onPointerDown={(e) => dragFrom(e, p.seek)} data-testid="tl-notes">
              {Object.entries(state.notes).map(([id, n]) => (
                <button
                  key={id}
                  type="button"
                  className="se-flag"
                  data-done={n.done ? 'true' : 'false'}
                  data-selected={isSel('note', id) ? 'true' : 'false'}
                  data-testid={`tl-note-${id}`}
                  style={{left: pct(keyFrame(timeline, n))}}
                  title={n.text || 'Empty note'}
                  onPointerDown={(e) => {
                    p.select({kind: 'note', id});
                    let moved = false;
                    const start = keyFrame(timeline, n);
                    dragFrom(e, (f) => {
                      if (!moved && f === start) return;
                      moved = true;
                      p.moveNote(id, f);
                    });
                  }}
                >
                  ⚑
                </button>
              ))}
            </div>
            <span className="se-tl-playhead" style={{left: pct(frame)}} data-testid="tl-playhead" />
          </div>
        </div>
      </div>
      <div className="se-tl-hint se-dim">
        Drag on the timeline to scrub · → / ← beat by beat · , . step a frame (Shift ×10) · K key · C cut · N note · Del removes the selected key or note · Fly: drag in the viewport to move the camera at the playhead
      </div>
    </div>
  );
};

