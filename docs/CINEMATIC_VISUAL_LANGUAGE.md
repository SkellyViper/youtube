# Cinematic visual language

The channel's playbook for staging technical events as physical scenes. It combines what we learned from fern's documentary reenactments (`docs/FERN_VISUAL_RESEARCH.md`) with the identity we already have: near-black, electric blue, luminous violet, restrained red; dark matte surfaces; sharp luminous accents. Think **documentary reenactment + Tron-lit night + precise explanation.**

Every rule below says (1) the problem it solves, (2) the fern observation behind it, marked *observed* when it comes from frames we inspected and *inferred* when it is our reading, (3) how we adapt it so the result is ours, and (4) where it is implemented in the Style Lab (`X01` to `X06` are `src/scenes/cinematic/01-john` to `06-evidence`).

This document is written to be pasted into a future prompt. It is not yet a skill; we are still deciding.

Contents: [Staging](#1-staging) · [Camera](#2-camera) · [Lens and framing](#3-lens-and-framing) · [Light](#4-light) · [Materials](#5-materials) · [People](#6-people) · [Screens](#7-screens) · [2D and 3D](#8-handing-over-between-3d-and-2d) · [Pacing](#9-pacing-and-beats) · [Revealing](#10-revealing-information) · [Continuity](#11-spatial-continuity) · [When not 3D](#12-when-not-to-use-3d) · [No text](#13-understandable-with-the-sound-off) · [Identity](#14-what-stays-ours) · [Checklist](#15-the-checklist)

---

## 1. Staging

**1.1 Every scene is a place.**
Problem: abstract geometry on a void gives the camera nothing to move through and the viewer nothing to recognise. Fern (*observed*): a plaza with wet slabs, a gate and a car, a bedroom with posters, a hall of men in a dark room. Ours: a developer's room with floorboards, a window, a shelf; a data hall with aisles, trays and fixtures; the street between them. Implementation: `DevRoom`, `DataHall`, `Outside` in `src/components/cinematic`; X01 to X06 all stand in these places.

**1.2 A cast list before a shot list.**
Problem: objects nobody can name. Rule: every prominent thing in the frame has a one-line entry at the top of the scene file saying what it stands for and why it is there; if the line cannot be written, the object goes. Fern (*inferred*): nothing decorative appears in the frames we saw; every object is a prop of the story. Implementation: the header comment of every cinematic scene (`JohnScene.tsx`, `WrongProjectScene.tsx`, ...).

**1.3 The agent lives in machines.**
Problem: the gimbal iris floating in space reads as a screensaver. Rule: the iris sits inside a rack's open bay, behind a glass sled, at the scale of a drive; its presence is also shown by the machine's own tells (LEDs busy, bay open, console scrolling). Fern (*inferred*): hardware is always shown as hardware (the macro circuit board). Implementation: `Rack` (`BAY_UNIT`), X02 wp-arrive, X03 sr-reveal, X04 sw-copy.

**1.4 Foreground, subject, depth.**
Problem: flat compositions. Rule: compose in three planes: something near (a shoulder, a cage wire, a rack edge), the subject, and the place receding (an aisle, the district). Fern (*observed*): the photo panel with bokeh behind; the silhouette line with lights behind. Implementation: X01 jc-game and jc-agent (John's head as the near mass), X02 wp-arrive (the aisle receding), X05 bs-sweep (cage wire in the foreground).

## 2. Camera

**2.1 One move per beat, and it means something.**
Problem: camera moves that exist because the camera can. Rule: each beat has one camera intention: approach, follow, reveal, settle. The move ends on a frame that could be a still. Fern (*inferred*; motion could not be inspected): the frames read as composed stills, which only happens when moves end deliberately. Implementation: `useCameraRig` segments, one per beat, in every scene.

**2.2 Follow what travels.**
Problem: a message that teleports. Rule: when something moves (a command, a copy, a scan), the camera goes with it and arrives where it arrives, so cause and effect are one shot. Implementation: X02 wp-send/wp-travel/wp-arrive (the camera takes the pulse's side after leaving the window), X04 sw-next (dolly along the aisle with the copy), X05 bs-sweep (track with the scanner).

**2.3 Reveal scale by moving, not by cutting.**
Problem: "there are many" shown by a cut to a map. Rule: crane up or pull back until the many are in frame; let the rows reveal themselves. Fern (*observed*): aerial first, then ground level in the clay reconstruction; the top-down plaza. Implementation: X04 sw-waves/sw-campus (crane through the ceiling), X05 bs-outside (crane over the cage).

**2.4 Leave a place the way the eye would.**
Problem: cameras that pass through walls. Rule: exit through the window, down the aisle, up through a roof that fades. Implementation: X02 wp-travel and X03 sr-leave (through the window below the blinds), `Outside` `shell`, `DataHall` `ceiling`.

**2.5 Never shake, never whip.**
Problem: fake energy. Rule: the heavy camera curve (`motion.camera`) for every move; nothing faster than a dolly. Our identity is calm and ominous, not frantic.

## 3. Lens and framing

**3.1 Two lenses.**
Wide (fov 36 to 44) for establishing shots and halls; long (fov 26 to 31) for over-the-shoulder shots and close-ups on machines. A long lens compresses the aisle and makes the foreground shoulder big; a wide lens makes a room a room. Implementation: X01 opens at 40 and goes to 27 for the agent screen; X02 arrives at 40.

**3.2 Over the shoulder.**
Problem: screens shown as flat inserts. Rule: when a person looks at a screen, shoot past their head or shoulder on a long lens, head as a dark mass on one third of the frame, screen centred. Fern (*observed*): a character at a desk lit by a lamp, filmed from the room, not from the screen. Implementation: X01 jc-game (over the right shoulder), jc-agent (over the left).

**3.3 Eye level, then height.**
Open at a person's eye level or a doorway's height; use height only to reveal (2.3) or to isolate (fern's top-down plaza, *observed*). Implementation: X01 opens from the doorway at 1.7 m; X05 ends from above.

**3.4 Leading lines.**
Aisles, trays, floor strips, skirting boards and cables lead to the subject. Implementation: `DataHall` floor strips and trays; `DeskCables` along the skirting.

## 4. Light

**4.1 Light comes from the scene.**
Problem: everything glowing. Rule: the only light sources are practicals the viewer can see: screens, a desk lamp, LEDs, hall fixtures, street lamps, the night through a window. Ambient is a whisper (hemisphere 0.1 to 0.4). Fern (*observed*): lamp-lit room, pink bedroom, backlit silhouettes; no decorative glow in any frame. Implementation: `Monitor` throws a point light in its picture's colour; `Lamp`; `WindowLight`; `DataHall` fixtures; `Outside` street lamps.

**4.2 Glow is a budget of about three.**
Bloom threshold 1.0, strength under 0.5: only LEDs, signal heads and the iris cross the threshold. Structure never blooms. Implementation: `Stage3D` props in every cinematic scene; `lit(hex, 1.5–3.2)` for the few emissives.

**4.3 Colour is a role, light is its carrier.**
Blue light = infrastructure (fixtures, status LEDs, the night). Purple = the agent and anything it touches (its screen, the rack it lands in, the spill on the aisle floor). Red = threat, introduced late and small. Warm orange = the human's world (the game, the lamp, a street lamp, a building entrance). A frame is mostly dark; the colours are the information. Implementation: theme roles `system`, `mind`, `threat`, `human` everywhere; X02's arrival turns one rack purple in a blue row.

**4.4 Contrast is the argument.**
Problem: "something kept running" told by a caption. Rule: make it a difference in light: a dark room against one lit machine; a green zone against a purple closet. Implementation: X03 (monitors off, lamp off, one busy rack), X05 (green checks inside the cage, purple LED outside).

**4.5 Shadows ground things.**
Soft shadow maps on the window light and the lamp put the desk, the chair and the person on the floor. Implementation: `Stage3D shadows`, `WindowLight`, `Lamp`.

## 5. Materials

**5.1 Ordinary dark matter.**
Painted wall, floorboards, powder-coated steel, fabric, denim, paper, ceramic, concrete, raised-floor tiles. Roughness 0.6 to 0.95; metalness only on steel. Nothing is glass except screens and the bay sled; nothing is chrome. Fern (*observed*): matte grey figure, matte white clay world, realistic gate and car. Implementation: `cineMaterials(theme)`; plank and tile textures are procedural, no assets.

**5.2 Mirror floors are for the old look.**
The legacy obsidian mirror floor stays in the legacy samples. Cinematic floors are wood or tiles with a faint sheen at most.

**5.3 Themes tint the lights, not the matter.**
Switching to Infrared or Glacial changes screens, LEDs and the night; the desk stays wood. Implementation: `cineMaterials` mixes a fixed physical base with a small amount of the theme's slate/abyss.

## 6. People

**6.1 Recognisable by silhouette, never by face.**
Hoodie, headphones, hair, hands on a keyboard, posture. No facial features. Fern (*observed*): smooth featureless faces, silhouettes, faces framed out. Ours differs in proportion and costume (a specific developer, not a white mannequin) and in being lit by his own screens. Implementation: `Developer` (`pose`: typing, lean, turn, reach, slump).

**6.2 Body language is a beat.**
Turning to the other screen, leaning in, slumping back, pushing the chair away. These are the human events of a scene and deserve their own camera attention. Implementation: X01 jc-agent (turn), X03 sr-close (lean back, slump).

**6.3 Hands do the acting.**
Typing, a hand on the mouse, a hand on a lid. Implementation: `Developer` hand targets (`KEYBOARD`, mouse), X02 wp-send (the press).

## 7. Screens

**7.1 Screens are pictures, not screenshots.**
Painted interfaces, clean and readable at the size they will be seen: a game that is unmistakably a game, a chat with two project tabs, a terminal with a scrolling log. Fern (*observed*): a browser drawn as a glowing outline in a rendered bedroom. Implementation: `paintGame`, `paintChat`, `paintTerminal` with `useScreenTexture`.

**7.2 Real words only where the UI is the subject.**
Project names on tabs (`my-game`, `cloud-ops`), a terminal title. Everything else is bars.

**7.3 The screen lights the room.**
Each monitor's point light carries its picture's colour onto the desk, the hands and the face-that-is-not-there. Implementation: `Monitor tint`.

## 8. Handing over between 3D and 2D

**8.1 Evidence comes out of the scene and goes back.**
Problem: a cut to a full-screen screenshot breaks the place. Rule: a source panel rises from the machine or screen it belongs to (pinned with `projectPoint`), the world steps back (desaturate, veil), the panel becomes readable, and then it returns and colour comes back. Fern (*observed*): photo as a lit panel in a dark room; document as angled paper; real footage at its own aspect. Implementation: X06; `SourcePanel`, `MediaInsert`, `worldStepBack`, `EvidenceVeil`.

**8.2 Real media keeps its own look.**
True colour, true aspect, a one-line caption with the credit. Never tinted to the theme. Implementation: `MediaPanel`, captions from `public/lab/media/SOURCES-*.md`.

**8.3 Diagrams are the last resort.**
If a relationship cannot be staged physically (a cable, a cage, a route), a diagram overlay may be pinned to the 3D anchor points; it must share the camera (`projectPoint`) so it moves with the world.

## 9. Pacing and beats

**9.1 One idea per beat; overlap the edges.**
A beat has one dominant action; the next element's entrance begins before the current one settles, and the camera is already moving toward the next composition. Implementation: X01 (the slime splits while the camera is still arriving; the head turns while the camera slides).

**9.2 Long takes over cuts.**
Where a sequence is one argument (closing the laptop, then the far machine still running), it is one continuous shot. Cut only to change scale drastically or to change place when travel would say nothing. Fern (*inferred*): the openings we saw are composed shots with time in them. Implementation: X02 and X03 are single continuous moves across two places.

**9.3 Hold on a photograph.**
The last frame of each beat is a composed still that could stand for a minute while the narrator talks. Nothing idles during a hold. Implementation: the engine's frozen holds; `useActiveTime` for any ambient motion.

**9.4 Lengths.**
Beats 2.4 to 3.8 s; a scene 10 to 14 s; holds 0.7 s in export. Travel beats are the longest.

## 10. Revealing information

**10.1 Setup, action, consequence, hold.**
The four-phase shape of every scene. The consequence is shown where it happens (the far rack lights up), not announced.

**10.2 The small tell before the big reveal.**
A purple underline on the active tab before the message goes astray; a single blinking LED before the closet is shown. Implementation: X02 wp-tab, X05 bs-outside.

**10.3 Keep the origin in frame when revealing scale.**
When the camera cranes up to show many, the one it started from stays identifiable (lit differently, bracketed, centred). Implementation: X04 sw-waves.

## 11. Spatial continuity

**11.1 One world, fixed geography.**
John's room, the street, the data centre and its hall share one coordinate system (`src/components/cinematic/world.ts`). The data centre John sees through his window is the hall the message arrives in. Implementation: `OUTSIDE.dataCenter`, `HALL_TO_WORLD`, `buildRoute()`.

**11.2 Messages travel along things.**
Cable, skirting, wall port, facade, street, fibre entry, tray, rack. Nothing crosses empty air. Implementation: `buildRoute()`, `Cable`, X02, X04.

**11.3 Return to where you were.**
When a scene leaves to show evidence or scale, it comes back to the same place, slightly changed (a little higher, a rack now purple). Implementation: X06 ev-return.

## 12. When not to use 3D

- **Reading.** A page, a paper, a screenshot: 2D at true scale, in a frame (8.1).
- **Pure logic.** A dependency graph, a test list, a timeline with no place: the 2D redesign scenes (S05, S08) already do this well; 3D would add nothing but render time.
- **Numbers.** Counts, dates and sources as quiet 2D captions or panels.
- **When a 2D scene already explains it in under ten seconds.** Compare in the gallery before choosing.

## 13. Understandable with the sound off

- The place is recognisable in the first second (a room, a hall, a street).
- Who acts is a figure or a machine with a tell (LEDs, an open bay, a scrolling console), never a colour alone.
- What happened is a change the eye can see: something travelled and arrived; a light went out; a light came on somewhere else.
- No captions, except real media credits and words that are the subject. The narrator carries the rest.

## 14. What stays ours

- Near-black base, blue/purple/red roles, warm for the human.
- The gimbal iris as the agent.
- Hairline instrument marks and corner brackets for evidence frames.
- Calm, heavy camera moves; a slightly ominous mood.
- Procedural, asset-free geometry (every room and rack is code, themable, reproducible).

What we deliberately did **not** take from fern: its white-clay reconstruction look, its typographic captions, its character designs, any of its shots.

## 15. The checklist

Before a scene is done:

1. Cast list written; every object justified.
2. Opens on a recognisable place; ends on a photograph.
3. One camera intention per beat; the camera travels with whatever travels.
4. Light only from practicals; about three glowing things.
5. Subject at least a third of the frame at every hold; a foreground element for depth.
6. The agent is inside a machine with physical tells.
7. Evidence rises from the scene and returns.
8. Mute test passed by someone who has not read the code.
9. `npm run typecheck`, preview contact sheet inspected, all five themes sane.
