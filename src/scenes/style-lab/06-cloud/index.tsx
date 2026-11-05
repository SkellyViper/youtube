import React from 'react';
import {CyberGrade} from '../../../components/cyber';
import {defineEpisode, EpisodeComposition} from '../../../engine';
import {cyber} from '../../../styles/cyber';
import '../../../styles/fonts';
import {CloudScene} from './CloudScene';

/**
 * Sample 06: cloud compute as islands. Four beats, each one press of ArrowRight:
 * come online -> load on A -> access granted at B's gate -> the work migrates A -> B -> C.
 */
export const episode = defineEpisode({
  id: 'lab-06-cloud',
  title: 'Style Lab 06 · Islands of compute',
  leadIn: 0.3,
  defaultHold: 0.5,
  tail: 0.4,
  background: cyber.color.void,
  scenes: [
    {
      id: 'cloud',
      title: 'Cloud',
      component: CloudScene,
      beats: [
        {id: 'cloud-online', label: 'Islands come online', duration: 2.0, notes: 'Three providers arrive out of depth. Seams light, each boundary ring draws on.'},
        {id: 'cloud-load', label: 'Load on A', duration: 1.7, notes: 'Light climbs the racks row by row: a blue hum of work.'},
        {id: 'cloud-access', label: 'Access granted', duration: 2.4, notes: 'A credential leaves A. B opens its ring exactly where it arrives, lets it in, closes behind it.'},
        {id: 'cloud-migrate', label: 'Workload migrates', duration: 2.6, hold: 0.9, notes: 'The work follows the access: A to B to C. Purple where it lands, A goes dark.'},
      ],
    },
  ],
  layers: [{id: 'grade', component: CyberGrade, z: 100}],
});

export const Sample: React.FC = () => <EpisodeComposition episode={episode} />;
