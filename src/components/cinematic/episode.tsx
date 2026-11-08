import React from 'react';
import {EpisodeComposition, type EpisodeDef} from '../../engine';
import {ThemeProvider, type ThemedProps} from '../../styles/ThemeContext';
import {StoryGrade} from '../story/Atmosphere';
import '../../styles/fonts';

/**
 * A cinematic experiment is an episode (beats + layers) with a themable
 * composition, exactly like the redesign scenes, so the gallery, the compare
 * view, the render scripts and Remotion Studio treat them the same way.
 */
export const cinematicComposition = (episode: EpisodeDef): React.FC<ThemedProps> => {
  const C: React.FC<ThemedProps> = ({theme}) => (
    <ThemeProvider theme={theme}>
      <EpisodeComposition episode={episode} />
    </ThemeProvider>
  );
  C.displayName = `Cinematic(${episode.id})`;
  return C;
};

/** Finishing layer (vignette, grain). */
export const CineGrade: React.FC = () => <StoryGrade />;
