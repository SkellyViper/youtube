import type React from 'react';
import type {EpisodeDef} from '../engine';
import {NotDetected} from './not-detected/NotDetected';
import {notDetectedEpisode} from './not-detected/episode';
import {RogueAgent} from './rogue-agent/RogueAgent';
import {rogueAgentEpisode} from './rogue-agent/episode';

/** Presentation registry (`?episode=<id>`). The first entry is the default. */
export type EpisodeEntry = {
  readonly id: string;
  readonly episode: EpisodeDef;
  readonly component: React.ComponentType;
};

export const DEFAULT_FPS = 60;

export const EPISODES: readonly EpisodeEntry[] = [
  {id: notDetectedEpisode.id, episode: notDetectedEpisode, component: NotDetected},
  {id: rogueAgentEpisode.id, episode: rogueAgentEpisode, component: RogueAgent},
];
