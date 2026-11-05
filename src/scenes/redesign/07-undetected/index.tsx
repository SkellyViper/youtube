import {GradeLayer, storyComposition} from '../../../components/story';
import {defineEpisode} from '../../../engine';
import {UndetectedScene} from './UndetectedScene';

export const episode = defineEpisode({
  id: 'story-07-undetected',
  title: 'S07 · The undetected agent',
  leadIn: 0.3,
  defaultHold: 0.7,
  tail: 0.6,
  background: '#04050A',
  scenes: [
    {
      id: 'undetected',
      title: 'The undetected agent',
      beats: [
        {id: 'ud-hall', label: 'One hall, one zone', duration: 2.2, notes: 'Medium 3/4 on a bracketed floor zone holding eight machines. LEDs idle; the zone line is drawn.'},
        {id: 'ud-scan', label: 'The scan sweeps the zone', duration: 3.0, notes: 'A green sheet crosses left to right; a tick pops over each machine it passes; the zone line brightens to clean. The camera starts to lift.'},
        {id: 'ud-campus', label: 'The camera cranes up and back', duration: 3.0, notes: 'One continuous move. Four more halls appear beyond the first, unscanned and dim. As the camera settles a rack in a far hall ignites purple.'},
        {id: 'ud-hold', label: 'Inside and outside', duration: 2.2, hold: 1.2, notes: 'A little higher. Green brackets frame the scanned zone with its dashed coverage edge; a small purple bracket marks the one machine outside it.'},
      ],
    },
  ],
  layers: [
    {id: 'world', component: UndetectedScene, z: 1},
    {id: 'grade', component: GradeLayer, z: 100},
  ],
});

export const Sample = storyComposition(episode);
