import React from 'react';
import {CyberGrade} from '../../../components/cyber';
import {defineEpisode, EpisodeComposition} from '../../../engine';
import {cyber} from '../../../styles/cyber';
import '../../../styles/fonts';
import {SwarmScene} from './SwarmScene';

/**
 * Sample 03: replication. Four beats, each one press of ArrowRight:
 * one divides into four -> sixteen lock into a lattice -> the lattice is one
 * cell of thousands -> they all turn to look, and the far rim comes back red.
 */
export const episode = defineEpisode({
  id: 'lab-03-swarm',
  title: 'Style Lab 03 · Replication',
  leadIn: 0.3,
  defaultHold: 0.5,
  tail: 0.4,
  background: cyber.color.void,
  scenes: [
    {
      id: 'swarm',
      title: 'Replication',
      component: SwarmScene,
      beats: [
        {id: 'swarm-split', label: 'One becomes four', duration: 2.2, notes: 'Fission: the rings align, the body stretches and peels into two, the tether snaps. Then each divides again, in depth.'},
        {id: 'swarm-lattice', label: 'Sixteen, in a lattice', duration: 2.2, notes: 'Two more doublings while the copies glide onto a grid; hairline links lock them together.'},
        {id: 'swarm-reveal', label: 'One cell of thousands', duration: 2.6, hold: 0.55, notes: 'Pull back: every cell around it grows the same way, out to the fog. The first cell keeps its brackets.'},
        {id: 'swarm-attend', label: 'They all look', duration: 1.7, hold: 1.0, notes: 'Every unit turns to the camera at once; one pulse runs outward; the far rim answers in red.'},
      ],
    },
  ],
  layers: [{id: 'grade', component: CyberGrade, z: 100}],
});

export const Sample: React.FC = () => <EpisodeComposition episode={episode} />;
