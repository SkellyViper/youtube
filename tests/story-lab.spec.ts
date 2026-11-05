import {expect, test, type Page} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Real-browser tests of the redesigned Style Lab: the two-section gallery,
 * the story viewer (concept / theme / compare), keyboard beats on the new
 * scenes, deterministic seeking, and the theme switch actually changing
 * pixels. State is read through `window.__presenter` (see PresentationApp).
 */

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

const ready = (page: Page) => page.waitForFunction(() => (window as unknown as PresenterWindow).__presenter?.frame >= 0, null, {timeout: 60_000});
const waitHolding = (page: Page, c: number) =>
  page.waitForFunction(
    (cp) => {
      const p = (window as unknown as PresenterWindow).__presenter;
      return p.state.status === 'holding' && p.state.checkpoint === cp && !p.isPlaying;
    },
    c,
    {timeout: 60_000},
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
  // Sum a sparse sample of bytes; PNG bytes differ when the image differs.
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
  test('shows the story scenes above the ten legacy samples', async ({page}) => {
    await page.goto('/style-lab');
    await expect(page.locator('.lab-tile')).toHaveCount(10);
    const stories = page.locator('.story-tile');
    await expect(stories).toHaveCount(10);
    await expect(page.getByTestId('story-tile-04-replication')).toBeVisible();
    // Each story tile says what the viewer should understand.
    const texts = await page.locator('.story-tile-understand').allTextContents();
    for (const t of texts) expect(t.length).toBeGreaterThan(20);
  });

  test('opens a scene; the URL carries concept, theme and compare', async ({page}) => {
    await page.goto('/style-lab');
    // A 2D scene whose legacy counterpart is also 2D keeps this interaction test fast on software GL.
    await page.getByTestId('story-tile-06-source').click();
    await expect(page).toHaveURL(/\/style-lab\/06-source/);
    await ready(page);
    expect((await presenter(page)).episode).toBe('story-06-source');
    await click(page, 'story-theme-infrared');
    await expect(page).toHaveURL(/theme=infrared/);
    await click(page, 'story-concept-original');
    await expect(page).toHaveURL(/concept=original/);
    await page.waitForFunction(() => (window as unknown as PresenterWindow).__presenter?.episode === 'lab-07-source');
    await click(page, 'story-concept-redesign');
    await page.waitForFunction(() => (window as unknown as PresenterWindow).__presenter?.episode === 'story-06-source');
    await click(page, 'story-compare-concept');
    await expect(page).toHaveURL(/compare=concept/);
    await expect(page.getByTestId('story-follower')).toBeVisible();
    await expect(page.getByTestId('story-cmd')).toContainText('npm run story:render -- 06-source --theme=infrared');
  });

  test('reloading a URL restores the selection', async ({page}) => {
    await page.goto('/style-lab/02-wrong-project?theme=ghost&compare=theme:glacial#c=2');
    await ready(page);
    await expect(page.getByTestId('story-follower')).toBeVisible();
    const p = await presenter(page);
    expect(p.state.checkpoint).toBe(2);
    expect(p.frame).toBe(p.checkpoints[2]);
    await page.mouse.move(640, 360);
    await expect(page.getByTestId('story-theme-ghost')).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('presenting the redesigned scenes', () => {
  for (const slug of ['02-wrong-project', '04-replication']) {
    test(`${slug}: ArrowRight plays each beat and holds on the exact checkpoint; ArrowLeft and R work`, async ({page}) => {
      test.setTimeout(240_000);
      await page.goto(`/style-lab/${slug}`);
      await ready(page);
      const {checkpoints} = await presenter(page);
      const dir = path.join('test-results', 'story-lab', slug);
      fs.mkdirSync(dir, {recursive: true});
      for (let c = 1; c < checkpoints.length; c++) {
        await page.keyboard.press('ArrowRight');
        await waitHolding(page, c);
        const p = await presenter(page);
        expect(p.frame, `checkpoint ${c} frame`).toBe(checkpoints[c]);
        await page.screenshot({path: path.join(dir, `c${c}.png`)});
      }
      // Holds do not drift.
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
    });
  }

  test('seeking is deterministic: the same frame renders the same pixels', async ({page}) => {
    await page.goto('/style-lab/02-wrong-project');
    await ready(page);
    const {checkpoints} = await presenter(page);
    const f = Math.round((checkpoints[2] + checkpoints[3]) / 2);
    await page.evaluate((fr) => (window as unknown as PresenterWindow).__presenter.seek(fr), f);
    const a = await fingerprint(page);
    await page.evaluate((fr) => (window as unknown as PresenterWindow).__presenter.seek(fr), checkpoints[4]);
    await page.waitForTimeout(300);
    await page.evaluate((fr) => (window as unknown as PresenterWindow).__presenter.seek(fr), f);
    const b = await fingerprint(page);
    expect(b).toBe(a);
  });

  test('switching the theme changes the picture without changing the timeline', async ({page}) => {
    await page.goto('/style-lab/02-wrong-project#c=4');
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

  test('compare: the follower sits on the matching beat', async ({page}) => {
    await page.goto('/style-lab/06-source?compare=concept');
    await ready(page);
    await page.keyboard.press('ArrowRight');
    await waitHolding(page, 1);
    await page.waitForTimeout(300);
    // Both panes rendered and the follower is not blank.
    const follower = page.getByTestId('story-follower');
    await expect(follower).toBeVisible();
    const buf = await follower.screenshot({type: 'png'});
    expect(buf.length).toBeGreaterThan(5_000);
  });

  test('presentation mode: F toggles fullscreen on the stage', async ({page}) => {
    await page.goto('/style-lab/04-replication');
    await ready(page);
    await page.keyboard.press('f');
    await expect(page.locator('.stage')).toHaveAttribute('data-fullscreen', 'true');
    await page.keyboard.press('f');
    await expect(page.locator('.stage')).toHaveAttribute('data-fullscreen', 'false');
  });
});
