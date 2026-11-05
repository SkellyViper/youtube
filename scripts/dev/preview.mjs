// Browser preview harness (not a render): opens a Style Lab URL in headless
// Chromium, seeks the live Player to checkpoints + mid-beat frames and
// screenshots them, then builds a contact sheet.
//   node preview.mjs <slug> [theme] [outdir] [--frames=a,b,c] [--every=0.5]
import {chromium} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [slug, theme = 'neon', outArg] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const flag = (n) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=')[1];
const out = outArg ?? path.join('/home/user/youtube/out/preview', `${slug}-${theme}`);
fs.mkdirSync(out, {recursive: true});

const browser = await chromium.launch({executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']});
const page = await browser.newPage({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 0.5});
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(`http://localhost:5173/style-lab/${slug}?theme=${theme}`);
await page.waitForFunction(() => window.__presenter?.frame >= 0, null, {timeout: 60000});
const tl = await page.evaluate(() => window.__presenter.timeline);
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
// --thumb: one poster (the last hold frame) at 960x540 into public/lab/thumbs/story-<slug>.jpg, then exit.
if (process.argv.includes('--thumb')) {
  const f = Math.max(0, tl.checkpoints[tl.checkpoints.length - 1]);
  await page.evaluate((fr) => window.__presenter.seek(fr), f);
  await page.waitForFunction((fr) => window.__presenter.frame === fr, f);
  await page.waitForTimeout(2200);
  const tmp = path.join(out, 'thumb.png');
  await page.screenshot({path: tmp});
  const dest = path.join('/home/user/youtube/public/lab/thumbs', `story-${slug}.jpg`);
  execFileSync('convert', [tmp, '-resize', '960x540', '-quality', '86', dest]);
  console.log(`thumb: ${dest}`);
  await browser.close();
  process.exit(0);
}
const files = [];
for (const {f, tag} of frames) {
  await page.evaluate((fr) => window.__presenter.seek(fr), f);
  await page.waitForFunction((fr) => window.__presenter.frame === fr, f);
  await page.waitForTimeout(250);
  const file = path.join(out, `${slug}-f${String(f).padStart(5, '0')}${tag ? '-' + tag : ''}.png`);
  await page.screenshot({path: file});
  files.push(file);
  process.stdout.write(`${path.basename(file)}\n`);
}
await browser.close();
const cols = Math.min(6, files.length);
execFileSync('montage', [...files, '-tile', `${cols}x`, '-geometry', '480x270+3+3', '-background', '#111', path.join(out, 'sheet.jpg')]);
console.log(`sheet: ${path.join(out, 'sheet.jpg')}`);
if (errors.length) console.log('ERRORS:\n' + errors.join('\n'));
