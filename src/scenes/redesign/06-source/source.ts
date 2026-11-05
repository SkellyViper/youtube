import type {Rect} from '../../../components/cyber/frame/fit';
import {sources} from '../../style-lab/07-source/sources.generated';

/**
 * The evidence S06 shows. Data only: one real capture with MEASURED regions,
 * re-exported from the generated module so nothing here is typed by hand.
 *
 * Today this is the English Wikipedia article "Morris worm" (a documented
 * self-replicating program), captured on the date below. The incident the
 * episode actually cites (the OpenAI and Hugging Face case) could not be
 * captured from this environment because those sites are unreachable here.
 *
 * To swap it in later:
 *   1. Add a capture to the CAPTURES list at the top of scripts/lab-capture.mjs:
 *        {id: 'source-openai-hf-incident', kind: 'web', url: '<the article URL>', licence: '<its licence>',
 *         viewport: {width: 1500, height: 940}, deviceScaleFactor: 2,
 *         regions: {passage: {within: '<selector of the body>', start: '<first words>', end: '<last words>'}, title: {within: 'h1'}}}
 *      (`passage` must be a sentence that really is on the page; the script finds it by text and measures its line boxes.)
 *   2. Run `node scripts/lab-capture.mjs openai-hf`. It writes the PNG + JSON to public/lab/media/ and regenerates sources.generated.ts.
 *   3. Change the key in `sources[...]` below. The scene reads everything else (size, lines, domain, date) from the record.
 *   4. Add the asset to public/lab/media/SOURCES-source.md.
 * Nothing in the scene is typed by hand, so no other change is needed.
 */
export type SourceRegion = {readonly x: number; readonly y: number; readonly width: number; readonly height: number; readonly lines: readonly Rect[]; readonly text: string};

export type SourceCapture = {
  /** Image under public/. */
  readonly src: string;
  readonly naturalWidth: number;
  readonly naturalHeight: number;
  readonly regions: {
    /** The sentence the scene lights (per-line boxes, image px). */
    readonly passage: SourceRegion;
    /** The article title (image px), used to frame the column from the title down to the sentence. */
    readonly title?: Rect;
  };
  /** Caption under the frame: the source's domain, taken from its URL. */
  readonly caption: string;
  /** Right-aligned line: when it was captured, from the record. */
  readonly meta: string;
  readonly url: string;
  readonly licence: string;
};

const capture = sources['source-morris-worm'];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "2026-11-04" -> "4 Nov 2026" (the record's own calendar date, nothing added). */
const shortDate = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};

export const SOURCE: SourceCapture = {
  src: capture.src,
  naturalWidth: capture.naturalWidth,
  naturalHeight: capture.naturalHeight,
  regions: {
    passage: capture.regions.passage,
    title: capture.regions.title,
  },
  caption: new URL(capture.url).hostname,
  meta: `Retrieved ${shortDate(capture.capturedOn)}`,
  url: capture.url,
  licence: capture.licence,
};
