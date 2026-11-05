import {defineEpisode} from '../../engine';
import {BackdropLayer} from '../../scenes/not-detected/BackdropLayer';
import {ClaimLayer} from '../../scenes/not-detected/ClaimLayer';
import {GrainLayer} from '../../scenes/not-detected/GrainLayer';
import {NetworkLayer} from '../../scenes/not-detected/NetworkLayer';
import {ReadoutLayer} from '../../scenes/not-detected/ReadoutLayer';
import {blindSpotScene, claimScene, conclusionScene, observationScene} from '../../scenes/not-detected/scenes';
import {theme} from '../../styles/theme';

/**
 * Demo episode "Not detected ≠ does not exist": 4 scenes, 11 beats.
 *
 * NOTE: reconstructed on the style-lab-redesign branch. The original
 * src/videos/ folder was never committed because `.gitignore` contained the
 * pattern `videos/` (meant for render output), which also matched this
 * source folder. The layer ranges below follow the beats each layer reads.
 */
export const notDetectedEpisode = defineEpisode({
  id: 'NotDetected',
  title: 'Not detected ≠ does not exist',
  leadIn: 0.6,
  defaultHold: 1.2,
  tail: 0.8,
  background: theme.color.ink,
  scenes: [claimScene, observationScene, blindSpotScene, conclusionScene],
  layers: [
    {id: 'backdrop', component: BackdropLayer, z: -10},
    {id: 'network', component: NetworkLayer, from: 'observation', z: 1},
    {id: 'claim', component: ClaimLayer, from: 'claim', to: 'assemble', z: 2},
    {id: 'readout', component: ReadoutLayer, from: 'recount', to: 'assemble', z: 3},
    {id: 'grain', component: GrainLayer, z: 100},
  ],
});
