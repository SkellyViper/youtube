# Explainer Engine

A frame-driven animation engine for AI explainer videos, built on React, TypeScript, Remotion and Vite.

You write each animation once. It runs in two modes:

| Mode | What happens | Built on |
| --- | --- | --- |
| **Presentation** | You narrate live. Each `→` press plays the next animation beat, and the result stays on screen until you press again. | `@remotion/player` in a Vite app |
| **Export** | The same beats play on a normal timeline, with a hold time after each one, and render to a 1920×1080 60 fps H.264 MP4. | Remotion renderer |

Both modes mount the same composition component and read the same timeline. Nothing is re-implemented for either mode.

The included demo is *"Not detected ≠ does not exist"*: 4 scenes, 11 beats, about 38.7 s when exported.

**Style Lab V2** (current direction): fewer objects, a still camera, the legacy Tron-like look, and a **shot editor** (`/style-lab/<scene>/edit`) for editing 3D shots without rewriting them: hierarchy, object inspector, lights and presets, camera lock, beat timing, save to repo, export/import, render the same file. See [docs/STYLE_LAB_V2.md](docs/STYLE_LAB_V2.md) and the audit of the earlier experiments in [docs/style-lab-v2/AUDIT.md](docs/style-lab-v2/AUDIT.md).

The **Style Lab** (`/style-lab`) holds the channel's visual language in motion: six **cinematic 3D experiments** (documentary-style reenactments: a real room, a data hall, cameras that travel), ten story-driven 2D scenes from the first episode, and the original ten experiments, all switchable between five visual identities and comparable beat for beat. See [docs/CINEMATIC_VISUAL_LANGUAGE.md](docs/CINEMATIC_VISUAL_LANGUAGE.md) (the cinematography playbook), [docs/FERN_VISUAL_RESEARCH.md](docs/FERN_VISUAL_RESEARCH.md) (the research behind it), [docs/cinematic/](docs/cinematic/) (critique, builder brief, quality report), [docs/STYLE_LAB_REDESIGN.md](docs/STYLE_LAB_REDESIGN.md) (the 2D redesign, themes, gallery) and [docs/STYLE_LAB.md](docs/STYLE_LAB.md) (the original experiments).

---

## Installation

You need Node 20 or newer (tested on 22.14). FFmpeg on your `PATH` is optional; the video verification step uses it.

```bash
npm install
npx playwright install chromium   # only needed for `npm test`
```

On the first render, Remotion downloads its own headless Chrome automatically. Fonts are stored in `public/fonts`, so rendering never needs the network.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run present` | Builds a production bundle and opens the presentation at **http://localhost:4173/**. If that port is taken it uses the next free one and opens that instead. Use this when presenting live. |
| `npm run dev` | Development server with hot reload at **http://localhost:5173/**. React's development build is slower, so expect some dropped frames. |
| `npm run studio` | Opens Remotion Studio (timeline, scrubbing, render UI). |
| `npm run render` | Exports **`out/demo.mp4`** (1920×1080, 60 fps, H.264, yuv420p, BT.709), then checks it with ffprobe/ffmpeg. |
| `npm run render:30` | 30 fps compatibility export: `out/demo-30fps.mp4` (same timing). |
| `npm run stills -- --frames=0,600,1200` | Renders individual PNG frames exactly as the exporter sees them (`out/stills/`). |
| `npm run verify:video` | Re-checks `out/demo.mp4`: resolution, fps, codec, frame count, and a full decode. |
| `npm test` | Playwright suite: timeline unit tests plus real-browser presentation tests. |
| `npm run perf` | With `npm run present` running, measures for every beat how many frames the live Player actually displayed, and checks that it stopped on the exact checkpoint. |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lab:render` | Style Lab: renders all ten samples to `out/style-lab/<slug>.mp4` and verifies each. Add `-- 01-hero` for one. |
| `npm run lab:stills -- 03-swarm` | Style Lab: checkpoint and mid-beat stills of one sample (`out/style-lab/stills/`). |
| `npm run lab:thumbs` | Style Lab: gallery thumbnails (`public/lab/thumbs/`). |
| `npm run lab:check` | Style Lab: decodes the MP4s and checks for black frames, flicker and moving holds. |
| `npm run lab:frames`, `npm run lab:sheet` | Style Lab: key frames from the MP4s, and a contact sheet of all ten. |
| `npm run story:render -- 04-replication --theme=infrared` | Redesign: render one scene in one theme (`--all-themes`, `all`, `--concept=original`, `--fps=30`). |
| `npm run story:stills`, `npm run story:thumbs`, `npm run story:sheet` | Redesign: stills, gallery posters, contact sheet. |
| `npm run story:preview -- 04-replication neon` | Redesign: screenshots from the live Player (no render) with a contact sheet. |
| `npm run cine:render -- 02-wrong-project --theme=neon` | Cinematic: render one experiment in one theme to `out/cinematic/` (`--all-themes`, `all`, `--fps=30`). |
| `npm run cine:stills -- 01-john`, `npm run cine:thumbs`, `npm run cine:frames`, `npm run cine:sheet` | Cinematic: stills, gallery posters, key frames from the MP4s, contact sheet. |
| `npm run cine:render -- 01-john --shot=draft.shot.json` | Editable shot: render an exported editor draft instead of the approved `shot.json` (`--code-defaults` renders the code alone). Also works for `cine:stills`. |
| `npm run cine:preview -- cine-01-john neon` | Cinematic: checkpoint and mid-beat screenshots from the live Player (needs `npm run dev`); works on Windows, GPU through ANGLE. |

