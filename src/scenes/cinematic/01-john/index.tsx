import {defineEpisode} from '../../../engine';
import {applyShotBeats, shotComposition, ShotGrade} from '../../../shot';
import {JohnScene} from './JohnScene';
import {shot} from './shot';

/** The beat sheet as written in code (the approved shot.json may retime it). */
export const baseEpisode = defineEpisode({
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
        {id: 'jc-room', label: 'A room, late', duration: 3.0, notes: 'A developer at two screens, typing.'},
        {id: 'jc-game', label: 'The game', duration: 2.8, notes: 'On the game monitor the new enemy, a slime, splits in two.'},
        {id: 'jc-agent', label: 'He turns to the agent', duration: 2.6, notes: 'He turns to the agent screen. The reply writes itself; purple light rises on him.'},
        {id: 'jc-hold', label: 'The whole situation', duration: 2.4, hold: 1.2, notes: 'He turns back to the game while the agent keeps working.'},
      ],
    },
  ],
  layers: [
    {id: 'world', component: JohnScene, z: 1},
    {id: 'grade', component: ShotGrade, z: 100},
  ],
});

export {shot};

/** The episode with the approved timing (what the gallery, Remotion Root and renders use by default). */
export const episode = applyShotBeats(baseEpisode, shot.approved);

export const Sample = shotComposition(shot, baseEpisode);
