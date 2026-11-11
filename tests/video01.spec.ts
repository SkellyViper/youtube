import {expect, test, type Page} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {LIGHTING_PRESETS, noirRig, noirStage} from '../src/shot/presets';
import {screenInsert} from '../src/shot/cameras';
import {THEMES, THEME_IDS} from '../src/styles/themes';
import {cyber} from '../src/styles/cyber';
import {video01} from '../src/styles/video01';

/**
 * Video 01 · Legacy / Digital Noir (docs/VIDEO_01_VISUAL_LANGUAGE.md).
 *
 * Pure checks of the tokens, the theme, the presets and the reference shot's
 * camera track; then the real Player: the style is selectable in the lab, the
 * reference shot opens in it, every interactive beat plays and holds, the
 * wide shot is the same picture whenever it comes back (no camera movement),
 * and the ending is the full-screen game with his posture unchanged.
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

const REFERENCE = '/style-lab/cine-02-wrong-project?theme=noir';
const shotJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src/scenes/cinematic/02-wrong-project/shot.json'), 'utf8')) as {
  camera: {mode: string; keys: Record<string, {beat: string; t: number; cut: boolean; position: number[]; target: number[]; fov: number}>};
};

test.describe('tokens and presets', () => {
  test('the noir theme is selectable and freezes the lab palette; three hues only', () => {
    expect(THEME_IDS).toContain('noir');
    expect(video01.theme).toBe('noir');
    const th = THEMES.noir;
    expect(th.color.void).toBe(cyber.color.void);
    expect(th.tone.system).toEqual(cyber.tone.system);
    expect(th.tone.mind).toEqual(cyber.tone.mind);
    expect(th.tone.threat).toEqual(cyber.tone.threat);
    // "Verified" is bright cyan in this episode, not green.
    expect(th.tone.safe.base).not.toBe(THEMES.neon.tone.safe.base);
    expect(th.bloom).toEqual({strength: 0.85, radius: 0.72, threshold: 0.92});
  });

  test('the figure is dimmer than the approved render had it; the rig and stage presets carry the token values', () => {
    expect(video01.figure.rim).toBeLessThanOrEqual(1.3);
    expect(video01.figure.core).toBeLessThanOrEqual(0.35);
    const rig = noirRig();
    expect(rig.key.defaults.intensity).toBe(video01.light.key.intensity);
    expect(rig.rim.defaults.intensity).toBe(video01.light.rim.intensity);
    expect(rig.rim.defaults.position).toEqual(video01.light.rim.position);
    expect(noirStage().bloom).toEqual(video01.stage.bloom);
    const preset = LIGHTING_PRESETS.find((p) => p.id === 'digital-noir');
    expect(preset?.label).toContain('Video 01');
    expect(preset?.rig.rim.intensity).toBe(video01.light.rim.intensity);
  });

  test('the reference shot keeps its approved camera track: two cuts, one push within the limit, nothing else', () => {
    const keys = shotJson.camera.keys;
    expect(shotJson.camera.mode).toBe('keys');
    expect(Object.keys(keys).sort()).toEqual(['a-open', 'a-return', 'b-insert', 'b-push']);
    // The wide shot is one pose, used twice.
    expect(keys['a-return'].position).toEqual(keys['a-open'].position);
    expect(keys['a-return'].target).toEqual(keys['a-open'].target);
    expect(keys['a-open'].position).toEqual([1.85, 1.5, 1.85]);
    expect(keys['b-insert'].position).toEqual([0.35, 1.25, 0.75]);
    // Shots change by cutting; the only travel is the insert's push.
    expect(keys['a-return'].cut && keys['b-insert'].cut).toBe(true);
    const travel = Math.hypot(...keys['b-push'].position.map((v, i) => v - keys['b-insert'].position[i]));
    expect(travel).toBeGreaterThan(0);
    expect(travel).toBeLessThanOrEqual(video01.camera.maxPush);
    expect(keys['b-push'].target).toEqual(keys['b-insert'].target);
  });

  test('screenInsert: a frontal close-up on a region of a curved screen, at the distance that fits it', () => {
    const monitor = {center: [0, 1.075, -0.26] as const, width: 1.04, height: 0.447, radius: 1.5};
    const whole = screenInsert(monitor, {x: 0, y: 0, w: 1, h: 1}, {fill: 1});
    // Centre of the picture, straight in front of it.
    expect(whole.target).toEqual([0, 1.075, -0.26]);
    expect(whole.position[0]).toBe(0);
    expect(whole.position[1]).toBe(1.075);
    // A 1.04 m wide picture fills a 16:9 frame at 26 degrees from about 1.27 m.
    expect(whole.position[2] - whole.target[2]).toBeCloseTo(1.04 / (2 * Math.tan((13 * Math.PI) / 180) * (16 / 9)), 2);
    // The right half: the camera stands on that part's normal, which leans toward the centre of the curve.
    const right = screenInsert(monitor, {x: 0.5, y: 0, w: 0.5, h: 1});
    expect(right.target[0]).toBeGreaterThan(0.2);
    expect(right.position[0]).toBeLessThan(right.target[0]);
    expect(right.position[2]).toBeGreaterThan(right.target[2]);
  });
});

const errorsFor = new WeakMap<Page, string[]>();
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
    return {episode: p.episode, frame: p.frame, state: {...p.state}, checkpoints: p.timeline.checkpoints, beats: p.timeline.beats, durationInFrames: p.timeline.durationInFrames, fps: p.timeline.fps};
  });

const outDir = path.join(process.cwd(), 'test-results/video01');

/** Mean absolute difference (0..255) between two screenshots of the same size, over a band of the frame (fractions). */
const bandDiff = async (page: Page, a: Buffer, b: Buffer, band: {x: number; y: number; w: number; h: number}) =>
  page.evaluate(
    async ({a64, b64, band}) => {
      const load = (s: string) =>
        new Promise<HTMLImageElement>((res) => {
          const im = new Image();
          im.onload = () => res(im);
          im.src = `data:image/png;base64,${s}`;
        });
      const [ia, ib] = await Promise.all([load(a64), load(b64)]);
      const w = Math.round(ia.width * band.w);
      const h = Math.round(ia.height * band.h);
      const px = (im: HTMLImageElement) => {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d')!;
        ctx.drawImage(im, Math.round(im.width * band.x), Math.round(im.height * band.y), w, h, 0, 0, w, h);
        return ctx.getImageData(0, 0, w, h).data;
      };
      const da = px(ia);
      const db = px(ib);
      let sum = 0;
      for (let i = 0; i < da.length; i += 4) sum += Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]);
      return sum / ((da.length / 4) * 3);
    },
    {a64: a.toString('base64'), b64: b.toString('base64'), band},
  );

