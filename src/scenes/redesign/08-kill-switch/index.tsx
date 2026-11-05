import {GradeLayer, storyComposition} from '../../../components/story';
import {defineEpisode} from '../../../engine';
import {KillSwitchScene} from './KillSwitchScene';

export const episode = defineEpisode({
  id: 'story-08-kill-switch',
  title: 'S08 · Compute, model access and the kill switch',
  leadIn: 0.3,
  defaultHold: 0.7,
  tail: 0.6,
  background: '#04050A',
  scenes: [
    {
      id: 'kill-switch',
      title: 'Compute, model access and the kill switch',
      beats: [
        {id: 'ks-feed', label: 'Two cables feed the agent', duration: 2.6, notes: 'A model service (lattice glyph) with a key in the line, and a compute rack. Pulses travel toward the agent; its rings turn.'},
        {id: 'ks-pull', label: 'The key is pulled', duration: 3.0, hold: 0.8, notes: 'No hand: the key dips, then slides out. The line dies from the socket toward the agent; the rings slow to a stop and grey out.'},
        {id: 'ks-many', label: 'Hypothetical: three services', duration: 3.0, hold: 0.7, notes: 'Pull wide and pan right in the same world: the agent fed by three model lines, three keys, and compute. One tag: Hypothetical.'},
        {id: 'ks-one', label: 'One key, one line', duration: 3.2, hold: 1.2, notes: 'The middle key pulls. Only its line dies. The agent dims a little and keeps turning; the other lines keep pulsing.'},
      ],
    },
  ],
  layers: [
    {id: 'world', component: KillSwitchScene, z: 1},
    {id: 'grade', component: GradeLayer, z: 100},
  ],
});

export const Sample = storyComposition(episode);
