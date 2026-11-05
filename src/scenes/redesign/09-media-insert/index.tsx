import {GradeLayer, storyComposition} from '../../../components/story';
import {defineEpisode} from '../../../engine';
import {MediaInsertScene} from './MediaInsertScene';

export const episode = defineEpisode({
  id: 'story-09-media-insert',
  title: 'S09 · External media insert',
  leadIn: 0.3,
  defaultHold: 0.7,
  tail: 0.6,
  background: '#04050A',
  scenes: [
    {
      id: 'media-insert',
      title: 'External media insert',
      beats: [
        {id: 'mi-world', label: 'The world steps back; a photo enters', duration: 2.6, notes: 'The plan dims and desaturates under a veil while the ENIAC photo arrives in true colour.'},
        {id: 'mi-detail', label: 'Push-in on a detail', duration: 2.4, notes: 'The two operators at the machine.'},
        {id: 'mi-pair', label: 'A clip joins and plays', duration: 2.8, hold: 0.9, notes: 'The photo steps aside; the screen recording builds beside it and plays on beat time.'},
        {id: 'mi-return', label: 'Both leave; the world returns', duration: 2.4, hold: 1.0, notes: 'Apertures close to a line, chrome retracts; colour comes back to the plan.'},
      ],
    },
  ],
  layers: [
    {id: 'world', component: MediaInsertScene, z: 1},
    {id: 'grade', component: GradeLayer, z: 100},
  ],
});

export const Sample = storyComposition(episode);
