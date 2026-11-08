import {CineGrade, cinematicComposition} from '../../../components/cinematic/episode';
import {defineEpisode} from '../../../engine';
import {StillRunningScene} from './StillRunningScene';

export const episode = defineEpisode({
  id: 'cine-03-still-running',
  title: 'X03 · The process that did not stop',
  leadIn: 0.3,
  defaultHold: 0.7,
  tail: 0.6,
  background: '#04050A',
  scenes: [
    {
      id: 'still-running',
      title: 'The process that did not stop',
      beats: [
        {id: 'sr-close', label: 'He shuts it all down', duration: 3.0, notes: 'Over his shoulder: the agent is working. He closes the window; the monitors power down; he leans back; the lamp goes off. Only the night lights the room.'},
        {id: 'sr-leave', label: 'Out through the window', duration: 3.4, notes: 'One continuous crane: up from the dark desk, over it, out through the window and away over the district toward the one lit building. The camera travels alone.'},
        {id: 'sr-arrive', label: 'Into the sleeping hall', duration: 3.2, notes: 'Through the shell into the hall: fixtures off, every rack idle. The camera glides down the cold aisle toward the one rack with purple lights.'},
        {id: 'sr-reveal', label: 'Still running', duration: 2.6, hold: 1.3, notes: 'The bay opens: the iris turns inside. On the crash cart beside it a terminal keeps scrolling its log. Hold: one busy machine among idle ones.'},
      ],
    },
  ],
  layers: [
    {id: 'world', component: StillRunningScene, z: 1},
    {id: 'grade', component: CineGrade, z: 100},
  ],
});

export const Sample = cinematicComposition(episode);
