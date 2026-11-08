import {CineGrade, cinematicComposition} from '../../../components/cinematic/episode';
import {defineEpisode} from '../../../engine';
import {EvidenceLayer} from './EvidenceLayer';
import {WorldLayer} from './WorldLayer';

export const episode = defineEpisode({
  id: 'cine-06-evidence',
  title: 'X06 · Real evidence in a cinematic environment',
  leadIn: 0.3,
  defaultHold: 0.7,
  tail: 0.6,
  background: '#04050A',
  scenes: [
    {
      id: 'evidence',
      title: 'Real evidence in a cinematic environment',
      beats: [
        {id: 'ev-approach', label: 'Push in on the open bay', duration: 2.6, notes: 'Medium three-quarter in the cold aisle on the purple rack. The camera pushes in on the open bay; the hall steps back; a small evidence frame forms in the bay, pinned to it.'},
        {id: 'ev-source', label: 'The page comes out of the machine', duration: 3.2, hold: 1.1, notes: 'The real article flies out of the bay to a readable rect and opens; the inner camera reframes onto the measured sentence, which lights. Domain and capture date under the frame.'},
        {id: 'ev-media', label: 'A photo and a clip join the citation', duration: 3.4, hold: 1.0, notes: 'The page docks to a citation at the bottom-right corner. The ENIAC photo and the NASA clip arrive on the same baseline; the clip plays (frozen on the hold); push-in on the two operators.'},
        {id: 'ev-return', label: 'Back into the machine, back to the hall', duration: 2.6, notes: 'Photo and clip exit; the citation flies back into the bay; the veil lifts and the colour returns; the camera eases back out to the opening composition, a little higher. Nothing 2D is left.'},
      ],
    },
  ],
  layers: [
    {id: 'world', component: WorldLayer, z: 1},
    {id: 'evidence', component: EvidenceLayer, z: 10},
    {id: 'grade', component: CineGrade, z: 100},
  ],
});

export const Sample = cinematicComposition(episode);
