# Style Lab

Ten motion-design experiments for the channel's visual identity, built on the existing beat engine. Nothing here is final branding. The look is provisional and has a working name, **obsidian neon**; the point of the lab is to see it move and decide what to keep.

Open the gallery at `/style-lab` (see [Commands](#commands)).

## The look in one paragraph

A deep blue-black void, never flat black. A polished obsidian floor that mirrors whatever hovers above it, and a thin cold band of haze where that floor meets the dark. On this stage, light is rare and means something: blue is infrastructure, purple is intelligence, red is loss of control. Lines are hairlines. The only white-hot pixels are signal heads and the centre of an agent. Things arrive out of depth, signals travel as comets, and the camera moves slowly or not at all. There is almost no text: the narrator explains, the picture shows.

## What makes a frame ours

These five things, together, are the fingerprint. A sample should use at least three.

1. **The mirror floor and the horizon band.** 3D: `<MirrorFloor>` + `<Reflect>` + `<SkyDome>`. 2D: `<SceneAtmosphere>` draws the same horizon and floor hairlines flat.
2. **The gimbal iris.** The agent is always the same character: a small hot core, a faceted shell, three broken rings on different axes (`AgentCore3D`, and `AgentGlyph` for its flat 2D form). No faces, no robots.
3. **Comets.** Anything that travels (a request, a credential, a result) is a white-hot head with a tapering coloured tail, moving at near-constant speed (`Comet3D`, `Comet2D`). Where a comet has passed, a thin line may stay.
4. **Hairlines and corner brackets.** Instrument marks, not UI panels: 1.25 px lines, short ticks, L-shaped corner brackets standing just off what they mark. No filled glass panels, no rounded cards.
5. **Colour that carries meaning.** See below. A frame is mostly dark; colour is the information.

## Palette and colour semantics

All tokens live in `src/styles/cyber.ts`.

| Role | Token | Hex | Used for |
| --- | --- | --- | --- |
| Void | `color.void` | `#04050A` | Base of every frame |
| Abyss | `color.abyss` | `#070A14` | Lifted background, panel backing |
| Slate | `color.slate` | `#1A2032` | Unlit structure (slabs, plates, racks) |
| Steel | `color.steel` | `#2B3654` | Hairlines on unlit structure, inactive nodes |
| Haze | `color.haze` | `#16226A` | Horizon band |
| Blue | `color.blue` / `blueHot` / `blueDeep` | `#2E9BFF` / `#A6D6FF` / `#0B3C9E` | **Systems**: infrastructure, neutral computation, evidence |
| Purple | `color.purple` / `purpleHot` / `purpleDeep` | `#8B3DFF` / `#CDB2FF` / `#3B1290` | **Intelligence**: AI, agents, inference, anything an agent touches |
| Red | `color.red` / `redHot` / `redDeep` | `#FF2A3C` / `#FF949C` / `#7C0F1B` | **Threat**: compromise, danger, uncontrolled behaviour |
| White | `color.white` | `#EAF2FF` | Signal heads and core centres only |

Rules:

- Blue, purple and red are never decoration. If something is purple, an AI is involved. If something is red, something is wrong.
- The control-loss ramp `ramp(v)` / `hdrRamp(v)` runs 0 = blue, 1 = purple, 2 = red. Use it when a thing changes hands.
- Red is introduced late and in small amounts. A frame that is red everywhere has nowhere left to go.
- Use `tone('system' | 'mind' | 'threat')` for base/hot/deep triplets.

## Lighting language

- **Glow is opt-in.** In 3D, only colours multiplied above 1.0 bloom: `hdr(hex, cyber.emissive.dim | base | strong | hot)` = 0.55 / 1.5 / 2.6 / 4.5. `dim` never blooms (structure seams), `hot` is for signal heads and core centres.
- **About three strongly glowing things per frame.** If everything glows, nothing does. Dim the rest.
- Structure is dark and reads by silhouette, rim light and reflection (`structureProps`, `<StageLights>`).
- Depth comes from fog (`Stage3D fog`), not from blur. Things far away are fainter and bluer.
- 2D glow: a wide faint underlay stroke (`Trace halo`) or `glow(color, radius)`; radii in `cyber.glow2d`.
- Every sample ends with `<CyberGrade>` on top: vignette and static grain.

## Animation grammar

Easing curves are in `motion` (`src/styles/cyber.ts`), durations in `cyber.time`.

| Move | Curve | Meaning |
| --- | --- | --- |
| Arrive | `motion.arrive` | Things come out of depth or darkness and settle. Not slide-ins from the frame edge. |
| Ignite | `motion.ignite` | A light switching on: fast attack. |
| Draw-on | `motion.glide` / `signal` | Lines draw from their source towards their target, then the target ignites. Cause before effect. |
| Signal | `motion.signal` | Comets: near-constant velocity. |
| Camera | `motion.camera` | Slow, heavy departure, long settle. One camera move per beat. Never shake. |
| Leave | `motion.leave` | Exits and gathers. |

- **One beat = one idea.** One press of the right arrow plays one transformation or one camera move, then the frame is completely still until the next press.
- **Holds are frozen.** Nothing idles. Ambient motion (rings turning, slow drift) is driven by `useActiveTime()`, which advances only while a beat is playing, so a hold frame and the next beat's first frame are identical.
- **Stagger with intent.** Sequence by distance, by causality or by hierarchy. Never by random delay.
- Timed exports are 6 to 12 seconds: 3 to 5 beats, holds around 0.5 to 0.8 s.

## Camera conventions

- `useCameraRig(initial, segments)` binds camera poses to beats (`position`, `target`, `fov`, `roll`). Default fov 34: a long-ish lens, flat and calm.
- Eye level is low; the horizon sits in the lower-middle of the frame unless the shot is a deliberate top-down.
- Moves are dollies and slow arcs. Scale changes (pull back to reveal, push into one node) are the big moments; use them once per sample.
- `projectPoint(rig, point)` pins 2D overlays to 3D things. That is how hybrid shots stay locked together.

## Media frame conventions

Outside material (web pages, papers, photos, clips, memes) always sits in a `CyberFrame`, so it looks like evidence brought into our world instead of a pasted screenshot.

- The frame takes the media's shape (`frameFor(aspect, bounds)`); media is never stretched. Landscape and portrait both work.
- Chrome is quiet: hairline border, four corner brackets, a short lit spine in the tone colour, a pool of light underneath. Blue for evidence by default.
- **Nothing is drawn over the content** except an explicit `RegionHighlight`, which dims everything but the region and brackets it. Text inside screenshots must stay readable at 1080p: source screenshots are captured at 2x.
- Captions are one short line under the frame (source domain, date). Sentence case. No all-caps labels.
- Entrance: chrome builds (`build`), then the aperture opens (`open`). Exit: reverse, or dock to a corner as a small citation.

## Reusable components

2D: `import {...} from 'src/components/cyber'`. 3D: `import {...} from 'src/components/cyber/three'`.

| Component | What it is |
| --- | --- |
| `Stage3D` | The 3D stage: bridges engine hooks into three.js, sets the camera from a rig, HDR + MSAA + bloom + neutral tone mapping + dither. Renders on demand. |
| `useCameraRig`, `projectPoint` | Beat-bound 3D camera; world-to-screen projection for hybrid overlays. |
| `SkyDome`, `MirrorFloor`, `Reflect`, `StageLights` | The environment: horizon haze, obsidian floor, mirrored copies, rim lighting. |
| `AgentCore3D`, `AgentGlyph` | The agent, in 3D and flat. Props: `open`, `energy`, `spin`, `threat`, `calm`, `facing`. |
| `GlowTube`, `Comet3D`, `NetworkNode3D`, `curveThrough`, `arcBetween` | Lines that draw on, signals, nodes, curve builders (3D). |
| `Curve2`, `Trace`, `Comet2D`, `Node2D`, `glow` | The same vocabulary in SVG, with arc-length curves (no DOM measuring). |
| `hdr`, `hdrMix`, `hdrRamp`, `structureProps` | Colour and material conventions for 3D. |
| `SceneAtmosphere`, `CyberGrade` | 2D backdrop matching the 3D stage; the finishing layer. |
| `CyberFrame`, `RegionHighlight`, `frameFor`, `fitMedia`, `reframe` | Media frame, region emphasis, aspect-ratio and reframing maths. |

Built with the samples, and exported from the same barrels:

| Component | What it is | Shown in |
| --- | --- | --- |
| `SourcePanel`, `PassageHighlight`, `sourceRect`, `sourceView` | Real evidence (web page, paper, document) in a CyberFrame: arrives from depth, opens, reframes onto a measured passage, docks as a citation. Progress values in, pixels out. | 07 |
| `MediaPanel`, `useMediaTime` | Photo or video in a CyberFrame, any aspect ratio, with push-in reframing and exit. `useMediaTime` makes a clip advance only while its beats play and freeze during holds (identical in preview and export). | 08 |
| `Pictograms` (`MessageCapsule`, `ServiceBlock`, `DataStore`, `Queue`, `Endpoint`, `Ledger`, `Switch`) | Diagram objects in the instrument line language, each with `appear`, `level` and a kind-specific `act` state change. | 09 |
| `AgentSwarm`, `LinkLines` | Thousands of agents (matching `AgentCore3D`) and hairline links, one draw call each. | 03 |
| `NetworkField`, `networkGraph` | A whole network in two draw calls with build-up, signal-hop and graph-distance wavefront clocks; deterministic cluster generator and Dijkstra distances. | 04 |
| `ScanField`, `scanPassed`, `scanSince` | A travelling scan sheet with a hot leading edge, and helpers that say whether and when a point was scanned. | 05 |
| `ComputeIsland`, `PerimeterRing` | Floating compute platforms with instanced racks and load meters; a boundary ring with gates that open and close. | 06 |
| `flattenRig`, `CameraClip`, `RouteCurve` | The 3D-to-diagram move (orbit to top-down while dolly-zooming to near-orthographic); constant-speed routes with filleted corners. | 01 |

Sample-local helpers that may be promoted later: `LightField` / `LightStreaks` (10, thousands of point lights), `Hairlines` and `softVisibility` (05).

## The ten samples

| # | Sample | Idea | Beats |
| --- | --- | --- | --- |
| 01 | Cinematic opening | A dark city of compute wakes up, scales out, an agent ignites at its centre, then the camera flattens the world into a plan diagram. | 4 |
| 02 | A single agent | The gimbal iris assembles, attends, reaches into three tools, uses them, turns red. | 5 |
| 03 | Replication | One agent divides into a 4x4 cell; the cell is one of hundreds; all turn to face you and the far edge goes red. | 4 |
| 04 | The network | A cluster forms, one signal hops, activity cascades, the camera pulls out to a web of clusters, then dives into another one. | 5 |
| 05 | Scanning and detection | A scan verifies what it can see; under the floor, beneath a ticked module, hangs a red agent. | 5 |
| 06 | Cloud compute | Three islands of compute; an access token opens a gate; the workload moves across. | 4 |
| 07 | Source and citation panel | A real Wikipedia page arrives, becomes readable, a measured sentence is emphasised, it docks beside a NIST paper. | 4 |
| 08 | Image and video panel | A public-domain photo is framed and reframed, then shown beside a portrait NASA clip that plays in its beat. | 4 |
| 09 | Technical diagram | Prompt, agent, action, consequences; the far consequences turn red and loop back. | 5 |
| 10 | Ominous hold | The system winds down and goes dark, one ember stays on, the camera finds a whole lit city on the horizon. | 4 |

Asset sources and licences: `public/lab/media/SOURCES-source.md` and `public/lab/media/SOURCES-media.md`. Re-capture the sources with `node scripts/lab-capture.mjs` (needs the network).

## How to change the theme

Edit `src/styles/cyber.ts`. Colours, emissive levels, bloom, line weights, type, timings, camera defaults and fog are all there, and every sample reads them. To try a different palette, change the hexes in `color` and `tone` and re-render the thumbnails.

## How to create a new sample

1. Create `src/scenes/style-lab/<nn-name>/index.tsx` exporting `episode` (a `defineEpisode`) and `Sample` (`<EpisodeComposition episode={episode} />`). Copy `02-agent` as a starting point.
2. Add it to `LAB_SAMPLES` in `src/videos/style-lab/registry.ts` and to `SLUGS` in `scripts/lab.mjs`.
3. Iterate with stills: `node scripts/lab.mjs stills <nn-name>` and look at `out/style-lab/stills/<nn-name>/`.

Authoring rules (they keep preview and export identical):

- Motion comes only from beats: `useBeat`, `useBeats`, `useActiveTime`, `useCameraRig`, `useTrack`. No CSS transitions or animations, no timers, no `requestAnimationFrame`, no `useFrame` animation, no `Math.random()` (use `createRandom(seed)`).
- A beat's completed frame must equal the next beat's first frame.
- Assets go in `public/` and are referenced with `staticFile()`.

## Commands

| Task | Command |
| --- | --- |
| Start the interactive app (dev) | `npm run dev`, then open http://localhost:5173/ |
| Open the style gallery | http://localhost:5173/style-lab |
| Present with the production build | `npm run present`, then go to `/style-lab` |
| Launch Remotion Studio | `npm run studio` (samples are in the StyleLab folder) |
| Render one sample | `npm run lab:render -- 01-hero` |
| Render all samples | `npm run lab:render` |
| Stills for one sample | `npm run lab:stills -- 03-swarm` |
| Gallery thumbnails | `npm run lab:thumbs` |
| Key frames from the MP4s + contact sheet | `npm run lab:frames` and `npm run lab:sheet` |
| Run tests | `npm test` |
| Typecheck | `npm run typecheck` |
