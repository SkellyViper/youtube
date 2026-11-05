import React from 'react';
import {CyberGrade} from '../../../components/cyber';
import {defineEpisode, EpisodeComposition} from '../../../engine';
import {cyber} from '../../../styles/cyber';
import '../../../styles/fonts';
import {SourceScene} from './SourceScene';

/**
 * Sample 07: internet source / citation panel. Four beats, each one press of ArrowRight:
 * arrive -> open -> find the sentence -> dock as a citation while a second document arrives.
 * Gallery poster: checkpoint 3 (the emphasised passage).
 */
export const episode = defineEpisode({
  id: 'lab-07-source',
  title: 'Style Lab 07 · Internet source',
  leadIn: 0.3,
  defaultHold: 0.55,
  tail: 0.4,
  background: cyber.color.void,
  scenes: [
    {
      id: 'source',
      title: 'Source',
      component: SourceScene,
      beats: [
        {id: 'source-enter', label: 'A source arrives', duration: 1.8, notes: 'Out of the distant network: small and tilted, chrome building, then flat and centred. The page is still dormant.'},
        {id: 'source-read', label: 'It opens', duration: 1.4, notes: 'The aperture opens from the centre line. A real page, fully legible. Domain and date appear.'},
        {id: 'source-emphasis', label: 'The sentence', duration: 2.2, hold: 0.7, notes: 'The camera inside the frame finds one measured sentence; everything else dims.'},
        {id: 'source-dock', label: 'Docked, and a second source', duration: 2.2, hold: 1.0, notes: 'The page becomes a citation in the corner; a portrait document takes the stage.'},
      ],
    },
  ],
  layers: [{id: 'grade', component: CyberGrade, z: 100}],
});

export const Sample: React.FC = () => <EpisodeComposition episode={episode} />;
