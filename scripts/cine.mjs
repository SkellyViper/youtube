// Cinematic experiments tooling: export the six 3D experiments by scene and theme.
//
//   node scripts/cine.mjs render 02-wrong-project --theme=infrared   -> out/cinematic/02-wrong-project-infrared.mp4
//   node scripts/cine.mjs render all                                  every experiment, default theme
//   node scripts/cine.mjs render 01-john --fps=30                     30 fps compatibility export
//   node scripts/cine.mjs stills 01-john [--frames=0,120 | --every=0.75]   stills -> out/cinematic/stills/
//   node scripts/cine.mjs thumbs [slugs]                              gallery posters -> public/lab/thumbs/cine-<slug>.jpg
//   node scripts/cine.mjs frames                                      key frames from the MP4s -> out/cinematic/frames/
//   node scripts/cine.mjs sheet                                       contact sheet of the rendered MP4s -> out/cinematic/contact-sheet.jpg
//   node scripts/cine.mjs info 02-wrong-project                       beat sheet (frames)
//
// Editable shots (Style Lab V2, docs/STYLE_LAB_V2.md):
//   node scripts/cine.mjs render 01-john                              uses the approved src/scenes/cinematic/01-john/shot.json
//   node scripts/cine.mjs render 01-john --shot=drafts/x01.json       renders an exported editor draft instead (-> ...-x01.mp4)
//   node scripts/cine.mjs render 01-john --code-defaults              renders the code defaults (empty patch)  (-> ...-code.mp4)
//   (the same flags work for `stills`)
//
// Options: --theme=neon|infrared|glacial|ghost|spectral|noir  --all-themes  --fps=60|30  --concurrency=N  --scale=0.5  --png  --out=file.mp4
// Environment: REMOTION_BROWSER_EXECUTABLE, REMOTION_GL (see scripts/browser.mjs). Contact sheets use ffmpeg only.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {bundle} from '@remotion/bundler';
import {getCompositions, openBrowser, renderMedia, renderStill} from '@remotion/renderer';
import {browserExecutable, defaultGl, ensureBrowser} from './browser.mjs';
import {verifyVideo} from './verify-video.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const command = args[0];
const positional = args.slice(1).filter((a) => !a.startsWith('--'));
const flag = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const has = (name) => args.includes(`--${name}`);

const THEMES = ['neon', 'infrared', 'glacial', 'ghost', 'spectral', 'noir'];
const chromiumOptions = {gl: flag('gl') ?? defaultGl};
const outRoot = path.join(root, 'out', 'cinematic');
const fps = Number(flag('fps') ?? 60);

/**
 * Shot override: `--shot=<file.json>` (an editor export) or `--code-defaults`
 * (empty patch). Passed as the `shot` input prop, which replaces the approved
 * shot.json for editable scenes and is ignored by the others.
 */
const shotOverride = (() => {
  if (has('code-defaults')) return {tag: 'code', patch: {}};
  const file = flag('shot');
  if (!file) return null;
  const abs = path.resolve(process.cwd(), file);
  const patch = JSON.parse(fs.readFileSync(abs, 'utf8'));
  return {tag: path.basename(abs).replace(/(\.shot)?\.json$/, ''), patch};
})();
const propsFor = (theme) => (shotOverride ? {theme, shot: shotOverride.patch} : {theme});
const shotSuffix = shotOverride ? `-${shotOverride.tag}` : '';

/** Scene slugs come from the folders in src/scenes/cinematic. */
const allSlugs = () =>
  fs
    .readdirSync(path.join(root, 'src/scenes/cinematic'), {withFileTypes: true})
    .filter((d) => d.isDirectory() && /^\d\d-/.test(d.name) && fs.existsSync(path.join(root, 'src/scenes/cinematic', d.name, 'index.tsx')))
    .map((d) => d.name)
    .sort();

const resolveSlugs = () => {
  const known = allSlugs();
  if (positional.length === 0 || positional.includes('all')) return known;
  return positional.map((p) => {
    const q = p.replace(/^cine-/, '');
    const hit = known.find((s) => s === q || s.startsWith(`${q}-`) || String(Number(s.slice(0, 2))) === q);
    if (!hit) throw new Error(`Unknown experiment "${p}". Known: ${known.join(', ')}`);
    return hit;
  });
};
const themesWanted = () =>
  (has('all-themes') ? THEMES : [flag('theme') ?? 'neon']).map((t) => {
    if (!THEMES.includes(t)) throw new Error(`Unknown theme "${t}". Known: ${THEMES.join(', ')}`);
    return t;
  });

