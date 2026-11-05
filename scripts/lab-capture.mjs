// Evidence capture for SourcePanel: real web pages and real PDF pages -> crisp PNGs
// plus *measured* highlight regions (never hand-typed pixel coordinates).
//
//   node scripts/lab-capture.mjs            capture everything listed in CAPTURES
//   node scripts/lab-capture.mjs morris     only captures whose id contains "morris"
//
// For every capture it writes, next to each other in public/lab/media/:
//   <id>.png    the image (web pages at deviceScaleFactor 2, so zooming stays sharp)
//   <id>.json   url, capture time, natural size and regions in IMAGE pixels
// and one typed TS module (MODULE below) with the same data, for scenes to import.
//
// Web pages: Playwright Chromium, viewport screenshot. A passage is located by its
// text (start ... end inside the first element matching `within`), turned into a DOM
// Range and measured with getClientRects / getBoundingClientRect.
// PDFs: headless Chromium cannot display a PDF, so the page is rasterised with
// pdf.js (loaded from jsDelivr) on a canvas. Nothing is installed into the project.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mediaDir = path.join(root, 'public', 'lab', 'media');
const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38';
/** Typed copy of every capture record, so scenes import measurements instead of retyping them. */
const MODULE = path.join(root, 'src', 'scenes', 'style-lab', '07-source', 'sources.generated.ts');

const CAPTURES = [
  {
    id: 'source-morris-worm',
    kind: 'web',
    url: 'https://en.wikipedia.org/wiki/Morris_worm',
    licence: 'CC BY-SA 4.0 (text); Wikipedia contributors',
    viewport: {width: 1500, height: 940},
    deviceScaleFactor: 2,
    // Transient site notices (fundraising banners) are not part of the article.
    hide: '#siteNotice, #centralNotice, .cn-fundraising, #frb-inline, #frb-nag, .mw-dismissable-notice',
    regions: {
      // One sentence of the lead: "It is one of the oldest computer worms distributed via the Internet ...".
      passage: {within: '#mw-content-text p', start: 'It is one of the oldest', end: 'media attention.'},
      // The whole lead paragraph, for looser framing.
      paragraph: {within: '#mw-content-text p', start: 'The Morris worm'},
      title: {within: 'h1#firstHeading'},
    },
  },
  {
    id: 'source-nist-ai-rmf-p1',
    kind: 'pdf',
    url: 'https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf',
    licence: 'Public domain (work of the US Government, NIST); not subject to copyright in the United States',
    // PDF page 6 is the page numbered "Page 1": the Executive Summary.
    page: 6,
    width: 1700,
    regions: {
      heading: {start: 'Executive Summary'},
    },
  },
];

const round = (n) => Math.round(n * 100) / 100;
const scaleRect = (r, k) => ({x: round(r.x * k), y: round(r.y * k), width: round(r.width * k), height: round(r.height * k)});

