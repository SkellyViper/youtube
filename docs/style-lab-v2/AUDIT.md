# Style Lab v2 audit: cinematic experiments X01–X06 against the legacy look

**Evidence used**
- Renders: `out/cinematic/01-john-neon.mp4` … `06-evidence-neon.mp4` (60 fps, 1920×1080, 15.0–18.5 s). They are named `*-neon.mp4`, not `cine-0N-*.mp4`. They were rendered 16:00–16:15 on 8 Nov, before commits c1d43ba and e37786c. e37786c only keeps lights mounted for Player performance and turns off X01's exterior point lights, so apart from that the frames match the current code.
- I pulled one frame per second from t=0, plus full-resolution grabs at specific moments, and also checked `docs/cinematic/img/contact-sheet.jpg`. Times below are seconds into the MP4. Beat windows come from each `index.tsx`: lead-in 0.3 s, and each beat lasts its duration plus its hold.
- Legacy reference: `public/lab/thumbs/01-hero.jpg` … `10-ending.jpg`, plus the camera tracks in `src/scenes/style-lab/*`.
- **Seen** means observed in frames. **Code** means read or computed from source. Camera distances are straight-line distances between rig keys. The rig interpolates linearly per segment (`rig.ts:41-58`), so these are lower bounds for curved paths.
- **Line numbers.** Every `file:line` citation refers to commit e37786c, the state the experiments were audited in. The Style Lab V2 work in this same branch (the shot system in `src/shot/`, editable `Person.tsx`, `Room.tsx`, `Desk.tsx`, `Stage3D.tsx`, `rig.ts`, the new `LegacyStage.tsx`) moved lines in those files; the findings are about the experiments as they were, not about the V2 proof of concept (see `docs/STYLE_LAB_V2.md`).

## 1. Summary

- **The camera never settles.** Five of the six experiments move the camera on every beat. X02 and X03 each fly about 190–200 m in about 7 s (room → window → street → data centre → aisle). X04 cranes about 39 m up through a roof. X01 swings 1.6–2.0 m behind John's head twice, and the head fills about 40% of the frame mid-move. The legacy samples that work best (05-scan, 06-cloud) drift a few metres at a fixed fov of 34.
- **Whole places get built where one or two objects would do.** The scenes include a furnished room (bookshelf with 22 books, poster, rug, blinds), a district of 136 boxes with about 179 lit windows and 19 street lamps, a data-centre exterior, a 40-rack hall with 20 ceiling fixtures, a 4-building campus, and a comms closet with boxes and a coiled cable. Most of it is on screen for under a second, or only in the dark.
- **Quality per object is low exactly where the eye goes.** The developer is built from capsules and spheres. His forearms are longer than his upper arms and stretch when he leans back, the torus "hood" pushes into the chair back, his thighs sink into the seat and his hands are squashed balls. The plant is seven cones and the city is untextured boxes.
- **The storytelling is literal.** The scenes show the cable path out of the wall, the trip across town, a rail-mounted scanner trolley in a chain-link cage, and a closet with an old tower PC. The legacy set already has one-frame shorthands for these ideas: 05-scan for the blind spot, 06-cloud for "it went to a remote machine", 03-swarm for the spread.
- **The legacy look is gone.** The shared materials are brown wood and fabric. The neon theme adds a warm "human" orange (`#FFB45C`) and the outside scenes add sodium street lamps (`#FFB070`). X05 brings in a green "safe" tone, so the channel now has five hues instead of three. Bloom drops to 0.42–0.5 at threshold 1.0, and shadows and physical lights take over. No cinematic scene uses `MirrorFloor` or `Reflect`, and `SkyDome` only appears outdoors.
- **Many frames are hard to read.** X02 at t≈9.6 is one flat blue-grey plane with a warm wedge. X03 at t=5–9 is dark boxes washed brown. In X03's ending every nearby rack is purple, so "one busy machine among idle ones" does not read. X05 ends on green bars with a small purple doorway. X02's key clue is a tab label about 12 px tall.
- **Root cause.** Most of this comes from shared components (`DevRoom`, `Developer`, `Outside`, `DataHall`, `Campus`) and from the "one continuous world" premise in `world.ts:3-17`/`route.ts`, so the fixes belong there first.

