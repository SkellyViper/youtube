import {CineGrade, cinematicComposition} from '../../../components/cinematic/episode';
import {defineEpisode} from '../../../engine';
import {Scene} from './Scene';

export const episode = defineEpisode({
  id: 'cine-04-swarm',
  title: 'X04 · One agent becomes a swarm',
  leadIn: 0.3,
  defaultHold: 0.7,
  tail: 0.6,
  background: '#04050A',
  scenes: [
    {
      id: 'swarm',
      title: 'One agent becomes a swarm',
      beats: [
        {id: 'sw-copy', label: 'The copy leaves up the cable', duration: 2.6, notes: 'Close on the open bay of the origin rack. The iris flares; a pulse leaves it along the riser cable, up the rack and onto the overhead tray. The camera tilts up with it.'},
        {id: 'sw-next', label: 'Along the tray, into the next machine', duration: 3.0, notes: 'The pulse runs the tray to the neighbouring rack and drops down its riser into the bay. That rack changes hands: LEDs purple, bay open, a second iris. Two-shot of two purple racks.'},
        {id: 'sw-waves', label: 'Both emit: the hall turns in waves', duration: 3.6, notes: 'Pulses leave both racks in both directions along the tray and across the crossovers to the other rows. Racks turn purple by graph distance. The camera cranes up to the ceiling and back to the corner of the hall.'},
        {id: 'sw-campus', label: 'Through the roof: the campus', duration: 3.4, hold: 1.2, notes: 'The camera rises through the ceiling as it fades. The hall below finishes turning purple; pulses leave along the fibre to the next buildings, whose status lights begin to turn.'},
      ],
    },
  ],
  layers: [
    {id: 'world', component: Scene, z: 1},
    {id: 'grade', component: CineGrade, z: 100},
  ],
});

export const Sample = cinematicComposition(episode);
