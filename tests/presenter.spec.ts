import {expect, test, type Page} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Real-browser tests of the keyboard-driven presentation mode. They drive the
 * app with genuine key presses and read state through `window.__presenter`
 * (exposed by src/player/PresentationApp.tsx).
 */

type Snapshot = {
  state: {checkpoint: number; status: 'holding' | 'playing'; beat: number | null};
  frame: number;
  isPlaying: boolean;
  checkpoints: number[];
  beats: {id: string; start: number; animEnd: number; end: number}[];
};

declare global {
  interface Window {
    __presenter: {
      state: Snapshot['state'];
      frame: number;
      isPlaying: boolean;
      timeline: {fps: number; durationInFrames: number; checkpoints: number[]; beats: Snapshot['beats']};
      next: () => boolean;
      prev: () => void;
      replay: () => void;
      goTo: (c: number) => void;
    };
  }
}

const snapshot = (page: Page): Promise<Snapshot> =>
  page.evaluate(() => {
    const p = window.__presenter;
    return {
      state: {...p.state},
      frame: p.frame,
      isPlaying: p.isPlaying,
      checkpoints: p.timeline.checkpoints,
      beats: p.timeline.beats,
    };
  });

const errorsFor = new WeakMap<Page, string[]>();

const boot = async (page: Page, url = '/') => {
  const errors: string[] = [];
  errorsFor.set(page, errors);
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
  });
  await page.goto(url);
  try {
    await page.waitForFunction(() => window.__presenter !== undefined && window.__presenter.frame >= 0, null, {
      timeout: 20_000,
    });
  } catch {
    throw new Error(`Presentation app did not start. Page errors:\n${errors.join('\n') || '(none)'}`);
  }
  // Fonts are loaded before the Player mounts.
  expect(await page.evaluate(() => document.fonts.check('100px Archivo'))).toBe(true);
  expect(await page.evaluate(() => document.fonts.check('24px "JetBrains Mono"'))).toBe(true);
  return snapshot(page);
};

const waitHolding = async (page: Page, checkpoint: number) => {
  await page.waitForFunction(
    (c) => {
      const p = window.__presenter;
      return p.state.status === 'holding' && p.state.checkpoint === c && !p.isPlaying;
    },
    checkpoint,
    {timeout: 15_000},
  );
};

const waitPlaying = (page: Page) =>
  page.waitForFunction(() => window.__presenter.state.status === 'playing' && window.__presenter.isPlaying, null, {
    timeout: 5_000,
  });

const frameNow = (page: Page) => page.evaluate(() => window.__presenter.frame);

test.afterEach(async ({page}) => {
  expect(errorsFor.get(page) ?? [], 'no page errors / console errors').toEqual([]);
});

test('loads in a clean initial state', async ({page}) => {
  const s = await boot(page);
  expect(s.state).toEqual({checkpoint: 0, status: 'holding', beat: null});
  expect(s.frame).toBe(0);
  expect(s.isPlaying).toBe(false);
  expect(s.checkpoints.length).toBe(s.beats.length + 1);
  // Minimal UI: no HUD, no Player controls.
  await expect(page.getByTestId('hud')).toHaveCount(0);
  await expect(page.locator('.stage')).toHaveAttribute('data-status', 'holding');
});

test('ArrowRight plays one beat and holds exactly on its checkpoint', async ({page}) => {
  const s = await boot(page);
  await page.keyboard.press('ArrowRight');
  await waitPlaying(page);
  await waitHolding(page, 1);
  expect(await frameNow(page)).toBe(s.checkpoints[1]);
  // Holds indefinitely.
  await page.waitForTimeout(1500);
  const after = await snapshot(page);
  expect(after.frame).toBe(s.checkpoints[1]);
  expect(after.isPlaying).toBe(false);
  expect(after.state.status).toBe('holding');
});

