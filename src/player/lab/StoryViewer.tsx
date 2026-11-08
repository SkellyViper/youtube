import {Player, type PlayerRef} from '@remotion/player';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {buildTimeline, type EpisodeDef, type Timeline} from '../../engine';
import {THEMES, THEME_IDS, type ThemeId} from '../../styles/themes';
import {LAB_FPS} from '../../videos/style-lab/registry';
import {Presenter, type PresenterContext} from '../PresentationApp';
import {otherConcept, siblingSlug, type Concept, type Family, type RouteKind} from './family';
import {matchFrame} from './sync';
import {readSelection, writeSelection, type Compare, type ViewerSelection} from './url';

/**
 * Viewer for one scene family: the beat presenter (same keys as everywhere)
 * plus chrome to pick the treatment (Original | Redesign | Cinematic), the
 * theme, and a synchronised second view (another treatment, or another
 * theme). The selection is reflected in the URL.
 *
 * Compare: the left view is the live presenter; the right view is a follower
 * Player that seeks to the matching frame of its own timeline on every frame
 * update, so both sit on equivalent moments even when beat lengths differ.
 */

type View = {readonly id: string; readonly concept: Concept; readonly title: string; readonly component: React.ComponentType; readonly timeline: Timeline; readonly inputProps: Record<string, unknown>; readonly episode: EpisodeDef};

const CONCEPT_LABEL: Record<Concept, string> = {original: 'Original', redesign: 'Redesign', cinematic: 'Cinematic 3D'};

const viewFor = (family: Family, concept: Concept, theme: ThemeId): View | null => {
  if (concept === 'original' && family.legacy) {
    const l = family.legacy;
    return {id: l.id, concept, title: `Original · ${l.title}`, component: l.component, timeline: buildTimeline(l.episode, LAB_FPS), inputProps: {}, episode: l.episode};
  }
  if (concept === 'redesign' && family.story) {
    const s = family.story;
    return {id: s.id, concept, title: `Redesign · ${THEMES[theme].name}`, component: s.component as React.ComponentType, timeline: buildTimeline(s.episode, LAB_FPS), inputProps: {theme}, episode: s.episode};
  }
  if (concept === 'cinematic' && family.cinematic) {
    const c = family.cinematic;
    return {id: c.id, concept, title: `Cinematic 3D · ${THEMES[theme].name}`, component: c.component as React.ComponentType, timeline: buildTimeline(c.episode, LAB_FPS), inputProps: {theme}, episode: c.episode};
  }
  return null;
};

/** A concept the family really has, falling back to what exists. */
const resolveConcept = (family: Family, wanted: Concept): Concept => (family.concepts.includes(wanted) ? wanted : family.concepts[family.concepts.length - 1]);