## 2. Legacy Experiments: what to keep

**Traits (code):**
- **Void and horizon haze.** `void #04050A`, `abyss #070A14` and `haze #16226A` (`cyber.ts:19-27`). `SkyDome` draws a thin bright line on the true horizon plus a faint band above and below it: width 0.085, weights line 0.9, band 0.55, below 0.3 (`Environment.tsx:10-68`). It is the constant of the look.
- **Obsidian floor.** `MirrorFloor` is a translucent plane in the void colour, opacity 0.74–0.82 in the samples (`Environment.tsx:88-127`). `Reflect` adds a mirrored copy under it (`:136-149`), which reads as polished black glass.
- **Structure versus light.** Bodies are dark slate (`structureProps`: `#1A2032`, metalness 0.3, roughness 0.55; `materials.ts:29-33`). Edges and lines are unlit colours pushed above 1 with `hdr()` (`materials.ts:13-14`). Emissive levels are budgeted at dim 0.55 / base 1.5 / strong 2.6 / hot 4.5 (`cyber.ts:61-70`), with the rule "more than ~3 strongly glowing things → dim something" (`cyber.ts:55-60`).
- **Post and atmosphere.** Bloom strength 0.85 / radius 0.72 / threshold 0.92 (`cyber.ts:71`), applied by default in `Stage3D.tsx:209-211`. Neutral tone mapping. Fog `#05060D` at density 0.018 (`cyber.ts:111`).
- **`StageLights`** (`Environment.tsx:71-80`): ambient 0.5 `#8fa4ff`, a blue rim key at 2.2 from behind-left and a 0.5 fill. Silhouettes come first and there is almost no fill.
- **Three hues only.** Blue `#2E9BFF` for systems, violet `#8B3DFF` for AI, red `#FF2A3C` for threat (`cyber.ts:11-14, 29-39`).
- **Camera.** fov 34 (`cyber.ts:110`) and one heavy camera ease (`cyber.ts:132`).

**Samples that show these traits best (seen in thumbnails):**
- **05-scan** carries the whole idea in one frame: blue edge-lit blocks with checkmarks on the glass floor and a red core under the floor. The camera moves about 5 m in total at a fixed fov of 34, with one reframe for the reveal (`ScanScene.tsx:62-71`). This is the legacy answer to X05.
- **06-cloud** shows edge-lit cabinets on the mirror floor joined by one luminous curve, which reads as "a remote data centre" without a building or a street. The camera drifts slowly, about 8 m at 9–14 m distance with fov fixed (`CloudScene.tsx:73-80`). This is the legacy answer to the "elsewhere" in X02 and X03.
- **01-hero / 02-agent** establish the violet core as "the AI". 01-hero's wireframe skyline is the only city the channel needs.
- **07-source / 08-media** provide the bracketed evidence panels, which X06 already reuses.

**Legacy weaknesses:**
- 01-hero and 02-agent also travel. 01-hero moves about 9 m, then about 70 m out and about 68 m back (`HeroScene.tsx:43-70`). 02-agent moves about 14 m (`AgentScene.tsx:51-59`). The new camera rule applies to them too.
- 04-network is a dense particle web with no focal point, and 03-swarm is a uniform grid with no hero (seen).
- 10-ending is so dark that the skyline, the arch and the red light barely separate (seen).

## 3. Per experiment

### X01 · John at his computer
Beats: jc-room 0.3–4.0 s, jc-game 4.0–7.5 s, jc-agent 7.5–10.8 s, jc-hold 10.8–14.4 s.

