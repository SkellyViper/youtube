import {Player, type PlayerRef} from '@remotion/player';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {buildTimeline, type Timeline} from '../../engine';
import {THEMES, THEME_IDS, type ThemeId} from '../../styles/themes';
import {findLabSample, LAB_FPS, type LabSample} from '../../videos/style-lab/registry';
import {STORY_SCENES, type StoryScene} from '../../videos/style-lab/redesign';
import {Presenter, type PresenterContext} from '../PresentationApp';
import {matchFrame} from './sync';
import {readSelection, writeSelection, type Compare, type Concept, type ViewerSelection} from './url';

/**
 * Viewer for one scene of the redesign: the beat presenter (same keys as
 * everywhere) plus chrome to pick the concept (Original | Redesign), the
 * theme, and a synchronised second view (vs the other concept, or vs another
 * theme). The selection is reflected in the URL.
 *
 * Compare: the left view is the live presenter; the right view is a follower
 * Player that seeks to the matching frame of its own timeline on every frame
 * update, so both sit on equivalent moments even when beat lengths differ.
 */

type View = {readonly id: string; readonly title: string; readonly component: React.ComponentType; readonly timeline: Timeline; readonly inputProps: Record<string, unknown>; readonly episode: StoryScene['episode']};

const viewFor = (scene: StoryScene, legacy: LabSample | undefined, concept: Concept, theme: ThemeId): View => {
  if (concept === 'original' && legacy) {
    return {id: legacy.id, title: `Original · ${legacy.title}`, component: legacy.component, timeline: buildTimeline(legacy.episode, LAB_FPS), inputProps: {}, episode: legacy.episode};
  }
  return {
    id: scene.id,
    title: `Redesign · ${THEMES[theme].name}`,
    component: scene.component as React.ComponentType,
    timeline: buildTimeline(scene.episode, LAB_FPS),
    inputProps: {theme},
    episode: scene.episode,
  };
};

export const StoryViewer: React.FC<{readonly scene: StoryScene; readonly navigate: (slug: string | null) => void}> = ({scene, navigate}) => {
  const legacy = findLabSample(scene.legacy);
  const [sel, setSel] = useState<ViewerSelection>(() => readSelection(window.location.search));
  const [initial] = useState(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    return {checkpoint: Number(hash.get('c') ?? 0) || 0, hud: new URLSearchParams(window.location.search).has('hud')};
  });

  // Selection -> URL (replaceState: it is a view option, not a navigation).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const extra = new URLSearchParams();
    if (q.has('hud')) extra.set('hud', '');
    window.history.replaceState(null, '', `${window.location.pathname}${writeSelection(sel, extra)}${window.location.hash}`);
  }, [sel]);

  const concept: Concept = sel.concept === 'original' && legacy ? 'original' : 'redesign';
  const primary = useMemo(() => viewFor(scene, legacy, concept, sel.theme), [scene, legacy, concept, sel.theme]);
  const secondary = useMemo<View | null>(() => {
    if (sel.compare.kind === 'concept' && legacy) return viewFor(scene, legacy, concept === 'original' ? 'redesign' : 'original', sel.theme);
    if (sel.compare.kind === 'theme') return viewFor(scene, legacy, 'redesign', sel.compare.theme);
    return null;
  }, [sel.compare, scene, legacy, concept, sel.theme]);

  const entry = useMemo(() => ({id: primary.id, episode: primary.episode, component: primary.component}), [primary]);
  const index = STORY_SCENES.indexOf(scene);
  const sibling = useCallback((d: number) => STORY_SCENES[(index + d + STORY_SCENES.length) % STORY_SCENES.length], [index]);

  // Follower.
  const followerRef = useRef<PlayerRef>(null);
  const onFrame = useCallback(
    (frame: number) => {
      const f = followerRef.current;
      if (!f || !secondary) return;
      f.seekTo(matchFrame(primary.timeline, frame, secondary.timeline));
    },
    [primary.timeline, secondary],
  );

  const onKey = useCallback(
    (e: KeyboardEvent): boolean => {
      if (e.key === 'Escape' || e.key === 'g' || e.key === 'G') {
        if (e.key === 'Escape' && document.fullscreenElement) return false;
        navigate(null);
        return true;
      }
      if (e.key === '[' || e.key === ']') {
        navigate(sibling(e.key === ']' ? 1 : -1).slug);
        return true;
      }
      if (e.key === 't' || e.key === 'T') {
        setSel((s) => ({...s, theme: THEME_IDS[(THEME_IDS.indexOf(s.theme) + 1) % THEME_IDS.length]}));
        return true;
      }
      if ((e.key === 'o' || e.key === 'O') && legacy) {
        setSel((s) => ({...s, concept: s.concept === 'original' ? 'redesign' : 'original'}));
        return true;
      }
      if (e.key === 'c' || e.key === 'C') {
        setSel((s) => ({...s, compare: s.compare.kind === 'off' ? (legacy ? {kind: 'concept'} : {kind: 'theme', theme: nextTheme(s.theme)}) : {kind: 'off'}}));
        return true;
      }
      return false;
    },
    [navigate, sibling, legacy],
  );

  return (
    <div className="story-viewer" data-compare={secondary ? 'true' : 'false'} data-testid="story-viewer">
      <div className="story-pane story-pane-primary">
        <Presenter
          key={primary.id + JSON.stringify(primary.inputProps)}
          entry={entry}
          inputProps={primary.inputProps}
          initialCheckpoint={initial.checkpoint}
          initialHud={initial.hud}
          onKey={onKey}
          onFrame={onFrame}
          chrome={(ctx) => <StoryChrome ctx={ctx} scene={scene} legacy={legacy} sel={sel} setSel={setSel} navigate={navigate} sibling={sibling} primary={primary} secondary={secondary} />}
        />
      </div>
      {secondary ? (
        <div className="story-pane story-pane-secondary" data-testid="story-follower">
          <Player
            key={secondary.id + JSON.stringify(secondary.inputProps)}
            ref={followerRef}
            component={secondary.component as React.ComponentType<Record<string, unknown>>}
            inputProps={secondary.inputProps}
            durationInFrames={secondary.timeline.durationInFrames}
            fps={LAB_FPS}
            compositionWidth={secondary.episode.width ?? 1920}
            compositionHeight={secondary.episode.height ?? 1080}
            controls={false}
            clickToPlay={false}
            doubleClickToFullscreen={false}
            spaceKeyToPlayOrPause={false}
            numberOfSharedAudioTags={0}
            style={{width: '100%', height: '100%'}}
          />
          <span className="story-pane-label">{secondary.title}</span>
        </div>
      ) : null}
    </div>
  );
};

