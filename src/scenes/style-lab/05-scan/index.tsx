import React from 'react';
import {CyberGrade} from '../../../components/cyber';
import {defineEpisode, EpisodeComposition} from '../../../engine';
import {cyber} from '../../../styles/cyber';
import '../../../styles/fonts';
import {ScanScene} from './ScanScene';

/**
 * Sample 05: scanning and detection. Five beats:
 * arm -> sweep -> all clear -> look into the floor -> verified and compromised.
 */
export const episode = defineEpisode({
  id: 'lab-05-scan',
  title: 'Style Lab 05 · Scanning and detection',
  leadIn: 0.3,
  defaultHold: 0.55,
  tail: 0.4,
  background: cyber.color.void,
  scenes: [
    {
      id: 'scan',
      title: 'Scan',
      component: ScanScene,
      beats: [
        {id: 'scan-arm', label: 'Region marked', duration: 1.2, notes: 'Corner brackets and a hairline border mark the observable region; the scan sheet stands up on its near edge.'},
        {id: 'scan-sweep', label: 'Sweep', duration: 2.4, notes: 'The sheet crosses the region at constant speed. Each module it passes is traced blue and ticked. Outside the region: nothing.'},
        {id: 'scan-clear', label: 'All clear', duration: 1.0, notes: 'The sheet retires; the border and ticks settle to a calm blue.'},
        {id: 'scan-reveal', label: 'Under the floor', duration: 2.4, notes: 'The camera goes down to the glass. Beneath one verified module: a red thing with no counterpart above, hanging below the scan plane.'},
        {id: 'scan-miss', label: 'Verified and compromised', duration: 1.3, hold: 0.8, notes: 'The tick above the module stays blue. The thing beneath it pulses once; its tether brightens.'},
      ],
    },
  ],
  layers: [{id: 'grade', component: CyberGrade, z: 100}],
});

export const Sample: React.FC = () => <EpisodeComposition episode={episode} />;