- **What a muted viewer should understand:** a developer is making a small game at night, and an AI coding agent on his second screen is helping.
- **Unnecessary objects:**
  - `Outside` is mounted (`JohnScene.tsx:86`) but is only ever seen as dark boxes through the window. It contains 136 blocks, about 179 lit windows, 19 lamp posts, and a data-centre box with 6 chillers, a canopy, 5 downlights, 7 status lights and a fence (`Room.tsx:257-392`).
  - The room's exterior shell and neighbours' windows exist only for fly-outs (`Room.tsx:130-152`).
  - Room props: bookshelf with 22 books (`Room.tsx:154-172`), poster (`:174-192`), rug (`:48-52`), five blind slats (`:117-127`).
  - Desk props: mug (`Desk.tsx:173-192`), plant (`:228-252`), lamp (`:195-226`), drawer unit (`:50-60`).
- **Geometry / modelling:**
  - The person is capsules, spheres and boxes, with ball hands and no fingers (`Person.tsx:33-49, 181-188`). From behind, the warm-lit lower half of the head sphere below the hair cap reads as a bald orange ball (seen t=5.2, 9–11). The hood torus (`Person.tsx:140-143`) stands off the back like a horseshoe collar (seen t=12–14).
  - Code: the elbow is placed at 45%/55%/42% of the shoulder→hand line (`Person.tsx:80`), which gives an upper arm of 0.29 m and a forearm of 0.49 m.
  - Code: the chair sits 0.92 m from the desk (`world.ts:63`), so the chest is about 0.45 m behind the desk edge (chest z 0.77 vs edge z 0.32) and the arms are poles reaching to the keyboard.
  - Code: the seat top is at 0.49 m (`Person.tsx:102`), but the thigh capsules (centre 0.50, radius 0.065; `:123-124`) sink about 5.5 cm into it.
  - The plant is seven 6-sided cones (`Desk.tsx:244-247`, seen). The chair base is five bare boxes with no casters (`Person.tsx:92-97`).
- **Lighting:**
  - The floor, desk and plank colours are mixed toward browns `#2A211C` / `#3A2C24` / `#2E2520` (`cinematic/three/materials.ts:44-48`).
  - The lamp and the game-monitor light use the warm human tone (`Desk.tsx:198`, `JohnScene.tsx:88`).
  - Seen: brown-red walls and an orange desk pool, with violet only on the agent screen. There is no horizon band and no glass floor.
  - Seen: the headphone cup catches the purple light and blooms (t=5.2).
  - Code: bloom is 0.42/0.6/1.0 with exposure 1.2 (`JohnScene.tsx:83`).
- **Camera** (`JohnScene.tsx:48-54`):
  - jc-room: 1.07 m, fov 40→38.
  - jc-game: 2.05 m lateral swing from behind-left to behind-right in 2.2 s, fov 38→30.
  - jc-agent: 1.63 m swing back to the left, fov 30→27.
  - jc-hold: 1.21 m pull-out, fov 27→36.
  - Total: about 6 m and four fov changes. Both swings cross 0.6–0.85 m behind the head (code), and the head blocks the screens mid-move (seen t=5, t=8; frame 5 of the docs contact sheet). The two swings are the distracting moves.
- **Literalness:** a whole room plus the city outside to say "night, at home". The game action (knight, slime splitting) and a typed chat reply are fine, but they are carried by camera moves rather than by the composition. Shorthand: the night can be the `SkyDome` band behind the desk instead of a modelled city.
- **Verdict:** simplify. The minimum set is a desk slab on the obsidian floor, two monitors (game, agent), a keyboard, a chair, and one well-made seated figure or rim-lit silhouette. Use one fixed three-quarter frame, with at most a slow push-in at jc-agent.

### X02 · The wrong project
Beats: wp-tab 0.3–3.8 s, wp-send 3.8–7.1 s, wp-travel 7.1–11.6 s, wp-arrive 11.6–16.1 s.

