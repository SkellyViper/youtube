import React from 'react';
import {CyberGrade} from '../../../components/cyber';
import {defineEpisode, EpisodeComposition} from '../../../engine';
import {cyber} from '../../../styles/cyber';
import '../../../styles/fonts';
import {AgentScene} from './AgentScene';

/**
 * Sample 02: a single AI agent. Five beats, each one press of ArrowRight:
 * assemble -> think -> reach into tools -> operate -> turn (threat state).
 */
export const episode = defineEpisode({
  id: 'lab-02-agent',
  title: 'Style Lab 02 · A single agent',
  leadIn: 0.3,
  defaultHold: 0.55,
  tail: 0.4,
  background: cyber.color.void,
  scenes: [
    {
      id: 'agent',
      title: 'Agent',
      component: AgentScene,
      beats: [
        {id: 'agent-assemble', label: 'Core assembles', duration: 1.8, notes: 'Out of the dark: core, shell, then the three rings lock in.'},
        {id: 'agent-think', label: 'It attends', duration: 1.5, notes: 'Rings swing into one plane, a ripple leaves the floor, the reticle finds it.'},
        {id: 'agent-reach', label: 'Reaches into tools', duration: 2.0, notes: 'Three signals leave the core; each tool it touches lights up.'},
        {id: 'agent-operate', label: 'Operates', duration: 1.8, notes: 'Results come back. What it uses takes on its colour.'},
        {id: 'agent-turn', label: 'Turns', duration: 1.5, hold: 0.9, notes: 'Same agent, same tools. Red.'},
      ],
    },
  ],
  layers: [{id: 'grade', component: CyberGrade, z: 100}],
});

export const Sample: React.FC = () => <EpisodeComposition episode={episode} />;
