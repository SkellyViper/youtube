import {CineGrade, cinematicComposition} from '../../../components/cinematic/episode';
import {defineEpisode} from '../../../engine';
import {Scene} from './Scene';

export const episode = defineEpisode({
  id: 'cine-05-blind-spot',
  title: 'X05 · The scanner misses something',
  leadIn: 0.3,
  defaultHold: 0.7,
  tail: 0.6,
  background: '#04050A',
  scenes: [
    {
      id: 'blind-spot',
      title: 'The scanner misses something',
      beats: [
        {id: 'bs-zone', label: 'The caged zone', duration: 2.6, notes: 'From the open gate, down the cold aisle at head height: chain-link, two rows of racks, the scanner parked at the near end with its bar dark. The bar ignites green.'},
        {id: 'bs-sweep', label: 'The scanner rides the aisle', duration: 3.4, notes: 'The trolley runs the rail at constant speed; its pool of light slides along the rack faces; a check lamp lights above each rack behind it. The camera dollies with it, in through the gate.'},
        {id: 'bs-clear', label: 'Zone clear', duration: 2.2, notes: 'It parks before the shut far gate. Every tick inside the cage is steady green; the top-rail hairline and the sign lamps confirm it. Stillness, then the camera begins to rise.'},
        {id: 'bs-outside', label: 'Up, over the wire, to the closet', duration: 3.4, notes: 'One crane: over the fence into the side corridor and round toward the end wall. A closet door stands open; inside, an old tower with one LED and the iris, purple on its floor. The green ticks stay in view.'},
        {id: 'bs-hold', label: 'Inside and outside, one picture', duration: 2.0, hold: 1.2, notes: 'Wide three-quarter from above: the green zone behind its wire on the left, the lit closet on the right, the fence between them. Hold.'},
      ],
    },
  ],
  layers: [
    {id: 'world', component: Scene, z: 1},
    {id: 'grade', component: CineGrade, z: 100},
  ],
});

export const Sample = cinematicComposition(episode);