- **What a muted viewer should understand:** he asks the agent for a game feature, but the active project is a different one (`cloud-ops`), so the action lands in the wrong repository or system.
- **Unnecessary objects:**
  - Everything in X01, plus the full `Outside` district and data-centre exterior (`WrongProjectScene.tsx:166`).
  - A 400-segment conduit along the whole route (`:174`).
  - The full `DataHall`: 40 racks, 4 tray runs with about 148 instanced rungs, 20 ceiling fixtures each with a spotlight, 4 columns, 10 floor strips and 10 emergency strips (`DataHall.tsx:54-64, 84-185`).
  - The "?" placeholder slot on the game screen (`:80-81`).
- **Geometry / modelling:**
  - Seen t≈9.6: the facade climb is one untextured plane filling about 90% of the frame, with a warm canopy wedge.
  - Seen t=9–12: city blocks and the data centre are flat boxes, with plane doors and cone-shaped downlight pools.
  - Seen t=13: the hall roof "opens" by fading the ceiling (`DataHall.tsx:91-97`), giving a dollhouse view. The pulse head is a blown white blob.
  - Seen t=5: John's head edge intrudes into the screen close-up.
- **Lighting:**
  - Sodium lamps `#FFB070` at intensity 95 (`Room.tsx:323`) and a warm entrance light (`:358`) turn the facades orange-brown (seen t=9–12). The street frames are murky.
  - The hall at the end is a saturated blue-violet wall of racks (seen t=14–16), a different grade from the room and the street.
- **Camera:**
  - wp-tab: 0.74 m push, fov 27→22 (`WrongProjectScene.tsx:56`).
  - wp-send: 0.93 m move plus a tilt that drops the target about 0.8 m to the wall port, fov 22→32 (`:58`).
  - wp-travel: 1.09 m to the window in 0.9 s (`:60`). Then a follow camera offset 13 m back, 8.5 m up and 4.5 m aside (`:97-99`) trails a pulse along about 170 m of street in 3.6 s (`route.ts:184-198`, `:66`).
  - wp-arrive: a dive from 8.5 m to 1.2 m through the faded roof, then a settle (`:94-133`).
  - Total: about 190 m across four locations in 16.7 s. Everything after the wp-tab push is distracting.
- **Literalness:** this is the clearest case. It builds the game, the city, the data hall and labelled screens to depict the network path (cable → skirting → wall port → facade → street → roof → tray → rack). Meanwhile the actual story point, the wrong active tab, is about 12 px of text (`screens.ts:276-284`).
- **Verdict:** redo as one workstation shot. Keep the agent monitor with two clearly distinct project targets (by shape and colour, not small text), the send action, the violet result landing on the wrong target, and the game screen visibly unchanged. If "it went to a server" is needed, use the 06-cloud cabinet shorthand as a cut, not a flight.

### X03 · The process that did not stop
Beats: sr-close 0.3–4.0 s, sr-leave 4.0–8.1 s, sr-arrive 8.1–12.0 s, sr-reveal 12.0–15.9 s.

- **What a muted viewer should understand:** he shuts everything down for the night, but the agent's process keeps running on a remote machine.
- **Unnecessary objects:**
  - The room and desk props as in X01.
  - The district and data-centre exterior (`StillRunningScene.tsx:230`).
  - The whole 40-rack hall (`:233`).
  - A crash cart with casters, KVM box, keyboard tray and a monitor showing "agent-runner — running" (`CrashCart.tsx:64-128`, `StillRunningScene.tsx:205`).
- **Geometry / modelling:**
  - Code: the lean-back pose (lean −0.6, slump 0.6; `StillRunningScene.tsx:179`) keeps the hands on the keyboard. Because limbs are endpoint-stretched capsules (`Person.tsx:34-49`), the forearm grows to 0.57 m.
  - Code: the hood reaches z≈0.290 m at the backrest top, where the backrest front face is at 0.281 m, so the hood pushes into the chair back (`Person.tsx:105, 140`).
  - Seen t=3.8: rubber-hose arms, and the neck shows as a pale stem.
  - Seen t=5–9: the city is untextured boxes with a handful of windows.