/** Runs in the page: find text inside `within`, return its box and per-line boxes in CSS px. */
const measureInPage = ({within, start, end}) => {
  const candidates = [...document.querySelectorAll(within)];
  const el = start ? candidates.find((c) => c.textContent.includes(start)) : candidates[0];
  if (!el) return {error: `no element matching "${within}"${start ? ` containing "${start}"` : ''}`};
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let text = '';
  while (walker.nextNode()) {
    nodes.push({node: walker.currentNode, at: text.length});
    text += walker.currentNode.data;
  }
  const i0 = start ? text.indexOf(start) : 0;
  const i1 = end ? text.indexOf(end, i0) + end.length : text.length;
  if (i0 < 0 || (end && text.indexOf(end, i0) < 0)) return {error: `text not found in: ${text.slice(0, 400)}`};
  const locate = (i, atEnd) => {
    for (let k = nodes.length - 1; k >= 0; k--) {
      const n = nodes[k];
      if (n.at < i || (!atEnd && n.at === i) || k === 0) return [n.node, Math.min(n.node.data.length, i - n.at)];
    }
    return [nodes[0].node, 0];
  };
  const range = document.createRange();
  range.setStart(...locate(i0, false));
  range.setEnd(...locate(i1, true));
  // getClientRects returns one rect per inline box; merge them into visual lines.
  const lines = [];
  for (const r of range.getClientRects()) {
    if (r.width < 0.5 || r.height < 0.5) continue;
    const mid = r.top + r.height / 2;
    const line = lines.find((l) => mid > l.top && mid < l.bottom);
    if (line) {
      line.left = Math.min(line.left, r.left);
      line.right = Math.max(line.right, r.right);
      line.top = Math.min(line.top, r.top);
      line.bottom = Math.max(line.bottom, r.bottom);
    } else lines.push({left: r.left, right: r.right, top: r.top, bottom: r.bottom});
  }
  lines.sort((a, b) => a.top - b.top);
  const b = range.getBoundingClientRect();
  return {
    text: text.slice(i0, i1).replace(/\s+/g, ' ').trim(),
    box: {x: b.left, y: b.top, width: b.width, height: b.height},
    lines: lines.map((l) => ({x: l.left, y: l.top, width: l.right - l.left, height: l.bottom - l.top})),
  };
};

const captureWeb = async (browser, c) => {
  const context = await browser.newContext({viewport: c.viewport, deviceScaleFactor: c.deviceScaleFactor, locale: 'en-US', colorScheme: 'light'});
  const page = await context.newPage();
  await page.goto(c.url, {waitUntil: 'networkidle', timeout: 60000});
  if (c.hide) await page.addStyleTag({content: `${c.hide} { display: none !important; }`});
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);

  const regions = {};
  for (const [name, spec] of Object.entries(c.regions ?? {})) {
    const m = await page.evaluate(measureInPage, spec);
    if (m.error) throw new Error(`[capture] ${c.id}: region "${name}": ${m.error}`);
    regions[name] = {...scaleRect(m.box, c.deviceScaleFactor), lines: m.lines.map((l) => scaleRect(l, c.deviceScaleFactor)), text: m.text.length > 400 ? `${m.text.slice(0, 400)}...` : m.text};
  }
  const meta = await page.evaluate(() => ({
    title: document.title,
    revisionId: window.mw?.config?.get?.('wgRevisionId') ?? null,
  }));
  const file = path.join(mediaDir, `${c.id}.png`);
  await page.screenshot({path: file, type: 'png', clip: {x: 0, y: 0, ...c.viewport}});
  await context.close();
  return {
    title: meta.title,
    ...(meta.revisionId ? {permalink: `${new URL(c.url).origin}/w/index.php?oldid=${meta.revisionId}`} : {}),
    viewport: c.viewport,
    deviceScaleFactor: c.deviceScaleFactor,
    naturalWidth: Math.round(c.viewport.width * c.deviceScaleFactor),
    naturalHeight: Math.round(c.viewport.height * c.deviceScaleFactor),
    regions,
  };
};

