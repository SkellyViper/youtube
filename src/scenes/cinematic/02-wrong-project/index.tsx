import {CineGrade, cinematicComposition} from '../../../components/cinematic/episode';
import {defineEpisode} from '../../../engine';
import {WrongProjectScene} from './WrongProjectScene';

export const episode = defineEpisode({
  id: 'cine-02-wrong-project',
  title: 'X02 · The wrong project',
  leadIn: 0.3,
  defaultHold: 0.7,
  tail: 0.6,
  background: '#04050A',
  scenes: [
    {
      id: 'wrong-project',
      title: 'The wrong project',
      beats: [
        {id: 'wp-tab', label: 'The cloud tab is active', duration: 2.8, notes: 'Close on the agent screen. The prompt with the enemy sketch is ready. The camera pushes in: the active project is the cloud one.'},
        {id: 'wp-send', label: 'Send: the message leaves down the cable', duration: 2.6, notes: 'Enter. The bubble posts; a pulse runs down the monitor cable and along the skirting to the wall port. The camera tilts down with it. The game shows an empty slot.'},
        {id: 'wp-travel', label: 'Out of the window, across the district', duration: 3.8, notes: 'One continuous shot: the camera leaves through the window and travels with the pulse along the street toward the data centre.'},
        {id: 'wp-arrive', label: 'Into the hall, into one rack', duration: 3.2, hold: 1.3, notes: 'The roof opens for the camera; the pulse runs the tray and drops into a rack. Its LEDs turn purple and the agent ignites in its bay.'},
      ],
    },
  ],
  layers: [
    {id: 'world', component: WrongProjectScene, z: 1},
    {id: 'grade', component: CineGrade, z: 100},
  ],
});

export const Sample = cinematicComposition(episode);