test('walks the whole demo; every beat stops on its exact checkpoint frame', async ({page}) => {
  test.setTimeout(180_000);
  const s = await boot(page);
  const dir = path.join('test-results', 'checkpoints');
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, 'c00.png')});
  for (let c = 1; c <= s.beats.length; c++) {
    await page.keyboard.press('ArrowRight');
    await waitHolding(page, c);
    await page.waitForTimeout(150);
    const snap = await snapshot(page);
    expect(snap.frame, `checkpoint ${c}`).toBe(s.checkpoints[c]);
    expect(snap.state.beat).toBeNull();
    await page.screenshot({path: path.join(dir, `c${String(c).padStart(2, '0')}.png`)});
  }
  // Pressing on the final checkpoint does nothing.
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(600);
  const end = await snapshot(page);
  expect(end.state).toEqual({checkpoint: s.beats.length, status: 'holding', beat: null});
  expect(end.frame).toBe(s.checkpoints[s.beats.length]);
});

test('ArrowRight during playback is ignored (no interruption, no double advance)', async ({page}) => {
  const s = await boot(page);
  await page.keyboard.press('ArrowRight');
  await waitPlaying(page);
  await page.waitForTimeout(350); // past the double-tap guard
  expect((await snapshot(page)).state.status).toBe('playing');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await waitHolding(page, 1);
  await page.waitForTimeout(800);
  const snap = await snapshot(page);
  expect(snap.state.checkpoint).toBe(1);
  expect(snap.state.status).toBe('holding');
  expect(snap.frame).toBe(s.checkpoints[1]);
});

test('rapid double press advances only one beat', async ({page}) => {
  const s = await boot(page);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await waitHolding(page, 1);
  await page.waitForTimeout(800);
  expect((await snapshot(page)).state.checkpoint).toBe(1);
  expect(await frameNow(page)).toBe(s.checkpoints[1]);
});

test('keyboard auto-repeat is ignored', async ({page}) => {
  await boot(page);
  await page.evaluate(() => {
    for (let i = 0; i < 5; i++) {
      window.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight', repeat: true, bubbles: true}));
    }
  });
  await page.waitForTimeout(500);
  const snap = await snapshot(page);
  expect(snap.state).toEqual({checkpoint: 0, status: 'holding', beat: null});
  expect(snap.frame).toBe(0);
});

test('ArrowLeft while holding jumps to the previous checkpoint instantly', async ({page}) => {
  const s = await boot(page);
  await page.evaluate(() => window.__presenter.goTo(3));
  await waitHolding(page, 3);
  expect(await frameNow(page)).toBe(s.checkpoints[3]);
  await page.keyboard.press('ArrowLeft');
  await waitHolding(page, 2);
  expect(await frameNow(page)).toBe(s.checkpoints[2]);
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft'); // clamps at 0
  await waitHolding(page, 0);
  expect(await frameNow(page)).toBe(0);
});

test('ArrowLeft during playback aborts back to the beat start checkpoint', async ({page}) => {
  const s = await boot(page);
  await page.evaluate(() => window.__presenter.goTo(2));
  await waitHolding(page, 2);
  await page.keyboard.press('ArrowRight');
  await waitPlaying(page);
  await page.waitForTimeout(400);
  const mid = await frameNow(page);
  expect(mid).toBeGreaterThan(s.beats[2].start);
  expect(mid).toBeLessThan(s.beats[2].animEnd);
  await page.keyboard.press('ArrowLeft');
  await waitHolding(page, 2);
  await page.waitForTimeout(500);
  expect(await frameNow(page)).toBe(s.checkpoints[2]);
  expect((await snapshot(page)).isPlaying).toBe(false);
});

test('R replays the current beat and lands on the same checkpoint', async ({page}) => {
  const s = await boot(page);
  await page.evaluate(() => window.__presenter.goTo(4));
  await waitHolding(page, 4);
  await page.keyboard.press('r');
  await waitPlaying(page);
  const during = await snapshot(page);
  expect(during.state.beat).toBe(3);
  expect(during.frame).toBeLessThan(s.checkpoints[4]);
  await waitHolding(page, 4);
  expect(await frameNow(page)).toBe(s.checkpoints[4]);
  // R at the very start does nothing.
  await page.evaluate(() => window.__presenter.goTo(0));
  await waitHolding(page, 0);
  await page.keyboard.press('R');
  await page.waitForTimeout(400);
  expect((await snapshot(page)).state).toEqual({checkpoint: 0, status: 'holding', beat: null});
});

