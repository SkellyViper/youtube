import {GradeLayer, storyComposition} from '../../../components/story';
import {defineEpisode} from '../../../engine';
import {DeveloperScene} from './DeveloperScene';

export const episode = defineEpisode({
  id: 'story-01-developer',
  title: 'S01 · The indie game developer',
  leadIn: 0.3,
  defaultHold: 0.7,
  tail: 0.6,
  background: '#04050A',
  scenes: [
    {
      id: 'developer',
      title: 'The indie game developer',
      beats: [
        {id: 'dev-game', label: 'The game: the enemy splits', duration: 2.4, notes: 'Full-frame game. The knight walks in; the slime crouches and divides in two.'},
        {id: 'dev-pullback', label: 'Pull back to the desk', duration: 2.8, notes: 'The game becomes a monitor. John, the room, and the coding agent already writing on the second screen.'},
        {id: 'dev-agent', label: 'The agent’s code lands in the game', duration: 2.4, notes: 'The reply completes; a packet runs along the desk into the game; a new enemy drops in.'},
        {id: 'dev-hold', label: 'The workstation', duration: 2.0, hold: 1.2, notes: 'Settle wide. Warm game light left, cool agent light right. John types.'},
      ],
    },
  ],
  layers: [
    {id: 'world', component: DeveloperScene, z: 1},
    {id: 'grade', component: GradeLayer, z: 100},
  ],
});

export const Sample = storyComposition(episode);
