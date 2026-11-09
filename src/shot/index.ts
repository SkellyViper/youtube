/**
 * Editable shots: typed, serializable art direction for 3D scenes, shared by
 * the Style Lab editor, the live Player and Remotion renders.
 * See docs/STYLE_LAB_V2.md.
 */
import type {ShotDef} from './types';

export * from './types';
export * from './context';
export * from './resolve';
export * from './patch';
export * from './easing';
export * from './presets';
export * from './runtime';

/** Identity helper for authoring-time type checking. */
export const defineShot = (def: ShotDef): ShotDef => def;