- **Lighting:**
  - The dark room at t=3–4 is the closest any experiment gets to the legacy navy.
  - The flight is sodium-brown and murky (seen t=5–9).
  - In the hall, the hero light (6–11 intensity, distance 6; `:206, :235`) floods every nearby rack violet (seen t=11–16), which contradicts "every rack idle".
- **Camera:**
  - sr-close: 0.30 m push (`:86-88`), which is fine.
  - sr-leave + sr-arrive: one Catmull-Rom path through 13 keys (`:99-118`), about 196 m in 6.5 s.
  - sr-reveal: a 0.16 m push.
- **Literalness:** it flies the whole distance to say "meanwhile, elsewhere". A clean cut between two static frames says the same thing. Frame A: the dark desk, with the screens and lamp going off. Frame B: one cabinet with a violet core among dim blue ones (06-cloud style).
- **Verdict:** redo as two static shots joined by a cut. Keep the darkening choreography from sr-close, and drop the city, the crash cart and the terminal text.

### X04 · One agent becomes a swarm
Beats: sw-copy 0.3–3.6 s, sw-next 3.6–7.3 s, sw-waves 7.3–11.6 s, sw-campus 11.6–16.2 s.

- **What a muted viewer should understand:** one agent copies itself into the next machine, then the whole hall, then other buildings.
- **Unnecessary objects:**
  - Four campus buildings, each with a roof slab, 4 chillers, a plant room, a lit door, a canopy and a warm point light (`Campus.tsx:37-42, 117-156`), plus a roofless shell and a 420 m ground plane.
  - Tray rungs, ceiling fixtures and columns (`DataHall.tsx`).
  - Seven conduit families: tray bundles, crossovers, drops, two risers, the trunk and the fibres (`Scene.tsx:188-202`).
  - Additive top-vent and floor-pool sprites (`Takeover.tsx`), which read as purple smudges on the rack tops (seen t=9–12).
- **Geometry / modelling:**
  - Racks hold up at medium distance (seen t=6–8).
  - Pulse heads are white spheres at `hdr(white, 4)` (`Scene.tsx:96-99`), and the fibre heads are 0.25 m. They bloom into large blobs (seen t=2–5).
  - The iris at scale 0.062 (`:174`) is small in the bay.
  - The campus is boxes (seen t=14–16).
- **Lighting:** the palette is closest to the legacy one (navy plus violet). However, the warm campus doors (`Campus.tsx:150, 156`) re-introduce orange, and the final aerial is underexposed and murky (seen t=14–16).
- **Camera** (`Scene.tsx:65-78`): 0.20 m push (fov 30→28), then 0.54 m back with a tilt following the pulse up to the tray (fov 33), a 1.66 m dolly (fov 42), a 1.75 m crane (fov 44), 6.13 m to the hall corner (fov 50), and 28.9 m up through the roof (fov 55). That is about 39 m in total, with the fov going from 30 to 55. The tilt-follow, the crane and the roof rise are all distracting.
- **Literalness:** every cable route is modelled. Legacy 03-swarm already shows the takeover as nodes turning violet. Here, "a rack changes hands" (its LEDs turn violet) is the one good physical idea.
- **Verdict:** simplify. Use one fixed wide on one or two rows of legacy-style cabinets on the glass floor, with one tray line, and let the cabinets turn violet in sequence from the origin bay. Drop the campus and the roof rise.

### X05 · The scanner misses something
Beats: bs-zone 0.3–3.6 s, bs-sweep 3.6–7.7 s, bs-clear 7.7–10.6 s, bs-outside 10.6–14.7 s, bs-hold 14.7–17.9 s.

