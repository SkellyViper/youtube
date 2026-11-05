import React from 'react';
import {createRoot} from 'react-dom/client';
import {fontsReady} from '../styles/fonts';
import {PresentationApp} from './PresentationApp';
import './presenter.css';

// Two entry views, chosen by URL (no router needed):
//   /                        the presenter for an episode (?episode=..., #c=...)
//   /style-lab[/<slug>]      the Style Lab gallery and sample viewer
//   /?episode=lab-<slug>     also opens a Style Lab sample
// The Style Lab is loaded on demand: its samples pull in three.js, which the
// regular presenter does not need, and a broken sample can never take the
// regular presenter down with it.
const isStyleLab =
  /^\/style-lab(\/|$)/.test(window.location.pathname) ||
  (new URLSearchParams(window.location.search).get('episode') ?? '').startsWith('lab-');

const loadApp = async (): Promise<React.ComponentType> =>
  isStyleLab ? (await import('./lab/StyleLabApp')).StyleLabApp : PresentationApp;

// Mount only after the self-hosted fonts are ready, so the first frame the
// presenter sees is typographically identical to the rendered video.
fontsReady
  .catch((err) => console.error('[presenter] font loading failed', err))
  .then(loadApp)
  .then((App) => {
    createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
  })
  .catch((err) => {
    console.error('[presenter] failed to start', err);
    document.getElementById('root')!.textContent = `Failed to start: ${err instanceof Error ? err.message : String(err)}`;
  });
