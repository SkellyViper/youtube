import React, {createContext, useContext} from 'react';
import {DEFAULT_THEME, getTheme, type Theme, type ThemeId, type ToneRole, type ToneTriplet} from './themes';

/**
 * The active visual identity. It is plain React context, not module state, so
 * two Players on one page (the Style Lab's A/B compare) can show two themes at
 * once, and an export is exactly as deterministic as before: the theme is a
 * composition prop (`inputProps.theme`), nothing else.
 *
 * Without a provider every hook returns the `neon` theme, which equals the
 * original tokens in cyber.ts, so legacy components behave exactly as before.
 */
export const ThemeContext = createContext<Theme>(getTheme(DEFAULT_THEME));

export const ThemeProvider: React.FC<{readonly theme?: ThemeId | string; readonly children?: React.ReactNode}> = ({theme, children}) => (
  <ThemeContext.Provider value={getTheme(theme)}>{children}</ThemeContext.Provider>
);

export const useTheme = (): Theme => useContext(ThemeContext);

/** A tone triplet of the active theme. Accepts the legacy `Tone` names too. */
export const useTone = (role: ToneRole): ToneTriplet => useTheme().tone[role];

/** Props every themable composition accepts (Remotion inputProps / Player inputProps). */
export type ThemedProps = {readonly theme?: ThemeId};
