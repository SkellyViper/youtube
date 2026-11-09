import fs from 'node:fs';
import path from 'node:path';
import {defineConfig, type Plugin} from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Dev-server only: lets the Style Lab shot editor write an approved shot
 * config back into the repo ("Save to repo"), so an edit made in the browser
 * becomes an ordinary file change you can review and commit. Only paths of
 * the form src/scenes/<...>/shot.json inside this project are accepted.
 * It does not exist in `vite build` / `vite preview`.
 */
const shotSave = (): Plugin => ({
  name: 'shot-save',
  apply: 'serve',
  configureServer(server) {
    const root = server.config.root;
    server.middlewares.use('/__shot/save', (req, res) => {
      const reply = (status: number, body: unknown) => {
        res.statusCode = status;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(body));
      };
      if (req.method !== 'POST') return reply(405, {ok: false, error: 'POST only'});
      let raw = '';
      req.setEncoding('utf8');
      req.on('data', (chunk: string) => {
        raw += chunk;
        if (raw.length > 1_000_000) req.destroy();
      });
      req.on('end', () => {
        try {
          const {file, content} = JSON.parse(raw) as {file?: unknown; content?: unknown};
          if (typeof file !== 'string' || !/^src\/scenes\/[\w./-]+\/shot\.json$/.test(file) || file.includes('..')) return reply(400, {ok: false, error: 'invalid path'});
          if (typeof content !== 'string') return reply(400, {ok: false, error: 'invalid content'});
          JSON.parse(content); // must be valid JSON
          const abs = path.resolve(root, file);
          if (!abs.startsWith(path.resolve(root, 'src', 'scenes') + path.sep)) return reply(400, {ok: false, error: 'outside src/scenes'});
          fs.writeFileSync(abs, content, 'utf8');
          reply(200, {ok: true, file});
        } catch (err) {
          reply(400, {ok: false, error: err instanceof Error ? err.message : String(err)});
        }
      });
    });
  },
});

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
    plugins: [react(), shotSave()],
    server: {port: 5173, strictPort: true},
    // If 4173 is taken, use the next free port; `--open` opens whichever it got.
    preview: {port: 4173, strictPort: false},
    build: {chunkSizeWarningLimit: 2000},
  };
});
