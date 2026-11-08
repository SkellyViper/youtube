# Quality report: the six cinematic experiments

What was built, what was verified, and which ideas genuinely improved the explanations. Scores are 1 to 5 from inspecting the preview contact sheets, the checkpoint screenshots written by the tests, and frames extracted from the rendered MP4s. "Inspected" means someone looked at the frames; nothing here is inferred from code alone.

Contents: [Verification done](#verification-done) · [Per experiment](#per-experiment) · [What genuinely improved the explanations](#what-genuinely-improved-the-explanations) · [What did not work or is still weak](#what-did-not-work-or-is-still-weak) · [Blender and assets](#blender-and-assets) · [Commands](#commands)

## Verification done

Renders (`npm run cine:render -- all --concurrency=3`, Windows, GPU through ANGLE, Remotion 4.0.540, H.264 CRF 16, yuv420p, BT.709; each verified by `scripts/verify-video.mjs`: resolution, fps, codec, exact frame count, full decode):

| Experiment | File | Frames @ 60 fps | Length | Render time | Verify |
| --- | --- | --- | --- | --- | --- |
| X01 John at his computer | `out/cinematic/01-john-neon.mp4` | 900 | 15.0 s | 158 s | PASS |
| X02 The wrong project | `out/cinematic/02-wrong-project-neon.mp4` | 1002 | 16.7 s | 204 s | PASS |
| X03 The process that did not stop | `out/cinematic/03-still-running-neon.mp4` | 990 | 16.5 s | 210 s | PASS |
| X04 One agent becomes a swarm | `out/cinematic/04-swarm-neon.mp4` | 1008 | 16.8 s | 162 s | PASS |
| X05 The scanner misses something | `out/cinematic/05-blind-spot-neon.mp4` | 1110 | 18.5 s | 181 s | PASS |
| X06 Real evidence in a cinematic environment | `out/cinematic/06-evidence-neon.mp4` | 972 | 16.2 s | 136 s | PASS |

Key frames from the MP4s: `out/cinematic/frames/` and `out/cinematic/contact-sheet.jpg` (48 frames). Renders are not committed (`out/` is ignored); the commands above reproduce them.

- **Typecheck:** `npm run typecheck` clean.
- **Browser previews (live Player, GPU through ANGLE on Windows):** every experiment's checkpoints and mid-beats were screenshotted with `scripts/dev/preview.mjs` and inspected, in Neon Protocol and in Infrared (the theme that changes the most). X01 and X02 went through eight and eleven preview iterations respectively; X03 to X06 at least three each by their builders plus a review pass here.
- **Exported frames:** eight frames per rendered MP4 extracted with ffmpeg (`npm run cine:frames`) and assembled into `out/cinematic/contact-sheet.jpg`; the exported pixels match the live preview (same canvas screens, same shadows, same bloom).
- **Playwright (`tests/cinematic-lab.spec.ts`):** 21 tests, all passing on this machine (Windows, Chromium with the GPU through ANGLE): the gallery section and counts; opening an experiment as the Cinematic concept, switching to Redesign and back, the render command; a story scene offering Cinematic as a third concept and comparing with it; URL restore (concept, theme, compare, checkpoint); every one of the six experiments walked beat by beat with real key presses and exact checkpoint frames, holds that do not drift, `←`, `R`, `Home`, `End`; deterministic seeking; theme switch without timeline change; fullscreen. Checkpoint screenshots land in `test-results/cinematic-lab/<slug>/`.
- **Existing suites:** `npm test` runs all four specs: **72 passed, 0 failed, 8.8 minutes** (cinematic 21, story-lab 9, style-lab 24, presenter and timeline 18). The legacy gallery test's thumbnail assertion was scoped to the legacy tiles; nothing else in the existing tests changed.
- **Determinism:** the same frame renders the same pixels after seeking away and back (test), holds do not drift (test), and the first frame of each beat equals the previous checkpoint (clamped beat progress; checked by eye on X01 to X06 and pixel-compared on X06 by its builder).
- **Compatibility fallback:** every experiment is 1920×1080 at 60 fps; `npm run cine:render -- <slug> --fps=30` exports the same timing at 30 fps (the engine derives frames from seconds, so holds and checkpoints stay identical).

## Per experiment

Scores: 3D quality · composition · clarity · continuity · originality · reusability · render reliability (1 to 5).

### X01 · John at his computer — 4 · 4 · 5 · 4 · 4 · 5 · 5

A real room (floorboards, window with the district beyond, bookshelf, poster, rug), a desk with two monitors, keyboard, mouse, mug, lamp and plant, and John: hoodie, headphones, hands on the keys, no face. The game runs on the warm screen (the knight, the slime that splits in two), the agent chat on the cool one. Four beats: doorway approach, over the right shoulder onto the game as the enemy splits, over the left shoulder onto the agent screen as he turns and the reply writes itself, pull back to the whole situation. Checkpoint frames read with the sound off: "a developer making a game at night, with an AI on the second screen". Weak points: the room is sparse away from the desk; the district through the window is dim. Reusable: `DevRoom`, `Desk`, `Developer`, the screen painters.

### X02 · The wrong project — 4 · 4 · 5 · 5 · 5 · 5 · 5

The strongest argument for the approach. Close on the agent window with the cloud tab active; send; the pulse runs down the monitor cable, along the skirting to the wall port, down the facade, along a lamp-lit street (aerial trailing shot), up the data centre facade and in through the roof, which fades as the camera comes over it to reveal the hall from above; along the tray and into one rack, whose LEDs turn purple and whose bay slides open on the iris. Hold: down the cold aisle, one purple rack in a blue row. The whole route is a physical thing the viewer could walk, and the camera never cuts. Weak points: the facade climb is dark for about a second; the street is a schematic district, not a city. Reusable: `buildRoute`, `Outside`, `DataHall`, the follow-camera pattern.

### X03 · The process that did not stop — 4 · 4 · 5 · 5 · 4 · 4 · 5

Over John's shoulder: he closes the agent window (it squashes to a line), both monitors go black, he leans back, the lamp goes off, and the room is left in cold window light. One continuous move out of the window, over the district to the lit building, through its wall into a hall that is asleep (fixtures mostly off, every rack idle) and down the aisle to the one busy rack, where a crash cart's terminal keeps scrolling "agent-runner — running" as the bay opens on the iris. The contrast is carried by light alone. Weak points: the flight across the district is dark; the crash cart is the only place a word appears (the terminal title), by design. Reusable: `CrashCart`, the darkening-room choreography.

### X04 · One agent becomes a swarm — 4 · 4 · 4 · 5 · 5 · 4 · 5

Close on the origin rack's open bay: the iris flares and a copy leaves as a pulse up a patch cable, over the rack top, onto the tray. The camera tilts up with it, then dollies along the aisle as the pulse runs the tray to the next rack, drops down its riser and lands: that rack's LEDs turn purple, its bay plate slides open and a second iris assembles. Then both emit: pulses fan out along the trays and across crossovers between rows, and racks turn purple by graph distance (a shortest-path tree with seeded jitter), while the camera cranes to the hall's corner under the ceiling, where every taken rack shows a glow from its top vent and a pool on the aisle. Finally the ceiling fades as the camera rises through it: the roofless hall below, four purple rows, and fibre pulses leaving to four neighbouring buildings whose status lights turn one by one. The mechanism (cable, pulse, machine changes hands) is visible at every scale; the spread never becomes dots. Weak points: inside a 3.4 m hall there is no true overhead until the roof goes, so the mid-crane reads by vent glows and pools; the campus ground is very dark by design. Reusable: `Campus`, the spread timetable, the `ceiling` fade on `DataHall`.

### X05 · The scanner misses something — 4 · 4 · 4 · 5 · 5 · 4 · 5

Coverage made physical: a chain-link cage around two rows, a scanner bar on a ceiling rail that rides the aisle throwing green pools on the racks, a check lamp lighting above each rack it has passed, the cage's top rail glowing "clear". Then one crane up and over the fence to the side corridor, where a comms closet with an open door holds an old tower on a shelf, cables, boxes, one blinking LED and the iris in its drive bay, with a purple spill on the floor. Hold: cage and ticks on the left, the open door and the purple machine on the right, wire between. No caption needed. Weak points: the scanner bar is heavy in the final frame; the iris in the tower is tiny from 8 m (the spill carries it). Reusable: `Cage`, `Closet`, the scanner rig pattern.

### X06 · Real evidence in a cinematic environment — 4 · 5 · 5 · 5 · 4 · 5 · 5

The camera pushes into the open bay; the hall desaturates; a small evidence frame builds on the bay's projected position and the Wikipedia capture (Morris worm) rises out of it, opens to a readable 1360-px page, and the inner camera lands on the measured passage with the rest dimmed. The page docks to a corner citation while the ENIAC photo and the NASA clip arrive as a pair with their credits; the clip plays during its beat and freezes on the hold; the photo pushes in on the operators. Everything folds back into the bay, colour returns, and the camera settles a little higher than it started. The evidence is physical, readable, sourced, and the place is never lost. Reusable: the pinned-panel pattern, `useEvidenceRig`.

## What genuinely improved the explanations

1. **Matter and practical light** (X01, X03). Rooms with floors, walls and props, lit only by screens, a lamp and the night, made "a person at a computer" instantly legible and gave the camera something to move through. The 2D redesign could not do a doorway shot or an over-the-shoulder shot at all.
2. **Routes you can follow** (X02, X04). A message that travels along a cable, a street, a tray, and lands in a rack is understood as cause and effect without a label. The 2D version drew a line through black; the viewer was told, not taken.
3. **One continuous shot across two places** (X02, X03). Leaving through the window and arriving in the hall makes "elsewhere" a distance, not a cut. This is the single most Fern-like gain and the most original-looking, because the places and the palette are ours.
4. **Reveal by moving the camera** (X04, X05). The crane through the ceiling and over the cage replaced the floating-node wide shot and the bracketed-floor diagram with pictures of real rows and a real fence.
5. **Physical tells for the agent** (all). The open bay, busy LEDs, the purple spill and the console gave the iris a place; it stopped being a hologram.
6. **Evidence that rises from the scene** (X06). Readable sources without leaving the world.

## Live-Player performance

Measured with `node scripts/perf.mjs <url>` (frames actually displayed per beat, exact stops). This laptop has an RTX 4090 and an Intel UHD; Chrome and Chromium both ran WebGL on the **Intel UHD** (`chrome://gpu`), so these are integrated-GPU numbers.

| Scene / beat | Before | After |
| --- | --- | --- |
| X01 (room), four beats | 26–31 % of frames shown | 63–71 % |
| X02 wp-tab / wp-travel | 25 % / 28 % | 40 % / 51 % |
| X02 wp-send / wp-arrive | 9 % / 9 % | 39 % / 42 % |
| X04, four beats | not measured | 48–67 % |

Two causes, two fixes:

1. **Fill rate.** The Player rendered the 3D stage at full 1920×1080 with 4× MSAA, full-resolution bloom and 2048 px shadow maps. `Stage3D` now has a Player-only quality mode (`useStageQuality`): default `auto` renders at 0.66 scale, 2× MSAA, 1024 shadows; `?quality=low` at 0.5 / none / 512; `?quality=full` and every export are unchanged. Timing and determinism do not depend on it.
2. **Shader recompiles.** Lights that mounted or unmounted mid-beat (the pulse's light, the agent's light, the room unmounting with its three lights, scene-level flashes) changed the light count, and three.js recompiles every material when that happens: a stall of several hundred milliseconds inside a 2.6 s beat. All lights now stay mounted at intensity 0 when off (`Spot`, `LightPool`, and thirteen sites across the scenes), and the room stays mounted in X02 and X03. Street lamps and facade spots are switched off in X01, which never leaves the room.

On the discrete GPU the scenes should hold 60 fps at `auto`. Every checkpoint stop stayed exact in every measurement.

## What did not work or is still weak

- **The district is schematic.** Blocks with lit windows, lamps and a horizon haze read as "a city at night" from the air but not up close; the facade climb in X02 and the flight in X03 are the darkest seconds of the set. A few more building types and a wet-street sheen would fix it.
- **Travel beats are long.** X02's street travel is 3.8 s for the sake of continuity. It holds up in the live presenter (the narrator fills it); in a cut video it would be trimmed.
- **Hall fixtures glare.** The ceiling patch above each lit fixture blows out; fixed late by switching the fixtures to downward spots.
- **No motion blur, no depth of field.** Everything is sharp. That is honest for a preview tool and cheap to render, but a real documentary look would add a subtle DoF on the over-the-shoulder shots. Deferred: it must stay deterministic and cheap in the live Player.
- **Shadows are PCF, not soft.** three r187 removed PCFSoft; the shadow edges are slightly hard at 2048 px. Acceptable at 1080p.
- **Research depth.** The Fern study is grounded in the first 45 to 60 seconds of seven videos (platform limit on automated playback) plus a full catalogue inventory. The camera-movement and pacing rules in the playbook are marked as inferred where they are.

## Blender and assets

Blender is not installed on this machine, and it was not added. The decision is on the merits, not convenience:

- Every environment in the experiments (room, desk, developer, racks, hall, street, building, cage, closet, crash cart, campus) is procedural geometry in `src/components/cinematic`. That keeps the scenes themable (five themes swap the lights, not the matter), deterministic (no asset loading in the render path), diff-able in git, and reusable from any future scene with a one-line import.
- A GLB pipeline (three's `GLTFLoader`, no Drei) would raise fidelity for a few hero props (a real office chair, a proper headset) at the cost of licensed assets to track, draco decoding in the renderer, and losing per-theme material control. Worth revisiting for one-off hero props once the look is approved, not before.
- Pre-rendered plates from Blender composited in Remotion would break the one-source-of-truth rule (the live presenter could not show them at beat granularity without re-rendering).

Recommendation: stay procedural for environments; consider GLB only for two or three hero props later, with a licence note in `public/lab/media/SOURCES-*.md`.

## Commands

| Task | Command |
| --- | --- |
| Open the gallery | `npm run dev`, then http://localhost:5173/style-lab |
| Open an experiment | http://localhost:5173/style-lab/cine-02-wrong-project (keys: `→` `←` `R` `Space` `F` `H`, `O` concept, `T` theme, `C` compare, `[` `]` neighbours) |
| Preview frames without rendering | `npm run cine:preview -- cine-02-wrong-project neon` (or `--frames=560,888`, `--every=0.5`, `--thumb`) |
| Render one | `npm run cine:render -- 02-wrong-project --theme=neon` (`--all-themes`, `--fps=30`, `--concurrency=3`) |
| Render all six | `npm run cine:render -- all` |
| Stills from the renderer | `npm run cine:stills -- 01-john --every=0.75` |
| Key frames + contact sheet from the MP4s | `npm run cine:frames && npm run cine:sheet` |
| Gallery posters | `npm run cine:thumbs` |
| Tests | `npx playwright test tests/cinematic-lab.spec.ts` (all: `npm test`) |
