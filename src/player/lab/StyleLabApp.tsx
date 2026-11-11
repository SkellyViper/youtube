import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {LAB_SAMPLES, findLabSample, labInfo, type LabSample} from '../../videos/style-lab/registry';
import {STORY_SCENES, type StoryScene} from '../../videos/style-lab/redesign';
import {CINEMATIC_SCENES, findCinematicScene, type CinematicScene} from '../../videos/style-lab/cinematic';
import {ShotEditor} from './editor/ShotEditor';
import {familyForSlug} from './family';
import {THEMES, THEME_IDS} from '../../styles/themes';
import {video01} from '../../styles/video01';
import {StoryViewer} from './StoryViewer';
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

/** `/style-lab/<slug>/edit`: the shot editor for an editable 3D scene. */
const readEdit = (): boolean => /^\/style-lab\/[^/]+\/edit\/?$/.test(window.location.pathname);

/** `/style-lab/<slug>`, or the presenter-style `?episode=lab-<slug>`. */
const readSlug = (): string | null => {
  const m = window.location.pathname.match(/^\/style-lab\/([^/]+)/);
  if (m) return decodeURIComponent(m[1]);
  const episode = new URLSearchParams(window.location.search).get('episode');
  return episode && episode.startsWith('lab-') ? episode : null;
};

