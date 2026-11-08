import {expect, test, type Page} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Real-browser tests of the cinematic 3D experiments in the Style Lab: the
 * gallery section, opening an experiment, the three-way concept switch
 * (Original | Redesign | Cinematic 3D), keyboard beats with exact checkpoint
 * frames, back and replay, deterministic seeking, fullscreen, and the
 * synchronised compare view. State is read through `window.__presenter`.
 *
 * Checkpoint screenshots are written to test-results/cinematic-lab/<slug>/.
 */

const SLUGS = ['cine-01-john', 'cine-02-wrong-project', 'cine-03-still-running', 'cine-04-swarm', 'cine-05-blind-spot', 'cine-06-evidence'];

type PresenterWindow = {
  __presenter: {
    state: {checkpoint: number; status: string; beat: number | null};
    frame: number;
    isPlaying: boolean;
    episode: string;
    timeline: {fps: number; durationInFrames: number; checkpoints: number[]; beats: {id: string; start: number; animEnd: number; end: number}[]};
    goTo: (c: number) => void;
    seek: (f: number) => void;
  };
};

const errorsFor = new WeakMap<Page, string[]>();
const watch = (page: Page) => {
  const errors: string[] = [];
  errorsFor.set(page, errors);
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    // Missing optional thumbnails (404) are not errors for these tests.
    if (m.type() === 'error' && !/404/.test(m.text())) errors.push(`console.error: ${m.text()}`);
  });
  return errors;
};

const ready = (page: Page) => page.waitForFunction(() => (window as unknown as PresenterWindow).__presenter?.frame >= 0, null, {timeout: 90_000});
const waitHolding = (page: Page, c: number) =>
  page.waitForFunction(
    (cp) => {
      const p = (window as unknown as PresenterWindow).__presenter;
      return p.state.status === 'holding' && p.state.checkpoint === cp && !p.isPlaying;
    },
    c,
    {timeout: 90_000},
  );
const presenter = (page: Page) =>
  page.evaluate(() => {
    const p = (window as unknown as PresenterWindow).__presenter;
    return {episode: p.episode, frame: p.frame, state: {...p.state}, checkpoints: p.timeline.checkpoints, beats: p.timeline.beats, durationInFrames: p.timeline.durationInFrames};
  });

/** The viewer chrome auto-hides 1.5 s after the mouse stops; a user moves the mouse, then clicks. */
const click = async (page: Page, testId: string) => {
  await page.mouse.move(640, 360);
  await page.mouse.move(650, 370);
  await page.getByTestId(testId).click();
};

/** Pixel fingerprint of the composition (the chrome has faded out after 2 s without mouse movement). */
const fingerprint = async (page: Page) => {
  await page.waitForTimeout(2200);
  const buf = await page.locator('.story-pane-primary').screenshot({type: 'png'});
  let h = 0;
  for (let i = 0; i < buf.length; i += 97) h = (h * 31 + buf[i]) >>> 0;
  return h;
};

test.beforeEach(async ({page}) => {
  watch(page);
});
test.afterEach(async ({page}) => {
  expect(errorsFor.get(page) ?? [], 'no page errors / console errors').toEqual([]);
});