> **NODE_ENV:** If your shell exports `NODE_ENV=development`, `vite build` would normally bundle React's development build, which is about 5× slower. `vite.config.ts` forces production for builds, so `npm run present` is always fast.

## Keyboard controls (presentation)

| Key | Action |
| --- | --- |
| `→` / `PageDown` | Play the **next beat**. It stops exactly on the beat's completed frame and holds there indefinitely. |
| `←` / `PageUp` | Go back one checkpoint, instantly. If a beat is playing, abort it and snap back to where it started. |
| `R` | Replay the current beat: the one that led to the frame you're on, or the one that's playing. |
| `F` | Toggle fullscreen. `Esc` leaves fullscreen as usual. |
| `H` | Toggle the developer HUD (scene, beat, checkpoint, frame, state, speaker notes, clickable beat list). |
| `Space` | Play straight through on the export timing (beats and holds). Press again to pause where you are; `→` then finishes the interrupted beat. |
| `Home` / `End` | First / last checkpoint. |

Safeguards:
- **Auto-repeat is ignored.** Holding a key never advances more than once.
- **`→` is ignored while a beat is playing.** A transition can't be interrupted, and two beats can't overlap.
- **Rapid double presses are ignored.** A second `→` within 280 ms doesn't advance.
- **The cursor hides** after 1.5 s without mouse movement.

`PageDown`/`PageUp` also make standard presentation clickers work.

URL options:
- `?hud`: start with the HUD open.
- `#c=5`: deep link to checkpoint 5. The hash updates as you present, so reloading resumes where you were.
- `?episode=NotDetected`: choose an episode from `src/videos/registry.ts`.
- `?fps=30`: preview the 30 fps timing.
- `?quality=full|low`: rendering quality of the 3D stages in the live Player (default `auto`: 0.66 internal resolution, 2x MSAA, 1024 shadows). Exports always render at full quality. On a laptop with two GPUs, also make sure the browser runs on the discrete one (Windows: Settings → System → Display → Graphics → add the browser → High performance; check `chrome://gpu`).
- `/style-lab`: the Style Lab gallery. `/style-lab/03-swarm` opens one sample in the presenter (same keys, plus `[` / `]` for the previous / next sample and `Esc` or `G` for the gallery).
- `/style-lab/04-replication?concept=redesign&theme=infrared&compare=theme:glacial`: a scene with its concept, theme and comparison (`O`, `T`, `C` keys). Concepts are `original` (legacy sample), `redesign` (2D story scene) and `cinematic` (3D reenactment); `compare=concept:cinematic` puts another treatment beside it.
- `/style-lab/cine-02-wrong-project`: a cinematic experiment opens as the Cinematic concept of its scene family.
- `/style-lab/cine-01-john/edit`: the shot editor for an editable 3D scene (same presenter keys, plus `I` free camera, `Esc` deselect, `Ctrl+Z` / `Ctrl+Shift+Z`). `?theme=` picks the theme.

## Architecture

```
src/
  engine/        Timeline, beat clocks, property tracks, camera, <EpisodeComposition>
  components/    Reusable primitives: SplitText, Mask, DrawPath, path builders, backdrop, seeded random
    cyber/       Style Lab primitives: 3D stage, agent core, signals, media frames (docs/STYLE_LAB.md)
    cinematic/   Cinematic 3D primitives: world geography, room, desk, developer, racks, data hall, routes, screen painters, legacy stage
  shot/          Editable shots (Style Lab V2): schema, code defaults <- patch, ShotObject / useLook / useMotion, presets
    story/       2D story primitives of the redesign (workspace, game, chat, machines)
  scenes/        Explainer content. One folder per topic (scene beats + visual layers)
    style-lab/   The ten Style Lab samples
    redesign/    The ten 2D story scenes
    cinematic/   The six cinematic 3D experiments
  videos/        Episode definitions + composition components + registry.ts
  player/        Presentation app: usePresenter state machine, keyboard, HUD; lab/ = Style Lab gallery; lab/editor/ = shot editor
  remotion/      Remotion entry point (registerRoot) and <Composition> registrations
  styles/        theme.ts (provisional design tokens), cyber.ts (Style Lab tokens), motion.ts, fonts.ts
scripts/         render.mjs, stills.mjs, verify-video.mjs, lab.mjs / story.mjs / cine.mjs (Style Lab tooling), dev/preview.mjs
tests/           Playwright specs
```