export const StyleLabApp: React.FC = () => {
  const [slug, setSlug] = useState(readSlug);
  const [edit, setEdit] = useState(readEdit);

  useEffect(() => {
    const onPop = () => {
      setSlug(readSlug());
      setEdit(readEdit());
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  /** `slug` = a scene; `slug/edit` = its shot editor; null = the gallery. */
  const navigate = useCallback((next: string | null) => {
    const isEdit = Boolean(next && next.endsWith('/edit'));
    const target = next ? next.replace(/\/edit$/, '') : null;
    window.history.pushState(null, '', target ? `${BASE}/${target}${isEdit ? '/edit' : ''}` : BASE);
    setSlug(target);
    setEdit(isEdit);
  }, []);

  // Automation hook (Playwright): the sample list with frame-accurate beat sheets.
  useEffect(() => {
    (window as unknown as {__lab: unknown}).__lab = LAB_SAMPLES.map((s) => labInfo(s));
  }, []);

  const sample = findLabSample(slug);
  const fam = sample ? undefined : familyForSlug(slug);
  useEffect(() => {
    document.title = sample ? `${String(sample.number).padStart(2, '0')} ${sample.title} · Style Lab` : fam ? `${fam.family.title} · Style Lab` : 'Style Lab';
  }, [sample, fam]);

  const editable = edit ? findCinematicScene(slug) : undefined;
  if (editable?.shot && editable.baseEpisode) return <ShotEditor key={`edit:${editable.slug}`} scene={editable} navigate={navigate} />;
  if (sample) return <LabViewer key={sample.slug} sample={sample} navigate={navigate} />;
  if (fam && slug) return <StoryViewer key={slug} family={fam.family} initialConcept={fam.concept} route={fam.route} slug={slug} navigate={navigate} />;
  if (slug && DEV_SCENES[`../../scenes/redesign/${slug}/index.tsx`]) return <DevStoryViewer key={slug} slug={slug} load={DEV_SCENES[`../../scenes/redesign/${slug}/index.tsx`]} navigate={navigate} />;
  if (slug && slug.startsWith('cine-') && DEV_CINE[`../../scenes/cinematic/${slug.slice(5)}/index.tsx`]) return <DevStoryViewer key={slug} slug={slug} kind="3D" load={DEV_CINE[`../../scenes/cinematic/${slug.slice(5)}/index.tsx`]} navigate={navigate} />;
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
          <p>The channel&rsquo;s visual language, in motion. Open a scene, then press the right arrow to play it beat by beat.</p>
        </div>
        <nav aria-label="Other episodes">
          <a href="/">Not detected</a>
          <a href="/?episode=RogueAgent">Rogue agent</a>
        </nav>
      </header>
      <Video01Section />
      <section className="lab-section" aria-labelledby="cine-h">
        <div className="lab-section-head">
          <h2 id="cine-h">3D shots</h2>
          <p>X01 and X02 are Style Lab V2 shots: the legacy look, a locked camera, and an editable shot (Edit shot). X02 is the reference for Video 01. X03–X06 are the earlier documentary-style experiments, kept until their redesign.</p>
        </div>
        <ol className="lab-grid">
          {CINEMATIC_SCENES.map((scene) => (
            <li key={scene.slug}>
              <a
                className="cine-tile"
                href={`${BASE}/${scene.slug}`}
                data-testid={`cine-tile-${scene.slug}`}
                onClick={(e) => {
                  if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return;
                  e.preventDefault();
                  navigate(scene.slug);
                }}
              >
                <span className="cine-thumb">
                  <CineThumb scene={scene} />
                </span>
                <span className="lab-caption">
                  <span className="lab-num">X{num(scene.number)}</span>
                  <span className="lab-title">{scene.title}</span>
                  <span className={`lab-kind lab-kind-${scene.kind.toLowerCase()}`}>{scene.kind}</span>
                </span>
                <span className="story-tile-understand">{scene.understand}</span>
                <span className="story-tile-meta">
                  {scene.shot ? (
                    <span
                      role="link"
                      tabIndex={0}
                      className="pill is-edit"
                      data-testid={`edit-shot-${scene.slug}`}
                      title="Open the shot editor: objects, lights, camera lock, beat timing"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        navigate(`${scene.slug}/edit`);
                      }}
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter') return;
                        e.preventDefault();
                        e.stopPropagation();
                        navigate(`${scene.slug}/edit`);
                      }}
                    >
                      Edit shot
                    </span>
                  ) : null}
                  <span className="pill is-cine">{scene.legacy ? 'Original + Redesign + Cinematic' : 'Redesign + Cinematic'}</span>
                  <span className="cine-tests">{scene.tests.join(' · ')}</span>
                </span>
              </a>
            </li>
          ))}
        </ol>
      </section>
      <section className="lab-section" aria-labelledby="story-h">
        <div className="lab-section-head">
          <h2 id="story-h">Episode scenes · story-driven redesign</h2>
          <p>Ten scenes from the first video. Open one, pick Original or Redesign, a theme, and a comparison.</p>
        </div>
        <ol className="lab-grid">
          {STORY_SCENES.map((scene) => (
            <li key={scene.slug}>
              <a
                className="story-tile"
                href={`${BASE}/${scene.slug}`}
                data-testid={`story-tile-${scene.slug}`}
                onClick={(e) => {
                  if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return;
                  e.preventDefault();
                  navigate(scene.slug);
                }}
              >
                <span className="story-thumb">
                  <StoryThumb scene={scene} />
                </span>
                <span className="lab-caption">
                  <span className="lab-num">S{num(scene.number)}</span>
                  <span className="lab-title">{scene.title}</span>
                  <span className={`lab-kind lab-kind-${scene.kind.toLowerCase()}`}>{scene.kind}</span>
                </span>
                <span className="story-tile-understand">{scene.understand}</span>
                <span className="story-tile-meta">
                  <span className={`pill ${scene.legacy ? 'is-on' : ''}`}>{scene.legacy ? 'Original + Redesign' : 'Redesign only'}</span>
                  <span className="story-swatches" aria-hidden="true">
                    {THEME_IDS.map((id) => (
                      <i key={id} style={{background: THEMES[id].tone.mind.base}} title={THEMES[id].name} />
                    ))}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ol>
      </section>
      <section className="lab-section" aria-labelledby="legacy-h">
        <div className="lab-section-head">
          <h2 id="legacy-h">Legacy experiments · the original ten</h2>
          <p>Kept as they were. Samples that match a scene brief also open as that scene's Original concept.</p>
        </div>
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
      </section>
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

/**
 * Video 01 · Legacy / Digital Noir: the episode's style, with its reference
 * shot. Swatches and rules are read from the `noir` theme and the tokens in
 * src/styles/video01.ts, so this card cannot drift from what scenes render.
 * The link is a plain navigation: it carries `?theme=noir`, which the viewer
 * reads on load.
 */
const Video01Section: React.FC = () => {
  const th = THEMES[video01.theme];
  const reference = `${BASE}/cine-02-wrong-project?theme=${video01.theme}`;
  const colours: readonly (readonly [string, string, string])[] = [
    ['Blue', th.tone.system.base, 'People, ordinary activity, neutral systems'],
    ['Purple', th.tone.mind.base, 'AI agents, anything running on its own'],
    ['Red', th.tone.threat.base, 'Compromise, danger, escalation'],
    ['Void', th.color.void, 'The base of every frame'],
  ];
  const rules: readonly (readonly [string, string])[] = [
    ['Camera', 'One locked wide shot per scene. Cut to an insert for evidence; never travel to it.'],
    ['People', 'Featureless figures of light with contour lines, dimmer than the screens they look at.'],
    ['Objects', 'Only what the story needs: dark matter with one hairline of light.'],
    ['Motion', 'Small gestures and real changes on screens. Nothing moves to fill time.'],
  ];
  return (
    <section className="lab-section v01" aria-labelledby="v01-h" data-testid="video01-style">
      <div className="lab-section-head">
        <h2 id="v01-h">Video 01 · {video01.name}</h2>
        <p>The first episode&rsquo;s look, taken from its approved shot. Every themed scene can be viewed in it: choose {th.name} in the viewer, or add ?theme={video01.theme}.</p>
      </div>
      <div className="v01-body">
        <a className="v01-ref" href={reference} data-testid="video01-reference">
          <span className="cine-thumb">
            <img src="/lab/video01/reference.jpg" alt="A figure made of light at a curved monitor on a dark grid floor: the game on the left of the screen, a coding agent's terminal on the right." width={1280} height={720} loading="lazy" />
          </span>
          <span className="lab-caption">
            <span className="lab-num">X02</span>
            <span className="lab-title">The wrong project</span>
            <span className="lab-kind lab-kind-3d">Reference shot</span>
          </span>
        </a>
        <div className="v01-spec">
          <dl className="v01-colours">
            {colours.map(([name, hex, role]) => (
              <div key={name}>
                <dt>
                  <i style={{background: hex}} aria-hidden="true" />
                  {name}
                </dt>
                <dd>
                  {role} <code>{hex}</code>
                </dd>
              </div>
            ))}
          </dl>
          <dl className="v01-rules">
            {rules.map(([name, rule]) => (
              <div key={name}>
                <dt>{name}</dt>
                <dd>{rule}</dd>
              </div>
            ))}
          </dl>
          <p className="v01-files">
            <span>
              Guide <code>docs/VIDEO_01_VISUAL_LANGUAGE.md</code>
            </span>
            <span>
              Tokens <code>src/styles/video01.ts</code>
            </span>
            <span>
              Kit <code>src/components/video01</code>
            </span>
          </p>
        </div>
      </div>
    </section>
  );
};

/** Poster still of a cinematic experiment (`npm run cine:thumbs`); falls back to the number. */
const CineThumb: React.FC<{readonly scene: CinematicScene}> = ({scene}) => {
  const [missing, setMissing] = useState(false);
  if (missing) return <span className="lab-thumb-missing">X{num(scene.number)}</span>;
  return <img src={`/lab/thumbs/${scene.slug}.jpg`} alt="" width={960} height={540} loading="lazy" onError={() => setMissing(true)} />;
};

/** Poster still of a redesigned scene (`node scripts/story.mjs thumbs`); falls back to the number. */
const StoryThumb: React.FC<{readonly scene: StoryScene}> = ({scene}) => {
  const [missing, setMissing] = useState(false);
  if (missing) return <span className="lab-thumb-missing">S{num(scene.number)}</span>;
  return <img src={`/lab/thumbs/story-${scene.slug}.jpg`} alt="" width={960} height={540} loading="lazy" onError={() => setMissing(true)} />;
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

/** Any scene folder under src/scenes/redesign or src/scenes/cinematic (as `cine-<folder>`) can be previewed before it is registered (authoring aid). */
type DevMod = {episode: StoryScene['episode']; Sample: StoryScene['component']};
const DEV_SCENES = import.meta.glob('../../scenes/redesign/*/index.tsx') as Record<string, () => Promise<DevMod>>;
const DEV_CINE = import.meta.glob('../../scenes/cinematic/*/index.tsx') as Record<string, () => Promise<DevMod>>;

const DevStoryViewer: React.FC<{readonly slug: string; readonly kind?: StoryScene['kind']; readonly load: () => Promise<DevMod>; readonly navigate: (slug: string | null) => void}> = ({slug, kind = '2D', load, navigate}) => {
  const [scene, setScene] = useState<StoryScene | null>(null);
  useEffect(() => {
    let live = true;
    load().then((mod) => {
      if (!live) return;
      setScene({id: mod.episode.id, slug, number: 0, title: mod.episode.title, kind, understand: '', idea: '', episode: mod.episode, component: mod.Sample, status: 'built'});
    });
    return () => {
      live = false;
    };
  }, [slug, kind, load]);
  // An unregistered scene is a family of one.
  return scene ? <StoryViewer family={{key: slug, number: 0, title: scene.title, understand: '', story: scene, concepts: ['redesign']}} initialConcept="redesign" route="story" slug={slug} navigate={navigate} /> : null;
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
