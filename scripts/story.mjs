// Redesign tooling: export the story-driven scenes by scene, concept and theme.
//
//   node scripts/story.mjs render 04-replication --theme=infrared     -> out/story/04-replication-infrared.mp4
//   node scripts/story.mjs render 04-replication --all-themes           one MP4 per theme
//   node scripts/story.mjs render all                                   every built scene, default theme
//   node scripts/story.mjs render 04-replication --concept=original     the legacy counterpart (scripts/lab.mjs render)
//   node scripts/story.mjs stills 02-wrong-project --theme=ghost        checkpoint + mid-beat stills -> out/story/stills/
//   node scripts/story.mjs thumbs [slugs]                               gallery posters -> public/lab/thumbs/story-<slug>.jpg
//   node scripts/story.mjs sheet                                        contact sheet of the rendered MP4s / stills
//   node scripts/story.mjs info 04-replication                          beat sheet (frames)
//
// Options: --theme=neon|infrared|glacial|ghost|spectral|noir  --concept=redesign|original
//          --fps=60|30  --concurrency=N  --scale=0.5  --png
// Environment: REMOTION_BROWSER_EXECUTABLE, REMOTION_GL (see scripts/browser.mjs).
import {execFileSync, spawnSync} from 'node:child_process';
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
const outRoot = path.join(root, 'out', 'story');
const fps = Number(flag('fps') ?? 60);

/** Scene slugs come from the folders in src/scenes/redesign (the registry is TypeScript). */
const allSlugs = () =>
  fs
    .readdirSync(path.join(root, 'src/scenes/redesign'), {withFileTypes: true})
    .filter((d) => d.isDirectory() && /^\d\d-/.test(d.name) && fs.existsSync(path.join(root, 'src/scenes/redesign', d.name, 'index.tsx')))
    .map((d) => d.name)
    .sort();

const resolveSlugs = () => {
  const known = allSlugs();
  if (positional.length === 0 || positional.includes('all')) return known;
  return positional.map((p) => {
    const hit = known.find((s) => s === p || s.startsWith(`${p}-`) || String(Number(s.slice(0, 2))) === p);
    if (!hit) throw new Error(`Unknown scene "${p}". Known: ${known.join(', ')}`);
    return hit;
  });
};
const themesWanted = () => (has('all-themes') ? THEMES : [flag('theme') ?? 'neon']).map((t) => {
  if (!THEMES.includes(t)) throw new Error(`Unknown theme "${t}". Known: ${THEMES.join(', ')}`);
  return t;
});

