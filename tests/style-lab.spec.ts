import {expect, test, type Page} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Real-browser tests of the Style Lab: the gallery at /style-lab and the ten
 * samples in the beat presenter. Every sample is walked beat by beat with
 * genuine key presses; state is read through `window.__presenter` and
 * `window.__lab` (exposed by the app for automation).
 *
 * Checkpoint screenshots are written to test-results/style-lab/<slug>/.
 */

const SLUGS = ['01-hero', '02-agent', '03-swarm', '04-network', '05-scan', '06-cloud', '07-source', '08-media', '09-diagram', '10-ending'];

type LabInfo = {slug: string; title: string; kind: string; durationInFrames: number; checkpoints: number[]; beats: {id: string}[]};
type PresenterWindow = {
  __presenter: {
    state: {checkpoint: number; status: string; beat: number | null};
    frame: number;
    isPlaying: boolean;
    episode: string;
    timeline: {fps: number; durationInFrames: number; checkpoints: number[]; beats: {id: string; start: number; animEnd: number; end: number}[]};
    goTo: (c: number) => void;
  };
  __lab: LabInfo[];
};
const errorsFor = new WeakMap<Page, string[]>();

const watch = (page: Page) => {
  const errors: string[] = [];
  errorsFor.set(page, errors);
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
  });
  return errors;
};

const openSample = async (page: Page, slug: string, suffix = '') => {
  const errors = errorsFor.get(page) ?? watch(page);
  await page.goto(`/style-lab/${slug}${suffix}`);
  try {
    await page.waitForFunction(() => (window as unknown as PresenterWindow).__presenter?.frame >= 0, null, {timeout: 30_000});
  } catch {
    throw new Error(`Sample ${slug} did not start. Page errors:\n${errors.join('\n') || '(none)'}`);
  }
  return page.evaluate(() => {
    const p = (window as unknown as PresenterWindow).__presenter;
    return {episode: p.episode, checkpoints: p.timeline.checkpoints, beats: p.timeline.beats, fps: p.timeline.fps, durationInFrames: p.timeline.durationInFrames};
  });
};

const waitHolding = (page: Page, checkpoint: number, timeout = 30_000) =>
  page.waitForFunction(
    (c) => {
      const p = (window as unknown as PresenterWindow).__presenter;
      return p.state.status === 'holding' && p.state.checkpoint === c && !p.isPlaying;
    },
    checkpoint,
    {timeout},
  );

const snapshot = (page: Page) =>
  page.evaluate(() => {
    const p = (window as unknown as PresenterWindow).__presenter;
    return {state: {...p.state}, frame: p.frame, isPlaying: p.isPlaying};
  });

test.beforeEach(async ({page}) => {
  watch(page);
});

test.afterEach(async ({page}) => {
  expect(errorsFor.get(page) ?? [], 'no page errors / console errors').toEqual([]);
});

test.describe('gallery', () => {
  test('lists all ten samples with thumbnails', async ({page}) => {
    await page.goto('/style-lab');
    const tiles = page.locator('.lab-tile');
    await expect(tiles).toHaveCount(10);
    for (const slug of SLUGS) await expect(page.getByTestId(`lab-tile-${slug}`)).toBeVisible();
    // Thumbnails are real rendered stills, all loaded.
    await expect
      .poll(() => page.evaluate(() => Array.from(document.querySelectorAll<HTMLImageElement>('.lab-thumb img')).filter((img) => img.complete && img.naturalWidth > 0).length))
      .toBe(10);
    await expect(page.locator('.lab-thumb-missing')).toHaveCount(0);
    // The registry behind it: ten samples, each a short multi-beat clip.
    const lab = await page.evaluate(() => (window as unknown as PresenterWindow).__lab);
    expect(lab.map((s) => s.slug)).toEqual(SLUGS);
    for (const s of lab) {
      const seconds = s.durationInFrames / 60;
      expect(s.beats.length, `${s.slug} beats`).toBeGreaterThanOrEqual(3);
      expect(s.beats.length, `${s.slug} beats`).toBeLessThanOrEqual(6);
      expect(seconds, `${s.slug} length`).toBeGreaterThanOrEqual(5);
      expect(seconds, `${s.slug} length`).toBeLessThanOrEqual(13);
    }
  });

  test('opens a sample by click and by number key; Escape, [ and ] navigate', async ({page}) => {
    await page.goto('/style-lab');
    await page.getByTestId('lab-tile-02-agent').click();
    await expect(page).toHaveURL(/\/style-lab\/02-agent/);
    await page.waitForFunction(() => (window as unknown as PresenterWindow).__presenter?.episode === 'lab-02-agent');
    await expect(page.getByTestId('lab-title')).toContainText('A single agent');

    await page.keyboard.press(']');
    await page.waitForFunction(() => (window as unknown as PresenterWindow).__presenter?.episode === 'lab-03-swarm');
    await expect(page).toHaveURL(/\/style-lab\/03-swarm/);
    await page.keyboard.press('[');
    await page.waitForFunction(() => (window as unknown as PresenterWindow).__presenter?.episode === 'lab-02-agent');

    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(/\/style-lab$/);
    await expect(page.locator('.lab-tile')).toHaveCount(10);

    await page.keyboard.press('9');
    await page.waitForFunction(() => (window as unknown as PresenterWindow).__presenter?.episode === 'lab-09-diagram');
    // Browser back returns to the gallery.
    await page.goBack();
    await expect(page.locator('.lab-tile')).toHaveCount(10);
  });

  test('arrow keys move focus between tiles and Enter opens', async ({page}) => {
    await page.goto('/style-lab');
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('lab-tile-01-hero')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('lab-tile-03-swarm')).toBeFocused();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => (window as unknown as PresenterWindow).__presenter?.episode === 'lab-03-swarm');
  });

  test('the regular presentation app is still at /', async ({page}) => {
    await page.goto('/');
    await page.waitForFunction(() => (window as unknown as PresenterWindow).__presenter?.frame >= 0);
    expect(await page.evaluate(() => (window as unknown as PresenterWindow).__presenter.episode)).toBe('NotDetected');
    await expect(page.locator('.lab-chrome')).toHaveCount(0);
  });
});

