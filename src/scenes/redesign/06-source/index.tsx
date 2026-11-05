import {GradeLayer, storyComposition} from '../../../components/story';
import {defineEpisode} from '../../../engine';
import {SourceScene} from './SourceScene';

export const episode = defineEpisode({
  id: 'story-06-source',
  title: 'S06 · Real incident: an internet source',
  leadIn: 0.3,
  defaultHold: 0.7,
  tail: 0.6,
  background: '#04050A',
  scenes: [
    {
      id: 'source',
      title: 'Real incident: an internet source',
      beats: [
        {id: 'sr-plan', label: 'The hypothetical plan', duration: 2.4, notes: 'The flattened network from S04, dim. The camera pushes slowly toward the root rack.'},
        {id: 'sr-rise', label: 'A real page rises out of the node', duration: 3.0, hold: 0.9, notes: 'The world desaturates and recedes. The page comes out of the rack, opens, and the inner camera lands on the measured sentence.'},
        {id: 'sr-read', label: 'Read, then ease off', duration: 2.2, notes: 'Hold on the sentence; the inner camera relaxes so the article column is seen whole.'},
        {id: 'sr-dock', label: 'Docked as a citation', duration: 2.6, hold: 1.2, notes: 'The page shrinks beside the rack with a leader line; the world regains its colour.'},
      ],
    },
  ],
  layers: [
    {id: 'world', component: SourceScene, z: 1},
    {id: 'grade', component: GradeLayer, z: 100},
  ],
});

export const Sample = storyComposition(episode);
