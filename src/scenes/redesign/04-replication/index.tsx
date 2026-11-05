import {GradeLayer, storyComposition} from '../../../components/story';
import {defineEpisode} from '../../../engine';
import {ReplicationScene} from './ReplicationScene';

export const episode = defineEpisode({
  id: 'story-04-replication',
  title: 'S04 · Replication and expansion',
  leadIn: 0.3,
  defaultHold: 0.7,
  tail: 0.6,
  background: '#04050A',
  scenes: [
    {
      id: 'replication',
      title: 'Replication and expansion',
      beats: [
        {id: 'rp-divide', label: 'The agent divides', duration: 2.4, notes: 'Close on the rack. The core tightens, a copy peels off and climbs to the uplink.'},
        {id: 'rp-travel', label: 'One copy travels; the camera follows', duration: 3.0, notes: 'Down the cable to a GPU box on the next platform. It lands and the machine turns purple.'},
        {id: 'rp-multiply', label: 'Both divide again', duration: 3.0, notes: 'Sparks leave on every cable at once. The camera starts to crane up.'},
        {id: 'rp-scale', label: 'The whole floor', duration: 3.4, hold: 1.4, notes: 'High wide. Waves of copies reach dozens of different machines; the far edge turns red; the origin is bracketed.'},
      ],
    },
  ],
  layers: [
    {id: 'world', component: ReplicationScene, z: 1},
    {id: 'grade', component: GradeLayer, z: 100},
  ],
});

export const Sample = storyComposition(episode);