const nextTheme = (t: ThemeId): ThemeId => THEME_IDS[(THEME_IDS.indexOf(t) + 1) % THEME_IDS.length];

const Btn: React.FC<{readonly onClick: () => void; readonly title: string; readonly active?: boolean; readonly testId?: string; readonly disabled?: boolean; readonly children: React.ReactNode}> = ({
  onClick,
  title,
  active,
  testId,
  disabled,
  children,
}) => (
  <button type="button" tabIndex={-1} title={title} aria-pressed={active} aria-disabled={disabled} data-testid={testId} onMouseDown={(e) => e.preventDefault()} onClick={disabled ? undefined : onClick}>
    {children}
  </button>
);

/** The shell command that exports exactly what is on screen. */
export const renderCommand = (scene: StoryScene, sel: ViewerSelection): string =>
  sel.concept === 'original' && scene.legacy ? `npm run lab:render -- ${scene.legacy}` : `npm run story:render -- ${scene.slug} --theme=${sel.theme}`;

const StoryChrome: React.FC<{
  readonly ctx: PresenterContext;
  readonly scene: StoryScene;
  readonly legacy?: LabSample;
  readonly sel: ViewerSelection;
  readonly setSel: React.Dispatch<React.SetStateAction<ViewerSelection>>;
  readonly navigate: (slug: string | null) => void;
  readonly sibling: (d: number) => StoryScene;
  readonly primary: View;
  readonly secondary: View | null;
}> = ({ctx, scene, legacy, sel, setSel, navigate, sibling, primary, secondary}) => {
  const {presenter, timeline} = ctx;
  const {state} = presenter;
  const N = timeline.beats.length;
  const running = state.status === 'playing' || state.status === 'timed';
  const visible = ctx.cursorVisible || ctx.hud;
  const upcoming = state.status === 'playing' ? timeline.beats[state.beat ?? 0] : timeline.beats[state.checkpoint];
  const [copied, setCopied] = useState(false);
  const cmd = renderCommand(scene, sel);
  const setCompare = (compare: Compare) => setSel((s) => ({...s, compare}));

  return (
    <div className="lab-chrome story-chrome" data-visible={visible ? 'true' : 'false'} data-testid="lab-chrome">
      <div className="lab-bar">
        <Btn onClick={() => navigate(null)} title="Back to the gallery (G or Esc)" testId="lab-back">
          &larr; Gallery
        </Btn>
        <div className="lab-bar-title" data-testid="lab-title">
          <span className="lab-num">S{String(scene.number).padStart(2, '0')}</span>
          {scene.title}
          <span className={`lab-kind lab-kind-${scene.kind.toLowerCase()}`}>{scene.kind}</span>
          <span className="story-view-title" data-testid="story-view-title">
            {primary.title}
            {secondary ? ` · vs ${secondary.title}` : ''}
          </span>
        </div>
        <div className="lab-bar-actions">
          <Btn onClick={() => navigate(sibling(-1).slug)} title="Previous scene ( [ )" testId="lab-prev-sample">
            Previous
          </Btn>
          <Btn onClick={() => navigate(sibling(1).slug)} title="Next scene ( ] )" testId="lab-next-sample">
            Next
          </Btn>
          <i />
          <Btn onClick={presenter.togglePlay} title="Play through on export timing / pause (Space)" active={running} testId="lab-play">
            {running ? 'Pause' : 'Play'}
          </Btn>
          <Btn onClick={() => presenter.goTo(0)} title="Back to the start (Home)" testId="lab-restart">
            Restart
          </Btn>
          <Btn onClick={ctx.toggleHud} title="Beat HUD (H)" active={ctx.hud} testId="lab-hud">
            HUD
          </Btn>
          <Btn onClick={ctx.toggleFullscreen} title="Presentation mode: fullscreen (F)" active={ctx.isFullscreen} testId="lab-fullscreen">
            Present
          </Btn>
        </div>
      </div>

      {/* Selection row: concept, theme, compare, render. */}
      <div className="story-controls" data-testid="story-controls">
        <div className="story-group" role="group" aria-label="Concept">
          <span className="story-label">Concept</span>
          <Btn onClick={() => setSel((s) => ({...s, concept: 'original'}))} title={legacy ? `Original: ${legacy.title} (O)` : 'This scene has no original prototype'} active={sel.concept === 'original' && !!legacy} disabled={!legacy} testId="story-concept-original">
            Original
          </Btn>
          <Btn onClick={() => setSel((s) => ({...s, concept: 'redesign'}))} title="Redesign (O)" active={sel.concept === 'redesign' || !legacy} testId="story-concept-redesign">
            Redesign
          </Btn>
        </div>
        <div className="story-group" role="group" aria-label="Theme">
          <span className="story-label">Theme</span>
          {THEME_IDS.map((id) => (
            <Btn key={id} onClick={() => setSel((s) => ({...s, theme: id}))} title={`${THEMES[id].name}: ${THEMES[id].mood} (T cycles)`} active={sel.theme === id} disabled={sel.concept === 'original' && !!legacy} testId={`story-theme-${id}`}>
              <span className="story-swatch" style={{background: `linear-gradient(135deg, ${THEMES[id].tone.mind.base}, ${THEMES[id].tone.system.base} 60%, ${THEMES[id].tone.threat.base})`}} />
              {THEMES[id].name}
            </Btn>
          ))}
        </div>
        <div className="story-group" role="group" aria-label="Compare">
          <span className="story-label">Compare</span>
          <Btn onClick={() => setCompare({kind: 'off'})} title="Single view" active={sel.compare.kind === 'off'} testId="story-compare-off">
            Off
          </Btn>
          <Btn onClick={() => setCompare({kind: 'concept'})} title="Original vs redesign, synchronised at matching beats (C)" active={sel.compare.kind === 'concept'} disabled={!legacy} testId="story-compare-concept">
            vs Original
          </Btn>
          <Btn onClick={() => setCompare({kind: 'theme', theme: sel.compare.kind === 'theme' ? nextTheme(sel.compare.theme) : nextTheme(sel.theme)})} title="Theme A vs theme B (click again to cycle B)" active={sel.compare.kind === 'theme'} testId="story-compare-theme">
            vs Theme{sel.compare.kind === 'theme' ? `: ${THEMES[sel.compare.theme].name}` : ''}
          </Btn>
        </div>
        <div className="story-group story-group-render">
          <Btn
            onClick={() => {
              void navigator.clipboard?.writeText(cmd);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1400);
            }}
            title={`Copy the export command for this selection:\n${cmd}`}
            testId="story-render"
          >
            {copied ? 'Copied' : 'Render'}
          </Btn>
          <code className="story-cmd" data-testid="story-cmd">
            {cmd}
          </code>
        </div>
      </div>

      <div className="lab-beats">
        <ol>
          {timeline.checkpoints.map((_, i) => (
            <li key={i}>
              <button
                type="button"
                tabIndex={-1}
                className={i < state.checkpoint ? 'is-done' : i === state.checkpoint ? (state.status === 'holding' ? 'is-here' : 'is-leaving') : ''}
                title={i === 0 ? 'Start' : `After beat ${i}: ${timeline.beats[i - 1].label}`}
                data-testid={`lab-dot-${i}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => presenter.goTo(i)}
              />
            </li>
          ))}
        </ol>
        <span className="lab-beat-label" data-testid="lab-beat-label">
          {upcoming ? (
            <>
              <em>{state.status === 'playing' ? 'Playing' : 'Next'}</em> {upcoming.label}
            </>
          ) : (
            <em>End of scene</em>
          )}
          <b>
            {Math.min(state.checkpoint + (state.status === 'playing' ? 1 : 0), N)}/{N}
          </b>
        </span>
      </div>
    </div>
  );
};
