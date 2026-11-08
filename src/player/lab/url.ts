import {DEFAULT_THEME, isThemeId, type ThemeId} from '../../styles/themes';
import {isConcept, type Concept} from './family';

/**
 * The viewer's selection lives in the URL, so a view can be shared or
 * reloaded:  /style-lab/02-wrong-project?concept=cinematic&theme=infrared&compare=concept:redesign#c=2
 *
 *   concept   original | redesign | cinematic     which treatment of the scene
 *   theme     one of the five theme ids           visual identity
 *   compare   off | concept | concept:<c> | theme:<id>   second, synchronised view
 *             (`concept` alone means "the other treatment", for older links)
 */
export type {Concept};
export type Compare = {readonly kind: 'off'} | {readonly kind: 'concept'; readonly concept?: Concept} | {readonly kind: 'theme'; readonly theme: ThemeId};

export type ViewerSelection = {
  readonly concept: Concept;
  readonly theme: ThemeId;
  readonly compare: Compare;
};

export const readSelection = (search: string, fallbackConcept: Concept): ViewerSelection => {
  const q = new URLSearchParams(search);
  const c0 = q.get('concept');
  const concept: Concept = isConcept(c0) ? c0 : fallbackConcept;
  const t = q.get('theme');
  const theme = isThemeId(t) ? t : DEFAULT_THEME;
  const c = q.get('compare') ?? 'off';
  let compare: Compare = {kind: 'off'};
  if (c === 'concept') compare = {kind: 'concept'};
  else if (c.startsWith('concept:') && isConcept(c.slice(8))) compare = {kind: 'concept', concept: c.slice(8) as Concept};
  else if (c.startsWith('theme:') && isThemeId(c.slice(6))) compare = {kind: 'theme', theme: c.slice(6) as ThemeId};
  return {concept, theme, compare};
};

export const writeSelection = (sel: ViewerSelection, defaultConcept: Concept, extra?: URLSearchParams): string => {
  const q = new URLSearchParams(extra);
  if (sel.concept !== defaultConcept) q.set('concept', sel.concept);
  else q.delete('concept');
  if (sel.theme !== DEFAULT_THEME) q.set('theme', sel.theme);
  else q.delete('theme');
  if (sel.compare.kind === 'concept') q.set('compare', sel.compare.concept ? `concept:${sel.compare.concept}` : 'concept');
  else if (sel.compare.kind === 'theme') q.set('compare', `theme:${sel.compare.theme}`);
  else q.delete('compare');
  const s = q.toString();
  return s ? `?${s}` : '';
};
