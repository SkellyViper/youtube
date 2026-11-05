// Render individual frames exactly as the exporter sees them (PNG).
//   node scripts/stills.mjs [CompositionId] [--frames=0,120,480] [--every=1.5] [--out=out/stills]
// Default: one frame every second of the composition.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {bundle} from '@remotion/bundler';
import {openBrowser, renderStill, selectComposition} from '@remotion/renderer';
import {browserExecutable, defaultGl, ensureBrowser} from './browser.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const id = args.find((a) => !a.startsWith('--')) ?? 'NotDetected';
const outDir = path.resolve(root, flag('out') ?? 'out/stills');
fs.mkdirSync(outDir, {recursive: true});

await ensureBrowser();
const serveUrl = await bundle({entryPoint: path.join(root, 'src/remotion/index.ts'), publicDir: path.join(root, 'public')});
const puppeteerInstance = await openBrowser('chrome', {browserExecutable, chromiumOptions: {gl: defaultGl}});
const composition = await selectComposition({serveUrl, id, puppeteerInstance});

const every = Number(flag('every') ?? 1);
const frames = flag('frames')
  ? flag('frames').split(',').map(Number)
  : Array.from({length: Math.floor(composition.durationInFrames / (every * composition.fps)) + 1}, (_, i) =>
      Math.min(composition.durationInFrames - 1, Math.round(i * every * composition.fps)),
    );

for (const frame of frames) {
  const output = path.join(outDir, `${id}-f${String(frame).padStart(5, '0')}.png`);
  await renderStill({composition, serveUrl, frame, output, imageFormat: 'png', puppeteerInstance, overwrite: true});
  console.log(`[still] ${output}`);
}
await puppeteerInstance.close({silent: true});
