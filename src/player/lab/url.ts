import {DEFAULT_THEME, isThemeId, type ThemeId} from '../../styles/themes';

/**
 * The viewer's selection lives in the URL, so a view can be shared or
 * reloaded:  /style-lab/04-replication?concept=redesign&theme=infrared&compare=theme:glacial#c=2
 *
 *   concept   redesign | original          which treatment of the scene
 *   theme     one of the five theme ids    visual identity
 *   compare   off | concept | theme:<id>   second, synchronised view
 */
export type Concept = 'redesign' | 'original';
export type Compare = {readonly kind: 'off'} | {readonly kind: 'concept'} | {readonly kind: 'theme'; readonly theme: ThemeId};

export type ViewerSelection = {
  readonly concept: Concept;
  readonly theme: ThemeId;
  readonly compare: Compare;
};

export const DEFAULT_SELECTION: ViewerSelection = {concept: 'redesign', theme: DEFAULT_THEME, compare: {kind: 'off'}};

export const readSelection = (search: string): ViewerSelection => {
  const q = new URLSearchParams(search);
  const concept: Concept = q.get('concept') === 'original' ? 'original' : 'redesign';
  const t = q.get('theme');
  const theme = isThemeId(t) ? t : DEFAULT_THEME;
  const c = q.get('compare') ?? 'off';
  let compare: Compare = {kind: 'off'};
  if (c === 'concept') compare = {kind: 'concept'};
  else if (c.startsWith('theme:') && isThemeId(c.slice(6))) compare = {kind: 'theme', theme: c.slice(6) as ThemeId};
  return {concept, theme, compare};
};

export const writeSelection = (sel: ViewerSelection, extra?: URLSearchParams): string => {
  const q = new URLSearchParams(extra);
  if (sel.concept !== 'redesign') q.set('concept', sel.concept);
  else q.delete('concept');
  if (sel.theme !== DEFAULT_THEME) q.set('theme', sel.theme);
  else q.delete('theme');
  if (sel.compare.kind === 'concept') q.set('compare', 'concept');
  else if (sel.compare.kind === 'theme') q.set('compare', `theme:${sel.compare.theme}`);
  else q.delete('compare');
  const s = q.toString();
  return s ? `?${s}` : '';
};