test.describe('in the Style Lab', () => {
  test.beforeEach(async ({page}) => {
    const errors: string[] = [];
    errorsFor.set(page, errors);
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/404/.test(m.text())) errors.push(`console.error: ${m.text()}`);
    });
  });
  test.afterEach(async ({page}) => {
    expect(errorsFor.get(page) ?? [], 'no page errors / console errors').toEqual([]);
  });

  test('the gallery presents the style with its reference shot; the existing sections are still there', async ({page}) => {
    await page.goto('/style-lab');
    const card = page.getByTestId('video01-style');
    await expect(card).toBeVisible();
    await expect(card.getByRole('heading')).toContainText('Legacy / Digital Noir');
    await expect(card.locator('.v01-colours dt')).toHaveText(['Blue', 'Purple', 'Red', 'Void']);
    await expect(page.getByTestId('video01-reference')).toHaveAttribute('href', REFERENCE);
    const img = card.locator('img');
    await expect(img).toBeVisible();
    expect(await img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBeGreaterThan(0);
    // The original experiments are preserved.
    await expect(page.locator('.cine-tile')).toHaveCount(6);
    await expect(page.locator('.story-tile')).toHaveCount(10);
    await expect(page.locator('.lab-tile')).toHaveCount(10);
    fs.mkdirSync(outDir, {recursive: true});
    await card.screenshot({path: path.join(outDir, 'gallery-card.png')});
  });

  test('the reference link opens X02 in the noir theme; the theme sits beside the others', async ({page}) => {
    await page.goto('/style-lab');
    await page.getByTestId('video01-reference').click();
    await ready(page);
    expect((await presenter(page)).episode).toBe('cine-02-wrong-project');
    await page.mouse.move(640, 360);
    await page.mouse.move(650, 370);
    await expect(page.getByTestId('story-theme-noir')).toHaveAttribute('aria-pressed', 'true');
    for (const id of ['neon', 'infrared', 'glacial', 'ghost', 'spectral']) await expect(page.getByTestId(`story-theme-${id}`)).toBeVisible();
    await expect(page.getByTestId('story-cmd')).toContainText('npm run cine:render -- 02-wrong-project --theme=noir');
  });

  test('every beat of the reference shot plays and holds; back and replay work; the wide shot never moves; it ends on the full-screen game', async ({page}) => {
    test.setTimeout(240_000);
    await page.goto(REFERENCE);
    await ready(page);
    const p0 = await presenter(page);
    // 0.3 s lead-in, then 4.2 + 4.5 + 3.8 + 3.6 s of beats, a 1.0 s final hold and a 0.6 s tail: 18.0 s at 60 fps.
    expect(p0.fps).toBe(60);
    expect(p0.durationInFrames).toBe(1080);
    expect(p0.beats.map((b) => b.id)).toEqual(['wp-type', 'wp-send', 'wp-carry', 'wp-hold']);
    expect(p0.checkpoints).toHaveLength(5);
    expect(p0.state.checkpoint).toBe(0);

    fs.mkdirSync(outDir, {recursive: true});
    const stage = page.locator('.story-pane-primary');
    const shots: Buffer[] = [];
    for (let c = 1; c <= 4; c++) {
      await page.keyboard.press('ArrowRight');
      await waitHolding(page, c);
      const p = await presenter(page);
      expect(p.frame).toBe(p0.checkpoints[c]);
      // A hold is a frozen frame: nothing advances while the narrator talks.
      await page.waitForTimeout(700);
      expect((await presenter(page)).frame).toBe(p.frame);
      await page.waitForTimeout(1600); // viewer chrome fades
      const shot = await stage.screenshot({type: 'png'});
      fs.writeFileSync(path.join(outDir, `checkpoint-${c}.png`), shot);
      shots.push(shot);
    }

    // Sky and horizon right of the monitor: only a camera change can alter this band.
    const band = {x: 0.72, y: 0.02, w: 0.26, h: 0.12};
    // Checkpoints 1, 3 and 4 are the wide shot: the same picture there. Checkpoint 2 is the insert.
    expect(await bandDiff(page, shots[0], shots[2], band)).toBeLessThan(0.5);
    expect(await bandDiff(page, shots[0], shots[3], band)).toBeLessThan(0.5);
    expect(await bandDiff(page, shots[0], shots[1], band)).toBeGreaterThan(3);

    // The ending: he makes the game full screen. The terminal's part of the monitor changes completely
    // (it was the agent at work, it is now the game's black side bar)...
    const terminalArea = {x: 0.6, y: 0.24, w: 0.08, h: 0.26};
    expect(await bandDiff(page, shots[2], shots[3], terminalArea)).toBeGreaterThan(3);
    // ...the purple light is gone from the desk (red and blue both drop there)...
    const deskRight = {x: 0.56, y: 0.68, w: 0.14, h: 0.08};
    expect(await bandDiff(page, shots[2], shots[3], deskRight)).toBeGreaterThan(2);
    // ...and his posture does not change: his back is where it was (a lean back moved it by far more than this).
    const back = {x: 0.16, y: 0.5, w: 0.1, h: 0.22};
    expect(await bandDiff(page, shots[2], shots[3], back)).toBeLessThan(6);

    // ArrowLeft: previous checkpoint. R: replay the beat that led here.
    await page.keyboard.press('ArrowLeft');
    await waitHolding(page, 3);
    expect((await presenter(page)).frame).toBe(p0.checkpoints[3]);
    await page.keyboard.press('r');
    await waitHolding(page, 3);
    expect((await presenter(page)).frame).toBe(p0.checkpoints[3]);
  });
});
