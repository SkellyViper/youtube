import React from 'react';
import {CyberGrade} from '../../../components/cyber';
import {defineEpisode, EpisodeComposition} from '../../../engine';
import {cyber} from '../../../styles/cyber';
import '../../../styles/fonts';
import {DURATION, NetworkScene} from './NetworkScene';

/**
 * Sample 04: the network. Five beats, each one press of ArrowRight:
 * form -> signal -> cascade -> scale -> dive.
 */
export const episode = defineEpisode({
  id: 'lab-04-network',
  title: 'Style Lab 04 · The network',
  leadIn: 0.3,
  defaultHold: 0.4,
  tail: 0.35,
  background: cyber.color.void,
  scenes: [
    {
      id: 'network',
      title: 'Network',
      component: NetworkScene,
      beats: [
        {id: 'net-form', label: 'A cluster forms', duration: DURATION.form, notes: 'Nodes arrive out of depth; edges draw on from the hubs outward.'},
        {id: 'net-signal', label: 'A signal crosses it', duration: DURATION.signal, notes: 'One purple comet, four or five hops. Each node it passes ignites; the path stays.'},
        {id: 'net-cascade', label: 'Activity cascades', duration: DURATION.cascade, notes: 'From where it landed, a wavefront spreads in graph order.'},
        {id: 'net-scale', label: 'The scale', duration: DURATION.scale, notes: 'Pull back: dozens of clusters on a web of long-haul arcs. The cascade keeps going.'},
        {id: 'net-dive', label: 'Across the web', duration: DURATION.dive, hold: 0.7, notes: 'Dive to a distant node; the cascade reaches it as we land.'},
      ],
    },
  ],
  layers: [{id: 'grade', component: CyberGrade, z: 100}],
});

export const Sample: React.FC = () => <EpisodeComposition episode={episode} />;
