import {GradeLayer, storyComposition} from '../../../components/story';
import {defineEpisode} from '../../../engine';
import {KeepsRunningScene} from './KeepsRunningScene';

export const episode = defineEpisode({
  id: 'story-03-keeps-running',
  title: 'S03 · The agent keeps running',
  leadIn: 0.3,
  defaultHold: 0.7,
  tail: 0.6,
  background: '#04050A',
  scenes: [
    {
      id: 'keeps-running',
      title: 'The agent keeps running',
      beats: [
        {id: 'kr-close', label: 'John closes the window', duration: 2.1, notes: 'His hand goes to the keyboard; the chat collapses to a line, then a dot; the agent monitor switches off.'},
        {id: 'kr-dark', label: 'The room goes dark; the camera climbs the cable', duration: 2.6, notes: 'One continuous move away from the desk, up the cable that the prompt took.'},
        {id: 'kr-hall', label: 'One rack is still lit', duration: 2.8, notes: 'The hall is asleep except the bay the prompt landed in. The agent is still turning. A cable leads onward.'},
        {id: 'kr-pulse', label: 'A signal leaves', duration: 2.4, hold: 1.3, notes: 'A pulse, tinted toward red, leaves the rack toward the rest of the internet. Another follows.'},
      ],
    },
  ],
  layers: [
    {id: 'world', component: KeepsRunningScene, z: 1},
    {id: 'grade', component: GradeLayer, z: 100},
  ],
});

export const Sample = storyComposition(episode);
