import React from 'react';
import {CyberGrade} from '../../../components/cyber';
import {defineEpisode, EpisodeComposition} from '../../../engine';
import {cyber} from '../../../styles/cyber';
import '../../../styles/fonts';
import {EndingScene} from './EndingScene';

/**
 * Sample 10: reflective ending / ominous hold. Four beats, each one press of
 * ArrowRight: wind down -> lights out -> one ember -> the horizon that never stopped.
 *
 * Export length: 0.3 + (2.0 + 0.35) + (2.4 + 0.35) + (1.7 + 0.4) + (2.8 + 1.3) + 0.4 = 12.0 s.
 */
export const episode = defineEpisode({
  id: 'lab-10-ending',
  title: 'Style Lab 10 · Ending',
  leadIn: 0.3,
  defaultHold: 0.35,
  tail: 0.4,
  background: cyber.color.void,
  scenes: [
    {
      id: 'ending',
      title: 'Ending',
      component: EndingScene,
      beats: [
        {id: 'end-slow', label: 'Winds down', duration: 2.0, notes: 'Rings coast to a stop, the last signals arrive, everything dims.'},
        {id: 'end-dark', label: 'Lights out', duration: 2.4, notes: 'From the outer edge inward. The agent goes last, to nothing.'},
        {id: 'end-ember', label: 'One ember', duration: 1.7, hold: 0.4, notes: 'One small indicator is still on. The camera drifts to it; it breathes once.'},
        {id: 'end-horizon', label: 'The rest never stopped', duration: 2.8, hold: 1.3, notes: 'Rise and tilt up: an immense field of lights along the horizon. Hold.'},
      ],
    },
  ],
  layers: [{id: 'grade', component: CyberGrade, z: 100}],
});

export const Sample: React.FC = () => <EpisodeComposition episode={episode} />;