- **What a muted viewer should understand:** a scan checks every machine in its zone and reports clear, but the agent sits on a machine outside that zone.
- **Unnecessary objects:**
  - Hall rows 2–3 and the fixtures outside the cage (`Scene.tsx:295`).
  - Eight rail hangers, trolley wheels and a stem (`:149-176`).
  - Twenty check-lamp housings on brackets (`:215-244`).
  - Two sign plates (`:297-298`; `Cage.tsx:215-220`).
  - The closet: partition walls, door frame, a door leaf with handles, kick plate and louvre, a shelf on brackets, cardboard boxes with tape seams, a wall box, a coiled cable on a hook and a ceiling bulb (`Closet.tsx:151, 209-318`).
  - The old tower inside the closet, with floppy slot, power button, grille, feet and PSU (`Closet.tsx:77-139`).
- **Geometry / modelling:**
  - The chain-link texture moirés at distance (seen t=7–11).
  - The tower and iris in the closet are illegible from the final camera (seen t=14–17; the quality report admits the iris is tiny from 8 m).
  - The scanner bar is a heavy slab in the hold.
- **Lighting:**
  - Green `#2FE39A` (`themes.ts:98`) is a fourth hue outside the legacy palette. It drives the bar, two spotlights at 30, a point light at 7, 20 tick lamps, the top-rail hairline and a floor pool (`Scene.tsx:148, 200-202, 218, 308`). Seen t=3–17: the frames go green-teal.
  - The thing that was missed is shown violet, not red. In 05-scan the miss is red.
- **Camera:**
  - bs-zone: 0.53 m, fov 46→44 (`Scene.tsx:87-88`).
  - bs-sweep: a 7.3 m dolly that rides with the scanner (`:80-81, 274`).
  - bs-outside: a 5.35 m crane over the fence, with the target swinging to the closet (`:89, 280-284`).
  - Total: about 13 m. The dolly and the crane both distract.
- **Literalness:** it models a colocation cage, a ceiling rail, a trolley and a furnished closet. Legacy 05-scan states the same idea in one static frame: a blue zone with checks on the glass, and a red core outside or below it.
- **Verdict:** redo from the 05-scan vocabulary. Show the bounded zone as a few cabinets inside one luminous boundary line, with checkmarks, and one machine outside the line holding the core (red, or violet turning red). Keep the camera fixed and let the scan be a moving line of light.

### X06 · Real evidence in a cinematic environment
Beats: ev-approach 0.3–3.6 s, ev-source 3.6–7.9 s, ev-media 7.9–12.3 s, ev-return 12.3–15.6 s.

- **What a muted viewer should understand:** we step out of the reenactment to look at real sources, then return to the same place.
- **Unnecessary objects:** the full 40-rack hall with 20 lit fixtures (`WorldLayer.tsx:34`), even though it is desaturated and veiled for most of the runtime (`stage.ts:104-105`). There is also the fly-out and fly-back of the page through the rack bay.
- **Geometry / modelling:** the rack faces are acceptable. At t=14 the hand-off flare (point light 20 × flare, `WorldLayer.tsx:40`; `stage.ts:111`) blows out the bay (seen).
- **Lighting:** the hall is brighter and more saturated than the legacy stage, with violet wash on the hero rack and lit fixtures. The evidence panels themselves match legacy 07/08 (seen t=5–12).
- **Camera:** a 0.94 m push (fov 38→33) and a 1.11 m return (fov 33→38) (`stage.ts:82-91`). This is the most restrained of the six and acceptable.
- **Literalness:** low. The documents carry the beat, and only a couple of short captions appear ("ENIAC, c. 1947. US Army photo", the domain and the retrieval date).
- **Verdict:** keep the evidence layer. Simplify the world layer to a static hold on one violet cabinet on the glass floor (or any legacy stage) and drop the page's trip out of the bay.

## 4. Cross-cutting issues