const capturePdf = async (browser, c) => {
  const bytes = Buffer.from(await (await fetch(c.url)).arrayBuffer());
  const context = await browser.newContext({viewport: {width: 800, height: 600}});
  const page = await context.newPage();
  // Any CORS-friendly origin works as a host page for the pdf.js module.
  await page.goto(`${PDFJS}/package.json`);
  const result = await page.evaluate(
    async ({b64, pageNumber, width, cdn, specs}) => {
      const pdfjs = await import(`${cdn}/build/pdf.min.mjs`);
      pdfjs.GlobalWorkerOptions.workerSrc = `${cdn}/build/pdf.worker.min.mjs`;
      const data = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
      const doc = await pdfjs.getDocument({data, cMapUrl: `${cdn}/cmaps/`, cMapPacked: true, standardFontDataUrl: `${cdn}/standard_fonts/`}).promise;
      const pg = await doc.getPage(pageNumber);
      const base = pg.getViewport({scale: 1});
      const viewport = pg.getViewport({scale: width / base.width});
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await pg.render({canvasContext: ctx, viewport}).promise;
      // Text runs with their boxes in canvas px, so regions can be measured, not guessed.
      const content = await pg.getTextContent();
      const runs = content.items
        .filter((it) => it.str && it.str.trim())
        .map((it) => {
          const [a, b, , , e, f] = pdfjs.Util.transform(viewport.transform, it.transform);
          const h = Math.hypot(a, b);
          return {str: it.str, x: e, y: f - h, width: it.width * viewport.scale, height: h * 1.2};
        });
      const regions = {};
      for (const [name, spec] of Object.entries(specs)) {
        const hit = runs.filter((r) => r.str.includes(spec.start));
        if (hit.length === 0) return {error: `region "${name}": "${spec.start}" not found on page ${pageNumber}`};
        const r = hit[0];
        regions[name] = {x: r.x, y: r.y, width: r.width, height: r.height, text: r.str};
      }
      const info = await doc.getMetadata();
      return {png: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height, pages: doc.numPages, title: info.info?.Title ?? '', regions};
    },
    {b64: bytes.toString('base64'), pageNumber: c.page, width: c.width, cdn: PDFJS, specs: c.regions ?? {}},
  );
  await context.close();
  if (result.error) throw new Error(`[capture] ${c.id}: ${result.error}`);
  fs.writeFileSync(path.join(mediaDir, `${c.id}.png`), Buffer.from(result.png.split(',')[1], 'base64'));
  const regions = {};
  for (const [name, r] of Object.entries(result.regions)) regions[name] = {...scaleRect(r, 1), text: r.text};
  return {title: result.title, page: c.page, pages: result.pages, naturalWidth: result.width, naturalHeight: result.height, regions};
};

const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const list = CAPTURES.filter((c) => only.length === 0 || only.some((o) => c.id.includes(o)));
fs.mkdirSync(mediaDir, {recursive: true});
const browser = await chromium.launch();
for (const c of list) {
  const data = c.kind === 'pdf' ? await capturePdf(browser, c) : await captureWeb(browser, c);
  const now = new Date();
  // capturedOn is the local calendar date (sv-SE formats as YYYY-MM-DD); capturedAt is UTC.
  const record = {id: c.id, src: `lab/media/${c.id}.png`, kind: c.kind, url: c.url, capturedOn: now.toLocaleDateString('sv-SE'), capturedAt: now.toISOString(), licence: c.licence, ...data};
  fs.writeFileSync(path.join(mediaDir, `${c.id}.json`), `${JSON.stringify(record, null, 2)}\n`);
  const kb = (fs.statSync(path.join(mediaDir, `${c.id}.png`)).size / 1024).toFixed(0);
  console.log(`[capture] ${c.id}.png  ${record.naturalWidth}x${record.naturalHeight}  ${kb} KB`);
  for (const [name, r] of Object.entries(record.regions)) console.log(`          ${name.padEnd(10)} x ${r.x} y ${r.y} w ${r.width} h ${r.height}  "${String(r.text).slice(0, 70)}"`);
}
await browser.close();

// Regenerate the TS module from the JSON records on disk (so a filtered run keeps the others).
const records = Object.fromEntries(
  CAPTURES.map((c) => path.join(mediaDir, `${c.id}.json`))
    .filter((f) => fs.existsSync(f))
    .map((f) => JSON.parse(fs.readFileSync(f, 'utf8')))
    .map((r) => [r.id, r]),
);
fs.writeFileSync(
  MODULE,
  `// GENERATED by scripts/lab-capture.mjs. Do not edit: re-run the script instead.
// Regions are measured in the page (DOM Range / pdf.js text runs), in image pixels.
export const sources = ${JSON.stringify(records, null, 2)} as const;
`,
);
console.log(`[capture] wrote ${path.relative(root, MODULE)}`);
