// Measure live Player frame pacing for every beat (how many of the beat's
// frames were actually displayed). Run against the production preview:
//   npm run present            (in another terminal; serves http://localhost:4173/)
//   node scripts/perf.mjs [url]
// Uses the installed Google Chrome (GPU) when available, else Playwright's Chromium.
import {chromium} from '@playwright/test';

const url = process.argv[2] ?? 'http://localhost:4173/';
const launch = async () => {
  const args = ['--enable-gpu', '--enable-gpu-rasterization', '--ignore-gpu-blocklist'];
  try {
    return await chromium.launch({channel: 'chrome', args});
  } catch {
    return chromium.launch({args});
  }
};

const browser = await launch();
const page = await browser.newPage({viewport: {width: 1920, height: 1080}});
await page.goto(url);
await page.waitForFunction(() => window.__presenter && window.__presenter.frame >= 0);
const beats = await page.evaluate(() => window.__presenter.timeline.beats.length);

console.log('beat'.padEnd(16), 'shown/frames', ' wall ms', ' exact stop');
for (let c = 0; c < beats; c++) {
  const r = await page.evaluate(async (c) => {
    const p = window.__presenter;
    p.goTo(c);
    await new Promise((r) => setTimeout(r, 250));
    const beat = p.timeline.beats[c];
    const seen = new Set();
    const t0 = performance.now();
    p.next();
    while (p.state.status !== 'holding' || p.state.checkpoint !== c + 1) {
      seen.add(p.frame);
      await new Promise((r) => requestAnimationFrame(r));
    }
    return {
      id: beat.id,
      frames: beat.animEnd - beat.start,
      shown: Math.min(seen.size, beat.animEnd - beat.start),
      ms: Math.round(performance.now() - t0),
      exact: p.frame === p.timeline.checkpoints[c + 1],
    };
  }, c);
  const pct = ((r.shown / r.frames) * 100).toFixed(0).padStart(3);
  console.log(r.id.padEnd(16), `${String(r.shown).padStart(4)}/${String(r.frames).padEnd(4)} ${pct}%`, String(r.ms).padStart(7), r.exact ? '   ✓' : '   ✗');
}
await browser.close();
