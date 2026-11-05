import React from 'react';
import {EpisodeComposition, type EpisodeDef} from '../../engine';
import {ThemeProvider, type ThemedProps} from '../../styles/ThemeContext';
import {StoryGrade} from './Atmosphere';
import '../../styles/fonts';

/**
 * Every redesigned scene is an episode (beats + layers) plus a themable
 * composition component. The theme arrives as a composition input prop, so
 * `npx remotion render story-04-replication --props='{"theme":"infrared"}'`
 * and `<Player inputProps={{theme}}>` are the same code path.
 */
export const storyComposition = (episode: EpisodeDef): React.FC<ThemedProps> => {
  const C: React.FC<ThemedProps> = ({theme}) => (
    <ThemeProvider theme={theme}>
      <EpisodeComposition episode={episode} />
    </ThemeProvider>
  );
  C.displayName = `Story(${episode.id})`;
  return C;
};

/** The finishing layer every scene mounts last (z: 100). */
export const GradeLayer: React.FC = () => <StoryGrade />;
