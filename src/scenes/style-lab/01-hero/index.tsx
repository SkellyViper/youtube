import React from 'react';
import {CyberGrade} from '../../../components/cyber';
import {defineEpisode, EpisodeComposition} from '../../../engine';
import {cyber} from '../../../styles/cyber';
import '../../../styles/fonts';
import {HeroScene} from './HeroScene';

/**
 * Sample 01: the cinematic opening. Four beats, each one press of ArrowRight:
 * wake -> scale reveal -> a mind arrives -> the world flattens into a diagram.
 */
export const episode = defineEpisode({
  id: 'lab-01-hero',
  title: 'Style Lab 01 · Cinematic opening',
  leadIn: 0.3,
  defaultHold: 0.5,
  tail: 0.4,
  background: cyber.color.void,
  scenes: [
    {
      id: 'hero',
      title: 'Hero',
      component: HeroScene,
      beats: [
        {id: 'hero-wake', label: 'The field wakes', duration: 2.0, notes: 'Horizon brightens; seams ignite from the far distance towards us.'},
        {id: 'hero-scale', label: 'It is a city', duration: 2.2, notes: 'Crane up and back: blocks and avenues of compute, out into the fog.'},
        {id: 'hero-signal', label: 'A mind arrives', duration: 2.1, hold: 0.6, notes: 'Signals converge on the plaza; the agent ignites. The only purple thing in a blue world.'},
        {id: 'hero-flatten', label: 'Flattens into a diagram', duration: 2.4, hold: 0.9, notes: 'Top-down, perspective removed; instrument marks land on the plan.'},
      ],
    },
  ],
  layers: [{id: 'grade', component: CyberGrade, z: 100}],
});

export const Sample: React.FC = () => <EpisodeComposition episode={episode} />;
