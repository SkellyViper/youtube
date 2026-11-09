import {expect, test, type Locator, type Page} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Style Lab V2 shot editor, in a real browser with WebGL:
 * open from the gallery, select objects (hierarchy and viewport), edit a
 * transform, visibility, a light, a preset, lock / unlock the camera, inspect
 * and retime a beat, undo / redo, keep a draft across reloads, export and
 * import JSON, and the presenter keys still work inside the editor.
 *
 * "Did the picture change?" is measured, not assumed: viewport screenshots
 * are compared pixel by pixel in the page (mean absolute difference, 0..255).
 * Screenshots go to test-results/shot-editor/.
 */

const URL = '/style-lab/cine-01-john/edit';
const OUT = path.join('test-results', 'shot-editor');

type EditorWindow = {
  __shotEditor: {
    id: string;
    patch: Record<string, unknown> & {objects?: Record<string, Record<string, unknown>>; lights?: Record<string, Record<string, unknown>>; camera?: Record<string, unknown>; beats?: Record<string, Record<string, unknown>>};
    state: {camera: {locked: boolean; mode: string}; objects: Record<string, {visible: boolean; position: number[]}>};
    selection: {kind: string; id?: string} | null;
    set: (path: string[], v: unknown) => void;
    reset: (path: string[]) => void;
    replace: (p: unknown, label?: string) => void;
    select: (s: unknown) => void;
    seek: (f: number) => void;
    setView: (v: string) => void;
  };
  __presenter: {
    frame: number;
    isPlaying: boolean;
    state: {checkpoint: number; status: string};
    timeline: {durationInFrames: number; checkpoints: number[]; beats: {id: string; start: number; animEnd: number; end: number}[]};
    goTo: (c: number) => void;
  };
};

const errorsFor = new WeakMap<Page, string[]>();
const watch = (page: Page) => {
  const errors: string[] = [];
  errorsFor.set(page, errors);
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/404/.test(m.text())) errors.push(`console.error: ${m.text()}`);
  });
};

const open = async (page: Page, {clean = true} = {}) => {
  watch(page);
  await page.goto(URL);
  if (clean) {
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  }
  await page.waitForFunction(() => {
    const w = window as unknown as EditorWindow;
    return w.__presenter?.frame >= 0 && Boolean(w.__shotEditor);
  }, null, {timeout: 90_000});
  await settle(page);
};

const editor = (page: Page) => page.evaluate(() => {
  const e = (window as unknown as EditorWindow).__shotEditor;
  return {patch: JSON.parse(JSON.stringify(e.patch)), selection: e.selection, locked: e.state.camera.mode === 'locked', mode: e.state.camera.mode};
});

/** Let the demand-rendered canvas catch up with a change. */
const settle = (page: Page, ms = 700) => page.waitForTimeout(ms);

const goTo = async (page: Page, c: number) => {
  await page.evaluate((cp) => (window as unknown as EditorWindow).__presenter.goTo(cp), c);
  await page.waitForFunction(
    (cp) => {
      const p = (window as unknown as EditorWindow).__presenter;
      return p.state.status === 'holding' && p.state.checkpoint === cp && !p.isPlaying;
    },
    c,
    {timeout: 60_000},
  );
  await settle(page);
};

const viewport = (page: Page): Locator => page.getByTestId('shot-viewport');
const snap = async (page: Page, name: string, clip?: {x: number; y: number; w: number; h: number}) => {
  const vp = viewport(page);
  const box = (await vp.boundingBox())!;
  const shot = await page.screenshot({clip: clip ? {x: box.x + clip.x * box.width, y: box.y + clip.y * box.height, width: clip.w * box.width, height: clip.h * box.height} : box});
  fs.mkdirSync(OUT, {recursive: true});
  fs.writeFileSync(path.join(OUT, `${name}.png`), shot);
  return shot;
};

