import {GradeLayer, storyComposition} from '../../../components/story';
import {defineEpisode} from '../../../engine';
import {WrongProjectScene} from './WrongProjectScene';

export const episode = defineEpisode({
  id: 'story-02-wrong-project',
  title: 'S02 · The wrong project',
  leadIn: 0.3,
  defaultHold: 0.7,
  tail: 0.6,
  background: '#04050A',
  scenes: [
    {
      id: 'wrong-project',
      title: 'The wrong project',
      beats: [
        {id: 'wp-prompt', label: 'John types the request', duration: 2.0, notes: 'Close on the chat. The cloud tab is the active one.'},
        {id: 'wp-send', label: 'Send: the prompt leaves the screen', duration: 2.6, notes: 'The bubble folds into a capsule, exits the monitor, stops at the junction. The route to the game flickers.'},
        {id: 'wp-travel', label: 'It takes the cloud route', duration: 3.0, hold: 0.9, notes: 'The camera follows it up the cable to a remote hall. The rack lights, the agent there wakes.'},
        {id: 'wp-reveal', label: 'Pull back: both ends', duration: 2.8, hold: 1.2, notes: 'Desk lower left, lit hall upper right, the empty slot in the game.'},
      ],
    },
  ],
  layers: [
    {id: 'world', component: WrongProjectScene, z: 1},
    {id: 'grade', component: GradeLayer, z: 100},
  ],
});

export const Sample = storyComposition(episode);
