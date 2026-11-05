import {GradeLayer, storyComposition} from '../../../components/story';
import {defineEpisode} from '../../../engine';
import {CallbackScene} from './CallbackScene';

export const episode = defineEpisode({
  id: 'story-10-callback',
  title: 'S10 · The final callback to John',
  leadIn: 0.3,
  defaultHold: 0.7,
  tail: 1.0,
  background: '#04050A',
  scenes: [
    {
      id: 'callback',
      title: 'The final callback to John',
      beats: [
        {id: 'cb-game', label: 'The game, going well', duration: 2.2, notes: 'Close on the game. Three slimes bounce; the knight patrols.'},
        {id: 'cb-john', label: 'Pull back to John', duration: 3.0, notes: 'Slow pull back. John types, lit warm by his game.'},
        {id: 'cb-window', label: 'Through the window', duration: 3.2, notes: 'The camera keeps drifting up to the window behind him, and through it into the night.'},
        {id: 'cb-signal', label: 'One light, then two', duration: 3.0, hold: 2.0, notes: 'On the horizon, the data centre. One purple light blinks. A second appears beside it. Hold.'},
      ],
    },
  ],
  layers: [
    {id: 'world', component: CallbackScene, z: 1},
    {id: 'grade', component: GradeLayer, z: 100},
  ],
});

export const Sample = storyComposition(episode);