/** Mean absolute per-channel difference between two PNGs (0 = identical), computed in the page. */
const diff = (page: Page, a: Buffer, b: Buffer): Promise<number> =>
  page.evaluate(
    async ([A, B]) => {
      const load = (src: string) =>
        new Promise<ImageData>((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            const c = document.createElement('canvas');
            c.width = img.width;
            c.height = img.height;
            const ctx = c.getContext('2d')!;
            ctx.drawImage(img, 0, 0);
            resolve(ctx.getImageData(0, 0, img.width, img.height));
          };
          img.onerror = reject;
          img.src = `data:image/png;base64,${src}`;
        });
      const [x, y] = await Promise.all([load(A), load(B)]);
      if (x.width !== y.width || x.height !== y.height) return 255;
      let sum = 0;
      for (let i = 0; i < x.data.length; i += 4) sum += Math.abs(x.data[i] - y.data[i]) + Math.abs(x.data[i + 1] - y.data[i + 1]) + Math.abs(x.data[i + 2] - y.data[i + 2]);
      return sum / ((x.data.length / 4) * 3);
    },
    [a.toString('base64'), b.toString('base64')] as const,
  );

test.describe('Shot editor (Style Lab V2)', () => {
  test.afterEach(async ({page}) => {
    expect(errorsFor.get(page) ?? [], 'no page errors').toEqual([]);
  });

  test('opens from the gallery and from the viewer; lists the scene hierarchy', async ({page}) => {
    watch(page);
    await page.goto('/style-lab');
    await page.getByTestId('edit-shot-cine-01-john').click();
    await expect(page).toHaveURL(/\/style-lab\/cine-01-john\/edit$/);
    await expect(page.getByTestId('shot-editor')).toBeVisible();
    for (const id of ['developer', 'chair', 'desk', 'monitor-game', 'monitor-agent', 'keyboard', 'horizon', 'stage-floor', 'city', 'plant']) {
      await expect(page.getByTestId(`node-${id}`)).toBeVisible();
    }
    for (const id of ['key', 'fill', 'rim', 'ambient', 'glow-agent']) await expect(page.getByTestId(`node-light-${id}`)).toBeVisible();
    await expect(page.getByTestId('node-camera')).toBeVisible();
    // The approved shot hides the clutter and locks the camera.
    const {patch, locked} = await editor(page);
    expect(locked).toBe(true);
    expect(patch.objects.city.visible).toBe(false);
    expect(patch.objects.plant.visible).toBe(false);
    // Back to the viewer, which links to the editor too.
    await page.goto('/style-lab/cine-01-john');
    await page.waitForFunction(() => (window as unknown as EditorWindow).__presenter?.frame >= 0, null, {timeout: 90_000});
    await page.mouse.move(600, 300);
    await page.mouse.move(610, 310);
    await page.getByTestId('lab-edit-shot').click();
    await expect(page).toHaveURL(/\/edit$/);
    await expect(page.getByTestId('shot-hierarchy')).toBeVisible();
  });

  test('selects from the hierarchy and by clicking the object in the viewport', async ({page}) => {
    await open(page);
    await page.getByTestId('node-desk').click();
    await expect(page.getByTestId('shot-inspector')).toContainText('Desk');
    expect((await editor(page)).selection).toEqual({kind: 'object', id: 'desk'});
    // The agent monitor's screen, in the approved locked framing.
    const box = (await viewport(page).boundingBox())!;
    await page.mouse.click(box.x + box.width * 0.68, box.y + box.height * 0.42);
    await expect.poll(async () => (await editor(page)).selection).toEqual({kind: 'object', id: 'monitor-agent'});
    await expect(page.getByTestId('shot-inspector')).toContainText('Agent monitor');
    await snap(page, 'selected-agent-monitor');
  });

  test('a transform edit changes the picture and only that property; reset restores it', async ({page}) => {
    await open(page);
    await goTo(page, 1);
    // Select first: the editor draws a selection box, which must be in every compared image.
    await page.getByTestId('node-developer').click();
    await settle(page);
    const before = await snap(page, 'transform-before');
    const x = page.getByTestId('objects-developer-position-x');
    await x.fill('-0.35');
    await x.press('Enter');
    await settle(page);
    const after = await snap(page, 'transform-after');
    expect(await diff(page, before, after)).toBeGreaterThan(0.5);
    const {patch} = await editor(page);
    expect(patch.objects.developer.position).toEqual([-0.35, 0, 0.74]);
    expect(patch.objects.developer.variant).toBe('figure'); // untouched neighbour property
    // Undo: back to the approved position, and the same pixels.
    await page.getByTestId('undo').click();
    await settle(page);
    expect((await editor(page)).patch.objects.developer.position).toEqual([0, 0, 0.74]);
    expect(await diff(page, before, await snap(page, 'transform-undo'))).toBeLessThan(0.3);
    // A property the approved shot does not set: rotate, then reset it (removes it from the draft).
    const ry = page.getByTestId('objects-developer-rotation-y');
    await ry.fill('25');
    await settle(page);
    expect((await editor(page)).patch.objects.developer.rotation).toEqual([0, 25, 0]);
    expect(await diff(page, before, await snap(page, 'transform-rotated'))).toBeGreaterThan(0.5);
    await page.getByRole('button', {name: 'Reset Rotation °'}).click();
    await settle(page);
    expect((await editor(page)).patch.objects.developer.rotation).toBeUndefined();
    expect(await diff(page, before, await snap(page, 'transform-reset'))).toBeLessThan(0.3);
  });

  test('visibility, light intensity and a lighting preset all reach the render', async ({page}) => {
    await open(page);
    await goTo(page, 2);
    const base = await snap(page, 'light-base');
    // Hide the desk with its eye toggle.
    await page.getByTestId('eye-desk').click();
    await settle(page);
    const noDesk = await snap(page, 'light-no-desk');
    expect((await editor(page)).patch.objects.desk.visible).toBe(false);
    expect(await diff(page, base, noDesk)).toBeGreaterThan(0.5);
    await page.getByTestId('eye-desk').click();
    // Rim light: red and strong.
    await page.getByTestId('node-light-rim').click();
    await page.getByTestId('lights-rim-color-color').fill('#ff2a3c');
    await page.getByTestId('lights-rim-intensity-input').fill('5');
    await settle(page);
    const red = await snap(page, 'light-red-rim');
    const p = (await editor(page)).patch;
    expect(p.lights.rim.color).toBe('#ff2a3c');
    expect(p.lights.rim.intensity).toBe(5);
    expect(await diff(page, base, red)).toBeGreaterThan(0.5);
    // A preset rewrites the rig in one undoable step.
    await page.getByTestId('node-stage').click();
    await page.getByTestId('preset-practicals').click();
    await settle(page);
    expect((await editor(page)).patch.lights.key.enabled).toBe(false);
    await page.getByTestId('undo').click();
    expect((await editor(page)).patch.lights.key.enabled).toBe(true);
  });

  test('a locked camera does not move between beats; unlocked, the authored moves play', async ({page}) => {
    await open(page);
    // The upper band (horizon and void) only changes if the camera moves.
    const band = {x: 0, y: 0.02, w: 1, h: 0.18};
    await goTo(page, 1);
    const l1 = await snap(page, 'locked-c1', band);
    await goTo(page, 3);
    const l3 = await snap(page, 'locked-c3', band);
    expect(await diff(page, l1, l3)).toBeLessThan(0.05); // measured: 0.000, pixel-identical
    // Unlock: the code's camera moves (one per beat) take over.
    await page.getByTestId('camera-lock-quick').click();
    expect((await editor(page)).locked).toBe(false);
    await goTo(page, 1);
    const u1 = await snap(page, 'unlocked-c1', band);
    await goTo(page, 3);
    const u3 = await snap(page, 'unlocked-c3', band);
    expect(await diff(page, u1, u3)).toBeGreaterThan(0.5); // measured: ~1.9
    // Lock again from the camera inspector.
    await page.getByTestId('node-camera').click();
    await page.getByTestId('cam-mode-locked').click();
    expect((await editor(page)).locked).toBe(true);
  });

  test('inspects a beat and retimes it; the presenter timeline follows', async ({page}) => {
    await open(page);
    const tl = await page.evaluate(() => (window as unknown as EditorWindow).__presenter.timeline);
    const game = tl.beats.find((b) => b.id === 'jc-game')!;
    await page.getByTestId('beat-jc-game').click();
    const frames = page.getByTestId('beat-frames');
    await expect(frames).toContainText(String(game.start));
    await expect(frames).toContainText(String(game.animEnd));
    await expect(page.getByTestId('shot-inspector')).toContainText('The slime splits');
    // 2.8 s -> 4 s: +72 frames at 60 fps.
    await page.getByTestId('beats-jc-game-duration-input').fill('4');
    await settle(page);
    const after = await page.evaluate(() => (window as unknown as EditorWindow).__presenter.timeline);
    expect(after.durationInFrames - tl.durationInFrames).toBe(72);
    expect(after.beats.find((b) => b.id === 'jc-game')!.animEnd - game.animEnd).toBe(72);
    // A cue inside the beat: change its easing.
    await page.getByTestId('cue-slime-split').click();
    await page.getByTestId('motions-slime-split-easing-select').selectOption('linear');
    expect((await editor(page)).patch.motions).toEqual({'slime-split': {easing: 'linear'}});
  });

  test('undo / redo, a draft that survives a reload, revert', async ({page}) => {
    await open(page);
    await page.getByTestId('eye-keyboard').click();
    await page.getByTestId('eye-mouse').click();
    expect((await editor(page)).patch.objects.mouse.visible).toBe(false);
    await page.getByTestId('undo').click();
    expect((await editor(page)).patch.objects.mouse?.visible).toBeUndefined();
    await page.getByTestId('redo').click();
    expect((await editor(page)).patch.objects.mouse.visible).toBe(false);
    await expect(page.getByTestId('draft-state')).toContainText('Draft');
    // Reload: the draft comes back from browser storage.
    await page.reload();
    await page.waitForFunction(() => Boolean((window as unknown as EditorWindow).__shotEditor), null, {timeout: 90_000});
    const restored = (await editor(page)).patch;
    expect(restored.objects.keyboard.visible).toBe(false);
    expect(restored.objects.mouse.visible).toBe(false);
    // Revert: back to shot.json.
    await page.getByTestId('revert').click();
    await expect(page.getByTestId('draft-state')).toContainText('Matches shot.json');
  });

  test('exports the draft as JSON and imports it back', async ({page}) => {
    await open(page);
    await page.getByTestId('node-light-key').click();
    await page.getByTestId('lights-key-intensity-input').fill('1.7');
    const download = page.waitForEvent('download');
    await page.getByTestId('export').click();
    const file = path.join(OUT, 'export.shot.json');
    fs.mkdirSync(OUT, {recursive: true});
    await (await download).saveAs(file);
    const exported = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(exported.shot).toBe('cine-01-john');
    expect(exported.lights.key.intensity).toBe(1.7);
    // Start over from code defaults, then import the file.
    await page.getByTestId('reset-code').click();
    expect((await editor(page)).patch.objects).toBeUndefined();
    await page.getByTestId('import-file').setInputFiles(file);
    await expect(page.getByTestId('status')).toContainText('Imported');
    const {patch} = await editor(page);
    expect(patch.lights.key.intensity).toBe(1.7);
    expect(patch.objects.city.visible).toBe(false);
  });

  test('presenter keys work inside the editor (beats, back, replay)', async ({page}) => {
    await open(page);
    await page.getByTestId('shot-hierarchy').click({position: {x: 5, y: 5}});
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => {
      const p = (window as unknown as EditorWindow).__presenter;
      return p.state.status === 'holding' && p.state.checkpoint === 1;
    }, null, {timeout: 60_000});
    const tl = await page.evaluate(() => (window as unknown as EditorWindow).__presenter.timeline);
    expect(await page.evaluate(() => (window as unknown as EditorWindow).__presenter.frame)).toBe(tl.checkpoints[1]);
    await page.keyboard.press('ArrowLeft');
    await page.waitForFunction(() => (window as unknown as EditorWindow).__presenter.state.checkpoint === 0, null, {timeout: 30_000});
    await expect(page.getByTestId('strip-frame')).toHaveText('0');
  });
  test('timeline: scrub, key, cut, retime a key by dragging, notes', async ({page}) => {
    await open(page);
    // Scrub: dragging on the ruler seeks any frame (not only checkpoints).
    const ruler = page.getByTestId('tl-ruler');
    const rb = (await ruler.boundingBox())!;
    await page.mouse.move(rb.x + rb.width * 0.1, rb.y + rb.height / 2);
    await page.mouse.down();
    await page.mouse.move(rb.x + rb.width * 0.45, rb.y + rb.height / 2, {steps: 6});
    await page.mouse.up();
    const total = await page.evaluate(() => (window as unknown as EditorWindow).__presenter.timeline.durationInFrames);
    await expect.poll(() => page.evaluate(() => (window as unknown as EditorWindow).__presenter.frame)).toBeGreaterThan(total * 0.4);
    // Key at frame 300 from the free camera's view, cut at 520, note at 540 (inside beat 3).
    await page.evaluate(() => (window as unknown as EditorWindow).__shotEditor.seek(300));
    await settle(page);
    await page.getByTestId('view-free').click();
    await page.keyboard.press('k');
    await page.evaluate(() => (window as unknown as EditorWindow).__shotEditor.seek(520));
    await settle(page);
    await page.keyboard.press('c');
    await page.getByTestId('view-shot').click();
    let {patch, mode} = await editor(page);
    expect(mode).toBe('keys');
    const keys = Object.values(patch.camera.keys as Record<string, {beat: string; t: number; cut: boolean; label: string}>);
    // Opening key (taking over keeps the first frame), the key, the cut.
    expect(keys).toHaveLength(3);
    expect(keys.filter((k) => k.cut)).toHaveLength(1);
    await expect(page.getByTestId('tl-clip-1')).toBeVisible(); // the cut starts a second clip
    await page.evaluate(() => (window as unknown as EditorWindow).__shotEditor.seek(540));
    await settle(page);
    await page.getByTestId('tl-note').click();
    await page.getByTestId('note-text').fill('Hold on the agent screen a beat longer');
    ({patch} = await editor(page));
    const notes = Object.values(patch.notes as Record<string, {text: string; beat: string}>);
    expect(notes).toEqual([expect.objectContaining({text: 'Hold on the agent screen a beat longer', beat: 'jc-agent'})]);
    // Drag the cut later on the camera track: it moves to a later time.
    const cutId = Object.entries(patch.camera.keys as Record<string, {cut: boolean}>).find(([, k]) => k.cut)![0];
    const diamond = page.getByTestId(`tl-key-${cutId}`);
    const db = (await diamond.boundingBox())!;
    const lane = (await page.getByTestId('tl-camera').boundingBox())!;
    await page.mouse.move(db.x + db.width / 2, db.y + db.height / 2);
    await page.mouse.down();
    await page.mouse.move(db.x + db.width / 2 + lane.width * 0.12, db.y + db.height / 2, {steps: 8});
    await page.mouse.up();
    const moved = (await editor(page)).patch.camera.keys[cutId] as {beat: string; t: number};
    const before = keys.find((k) => k.cut)!;
    expect(moved.beat !== before.beat || moved.t > before.t).toBe(true);
    // Delete removes the selected key.
    await page.getByTestId(`tl-key-${cutId}`).click();
    await page.keyboard.press('Delete');
    expect(Object.keys((await editor(page)).patch.camera.keys)).toHaveLength(2);
  });

  test('fly: dragging in the viewport moves the shot camera at the playhead', async ({page}) => {
    await open(page);
    await page.evaluate(() => (window as unknown as EditorWindow).__shotEditor.seek(420));
    await settle(page);
    const before = await snap(page, 'fly-before');
    await page.getByTestId('view-fly').click();
    const vb = (await viewport(page).boundingBox())!;
    await page.mouse.move(vb.x + vb.width * 0.5, vb.y + vb.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(vb.x + vb.width * 0.4, vb.y + vb.height * 0.48, {steps: 10});
    await page.mouse.up();
    await settle(page);
    const after = await snap(page, 'fly-after');
    expect(await diff(page, before, after)).toBeGreaterThan(1);
    const {patch, mode} = await editor(page);
    expect(mode).toBe('keys');
    const flown = Object.values(patch.camera.keys as Record<string, {beat: string; position: number[]}>).find((k) => k.beat === 'jc-agent')!;
    expect(flown.position).not.toEqual([1.85, 1.62, 2.45]);
  });

  test('X02: the code camera converts to keyframes that reproduce it', async ({page}) => {
    watch(page);
    await page.goto('/style-lab/cine-02-wrong-project/edit');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForFunction(() => {
      const w = window as unknown as EditorWindow;
      return w.__presenter?.frame >= 0 && Boolean(w.__shotEditor);
    }, null, {timeout: 90_000});
    await expect(page.getByTestId('cam-badge')).toContainText('the scene');
    await page.evaluate(() => (window as unknown as EditorWindow).__shotEditor.seek(560));
    await settle(page, 1200);
    const code = await snap(page, 'x02-code-560');
    await page.getByTestId('node-camera').click();
    await page.getByTestId('bake').click();
    await page.waitForFunction(() => (window as unknown as EditorWindow).__shotEditor.state.camera.mode === 'keys', null, {timeout: 120_000});
    const n = Object.keys((await editor(page)).patch.camera.keys).length;
    expect(n).toBeGreaterThan(10);
    await page.evaluate(() => (window as unknown as EditorWindow).__shotEditor.seek(560));
    await settle(page, 1200);
    const baked = await snap(page, 'x02-baked-560');
    expect(await diff(page, code, baked)).toBeLessThan(1.5);
  });
});
