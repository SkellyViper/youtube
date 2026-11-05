import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

// The interactive presentation app. It imports the exact same composition
// components that Remotion renders (see src/videos/registry.ts).
export default defineConfig(({command, mode}) => {
  // A globally exported NODE_ENV=development would otherwise leak React's
  // (much slower) development build and dev JSX transform into `vite build`.
  // Presenting should always use the production build.
  if (command === 'build' && mode !== 'development') {
    process.env.NODE_ENV = 'production';
  }
  return {
    plugins: [react()],
    server: {port: 5173, strictPort: true},
    // If 4173 is taken, use the next free port; `--open` opens whichever it got.
    preview: {port: 4173, strictPort: false},
    build: {chunkSizeWarningLimit: 2000},
  };
});