const makeBundle = async () => {
  const t0 = Date.now();
  const serveUrl = await bundle({entryPoint: path.join(root, 'src/remotion/index.ts'), publicDir: path.join(root, 'public')});
  console.log(`[story] bundled in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  return serveUrl;
};

const loadCompositions = async (serveUrl, puppeteerInstance) => {
  const comps = await getCompositions(serveUrl, {puppeteerInstance, chromiumOptions, browserExecutable});
  return new Map(comps.filter((c) => c.id.startsWith('story-')).map((c) => [c.id.slice(6), c]));
};

const withFps = (comp) => (fps === comp.fps ? comp : {...comp, fps, durationInFrames: Math.round((comp.durationInFrames * fps) / comp.fps)});
const pad = (n, w = 5) => String(n).padStart(w, '0');

/** Checkpoints are not in the composition metadata here; derive them from the beat sheet printed by the Player? No: re-derive via a still-only bundle is overkill, so we sample evenly plus the last frame. */
const sampleFrames = (comp, every = 0.75) => {
  const frames = [];
  for (let f = 0; f < comp.durationInFrames; f += Math.round(every * comp.fps)) frames.push(f);
  frames.push(comp.durationInFrames - 1);
  return frames;
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
    const concept = flag('concept') ?? 'redesign';
    if (concept === 'original') {
      // Delegate to the legacy tooling: the original concept is a legacy sample.
      const map = {'04-replication': '03-swarm', '06-source': '07-source', '07-undetected': '05-scan', '08-kill-switch': '06-cloud', '09-media-insert': '08-media', '10-callback': '10-ending'};
      const legacy = slugs.map((s) => map[s]).filter(Boolean);
      if (!legacy.length) throw new Error('None of these scenes has an original prototype.');
      execFileSync('node', [path.join(root, 'scripts/lab.mjs'), 'render', ...legacy], {stdio: 'inherit'});
      return;
    }
    const themes = themesWanted();
    await ensureBrowser();
    const serveUrl = await makeBundle();
    const comps = await loadCompositions(serveUrl);
    fs.mkdirSync(outRoot, {recursive: true});
    const concurrency = Number(flag('concurrency') ?? Math.max(1, Math.min(8, Math.floor(os.cpus().length / 2))));
    let failures = 0;
    for (const slug of slugs) {
      for (const theme of themes) {
        const comp = withFps(comps.get(slug));
        const output = path.join(outRoot, `${slug}-${theme}${fps !== 60 ? `-${fps}fps` : ''}.mp4`);
        const t0 = Date.now();
        console.log(`[story] rendering ${slug} / ${theme}: ${comp.durationInFrames} frames @ ${comp.fps}fps`);
        await renderMedia({
          composition: comp,
          serveUrl,
          codec: 'h264',
          outputLocation: output,
          inputProps: {theme},
          imageFormat: 'png',
          crf: 16,
          pixelFormat: 'yuv420p',
          colorSpace: 'bt709',
          x264Preset: 'slow',
          concurrency,
          chromiumOptions,
          browserExecutable,
          overwrite: true,
          onProgress: ({progress}) => {
            if (Math.round(progress * 20) !== Math.round((progress - 0.001) * 20)) process.stdout.write(`\r[story] ${(progress * 100).toFixed(0)}%`);
          },
        });
        process.stdout.write(`\n[story] wrote ${path.relative(root, output)} in ${((Date.now() - t0) / 1000).toFixed(0)}s\n`);
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
        const outDir = path.join(outRoot, 'stills', `${slug}-${theme}`);
        fs.mkdirSync(outDir, {recursive: true});
        for (const frame of frames) {
          const output = path.join(outDir, `${slug}-${theme}-f${pad(frame)}.${png ? 'png' : 'jpg'}`);
          await renderStill({composition: comp, serveUrl, frame, output, inputProps: {theme}, imageFormat: png ? 'png' : 'jpeg', ...(png ? {} : {jpegQuality: 90}), scale, puppeteerInstance: browser, chromiumOptions, browserExecutable, overwrite: true});
          console.log(`[still] ${path.relative(root, output)}`);
        }
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
      const output = path.join(outDir, `story-${slug}.jpg`);
      await renderStill({composition: comp, serveUrl, frame, output, inputProps: {theme}, imageFormat: 'jpeg', jpegQuality: 86, scale: 0.5, puppeteerInstance: browser, chromiumOptions, browserExecutable, overwrite: true});
      console.log(`[thumb] ${path.relative(root, output)}`);
    }
    await browser.close({silent: true});
  },

  sheet() {
    const videos = fs.existsSync(outRoot) ? fs.readdirSync(outRoot).filter((f) => f.endsWith('.mp4')) : [];
    const framesDir = path.join(outRoot, 'frames');
    fs.mkdirSync(framesDir, {recursive: true});
    const tiles = [];
    for (const v of videos) {
      const base = v.replace(/\.mp4$/, '');
      const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.join(outRoot, v)], {encoding: 'utf8'});
      const dur = Number(probe.stdout) || 8;
      [0.12, 0.4, 0.7, 0.97].forEach((k, i) => {
        const out = path.join(framesDir, `${base}-${i}.jpg`);
        spawnSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(dur * k), '-i', path.join(outRoot, v), '-frames:v', '1', '-q:v', '3', out]);
        tiles.push(out);
      });
    }
    if (!tiles.length) {
      console.log('[story] no MP4s in out/story; render first.');
      return;
    }
    const sheet = path.join(outRoot, 'contact-sheet.jpg');
    execFileSync('montage', [...tiles, '-tile', '4x', '-geometry', '480x270+3+3', '-background', '#111', '-fill', '#aab', '-pointsize', '14', sheet]);
    console.log(`[story] ${path.relative(root, sheet)} (${tiles.length} frames from ${videos.length} videos)`);
  },
};

if (!commands[command]) {
  console.error(`Usage: node scripts/story.mjs <${Object.keys(commands).join('|')}> [slugs] [--theme=.. --all-themes --concept=.. --fps=.. --frames=..]`);
  process.exit(2);
}
await commands[command]();
