import {loadFont} from '@remotion/fonts';
import {staticFile} from 'remotion';

/**
 * Fonts are self-hosted from public/fonts so rendering never depends on the
 * network. @remotion/fonts blocks rendering (delayRender) until they load;
 * the presentation app awaits `fontsReady` before mounting the Player.
 */
export const fontsReady: Promise<void> = Promise.all([
  loadFont({
    family: 'Archivo',
    url: staticFile('fonts/Archivo-Variable.woff2'),
    weight: '100 900',
    stretch: '62% 125%',
    display: 'block',
  }),
  loadFont({
    family: 'Instrument Serif',
    url: staticFile('fonts/InstrumentSerif-Italic.woff2'),
    style: 'italic',
    weight: '400',
    display: 'block',
  }),
  loadFont({
    family: 'Instrument Serif',
    url: staticFile('fonts/InstrumentSerif-Regular.woff2'),
    style: 'normal',
    weight: '400',
    display: 'block',
  }),
  loadFont({
    family: 'JetBrains Mono',
    url: staticFile('fonts/JetBrainsMono-Variable.woff2'),
    weight: '100 800',
    display: 'block',
  }),
]).then(() => undefined);
