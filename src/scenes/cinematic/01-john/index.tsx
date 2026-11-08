import {CineGrade, cinematicComposition} from '../../../components/cinematic/episode';
import {defineEpisode} from '../../../engine';
import {JohnScene} from './JohnScene';

export const episode = defineEpisode({
  id: 'cine-01-john',
  title: 'X01 · John at his computer',
  leadIn: 0.3,
  defaultHold: 0.7,
  tail: 0.6,
  background: '#04050A',
  scenes: [
    {
      id: 'john',
      title: 'John at his computer',
      beats: [
        {id: 'jc-room', label: 'A room, late', duration: 3.0, notes: 'Establishing shot from the doorway. A developer at two screens; the camera eases toward the desk.'},
        {id: 'jc-game', label: 'Over the shoulder: the game', duration: 2.8, notes: 'Close on the game monitor. The new enemy, a slime, splits in two.'},
        {id: 'jc-agent', label: 'He turns to the agent', duration: 2.6, notes: 'The camera slides with his look to the agent chat. The reply writes itself; purple light rises on him.'},
        {id: 'jc-hold', label: 'The whole situation', duration: 2.4, hold: 1.2, notes: 'Pull back to a medium wide: person, game, agent, night.'},
      ],
    },
  ],
  layers: [
    {id: 'world', component: JohnScene, z: 1},
    {id: 'grade', component: CineGrade, z: 100},
  ],
});

export const Sample = cinematicComposition(episode);