- **`world.ts` / `route.ts`.** The premise "one continuous world… the camera can leave a desk, go through a window and arrive at a far building without a cut" (`world.ts:3-17`) is the root of the fly-throughs. Geography is laid out for travel: the data centre is 170 m away (`world.ts:76`), and `buildRoute` runs about 190 m (`route.ts:170-229`).
- **`DevRoom`** (`Room.tsx:24-200`). A furnished room of brown and slate materials, plus an exterior shell that only matters for fly-outs. It is used in X01–X03.
- **`Developer`** (`Person.tsx:51-191`). A primitive figure with wrong limb ratios and endpoint-stretched limbs. The chair is too far from the desk. The hood and chair back overlap, and the thighs sink into the seat. It appears in three experiments, in the most-watched part of each frame.
- **`Outside`** (`Room.tsx:257-392`). 136 boxes, about 179 windows, 19 sodium lamps and the data-centre exterior. It is mounted in X01–X03, and in X01 it is only ever seen as dark boxes through the window.
- **`DataHall`** (`DataHall.tsx:40-186`). 40 racks, trays, 20 fixtures with spotlights, columns, and floor and emergency strips. It is used in X02–X06 even when only one rack matters. With `lights` 0.15–0.9 and `room` 1.4–1.8 it reads as a lit room, not the void. `Campus` adds another layer of the same thing.
- **Palette and grade drift.**
  - Brown wood and fabric mixes (`cinematic/three/materials.ts:44-48`).
  - Warm `human` `#FFB45C` and green `safe` `#2FE39A` (`themes.ts:98-99`).
  - Sodium and warm practicals (`Room.tsx:321-323, 358`; `Campus.tsx:150-156`).
  - Bloom overridden to 0.42–0.5 / 0.6 / 1.0 in every scene, against legacy 0.85 / 0.72 / 0.92. Shadows on, exposure 1.2.
  - `StoryGrade` vignette 0.5 and grain 0.055 (`episode.tsx:23`, `themes.ts:105`) on top.
  - No `MirrorFloor`/`Reflect` anywhere in `src/components/cinematic` or `src/scenes/cinematic`. `SkyDome` only appears in `Outside`/`Campus` (`Room.tsx:305`, `Campus.tsx:79`).
  - Result: a generic dark-documentary grade with warm practicals instead of glass, haze and luminous edges.
- **Signal heads exceed the glow budget.** Comets and edge pulses at hdr 3.2–4 with 0.05–0.25 m heads become large white blooms (X02 t=13, X04 t=2–5). This breaks the "≤ ~3 strong glows" rule in `cyber.ts:55-60`.
- **On-screen text** is already minimal (tab labels, one terminal title, X06 captions). The issue is the reverse: X02's plot depends on text too small to read.

## 5. Priorities for the scene-by-scene redesign

1. **Lock the camera first.** Give each experiment one composed frame at fov ~34. Allow only a ≤0.5 m push-in or a clean cut where it clarifies. Remove the follow camera (X02), the path flight (X03), the cranes and roof rise (X04, X05) and the head-crossing swings (X01).
2. **Put the legacy stage back under everything.** That means `SkyDome`, `MirrorFloor` + `Reflect`, `StageLights`, slate bodies with `hdr()` edges, legacy bloom and fog, and only blue, violet and red. Remove the brown materials, the human orange, the sodium lamps and the safe green.
3. **Cut the shared world.** Drop `Outside`, `Campus`, the room furniture and the closet props. Replace `DataHall` with a small set of legacy-style cabinets (06-cloud), and use one hero cabinet when one machine is the point.
4. **Make the few remaining objects good.** Rebuild or replace the developer: correct proportions, seated contact, no stretching limbs, real hands. Otherwise reduce him to a rim-lit silhouette from one fixed angle. Do the same pass for the desk, the monitors and the cabinet.
5. **Redo X02 first** as one workstation shot of an action landing in the wrong project, with the distinction carried by shape and colour. It sets the pattern for the rest.
6. **Then the others:**
   - X05 rebuilt from the 05-scan vocabulary.
   - X03 as two static frames joined by a cut.
   - X04 as a fixed wide of cabinets turning violet.
   - X01 simplified to the desk, the screens and the figure.
   - X06 keeps its evidence layer on a static legacy backdrop.
7. **Then fix the legacy samples' own travelling cameras** (01-hero, 02-agent) to the same rule.
