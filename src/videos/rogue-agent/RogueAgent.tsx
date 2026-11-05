import React from 'react';
import {EpisodeComposition} from '../../engine';
import '../../styles/fonts';
import {rogueAgentEpisode} from './episode';

export const RogueAgent: React.FC = () => <EpisodeComposition episode={rogueAgentEpisode} />;
