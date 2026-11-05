import React from 'react';
import {CyberGrade} from '../../../components/cyber';
import {defineEpisode, EpisodeComposition} from '../../../engine';
import {cyber} from '../../../styles/cyber';
import '../../../styles/fonts';
import {MediaScene} from './MediaScene';

/**
 * Sample 08: image and video panel. Four beats, each one press of ArrowRight:
 * a photo enters -> push-in on a detail -> photo and portrait clip side by
 * side (the clip plays) -> both leave.
 */
export const episode = defineEpisode({
  id: 'lab-08-media',
  title: 'Style Lab 08 · Image and video panel',
  leadIn: 0.3,
  defaultHold: 0.55,
  tail: 0.4,
  background: cyber.color.void,
  scenes: [
    {
      id: 'media',
      title: 'Media',
      component: MediaScene,
      beats: [
        {id: 'media-enter', label: 'A photo enters', duration: 1.7, notes: 'Chrome builds, the aperture opens from its centre line, the photo is revealed.'},
        {id: 'media-reframe', label: 'Push in on a detail', duration: 1.8, notes: 'Marks find the detail, then a slow push-in inside the frame.'},
        {id: 'media-pair', label: 'Photo and clip, side by side', duration: 3.4, notes: 'The photo steps aside; a portrait clip builds next to it and plays.'},
        {id: 'media-exit', label: 'Both leave', duration: 1.5, hold: 0.9, notes: 'Apertures close to a line, lines to points, chrome retracts. Empty stage.'},
      ],
    },
  ],
  layers: [{id: 'grade', component: CyberGrade, z: 100}],
});

export const Sample: React.FC = () => <EpisodeComposition episode={episode} />;
