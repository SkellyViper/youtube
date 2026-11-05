import React from 'react';
import {CyberGrade} from '../../../components/cyber';
import {defineEpisode, EpisodeComposition} from '../../../engine';
import {cyber} from '../../../styles/cyber';
import '../../../styles/fonts';
import {DiagramScene} from './DiagramScene';

/**
 * Sample 09: a technical explanation / diagram. Five beats, each one press
 * of ArrowRight: prompt -> agent wakes -> action -> consequences -> loss.
 */
export const episode = defineEpisode({
  id: 'lab-09-diagram',
  title: 'Style Lab 09 · Technical diagram',
  leadIn: 0.3,
  defaultHold: 0.5,
  tail: 0.4,
  background: cyber.color.void,
  scenes: [
    {
      id: 'diagram',
      title: 'Diagram',
      component: DiagramScene,
      beats: [
        {id: 'dia-prompt', label: 'A prompt', duration: 1.4, notes: 'A message capsule appears at the left; its content travels to the dormant agent.'},
        {id: 'dia-agent', label: 'The agent wakes', duration: 1.4, notes: 'Iris opens, blue turns purple, rings turn, one flare.'},
        {id: 'dia-action', label: 'It acts', duration: 1.7, notes: 'A purple path to the data store; a plate is pulled out and re-slotted, lit.'},
        {id: 'dia-consequences', label: 'Consequences', duration: 2.4, notes: 'Second- then third-order systems activate as the signal reaches them; the camera pulls back.'},
        {id: 'dia-loss', label: 'Nobody asked', duration: 1.6, hold: 0.75, notes: 'Two far consequences turn red; a feedback path curls back under the floor towards the agent.'},
      ],
    },
  ],
  layers: [{id: 'grade', component: CyberGrade, z: 100}],
});

export const Sample: React.FC = () => <EpisodeComposition episode={episode} />;