export const StoryViewer: React.FC<{readonly family: Family; readonly initialConcept: Concept; readonly route: RouteKind; readonly slug: string; readonly navigate: (slug: string | null) => void}> = ({family, initialConcept, route, slug, navigate}) => {
  const [sel, setSel] = useState<ViewerSelection>(() => readSelection(window.location.search, initialConcept));
  const [initial] = useState(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    return {checkpoint: Number(hash.get('c') ?? 0) || 0, hud: new URLSearchParams(window.location.search).has('hud')};
  });

  // Selection -> URL (replaceState: it is a view option, not a navigation).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const extra = new URLSearchParams();
    if (q.has('hud')) extra.set('hud', '');
    if (q.get('quality')) extra.set('quality', q.get('quality')!);
    window.history.replaceState(null, '', `${window.location.pathname}${writeSelection(sel, initialConcept, extra)}${window.location.hash}`);
  }, [sel, initialConcept]);

  const concept = resolveConcept(family, sel.concept);
  const primary = useMemo(() => viewFor(family, concept, sel.theme)!, [family, concept, sel.theme]);
  const secondary = useMemo<View | null>(() => {
    if (sel.compare.kind === 'concept') {
      const target = sel.compare.concept && sel.compare.concept !== concept && family.concepts.includes(sel.compare.concept) ? sel.compare.concept : otherConcept(family, concept);
      return target ? viewFor(family, target, sel.theme) : null;
    }
    if (sel.compare.kind === 'theme') return viewFor(family, concept, sel.compare.theme);
    return null;
  }, [sel.compare, family, concept, sel.theme]);

  const entry = useMemo(() => ({id: primary.id, episode: primary.episode, component: primary.component}), [primary]);
  const sibling = useCallback((d: number) => siblingSlug(route, slug, d), [route, slug]);

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

  const cycleConcept = useCallback(() => {
    setSel((s) => {
      const list = family.concepts;
      const i = list.indexOf(resolveConcept(family, s.concept));
      return {...s, concept: list[(i + 1) % list.length]};
    });
  }, [family]);

  const onKey = useCallback(
    (e: KeyboardEvent): boolean => {
      if (e.key === 'Escape' || e.key === 'g' || e.key === 'G') {
        if (e.key === 'Escape' && document.fullscreenElement) return false;
        navigate(null);
        return true;
      }
      if (e.key === '[' || e.key === ']') {
        navigate(sibling(e.key === ']' ? 1 : -1));
        return true;
      }
      if (e.key === 't' || e.key === 'T') {
        setSel((s) => ({...s, theme: THEME_IDS[(THEME_IDS.indexOf(s.theme) + 1) % THEME_IDS.length]}));
        return true;
      }
      if ((e.key === 'o' || e.key === 'O') && family.concepts.length > 1) {
        cycleConcept();
        return true;
      }
      if (e.key === 'c' || e.key === 'C') {
        setSel((s) => {
          if (s.compare.kind === 'off') return {...s, compare: family.concepts.length > 1 ? {kind: 'concept'} : {kind: 'theme', theme: nextTheme(s.theme)}};
          if (s.compare.kind === 'concept') return {...s, compare: {kind: 'theme', theme: nextTheme(s.theme)}};
          return {...s, compare: {kind: 'off'}};
        });
        return true;
      }
      return false;
    },
    [navigate, sibling, family, cycleConcept],
  );

  return (
    <div className="story-viewer" data-compare={secondary ? 'true' : 'false'} data-concept={concept} data-testid="story-viewer">
      <div className="story-pane story-pane-primary">
        <Presenter
          key={primary.id + JSON.stringify(primary.inputProps)}
          entry={entry}
          inputProps={primary.inputProps}
          initialCheckpoint={initial.checkpoint}
          initialHud={initial.hud}
          onKey={onKey}
          onFrame={onFrame}
          chrome={(ctx) => <StoryChrome ctx={ctx} family={family} concept={concept} sel={sel} setSel={setSel} navigate={navigate} sibling={sibling} primary={primary} secondary={secondary} />}
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
export const renderCommand = (family: Family, concept: Concept, theme: ThemeId): string => {
  if (concept === 'original' && family.legacy) return `npm run lab:render -- ${family.legacy.slug}`;
  if (concept === 'cinematic' && family.cinematic) return `npm run cine:render -- ${family.cinematic.slug.replace(/^cine-/, '')} --theme=${theme}`;
  if (family.story) return `npm run story:render -- ${family.story.slug} --theme=${theme}`;
  return '';
};

const StoryChrome: React.FC<{
  readonly ctx: PresenterContext;
  readonly family: Family;
  readonly concept: Concept;
  readonly sel: ViewerSelection;
  readonly setSel: React.Dispatch<React.SetStateAction<ViewerSelection>>;
  readonly navigate: (slug: string | null) => void;
  readonly sibling: (d: number) => string;
  readonly primary: View;
  readonly secondary: View | null;
}> = ({ctx, family, concept, sel, setSel, navigate, sibling, primary, secondary}) => {
  const {presenter, timeline} = ctx;
  const {state} = presenter;
  const N = timeline.beats.length;
  const running = state.status === 'playing' || state.status === 'timed';
  const visible = ctx.cursorVisible || ctx.hud;
  const upcoming = state.status === 'playing' ? timeline.beats[state.beat ?? 0] : timeline.beats[state.checkpoint];
  const [copied, setCopied] = useState(false);
  const cmd = renderCommand(family, concept, sel.theme);
  const setCompare = (compare: Compare) => setSel((s) => ({...s, compare}));
  const themeable = concept !== 'original';
  const number = concept === 'cinematic' && family.cinematic ? `X${String(family.cinematic.number).padStart(2, '0')}` : `S${String(family.number).padStart(2, '0')}`;
  const kind = concept === 'cinematic' && family.cinematic ? family.cinematic.kind : concept === 'original' && family.legacy ? family.legacy.kind : (family.story?.kind ?? '3D');
  const others = family.concepts.filter((c) => c !== concept);
  const compareTarget = sel.compare.kind === 'concept' ? (sel.compare.concept && others.includes(sel.compare.concept) ? sel.compare.concept : otherConcept(family, concept)) : undefined;

  return (
    <div className="lab-chrome story-chrome" data-visible={visible ? 'true' : 'false'} data-testid="lab-chrome">
      <div className="lab-bar">
        <Btn onClick={() => navigate(null)} title="Back to the gallery (G or Esc)" testId="lab-back">
          &larr; Gallery
        </Btn>
        <div className="lab-bar-title" data-testid="lab-title">
          <span className="lab-num">{number}</span>
          {family.title}
          <span className={`lab-kind lab-kind-${kind.toLowerCase()}`}>{kind}</span>
          <span className="story-view-title" data-testid="story-view-title">
            {primary.title}
            {secondary ? ` · vs ${secondary.title}` : ''}
          </span>
        </div>
        <div className="lab-bar-actions">
          <Btn onClick={() => navigate(sibling(-1))} title="Previous scene ( [ )" testId="lab-prev-sample">
            Previous
          </Btn>
          <Btn onClick={() => navigate(sibling(1))} title="Next scene ( ] )" testId="lab-next-sample">
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
          {(['original', 'redesign', 'cinematic'] as const).map((c) => {
            const has = family.concepts.includes(c);
            const hint = c === 'original' ? (family.legacy ? `Original: ${family.legacy.title}` : 'This scene has no original prototype') : c === 'redesign' ? (family.story ? 'The 2D story-driven redesign' : 'No 2D redesign of this scene') : family.cinematic ? 'The cinematic 3D reenactment' : 'No cinematic experiment for this scene';
            return (
              <Btn key={c} onClick={() => setSel((s) => ({...s, concept: c}))} title={`${hint} (O cycles)`} active={concept === c} disabled={!has} testId={`story-concept-${c}`}>
                {CONCEPT_LABEL[c]}
              </Btn>
            );
          })}
        </div>
        <div className="story-group" role="group" aria-label="Theme">
          <span className="story-label">Theme</span>
          {THEME_IDS.map((id) => (
            <Btn key={id} onClick={() => setSel((s) => ({...s, theme: id}))} title={`${THEMES[id].name}: ${THEMES[id].mood} (T cycles)`} active={sel.theme === id} disabled={!themeable} testId={`story-theme-${id}`}>
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
          <Btn
            onClick={() => {
              // Click again to cycle through the other treatments.
              const next = compareTarget ? others[(others.indexOf(compareTarget) + 1) % others.length] : otherConcept(family, concept);
              setCompare({kind: 'concept', concept: sel.compare.kind === 'concept' ? next : otherConcept(family, concept)});
            }}
            title="This treatment next to another one, synchronised at matching beats (C). Click again to cycle."
            active={sel.compare.kind === 'concept'}
            disabled={others.length === 0}
            testId="story-compare-concept"
          >
            vs {compareTarget ? CONCEPT_LABEL[compareTarget] : otherConcept(family, concept) ? CONCEPT_LABEL[otherConcept(family, concept)!] : 'other'}
          </Btn>
          <Btn onClick={() => setCompare({kind: 'theme', theme: sel.compare.kind === 'theme' ? nextTheme(sel.compare.theme) : nextTheme(sel.theme)})} title="Theme A vs theme B (click again to cycle B)" active={sel.compare.kind === 'theme'} disabled={!themeable} testId="story-compare-theme">
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
