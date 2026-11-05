import {defineEpisode} from '../../engine';
import {BackdropLayer, GrainLayer, HudLayer, InternetLayer} from '../../scenes/rogue-agent/InternetLayer';
import {WorldLayer} from '../../scenes/rogue-agent/WorldLayer';
import {questionScene, setupScene, spreadScene, wrongScene} from '../../scenes/rogue-agent/scenes';
import {theme} from '../../styles/theme';

/**
 * Cold open of the rogue-agent episode (4 scenes, 24 beats).
 * Reconstructed: see the note in ../not-detected/episode.ts.
 */
export const rogueAgentEpisode = defineEpisode({
  id: 'RogueAgent',
  title: 'Rogue agent: cold open',
  leadIn: 0.6,
  defaultHold: 1.2,
  tail: 0.8,
  background: theme.color.ink,
  scenes: [setupScene, wrongScene, spreadScene, questionScene],
  layers: [
    {id: 'backdrop', component: BackdropLayer, z: -10},
    {id: 'world', component: WorldLayer, from: 'setup', to: 'scavenge', z: 2},
    {id: 'internet', component: InternetLayer, from: 'spread', z: 1},
    {id: 'hud', component: HudLayer, from: 'scavenge', to: 'dark', z: 3},
    {id: 'grain', component: GrainLayer, z: 100},
  ],
});