### The model

- An **episode** is a list of **scenes**, plus optional **layers**.
- A **scene** is a titled group of **beats**. It can have a component, which is mounted only for that scene's time range.
- A **beat** has a `duration` (animation seconds) and a `hold` (seconds to hold the result, used only in export). It can also have `notes` (shown in the HUD) and `auto: true` (in presentation, it chains straight from the previous beat).
- A **layer** is a visual mounted across any range, given as a scene id or beat id (`from: 'claim', to: 'assemble'`). Visuals that change across scene boundaries live in layers, which gives spatial continuity. In the demo, the network diagram exists from the first frame to the last. Its focus brackets become the scan area, the scan area becomes one module of a larger system, and the system's nodes fly into the ≠ glyph.

`buildTimeline(episode, fps)` turns those seconds into frames:

```
lead-in │ beat 1: start ──anim──► animEnd ──hold──► │ beat 2: start ──► …
        checkpoint 0 = frame 0          checkpoint 1 = beat 1 animEnd
```

### Why holds are exact

Every visual is a pure function of beat progress, and `useBeat()` clamps the local frame to `[0, duration]`. So every frame from `animEnd` to the next beat's `start` renders the same completed state.

- **Presentation** passes the beat's `animEnd` as the Player's `outFrame` prop. The Player stops exactly there and fires `ended`. A `frameupdate` guard is also in place.
- **The next beat** seeks to its own `start`. That frame looks identical to the hold, so the jump is invisible.
- **Export** plays straight through the hold frames.

### Animation API (inside a scene or layer)

```tsx
const b = useBeat('scan');          // BeatClock for one beat
b.at(0.2, 0.9, ease.out)            // 0..1 over seconds 0.2–0.9 of the beat (clamped, eased)
b.spring(0.1, {damping: 14})        // Remotion spring, guaranteed to land on exactly 1
b.stagger(i, {start: 0.1, each: 0.04, dur: 0.8, easing: ease.outExpo})
b.progress, b.started, b.done

const {title, system} = useBeats(['title', 'system']);

// Properties that evolve across many beats (camera, layouts, colours):
const camera = useCamera(initial, [
  {beat: 'zoom-out', to: {x: 0, y: 0, zoom: 0.31}, easing: ease.camera},
  {beat: 'recount',  to: {x: -990, y: -40, zoom: 0.29}, from: 0, until: 0.85},
]);
const P = makeProjector(camera, 1920, 1080);   // world -> screen, plus semantic-zoom sizing
```

All motion uses Remotion's `interpolate`, `spring` and `Easing`. The shared easing vocabulary is in `src/styles/motion.ts`.

### Authoring rules (these keep preview = export)

1. **Only frame-driven motion.** No CSS `transition`/`animation`, GSAP timelines, `setTimeout`, `requestAnimationFrame` or React state inside compositions.
2. **No `Math.random()`.** Use `createRandom(seed)` from `src/components/random.ts`.
3. **Beat boundaries must be continuous.** The frame where beat N starts must equal beat N−1's completed state. In practice: if something must leave during the *next* scene's first beat, make it a layer that extends into that beat. Scene components unmount at their scene's end.
4. **Keep it in `public/`.** Fonts and assets go in `public/` and are referenced with `staticFile()`.
5. **Prefer batched SVG paths.** Prefer one `<path>` holding many shapes (see `components/svg/paths.ts`) over hundreds of elements. Avoid dashed strokes on anything redrawn every frame; Chrome re-tessellates them, and they were the main source of dropped preview frames.

## How to…

### Add a new animation beat

1. Add it to a scene in `src/scenes/<topic>/scenes.ts`:
   ```ts
   {id: 'highlight-path', label: 'Highlight route', duration: 1.6, hold: 1.2, notes: 'Follow the request…'},
   ```
2. Animate it from any scene component or layer:
   ```tsx
   const hl = useBeat('highlight-path');
   <DrawPath d={routePath} progress={hl.at(0, 1.2, ease.inOut)} stroke={theme.color.scan} strokeWidth={3} />
   ```
