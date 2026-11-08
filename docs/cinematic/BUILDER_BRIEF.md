# Building a cinematic experiment

How the six cinematic 3D experiments are built, so that a new one looks like it belongs. Read this with `docs/CINEMATIC_VISUAL_LANGUAGE.md` (the why) and `src/components/cinematic/` (the parts).

## The contract

- One folder per experiment: `src/scenes/cinematic/<nn-slug>/index.tsx` exports `episode` (a `defineEpisode`) and `Sample = cinematicComposition(episode)`. The visuals are **layers** (`{id: 'world', component: Scene, z: 1}` and `{id: 'grade', component: CineGrade, z: 100}`), so nothing unmounts between beats.
- The scene file starts with a **cast list** comment: every prominent object, what it stands for, why it is there. If an object cannot be explained in one line, it does not belong.
- Four to five beats, 2.4 to 3.8 s each, `defaultHold: 0.7`, total 10 to 14 s. Beat ids are prefixed per scene (`sr-`, `sw-`, `bs-`, `ev-`). Each beat is one idea and ends on a composed frame the viewer could hold for a minute.
- Motion comes only from `useBeats`, `useActiveTime`, `useCameraRig`, `useScalarTrack`. No CSS transitions, no timers, no `useFrame`, no `Math.random()` (use `createRandom(seed)`). Screens are painted from the frame with `useScreenTexture`.
- Colours come from `useTheme()` roles (`system`, `mind`, `threat`, `safe`, `human`) and from `cineMaterials(theme)`; never raw hexes in a scene, except inside real media.
- Preview, do not render: `npm run dev`, then `node scripts/dev/preview.mjs cine-<nn-slug> [theme] [--frames=a,b,c]` writes checkpoint and mid-beat screenshots and a contact sheet to `out/preview/`. Look at them. Iterate until every checkpoint frame reads with the sound off.

## The world

`src/components/cinematic/world.ts` fixes the geography (metres, y up, floor at 0):

- John's room around the origin; he sits at +z facing the back wall at `ROOM.back`. The window is in that wall. `DESK`, `GAME_MONITOR`, `CHAT_MONITOR`, `KEYBOARD`, `LAMP`, `JOHN`, `WALL_PORT`.
- Outside: `OUTSIDE.groundY` is the street, far below (John is on an upper storey). `OUTSIDE.dataCenter` is the long lit building far to the north-east.
- The data hall has its own local frame (`HALL`, `rackAt(row, i)`, `rackYaw(row)`); `HALL_TO_WORLD` and `hallToWorld()` (in `route.ts`) place it inside that building. Rows run along x; even rows face +z, odd rows face -z, so every aisle has two faces. `HERO_RACK` is `{row: 1, i: 3}`: the machine the story's agent landed in (X02). Reuse it.
- `buildRoute()` is the physical path a message takes from the desk to the hero rack, with arc-length marks for its landmarks.

## The parts

