import React from 'react';
import {EpisodeComposition} from '../../engine';
import '../../styles/fonts';
import {notDetectedEpisode} from './episode';

export const NotDetected: React.FC = () => <EpisodeComposition episode={notDetectedEpisode} />;