test.describe('samples in the presenter', () => {
  for (const slug of SLUGS) {
    test(`${slug}: every beat plays on ArrowRight and holds on its exact checkpoint`, async ({page}) => {
      test.setTimeout(180_000);
      const info = await openSample(page, slug);
      expect(info.episode).toBe(`lab-${slug}`);
      const dir = path.join('test-results', 'style-lab', slug);
      fs.mkdirSync(dir, {recursive: true});
      const N = info.beats.length;

      expect((await snapshot(page)).state).toEqual({checkpoint: 0, status: 'holding', beat: null});
      await page.waitForTimeout(400);
      await page.screenshot({path: path.join(dir, 'c00.png')});

      for (let c = 1; c <= N; c++) {
        await page.keyboard.press('ArrowRight');
        await waitHolding(page, c);
        await page.waitForTimeout(250);
        const snap = await snapshot(page);
        expect(snap.frame, `checkpoint ${c}`).toBe(info.checkpoints[c]);
        expect(snap.isPlaying).toBe(false);
        await page.screenshot({path: path.join(dir, `c${String(c).padStart(2, '0')}.png`)});
      }

      // The hold is indefinite: nothing moves, and a further press does nothing at the end.
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(700);
      const end = await snapshot(page);
      expect(end.state).toEqual({checkpoint: N, status: 'holding', beat: null});
      expect(end.frame).toBe(info.checkpoints[N]);

      // ArrowLeft returns to the previous checkpoint instantly.
      await page.keyboard.press('ArrowLeft');
      await waitHolding(page, N - 1);
      expect((await snapshot(page)).frame).toBe(info.checkpoints[N - 1]);

      // R replays the beat that led here and lands on the same frame.
      await page.keyboard.press('r');
      await page.waitForFunction(() => (window as unknown as PresenterWindow).__presenter.state.status === 'playing', null, {timeout: 5_000});
      expect((await snapshot(page)).state.beat).toBe(N - 2);
      await waitHolding(page, N - 1);
      expect((await snapshot(page)).frame).toBe(info.checkpoints[N - 1]);
    });
  }

  test('holds are static: two screenshots of a checkpoint are pixel-identical (3D, media and 2D samples)', async ({page}) => {
    test.setTimeout(180_000);
    let hotUpdates = 0;
    page.on('console', (m) => {
      if (/\[vite\] (hot updated|page reload)/.test(m.text())) hotUpdates++;
    });
    for (const slug of ['03-swarm', '08-media', '09-diagram']) {
      const info = await openSample(page, slug);
      const c = Math.min(3, info.beats.length);
      let identical = false;
      for (let attempt = 0; attempt < 3 && !identical; attempt++) {
        await page.evaluate((c) => (window as unknown as PresenterWindow).__presenter.goTo(c), c);
        await waitHolding(page, c);
        // Let the viewer chrome fade out (1.5 s without mouse movement, then a short fade).
        await page.waitForTimeout(2600);
        const before = hotUpdates;
        const a = await page.screenshot();
        await page.waitForTimeout(600);
        const b = await page.screenshot();
        identical = a.equals(b);
        if (!identical && hotUpdates === before) break;
      }
      expect(identical, `${slug} checkpoint ${c} is static`).toBe(true);
    }
  });

  test('Space plays through on export timing; pause freezes; ArrowRight finishes the beat', async ({page}) => {
    const info = await openSample(page, '02-agent');
    await page.keyboard.press(' ');
    await page.waitForFunction(() => {
      const p = (window as unknown as PresenterWindow).__presenter;
      return p.state.status === 'timed' && p.isPlaying;
    });
    // Let it run into the first beat, then pause part-way.
    await page.waitForFunction((start) => (window as unknown as PresenterWindow).__presenter.frame > start + 20, info.beats[0].start, {timeout: 10_000});
    await page.keyboard.press(' ');
    await page.waitForFunction(() => (window as unknown as PresenterWindow).__presenter.state.status === 'paused');
    const paused = await snapshot(page);
    expect(paused.isPlaying).toBe(false);
    expect(paused.frame).toBeGreaterThan(info.beats[0].start);
    expect(paused.frame).toBeLessThan(info.beats[0].animEnd);
    await page.waitForTimeout(500);
    expect((await snapshot(page)).frame).toBe(paused.frame);
    // ArrowRight completes the interrupted beat and holds exactly on its checkpoint.
    await page.keyboard.press('ArrowRight');
    await waitHolding(page, 1);
    expect((await snapshot(page)).frame).toBe(info.checkpoints[1]);
    // Timed playback counts checkpoints as it passes them and ends holding on the last one.
    await page.evaluate((c) => (window as unknown as PresenterWindow).__presenter.goTo(c), info.beats.length - 1);
    await waitHolding(page, info.beats.length - 1);
    await page.keyboard.press(' ');
    await waitHolding(page, info.beats.length, 20_000);
    expect((await snapshot(page)).frame).toBe(info.checkpoints[info.beats.length]);
  });

  test('viewer chrome: play button, beat dots, HUD and restart work and stay outside the composition', async ({page}) => {
    const info = await openSample(page, '09-diagram');
    await page.mouse.move(400, 400);
    await page.mouse.move(500, 500);
    await expect(page.getByTestId('lab-chrome')).toHaveAttribute('data-visible', 'true');
    await page.getByTestId('lab-dot-2').click();
    await waitHolding(page, 2);
    expect((await snapshot(page)).frame).toBe(info.checkpoints[2]);
    await page.getByTestId('lab-hud').click();
    await expect(page.getByTestId('hud')).toBeVisible();
    await expect(page.getByTestId('hud-checkpoint')).toHaveText(`2/${info.beats.length}`);
    await page.getByTestId('lab-restart').click();
    await waitHolding(page, 0);
    await page.getByTestId('lab-play').click();
    await page.waitForFunction(() => (window as unknown as PresenterWindow).__presenter.state.status === 'timed');
    await page.getByTestId('lab-play').click();
    await page.waitForFunction(() => (window as unknown as PresenterWindow).__presenter.state.status === 'paused');
    // Chrome and HUD are siblings of the Player, never inside the rendered composition.
    const inside = await page.evaluate(() => {
      const stage = document.querySelector('.stage')!;
      const playerRoot = stage.firstElementChild!;
      return [document.querySelector('[data-testid="lab-chrome"]')!, document.querySelector('[data-testid="hud"]')!].some((el) => playerRoot.contains(el));
    });
    expect(inside).toBe(false);
    // Without mouse movement the chrome hides itself.
    await page.getByTestId('lab-hud').click();
    await page.waitForTimeout(2200);
    await expect(page.getByTestId('lab-chrome')).toHaveAttribute('data-visible', 'false');
  });

  test('fullscreen: the 16:9 scene fits the screen without clipping, and beats still play', async ({page}) => {
    const info = await openSample(page, '01-hero', '#c=1');
    await waitHolding(page, 1);
    expect((await snapshot(page)).frame).toBe(info.checkpoints[1]);
    await page.keyboard.press('f');
    await page.waitForFunction(() => document.fullscreenElement !== null, null, {timeout: 5_000});
    await expect(page.locator('.stage')).toHaveAttribute('data-fullscreen', 'true');
    const fit = await page.evaluate(() => {
      // The Player scales a 1920x1080 container to fit; find it and measure what is on screen.
      const candidates = Array.from(document.querySelectorAll<HTMLElement>('.stage div')).filter((el) => el.style.width === '1920px' && el.style.height === '1080px');
      const r = candidates[0].getBoundingClientRect();
      return {x: r.x, y: r.y, width: r.width, height: r.height, vw: window.innerWidth, vh: window.innerHeight};
    });
    expect(fit.x).toBeGreaterThanOrEqual(-0.5);
    expect(fit.y).toBeGreaterThanOrEqual(-0.5);
    expect(fit.x + fit.width).toBeLessThanOrEqual(fit.vw + 0.5);
    expect(fit.y + fit.height).toBeLessThanOrEqual(fit.vh + 0.5);
    expect(fit.width / fit.height).toBeCloseTo(16 / 9, 2);
    // It uses the available space: touches the screen edge on at least one axis.
    expect(Math.max(fit.width / fit.vw, fit.height / fit.vh)).toBeGreaterThan(0.995);
    await page.keyboard.press('ArrowRight');
    await waitHolding(page, 2);
    expect((await snapshot(page)).frame).toBe(info.checkpoints[2]);
    await page.keyboard.press('f');
    await page.waitForFunction(() => document.fullscreenElement === null, null, {timeout: 5_000});
  });
});