| Component | What it is | Notes |
| --- | --- | --- |
| `Stage3D` (`shadows`) | the stage: rig camera, bloom, fog, dither | use `bloom={{strength: 0.4–0.5, radius: 0.6, threshold: 1.0}}`, `exposure` 1.1–1.3, `shadows` on |
| `DevRoom`, `WindowLight`, `Outside` | John's room, the cold light through the window, the district and the data centre | `Outside` takes `lights`, `mind` (facade lights turning purple), `shell` (0 lets the camera inside the building) |
| `Desk`, `Monitor`, `Keyboard`, `Mouse`, `Mug`, `Lamp`, `Plant`, `DeskCables` | the workstation | monitors take a `map` from `useScreenTexture` and a `tint` for the light they throw |
| `Developer` | John: hoodie, headphones, no face | pose: `typing`, `lean`, `turn`, `reach`, `slump` |
| `paintGame`, `paintChat`, `paintTerminal` | what is on the screens | canvas painters; pure functions of state |
| `DataHall`, `Rack`, `RackRow`, `rackBay`, `rackTop` | the hall and its racks | `stateOf(row, i)` -> `{power, activity, agent, threat, open}`; `hero` draws one rack in full detail |
| `Cable`, `cableThrough`, `Comet3D`, `GlowTube` | wires and the pulses that run along them | nothing travels through empty air |
| `AgentCore3D` | the gimbal iris, the channel's picture of an AI | small, inside a machine's open bay, never floating in a void |
| `Spot` | a spotlight with a real target | use it instead of `spotLight target-position` (which aims at the world origin) |
| `CrashCart` | a wheeled console cart with a terminal screen | X03: "a process is running" made legible |
| `Cage`, `CageSign` | chain-link enclosure with gates and a top-rail hairline | X05: coverage made physical |
| `Closet` | a comms closet: doorway, shelf, old tower with the iris in its drive bay, boxes, cables | X05: the machine outside the zone |
| `Campus` | neighbouring buildings with status lights and fibre lines, a roofless shell around the hall | X04: scale beyond one hall |
| `DataHall ceiling` | 0..1 opacity of the ceiling and fixture housings | fade it as the camera rises through the roof |
| `SourcePanel`, `MediaPanel`, `MediaInsert` (`src/components/cyber`, `src/components/story`) | real evidence in frames | pin to 3D with `projectPoint(rig, point)` |

## Light

Most of a frame is unlit dark matter. Light comes from practicals: screens (`Monitor` throws a point light in the picture's colour), the desk lamp, the night through the window (`WindowLight`), LEDs, hall fixtures. Three.js light intensities are physical: a point light at half a metre wants ~2, a hall fixture at three metres wants ~40, a street lamp ~70. Glow is only for LEDs, signal heads and the iris (`lit(hex, 1.5–3.2)`); structure never blooms.

## Camera

- One move per beat. Dollies, slow cranes, follows. No shake, no whip pans.
- An over-the-shoulder shot puts the person's head or shoulder in the frame as a dark foreground mass; a long lens (fov 26–30) for that, a wide one (fov 36–44) for establishing and for halls.
- The camera follows what travels and arrives where it arrives. Scale is revealed by moving the camera (crane up, pull back), never by cutting to a map.
- When the camera leaves a place, it goes the way the eye would: through the window, down the aisle, up through the roof as the roof fades (`shell`).
- Helpers: `useCameraRig(initial, segments)` for keyed moves; for a follow, blend the keyed rig toward a position derived from the moving thing (see X02).

## Done means

- `npm run typecheck` clean.
- Every checkpoint frame of the preview reads without sound: a muted viewer can say what the place is, who acts, what happened.
- No object in frame that you cannot name in the cast list.
- The hold frames are still (nothing idles) and the first frame of each beat equals the last frame of the previous one.

## Pitfalls met while building X01 and X02

- **Zero scale kills the frame.** A mesh scaled to exactly 0 on any axis gives NaN normals; the bloom pass blurs that NaN across the whole picture and the frame renders black. Clamp scales to >= 0.002 or unmount the mesh.
- **Light units are physical.** A point light half a metre from a desk reads at intensity ~2; a hall fixture three metres up needs ~40; a street lamp ~70. If the picture is black, the lights are ten times too weak, not the exposure.
- **Cameras end up inside things.** Aisles are 1.6 m wide; a camera 2 m "in front of" a rack is inside the opposite row. Compute the final pose from `rackAt`/`rackBay` and check it against the geometry before previewing.
- **Open fronts.** A cabinet is side panels, a top and a core behind the servers, never a solid box in front of them.
- **The window must be a frame, not a slab.** Anything that should be seen through needs an actual opening.
- **Follow shots need a stable "ahead".** Taking the camera offset from the curve tangent breaks when the curve turns vertical; inside the hall use the row direction instead.
- **Preview screenshots sometimes show the viewer chrome** (the bar at the top and the beat dots). That is the gallery UI, not the composition; ignore it or wait for it to fade.