That's all. The timeline, presenter, HUD, Studio duration and export length all update automatically.

### Add a new scene

```ts
// src/scenes/<topic>/scenes.ts
export const newScene = defineScene({
  id: 'feedback-loop',
  title: 'The Feedback Loop',
  component: FeedbackLoopScene,   // optional; mounted for this scene only
  beats: [
    {id: 'loop-draw', duration: 2, label: 'Loop draws'},
    {id: 'loop-spin', duration: 1.5, label: 'Loop accelerates'},
  ],
});
```
Then add it to the episode's `scenes` array (`src/videos/<episode>/episode.ts`). If its visuals must carry over from or into neighbouring scenes, register them as a layer instead:
```ts
layers: [{id: 'loop', component: LoopLayer, from: 'feedback-loop', to: 'next-scene-first-beat', z: 1}]
```

### Add a new episode

1. Create `src/scenes/<topic>/` (beats + visuals) and `src/videos/<topic>/episode.ts` using `defineEpisode`.
2. Add a composition component (`<EpisodeComposition episode={...} />`).
3. Register it in `src/videos/registry.ts` (presentation) and `src/remotion/Root.tsx` (export/Studio).
4. Present with `?episode=<id>`. Render with `node scripts/render.mjs <id> out/<id>.mp4`.

### Change the theme

All colours, type families, the type scale and safe areas are in **`src/styles/theme.ts`**. Easing curves are in **`src/styles/motion.ts`**. Fonts are in **`src/styles/fonts.ts`** (drop new `.woff2` files into `public/fonts/`).

The current look is a provisional "editorial instrument" style:
- **Colours:** warm ink and paper, mint for *observed/verified*, vermilion for *exists but undetected*.
- **Fonts:** condensed Archivo for display, Instrument Serif for asides, JetBrains Mono for readouts.

Swap the tokens to try other directions.

### Export a video

```bash
npm run render            # out/demo.mp4, 1920×1080 @ 60 fps, H.264 CRF 16, PNG intermediates
npm run render:30         # out/demo-30fps.mp4
node scripts/render.mjs NotDetected out/clip.mp4 --frames=0-599 --concurrency=4
```
The render script bundles, renders, encodes and then verifies:
- resolution, frame rate, codec and pixel format
- the exact frame count against the timeline
- a full ffmpeg decode pass

`npx remotion render NotDetected out/demo.mp4` and the Studio render button use the same settings (`remotion.config.ts`).

## Testing

`npm test` runs Playwright. It starts the dev server automatically, or reuses one already running on port 5173. On a machine without a GPU or without Playwright's own browser: `PLAYWRIGHT_GL=swiftshader PLAYWRIGHT_CHROMIUM=/path/to/chrome npm test`.

- **Timeline unit tests:** frame math, checkpoint continuity, clamped holds, spring landing, track sequencing.
- **Presentation tests:**
  - stepping through every beat with real key presses
  - exact checkpoint frames
  - holds don't drift
  - auto-repeat and double-press protection
  - back, replay, Home/End and deep links
  - the HUD and fullscreen
- **Screenshots:** one per checkpoint, saved to `test-results/checkpoints/`.
- **Shot editor tests** (`tests/shot-editor.spec.ts`): open from gallery and viewer; select from the hierarchy and by clicking in the viewport; transform, visibility, light and preset edits with the image difference measured; undo, reset; camera lock measured across beats; beat inspection and retiming; draft kept across reload; export → import; presenter keys inside the editor. Screenshots in `test-results/shot-editor/`.
- **Cinematic experiments tests** (`tests/cinematic-lab.spec.ts`): the gallery section, the three-way concept switch and compare, every experiment walked beat by beat with exact checkpoint frames, back/replay/Home/End, deterministic seeking with shadows and canvas screens, theme switch, fullscreen.
- **Style Lab tests** (`tests/style-lab.spec.ts`):
  - the gallery lists ten samples with thumbnails; mouse and keyboard navigation
  - every sample is walked beat by beat with real key presses, with exact checkpoint frames, back and replay
  - holds are pixel-identical for a 3D, a media and a 2D sample
  - timed play, pause and resume; the viewer chrome; fullscreen without clipping
  - checkpoint screenshots are saved to `test-results/style-lab/<slug>/`

The 3D samples need WebGL. The Playwright config asks Chromium for the GPU through ANGLE; without a GPU they still run on software rendering, only slower.

## Licensing notes

Remotion has its own license: free for individuals and small teams, while larger companies need a company license. Check https://remotion.dev/license for your situation. The bundled fonts (Archivo, Instrument Serif, JetBrains Mono) are SIL Open Font License.