test.describe('gallery', () => {
  test('lists the six cinematic experiments above the story scenes and the legacy samples', async ({page}) => {
    await page.goto('/style-lab');
    await expect(page.locator('.cine-tile')).toHaveCount(6);
    await expect(page.locator('.story-tile')).toHaveCount(10);
    await expect(page.locator('.lab-tile')).toHaveCount(10);
    for (const slug of SLUGS) await expect(page.getByTestId(`cine-tile-${slug}`)).toBeVisible();
    // Each tile says what the muted viewer should understand.
    const texts = await page.locator('.cine-tile .story-tile-understand').allTextContents();
    for (const t of texts) expect(t.length).toBeGreaterThan(20);
  });

  test('opens an experiment as the Cinematic concept; Original, Redesign and Cinematic switch; the URL carries the selection', async ({page}) => {
    await page.goto('/style-lab');
    await page.getByTestId('cine-tile-cine-02-wrong-project').click();
    await expect(page).toHaveURL(/\/style-lab\/cine-02-wrong-project/);
    await ready(page);
    expect((await presenter(page)).episode).toBe('cine-02-wrong-project');
    await page.mouse.move(640, 360);
    await expect(page.getByTestId('story-concept-cinematic')).toHaveAttribute('aria-pressed', 'true');
    // To the 2D redesign of the same scene and back.
    await click(page, 'story-concept-redesign');
    await expect(page).toHaveURL(/concept=redesign/);
    await page.waitForFunction(() => (window as unknown as PresenterWindow).__presenter?.episode === 'story-02-wrong-project');
    await click(page, 'story-concept-cinematic');
    await page.waitForFunction(() => (window as unknown as PresenterWindow).__presenter?.episode === 'cine-02-wrong-project');
    // The render command names the cinematic tooling.
    await click(page, 'story-theme-infrared');
    await expect(page.getByTestId('story-cmd')).toContainText('npm run cine:render -- 02-wrong-project --theme=infrared');
  });

  test('a story scene offers its cinematic treatment as a third concept and compares with it', async ({page}) => {
    await page.goto('/style-lab/04-replication');
    await ready(page);
    expect((await presenter(page)).episode).toBe('story-04-replication');
    await page.mouse.move(640, 360);
    await expect(page.getByTestId('story-concept-original')).not.toHaveAttribute('aria-disabled', 'true');
    await click(page, 'story-concept-cinematic');
    await page.waitForFunction(() => (window as unknown as PresenterWindow).__presenter?.episode === 'cine-04-swarm');
    await expect(page).toHaveURL(/concept=cinematic/);
    await click(page, 'story-compare-concept');
    await expect(page).toHaveURL(/compare=concept/);
    await expect(page.getByTestId('story-follower')).toBeVisible();
  });

  test('reloading a cinematic URL restores concept, theme, compare and checkpoint', async ({page}) => {
    await page.goto('/style-lab/cine-01-john?theme=glacial&compare=concept:redesign#c=2');
    await ready(page);
    await expect(page.getByTestId('story-follower')).toBeVisible();
    const p = await presenter(page);
    expect(p.episode).toBe('cine-01-john');
    expect(p.state.checkpoint).toBe(2);
    expect(p.frame).toBe(p.checkpoints[2]);
    await page.mouse.move(640, 360);
    await expect(page.getByTestId('story-theme-glacial')).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('presenting the cinematic experiments', () => {
  for (const slug of SLUGS) {
    test(`${slug}: ArrowRight plays each beat and holds on the exact checkpoint; ArrowLeft and R work; the final hold is still`, async ({page}) => {
      test.setTimeout(420_000);
      await page.goto(`/style-lab/${slug}`);
      await ready(page);
      const {checkpoints} = await presenter(page);
      expect(checkpoints.length).toBeGreaterThan(3);
      const dir = path.join('test-results', 'cinematic-lab', slug);
      fs.mkdirSync(dir, {recursive: true});
      await page.screenshot({path: path.join(dir, 'c0.png')});
      for (let c = 1; c < checkpoints.length; c++) {
        await page.keyboard.press('ArrowRight');
        await waitHolding(page, c);
        const p = await presenter(page);
        expect(p.frame, `checkpoint ${c} frame`).toBe(checkpoints[c]);
        await page.screenshot({path: path.join(dir, `c${c}.png`)});
      }
      // The final hold does not drift.
      await page.waitForTimeout(700);
      expect((await presenter(page)).frame).toBe(checkpoints[checkpoints.length - 1]);
      // Back one checkpoint, instantly.
      await page.keyboard.press('ArrowLeft');
      await waitHolding(page, checkpoints.length - 2);
      expect((await presenter(page)).frame).toBe(checkpoints[checkpoints.length - 2]);
      // Replay the beat that led here.
      await page.keyboard.press('r');
      await page.waitForFunction(() => (window as unknown as PresenterWindow).__presenter.state.status === 'playing');
      await waitHolding(page, checkpoints.length - 2);
      expect((await presenter(page)).frame).toBe(checkpoints[checkpoints.length - 2]);
      // Home and End.
      await page.keyboard.press('Home');
      await waitHolding(page, 0);
      expect((await presenter(page)).frame).toBe(0);
      await page.keyboard.press('End');
      await waitHolding(page, checkpoints.length - 1);
      expect((await presenter(page)).frame).toBe(checkpoints[checkpoints.length - 1]);
    });
  }

  test('seeking is deterministic: the same frame renders the same pixels (3D with shadows and canvas screens)', async ({page}) => {
    await page.goto('/style-lab/cine-01-john');
    await ready(page);
    const {checkpoints} = await presenter(page);
    const f = Math.round((checkpoints[1] + checkpoints[2]) / 2);
    await page.evaluate((fr) => (window as unknown as PresenterWindow).__presenter.seek(fr), f);
    const a = await fingerprint(page);
    await page.evaluate((fr) => (window as unknown as PresenterWindow).__presenter.seek(fr), checkpoints[3]);
    await page.waitForTimeout(300);
    await page.evaluate((fr) => (window as unknown as PresenterWindow).__presenter.seek(fr), f);
    const b = await fingerprint(page);
    expect(b).toBe(a);
  });

  test('switching the theme changes the picture without changing the timeline', async ({page}) => {
    await page.goto('/style-lab/cine-02-wrong-project#c=1');
    await ready(page);
    const before = await presenter(page);
    const a = await fingerprint(page);
    await click(page, 'story-theme-infrared');
    await ready(page);
    const after = await presenter(page);
    expect(after.checkpoints).toEqual(before.checkpoints);
    expect(after.frame).toBe(before.frame);
    const b = await fingerprint(page);
    expect(b).not.toBe(a);
  });

  test('presentation mode: F toggles fullscreen on the stage', async ({page}) => {
    await page.goto('/style-lab/cine-01-john');
    await ready(page);
    await page.keyboard.press('f');
    await expect(page.locator('.stage')).toHaveAttribute('data-fullscreen', 'true');
    await page.keyboard.press('f');
    await expect(page.locator('.stage')).toHaveAttribute('data-fullscreen', 'false');
  });
});