test('Home / End jump to the first / last checkpoint', async ({page}) => {
  const s = await boot(page);
  const N = s.beats.length;
  await page.keyboard.press('End');
  await waitHolding(page, N);
  expect(await frameNow(page)).toBe(s.checkpoints[N]);
  await page.keyboard.press('Home');
  await waitHolding(page, 0);
  expect(await frameNow(page)).toBe(0);
});

test('#c=N deep link loads directly at that checkpoint and the URL tracks position', async ({page}) => {
  const s = await boot(page, '/#c=5');
  await waitHolding(page, 5);
  expect(await frameNow(page)).toBe(s.checkpoints[5]);
  await page.keyboard.press('ArrowRight');
  await waitHolding(page, 6);
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#c=6');
});

test('F toggles fullscreen on the presentation stage', async ({page}) => {
  await boot(page);
  await page.keyboard.press('f');
  await page.waitForFunction(() => document.fullscreenElement !== null, null, {timeout: 5_000});
  expect(await page.evaluate(() => document.fullscreenElement?.classList.contains('stage'))).toBe(true);
  await expect(page.locator('.stage')).toHaveAttribute('data-fullscreen', 'true');
  // Navigation keeps working in fullscreen.
  await page.keyboard.press('ArrowRight');
  await waitHolding(page, 1);
  await page.keyboard.press('f');
  await page.waitForFunction(() => document.fullscreenElement === null, null, {timeout: 5_000});
  await expect(page.locator('.stage')).toHaveAttribute('data-fullscreen', 'false');
});

test('H toggles the developer HUD, which lives outside the composition', async ({page}) => {
  await boot(page);
  await page.keyboard.press('h');
  const hud = page.getByTestId('hud');
  await expect(hud).toBeVisible();
  await expect(page.getByTestId('hud-checkpoint')).toHaveText(/^0\/\d+$/);
  await expect(page.getByTestId('hud-status')).toContainText('HOLDING');
  await expect(page.getByTestId('hud-scene')).toContainText('1/4');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('hud-status')).toContainText('PLAYING');
  await waitHolding(page, 1);
  await expect(page.getByTestId('hud-checkpoint')).toHaveText(/^1\/\d+$/);
  await expect(page.getByTestId('hud-beat')).toContainText('1/');
  const s = await snapshot(page);
  await expect(page.getByTestId('hud-frame')).toContainText(`${s.checkpoints[1]} /`);
  // The HUD is a sibling of the Player, never inside the rendered composition.
  const inside = await page.evaluate(() => {
    const stage = document.querySelector('.stage')!;
    const playerRoot = stage.firstElementChild!;
    const hudEl = document.querySelector('[data-testid="hud"]')!;
    return playerRoot.contains(hudEl) || playerRoot === hudEl;
  });
  expect(inside).toBe(false);
  // Clicking a beat in the HUD seeks deterministically.
  await page.locator('.hud-beats button').nth(6).click();
  await waitHolding(page, 7);
  expect(await frameNow(page)).toBe(s.checkpoints[7]);
  await page.keyboard.press('h');
  await expect(hud).toHaveCount(0);
});

test('holds are static: two screenshots of a checkpoint are pixel-identical', async ({page}) => {
  // Source edits while the dev server is running trigger Vite hot updates,
  // which legitimately change pixels. Count them so such a pair is retried
  // instead of being reported as non-determinism.
  let hotUpdates = 0;
  page.on('console', (m) => {
    if (/\[vite\] (hot updated|page reload)/.test(m.text())) hotUpdates++;
  });
  const s = await boot(page);
  for (const c of [1, 5, s.beats.length]) {
    let identical = false;
    for (let attempt = 0; attempt < 3 && !identical; attempt++) {
      await page.evaluate((c) => window.__presenter.goTo(c), c);
      await waitHolding(page, c);
      await page.waitForTimeout(300);
      const before = hotUpdates;
      const a = await page.screenshot();
      await page.waitForTimeout(500);
      const b = await page.screenshot();
      identical = a.equals(b);
      if (!identical && hotUpdates === before) break; // genuine change: fail
    }
    expect(identical, `checkpoint ${c} is static`).toBe(true);
  }
});
