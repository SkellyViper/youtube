// Deterministic MP4 export.
//   node scripts/render.mjs <CompositionId> <output.mp4> [--frames=0-599] [--concurrency=4]
// Mirrors remotion.config.ts so CLI / Studio / this script produce the same file.
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {bundle} from '@remotion/bundler';
import {renderMedia, selectComposition} from '@remotion/renderer';
import {browserExecutable, defaultGl, ensureBrowser} from './browser.mjs';
import {verifyVideo} from './verify-video.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith('--'));
const flag = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];

const id = positional[0] ?? 'NotDetected';
const output = path.resolve(root, positional[1] ?? 'out/demo.mp4');
const framesFlag = flag('frames');
const frameRange = framesFlag ? framesFlag.split('-').map(Number) : null;
const concurrency = Number(flag('concurrency') ?? Math.max(1, Math.min(8, Math.floor(os.cpus().length / 2))));

const bar = (p) => `${'█'.repeat(Math.round(p * 30)).padEnd(30, '░')} ${(p * 100).toFixed(1).padStart(5)}%`;
const t0 = Date.now();

await ensureBrowser();
console.log(`[render] bundling ${id}…`);
const serveUrl = await bundle({
  entryPoint: path.join(root, 'src/remotion/index.ts'),
  publicDir: path.join(root, 'public'),
});
const chromiumOptions = {gl: defaultGl};
const composition = await selectComposition({serveUrl, id, browserExecutable, chromiumOptions});
console.log(
  `[render] ${id}: ${composition.width}×${composition.height} @ ${composition.fps}fps, ` +
    `${composition.durationInFrames} frames (${(composition.durationInFrames / composition.fps).toFixed(2)}s), concurrency ${concurrency}`,
);

let lastLog = 0;
await renderMedia({
  composition,
  serveUrl,
  codec: 'h264',
  outputLocation: output,
  imageFormat: 'png',
  crf: 16,
  pixelFormat: 'yuv420p',
  colorSpace: 'bt709',
  x264Preset: 'slow',
  concurrency,
  browserExecutable,
  chromiumOptions,
  frameRange: frameRange ? [frameRange[0], frameRange[1]] : null,
  overwrite: true,
  onProgress: ({progress, renderedFrames, encodedFrames}) => {
    const now = Date.now();
    if (now - lastLog < 1500 && progress < 1) return;
    lastLog = now;
    process.stdout.write(`[render] ${bar(progress)}  rendered ${renderedFrames}  encoded ${encodedFrames}\n`);
  },
});
console.log(`[render] wrote ${output} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

const expectedFrames = frameRange ? frameRange[1] - frameRange[0] + 1 : composition.durationInFrames;
const ok = await verifyVideo(output, {
  width: composition.width,
  height: composition.height,
  fps: composition.fps,
  frames: expectedFrames,
});
process.exit(ok ? 0 : 1);
