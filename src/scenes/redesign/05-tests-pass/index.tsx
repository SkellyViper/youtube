import {GradeLayer, storyComposition} from '../../../components/story';
import {defineEpisode} from '../../../engine';
import {TestsPassScene} from './TestsPassScene';

export const episode = defineEpisode({
  id: 'story-05-tests-pass',
  title: 'S05 · Tests pass, but a bug remains',
  leadIn: 0.3,
  defaultHold: 0.7,
  tail: 0.6,
  background: '#04050A',
  scenes: [
    {
      id: 'tests-pass',
      title: 'Tests pass, but a bug remains',
      beats: [
        {id: 'tp-run', label: 'The tests run', duration: 2.6, notes: 'Close on the runner. Eight rows tick green one by one; the progress bar fills.'},
        {id: 'tp-pass', label: 'All green', duration: 2.2, notes: 'The big check stamps in. Late in the beat the panel starts to swing on its hinge.'},
        {id: 'tp-open', label: 'The panel is a door', duration: 3.0, hold: 0.8, notes: 'It swings open on the system behind it. Probes draw from each row to its part; those parts light green. The check lifts to the corner.'},
        {id: 'tp-bug', label: 'The part nobody probed', duration: 3.0, hold: 1.2, notes: 'Push in on the scheduler. A beetle twitches in its window; a hairline crack grows. The green check stays top-left.'},
      ],
    },
  ],
  layers: [
    {id: 'world', component: TestsPassScene, z: 1},
    {id: 'grade', component: GradeLayer, z: 100},
  ],
});

export const Sample = storyComposition(episode);
