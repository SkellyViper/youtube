// Optional browser override for every render script.
//
// Remotion normally downloads its own headless Chrome on first use. Where that
// is impossible (offline CI, sandboxed cloud containers), point
// REMOTION_BROWSER_EXECUTABLE at any local Chromium / headless_shell binary:
//
//   REMOTION_BROWSER_EXECUTABLE=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell npm run lab:render
//
// REMOTION_GL picks the WebGL backend: `angle` (GPU, default) or `swangle`
// (software, for machines without a GPU).
import {ensureBrowser as remotionEnsureBrowser} from '@remotion/renderer';

export const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || null;
export const defaultGl = process.env.REMOTION_GL || 'angle';
export const ensureBrowser = () => remotionEnsureBrowser(browserExecutable ? {browserExecutable} : {});
