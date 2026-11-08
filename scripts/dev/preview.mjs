// Browser preview harness (not a render): opens a Style Lab URL in headless
// Chromium, seeks the live Player to checkpoints + mid-beat frames and
// screenshots them, then builds a contact sheet. Needs `npm run dev` running.
//
//   node scripts/dev/preview.mjs <slug> [theme] [outdir] [--frames=a,b,c] [--every=0.5] [--thumb] [--base=http://localhost:5173] [--scale=0.5]
//
// Works on Windows, macOS and Linux: uses Playwright's bundled Chromium with
// the GPU through ANGLE (PW_CHROMIUM overrides the executable, PLAYWRIGHT_GL=swiftshader
// forces software GL). Contact sheets use ffmpeg (ImageMagick is not needed).
import {chromium} from '@playwright/test';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const [slug, theme = 'neon', outArg] = args.filter((a) => !a.startsWith('--'));
const flag = (n) => args.find((a) => a.startsWith(`--${n}=`))?.split('=')[1];
const has = (n) => args.includes(`--${n}`);
if (!slug) {
  console.error('usage: node scripts/dev/preview.mjs <slug> [theme] [outdir] [--frames=..|--every=..|--thumb]');
  process.exit(2);
}
const base = flag('base') ?? 'http://localhost:5173';
const scale = Number(flag('scale') ?? 0.5);
const out = outArg ?? path.join(root, 'out', 'preview', `${slug}-${theme}`);
fs.mkdirSync(out, {recursive: true});

const gl = process.env.PLAYWRIGHT_GL === 'swiftshader' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : process.platform === 'win32' ? ['--use-angle=d3d11'] : [];
const browser = await chromium.launch({executablePath: process.env.PW_CHROMIUM || undefined, args: ['--enable-gpu', '--ignore-gpu-blocklist', ...gl]});
const page = await browser.newPage({viewport: {width: 1920, height: 1080}, deviceScaleFactor: scale});
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && !/404/.test(m.text()) && errors.push(m.text()));
await page.goto(`${base}/style-lab/${slug}?theme=${theme}`);
await page.waitForFunction(() => window.__presenter?.frame >= 0, null, {timeout: 90000});
const tl = await page.evaluate(() => window.__presenter.timeline);
// Hide the viewer chrome: move the mouse once and wait for it to fade.
await page.mouse.move(5, 5);
await page.waitForTimeout(2300);

const seek = async (f) => {
  await page.evaluate((fr) => window.__presenter.seek(fr), f);
  await page.waitForFunction((fr) => window.__presenter.frame === fr, f, {timeout: 30000});
  await page.waitForTimeout(350);
};

if (has('thumb')) {
  const f = Math.max(0, tl.checkpoints[tl.checkpoints.length - 1]);
  await seek(f);
  await page.waitForTimeout(1500);
  const tmp = path.join(out, 'thumb.png');
  await page.screenshot({path: tmp});
  const dest = flag('dest') ?? path.join(root, 'public', 'lab', 'thumbs', `${flag('prefix') ?? ''}${slug}.jpg`);
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', tmp, '-vf', 'scale=960:540:flags=lanczos', '-q:v', '3', dest]);
  console.log(`thumb: ${path.relative(root, dest)}`);
  await browser.close();
  process.exit(0);
}

let frames;
if (flag('frames')) frames = flag('frames').split(',').map((f) => ({f: Number(f), tag: ''}));
else if (flag('every')) {
  frames = [];
  for (let f = 0; f < tl.durationInFrames; f += Math.round(Number(flag('every')) * tl.fps)) frames.push({f, tag: ''});
} else {
  frames = [{f: 0, tag: 'c0'}];
  tl.beats.forEach((b, i) => {
    frames.push({f: Math.round(b.start + (b.animEnd - b.start) * 0.33), tag: `b${i + 1}-a`});
    frames.push({f: Math.round(b.start + (b.animEnd - b.start) * 0.66), tag: `b${i + 1}-b`});
    frames.push({f: b.animEnd, tag: `c${i + 1}`});
  });
}
const files = [];
for (const {f, tag} of frames) {
  await seek(f);
  const file = path.join(out, `${slug}-f${String(f).padStart(5, '0')}${tag ? '-' + tag : ''}.png`);
  await page.screenshot({path: file});
  files.push(file);
  process.stdout.write(`${path.basename(file)}\n`);
}
await browser.close();
const cols = Math.min(4, files.length);
const rows = Math.ceil(files.length / cols);
const list = path.join(out, 'list.txt');
fs.writeFileSync(list, files.map((f) => `file '${f.replace(/\\/g, '/')}'`).join('\n'));
const sheet = path.join(out, 'sheet.jpg');
const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-vf', `scale=480:-1,tile=${cols}x${rows}:padding=3:color=0x111111`, '-frames:v', '1', '-q:v', '3', sheet], {encoding: 'utf8'});
if (r.status === 0) console.log(`sheet: ${path.relative(root, sheet)}`);
else console.error(r.stderr);
if (errors.length) console.log('ERRORS:\n' + errors.join('\n'));