const makeBundle = async () => {
  const t0 = Date.now();
  const serveUrl = await bundle({entryPoint: path.join(root, 'src/remotion/index.ts'), publicDir: path.join(root, 'public')});
  console.log(`[cine] bundled in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  return serveUrl;
};

const loadCompositions = async (serveUrl, puppeteerInstance) => {
  // Input props reach calculateMetadata, so a retimed draft gets its own duration.
  const comps = await getCompositions(serveUrl, {puppeteerInstance, chromiumOptions, browserExecutable, inputProps: propsFor(themesWanted()[0])});
  return new Map(comps.filter((c) => c.id.startsWith('cine-')).map((c) => [c.id.slice(5), c]));
};

const withFps = (comp) => (fps === comp.fps ? comp : {...comp, fps, durationInFrames: Math.round((comp.durationInFrames * fps) / comp.fps)});
const pad = (n, w = 5) => String(n).padStart(w, '0');

const sampleFrames = (comp, every = 0.75) => {
  const frames = [];
  for (let f = 0; f < comp.durationInFrames; f += Math.round(every * comp.fps)) frames.push(f);
  frames.push(comp.durationInFrames - 1);
  return frames;
};

/** ffmpeg contact sheet of image files (ImageMagick is not required). */
const tileSheet = (files, outFile, cols = 4, width = 480) => {
  if (!files.length) return false;
  const list = `${outFile}.txt`;
  fs.writeFileSync(list, files.map((f) => `file '${f.replace(/\\/g, '/')}'`).join('\n'));
  const rows = Math.ceil(files.length / cols);
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-vf', `scale=${width}:-1,tile=${cols}x${rows}:padding=3:color=0x111111`, '-frames:v', '1', '-q:v', '3', outFile], {encoding: 'utf8'});
  fs.unlinkSync(list);
  if (r.status !== 0) console.error(r.stderr);
  return r.status === 0;
};

const commands = {
  async info() {
    const slugs = resolveSlugs();
    await ensureBrowser();
    const comps = await loadCompositions(await makeBundle());
    for (const slug of slugs) {
      const c = comps.get(slug);
      console.log(`${slug}: ${c.durationInFrames} frames = ${(c.durationInFrames / c.fps).toFixed(2)}s @ ${c.fps}fps`);
    }
  },

  async render() {
    const slugs = resolveSlugs();
    const themes = themesWanted();
    await ensureBrowser();
    const serveUrl = await makeBundle();
    const comps = await loadCompositions(serveUrl);
    fs.mkdirSync(outRoot, {recursive: true});
    // WebGL scenes: fewer parallel tabs than CPU count, each one has a GPU context.
    const concurrency = Number(flag('concurrency') ?? Math.max(1, Math.min(4, Math.floor(os.cpus().length / 4))));
    let failures = 0;
    for (const slug of slugs) {
      for (const theme of themes) {
        const comp = withFps(comps.get(slug));
        const output = flag('out') ? path.resolve(process.cwd(), flag('out')) : path.join(outRoot, `${slug}-${theme}${shotSuffix}${fps !== 60 ? `-${fps}fps` : ''}.mp4`);
        const t0 = Date.now();
        console.log(`[cine] rendering ${slug} / ${theme}: ${comp.durationInFrames} frames @ ${comp.fps}fps, concurrency ${concurrency}`);
        await renderMedia({
          composition: comp,
          serveUrl,
          codec: 'h264',
          outputLocation: output,
          inputProps: propsFor(theme),
          imageFormat: 'png',
          crf: 16,
          pixelFormat: 'yuv420p',
          colorSpace: 'bt709',
          x264Preset: 'slow',
          concurrency,
          chromiumOptions,
          browserExecutable,
          overwrite: true,
          timeoutInMilliseconds: 120000,
          onProgress: ({progress}) => {
            if (Math.round(progress * 20) !== Math.round((progress - 0.001) * 20)) process.stdout.write(`\r[cine] ${(progress * 100).toFixed(0)}%`);
          },
        });
        process.stdout.write(`\n[cine] wrote ${path.relative(root, output)} in ${((Date.now() - t0) / 1000).toFixed(0)}s\n`);
        const ok = await verifyVideo(output, {width: comp.width, height: comp.height, fps: comp.fps, frames: comp.durationInFrames});
        if (!ok) failures++;
      }
    }
    process.exit(failures ? 1 : 0);
  },

  async stills() {
    const slugs = resolveSlugs();
    const themes = themesWanted();
    await ensureBrowser();
    const serveUrl = await makeBundle();
    const browser = await openBrowser('chrome', {chromiumOptions, browserExecutable});
    const comps = await loadCompositions(serveUrl, browser);
    const scale = Number(flag('scale') ?? 0.5);
    const png = has('png');
    for (const slug of slugs) {
      for (const theme of themes) {
        const comp = comps.get(slug);
        const frames = flag('frames') ? flag('frames').split(',').map(Number) : sampleFrames(comp, Number(flag('every') ?? 0.75));
        const outDir = path.join(outRoot, 'stills', `${slug}-${theme}${shotSuffix}`);
        fs.mkdirSync(outDir, {recursive: true});
        const files = [];
        for (const frame of frames) {
          const output = path.join(outDir, `${slug}-${theme}-f${pad(frame)}.${png ? 'png' : 'jpg'}`);
          await renderStill({composition: comp, serveUrl, frame, output, inputProps: propsFor(theme), imageFormat: png ? 'png' : 'jpeg', ...(png ? {} : {jpegQuality: 90}), scale, puppeteerInstance: browser, chromiumOptions, browserExecutable, overwrite: true, timeoutInMilliseconds: 120000});
          files.push(output);
          console.log(`[still] ${path.relative(root, output)}`);
        }
        if (tileSheet(files, path.join(outDir, 'sheet.jpg'))) console.log(`[cine] ${path.relative(root, path.join(outDir, 'sheet.jpg'))}`);
      }
    }
    await browser.close({silent: true});
  },

  async thumbs() {
    const slugs = resolveSlugs();
    const theme = flag('theme') ?? 'neon';
    await ensureBrowser();
    const serveUrl = await makeBundle();
    const browser = await openBrowser('chrome', {chromiumOptions, browserExecutable});
    const comps = await loadCompositions(serveUrl, browser);
    const outDir = path.join(root, 'public', 'lab', 'thumbs');
    fs.mkdirSync(outDir, {recursive: true});
    for (const slug of slugs) {
      const comp = comps.get(slug);
      // Poster: the last completed beat (the hold frame), which is the scene's point.
      const frame = Math.max(0, comp.durationInFrames - Math.round(0.9 * comp.fps));
      const output = path.join(outDir, `cine-${slug}.jpg`);
      await renderStill({composition: comp, serveUrl, frame, output, inputProps: {theme}, imageFormat: 'jpeg', jpegQuality: 86, scale: 0.5, puppeteerInstance: browser, chromiumOptions, browserExecutable, overwrite: true});
      console.log(`[thumb] ${path.relative(root, output)}`);
    }
    await browser.close({silent: true});
  },

  frames() {
    const videos = fs.existsSync(outRoot) ? fs.readdirSync(outRoot).filter((f) => f.endsWith('.mp4')) : [];
    const framesDir = path.join(outRoot, 'frames');
    fs.mkdirSync(framesDir, {recursive: true});
    for (const v of videos) {
      const base = v.replace(/\.mp4$/, '');
      const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.join(outRoot, v)], {encoding: 'utf8'});
      const dur = Number(probe.stdout) || 10;
      // Eight evenly spaced frames per video, plus the last one.
      const ks = [0.02, 0.14, 0.28, 0.42, 0.56, 0.7, 0.84, 0.985];
      ks.forEach((k, i) => {
        const out = path.join(framesDir, `${base}-${i}.jpg`);
        spawnSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(dur * k), '-i', path.join(outRoot, v), '-frames:v', '1', '-q:v', '3', out]);
      });
      console.log(`[frames] ${base}: ${ks.length} frames`);
    }
  },

  sheet() {
    const framesDir = path.join(outRoot, 'frames');
    if (!fs.existsSync(framesDir) || !fs.readdirSync(framesDir).length) commands.frames();
    const tiles = fs.existsSync(framesDir) ? fs.readdirSync(framesDir).filter((f) => f.endsWith('.jpg')).sort().map((f) => path.join(framesDir, f)) : [];
    if (!tiles.length) {
      console.log('[cine] no MP4s in out/cinematic; render first.');
      return;
    }
    const sheet = path.join(outRoot, 'contact-sheet.jpg');
    if (tileSheet(tiles, sheet, 8, 320)) console.log(`[cine] ${path.relative(root, sheet)} (${tiles.length} frames)`);
  },
};

if (!commands[command]) {
  console.error(`Usage: node scripts/cine.mjs <${Object.keys(commands).join('|')}> [slugs] [--theme=.. --all-themes --fps=.. --frames=.. --every=..]`);
  process.exit(2);
}
await commands[command]();
