import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {LAB_SAMPLES, findLabSample, labInfo, type LabSample} from '../../videos/style-lab/registry';
import {findStoryScene, type StoryScene} from '../../videos/style-lab/redesign';
import {getTheme} from '../../styles/themes';
import {Presenter, type PresenterContext} from '../PresentationApp';
import './lab.css';

/**
 * Style Lab: a gallery of the ten visual experiments (/style-lab) and a viewer
 * for one of them (/style-lab/<slug>). The viewer is the normal beat presenter
 * (same Player, same keys) with a thin layer of chrome that hides itself.
 *
 * Routing is two paths, so there is no router: the path is read on load and on
 * popstate, and navigation uses history.pushState.
 */

const BASE = '/style-lab';

/** `/style-lab/<slug>`, or the presenter-style `?episode=lab-<slug>`. */
const readSlug = (): string | null => {
  const m = window.location.pathname.match(/^\/style-lab\/([^/]+)/);
  if (m) return decodeURIComponent(m[1]);
  const episode = new URLSearchParams(window.location.search).get('episode');
  return episode && episode.startsWith('lab-') ? episode : null;
};

export const StyleLabApp: React.FC = () => {
  const [slug, setSlug] = useState(readSlug);

  useEffect(() => {
    const onPop = () => setSlug(readSlug());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((next: string | null) => {
    window.history.pushState(null, '', next ? `${BASE}/${next}` : BASE);
    setSlug(next);
  }, []);

  // Automation hook (Playwright): the sample list with frame-accurate beat sheets.
  useEffect(() => {
    (window as unknown as {__lab: unknown}).__lab = LAB_SAMPLES.map((s) => labInfo(s));
  }, []);

  const sample = findLabSample(slug);
  const story = sample ? undefined : findStoryScene(slug);
  useEffect(() => {
    document.title = sample ? `${String(sample.number).padStart(2, '0')} ${sample.title} · Style Lab` : story ? `${story.title} · Style Lab` : 'Style Lab';
  }, [sample, story]);

  if (sample) return <LabViewer key={sample.slug} sample={sample} navigate={navigate} />;
  if (story) return <StoryViewer key={story.slug} scene={story} navigate={navigate} />;
  if (slug && DEV_SCENES[`../../scenes/redesign/${slug}/index.tsx`]) return <DevStoryViewer key={slug} slug={slug} navigate={navigate} />;
  return <LabGallery navigate={navigate} />;
};

/* ------------------------------------------------------------------ gallery */

const num = (n: number) => String(n).padStart(2, '0');

const LabGallery: React.FC<{readonly navigate: (slug: string | null) => void}> = ({navigate}) => {
  const tiles = useRef<(HTMLAnchorElement | null)[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // 1..9 and 0 open a sample directly.
      if (/^[0-9]$/.test(e.key)) {
        const sample = LAB_SAMPLES[e.key === '0' ? 9 : Number(e.key) - 1];
        if (sample) {
          e.preventDefault();
          navigate(sample.slug);
        }
        return;
      }
      // Arrow keys move between tiles, following the grid as laid out.
      if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
      const els = tiles.current.filter((el): el is HTMLAnchorElement => el !== null);
      const current = els.indexOf(document.activeElement as HTMLAnchorElement);
      e.preventDefault();
      if (current < 0) {
        els[0]?.focus();
        return;
      }
      const top = els[0].getBoundingClientRect().top;
      const cols = Math.max(1, els.filter((el) => Math.abs(el.getBoundingClientRect().top - top) < 4).length);
      const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowDown' ? cols : -cols;
      els[Math.max(0, Math.min(els.length - 1, current + delta))]?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  return (
    <main className="lab">
      <header className="lab-head">
        <div>
          <h1>Style Lab</h1>
          <p>Ten motion experiments for the channel&rsquo;s look. Open one, then press the right arrow to play it beat by beat.</p>
        </div>
        <nav aria-label="Other episodes">
          <a href="/">Not detected</a>
          <a href="/?episode=RogueAgent">Rogue agent</a>
        </nav>
      </header>
      <ol className="lab-grid">
        {LAB_SAMPLES.map((sample, i) => (
          <li key={sample.slug}>
            <a
              ref={(el) => {
                tiles.current[i] = el;
              }}
              className="lab-tile"
              href={`${BASE}/${sample.slug}`}
              data-testid={`lab-tile-${sample.slug}`}
              onClick={(e) => {
                if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return;
                e.preventDefault();
                navigate(sample.slug);
              }}
            >
              <span className="lab-thumb">
                <Thumb sample={sample} />
              </span>
              <span className="lab-caption">
                <span className="lab-num">{num(sample.number)}</span>
                <span className="lab-title">{sample.title}</span>
                <span className={`lab-kind lab-kind-${sample.kind.toLowerCase()}`}>{sample.kind}</span>
              </span>
              <span className="lab-idea">{sample.idea}</span>
            </a>
          </li>
        ))}
      </ol>
      <footer className="lab-foot">
        <span>
          <kbd>1</kbd>&ndash;<kbd>0</kbd> open a sample
        </span>
        <span>
          <kbd>&rarr;</kbd> next beat
        </span>
        <span>
          <kbd>&larr;</kbd> back
        </span>
        <span>
          <kbd>R</kbd> replay
        </span>
        <span>
          <kbd>Space</kbd> play through
        </span>
        <span>
          <kbd>F</kbd> fullscreen
        </span>
        <span>
          <kbd>H</kbd> beat HUD
        </span>
      </footer>
    </main>
  );
};

/** Poster still (generated by `npm run lab:thumbs`); falls back to the number if it is missing. */
const Thumb: React.FC<{readonly sample: LabSample}> = ({sample}) => {
  const [missing, setMissing] = useState(false);
  if (missing) return <span className="lab-thumb-missing">{num(sample.number)}</span>;
  return <img src={`/lab/thumbs/${sample.slug}.jpg`} alt="" width={960} height={540} loading="lazy" onError={() => setMissing(true)} />;
};

/* ------------------------------------------------------------------- viewer */

const LabViewer: React.FC<{readonly sample: LabSample; readonly navigate: (slug: string | null) => void}> = ({sample, navigate}) => {
  const entry = useMemo(() => ({id: sample.id, episode: sample.episode, component: sample.component}), [sample]);
  const [initial] = useState(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    return {checkpoint: Number(hash.get('c') ?? 0) || 0, hud: new URLSearchParams(window.location.search).has('hud')};
  });

  const index = LAB_SAMPLES.indexOf(sample);
  const sibling = useCallback((d: number) => LAB_SAMPLES[(index + d + LAB_SAMPLES.length) % LAB_SAMPLES.length], [index]);

  const onKey = useCallback(
    (e: KeyboardEvent): boolean => {
      if (e.key === 'Escape' || e.key === 'g' || e.key === 'G') {
        // In fullscreen, Escape belongs to the browser (it leaves fullscreen).
        if (e.key === 'Escape' && document.fullscreenElement) return false;
        navigate(null);
        return true;
      }
      if (e.key === '[' || e.key === ']') {
        navigate(sibling(e.key === ']' ? 1 : -1).slug);
        return true;
      }
      if (/^[0-9]$/.test(e.key)) {
        const target = LAB_SAMPLES[e.key === '0' ? 9 : Number(e.key) - 1];
        if (target && target !== sample) navigate(target.slug);
        return true;
      }
      return false;
    },
    [navigate, sibling, sample],
  );

  return (
    <Presenter
      entry={entry}
      initialCheckpoint={initial.checkpoint}
      initialHud={initial.hud}
      onKey={onKey}
      chrome={(ctx) => <LabChrome ctx={ctx} sample={sample} navigate={navigate} sibling={sibling} />}
    />
  );
};

/** Any scene folder under src/scenes/redesign can be previewed before it is registered (authoring aid). */
const DEV_SCENES = import.meta.glob('../../scenes/redesign/*/index.tsx') as Record<string, () => Promise<{episode: StoryScene['episode']; Sample: StoryScene['component']}>>;

const DevStoryViewer: React.FC<{readonly slug: string; readonly navigate: (slug: string | null) => void}> = ({slug, navigate}) => {
  const [scene, setScene] = useState<StoryScene | null>(null);
  useEffect(() => {
    let live = true;
    DEV_SCENES[`../../scenes/redesign/${slug}/index.tsx`]().then((mod) => {
      if (!live) return;
      setScene({id: mod.episode.id, slug, number: 0, title: mod.episode.title, kind: '2D', understand: '', idea: '', episode: mod.episode, component: mod.Sample, status: 'built'});
    });
    return () => {
      live = false;
    };
  }, [slug]);
  return scene ? <StoryViewer scene={scene} navigate={navigate} /> : null;
};

/** Viewer for a redesigned scene: same presenter, theme from `?theme=`. (The full concept/theme UI lands with the gallery redesign.) */
const StoryViewer: React.FC<{readonly scene: StoryScene; readonly navigate: (slug: string | null) => void}> = ({scene, navigate}) => {
  const theme = getTheme(new URLSearchParams(window.location.search).get('theme')).id;
  const entry = useMemo(() => ({id: scene.id, episode: scene.episode, component: scene.component as React.ComponentType}), [scene]);
  const inputProps = useMemo(() => ({theme}), [theme]);
  const [initial] = useState(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    return {checkpoint: Number(hash.get('c') ?? 0) || 0, hud: new URLSearchParams(window.location.search).has('hud')};
  });
  const onKey = useCallback(
    (e: KeyboardEvent): boolean => {
      if (e.key === 'Escape' || e.key === 'g' || e.key === 'G') {
        if (e.key === 'Escape' && document.fullscreenElement) return false;
        navigate(null);
        return true;
      }
      return false;
    },
    [navigate],
  );
  return <Presenter entry={entry} inputProps={inputProps} initialCheckpoint={initial.checkpoint} initialHud={initial.hud} onKey={onKey} />;
};

/** Buttons that never take keyboard focus, so Space / arrows always reach the presenter. */
const Btn: React.FC<{readonly onClick: () => void; readonly title: string; readonly active?: boolean; readonly testId?: string; readonly children: React.ReactNode}> = ({
  onClick,
  title,
  active,
  testId,
  children,
}) => (
  <button type="button" tabIndex={-1} title={title} aria-pressed={active} data-testid={testId} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>
    {children}
  </button>
);

const LabChrome: React.FC<{
  readonly ctx: PresenterContext;
  readonly sample: LabSample;
  readonly navigate: (slug: string | null) => void;
  readonly sibling: (d: number) => LabSample;
}> = ({ctx, sample, navigate, sibling}) => {
  const {presenter, timeline} = ctx;
  const {state} = presenter;
  const N = timeline.beats.length;
  const running = state.status === 'playing' || state.status === 'timed';
  const visible = ctx.cursorVisible || ctx.hud;
  const upcoming = state.status === 'playing' ? timeline.beats[state.beat ?? 0] : timeline.beats[state.checkpoint];

  return (
    <div className="lab-chrome" data-visible={visible ? 'true' : 'false'} data-testid="lab-chrome">
      <div className="lab-bar">
        <Btn onClick={() => navigate(null)} title="Back to the gallery (G or Esc)" testId="lab-back">
          &larr; Gallery
        </Btn>
        <div className="lab-bar-title" data-testid="lab-title">
          <span className="lab-num">{num(sample.number)}</span>
          {sample.title}
          <span className={`lab-kind lab-kind-${sample.kind.toLowerCase()}`}>{sample.kind}</span>
        </div>
        <div className="lab-bar-actions">
          <Btn onClick={() => navigate(sibling(-1).slug)} title="Previous sample ( [ )" testId="lab-prev-sample">
            Previous
          </Btn>
          <Btn onClick={() => navigate(sibling(1).slug)} title="Next sample ( ] )" testId="lab-next-sample">
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
          <Btn onClick={ctx.toggleFullscreen} title="Fullscreen (F)" active={ctx.isFullscreen} testId="lab-fullscreen">
            Fullscreen
          </Btn>
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
            <em>End of sample</em>
          )}
          <b>
            {Math.min(state.checkpoint + (state.status === 'playing' ? 1 : 0), N)}/{N}
          </b>
        </span>
      </div>
    </div>
  );
};
