import {defineEpisode} from '../../../engine';
import {applyShotBeats, shotComposition, ShotGrade} from '../../../shot';
import {WrongProjectScene} from './WrongProjectScene';
import {shot} from './shot';

/** The beat sheet as written in code (the approved shot.json may retime it). */
export const baseEpisode = defineEpisode({
  id: 'cine-02-wrong-project',
  title: 'X02 · The wrong project',
  leadIn: 0.3,
  // Background footage: no frozen pauses between beats in the export (the live presenter still holds at every checkpoint).
  defaultHold: 0,
  tail: 0.6,
  background: '#04050A',
  scenes: [
    {
      id: 'wrong-project',
      title: 'The wrong project',
      beats: [
        {id: 'wp-type', label: 'Establish: his game, and a task for his agent', duration: 4.5, notes: 'Shot A. John at his desk. Left of the ultrawide: his game (my-game) in the engine editor. Right: a terminal with two tabs, my-game and cloud-ops; cloud-ops is active. He types a task for his agent: a new enemy that hides, scavenges, multiplies and ambushes the player.'},
        {id: 'wp-send', label: 'Trigger: Enter, in the cloud-ops tab', duration: 4.5, notes: 'Shot B, the terminal insert. The task sits in the prompt, ~/cloud-ops under it. Enter. The agent searches for the game files, finds an infrastructure repo, and creates enemies/scavenger.gd in ~/cloud-ops.'},
        {id: 'wp-carry', label: 'Outcome: it runs in cloud-ops; he goes back to his game', duration: 4.5, notes: 'Shot A. The agent keeps working on the right. He does not react: he takes the mouse, clicks his game and presses play.'},
        {id: 'wp-hold', label: 'Casual continuation, ominous hold', duration: 4.5, hold: 1.0, notes: 'Shot A. He leans back and plays his game. On the right the agent is still running in cloud-ops (terraform), a faint purple on that side of the desk.'},
      ],
    },
  ],
  layers: [
    {id: 'world', component: WrongProjectScene, z: 1},
    {id: 'grade', component: ShotGrade, z: 100},
  ],
});

export {shot};

/** The episode with the approved timing (what the gallery, Remotion Root and renders use by default). */
export const episode = applyShotBeats(baseEpisode, shot.approved);

export const Sample = shotComposition(shot, baseEpisode);
