export * from './types';
export * from './timeline';
export * from './beat';
export * from './track';
export * from './context';
export * from './hooks';
export * from './camera';
export {EpisodeComposition} from './EpisodeComposition';

import type {EpisodeDef, SceneDef} from './types';

/** Identity helpers that give authoring-time type checking. */
export const defineEpisode = (episode: EpisodeDef): EpisodeDef => episode;
export const defineScene = (scene: SceneDef): SceneDef => scene;
