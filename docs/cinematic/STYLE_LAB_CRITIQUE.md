# Critique of the existing Style Lab

Measured against the three complaints in the brief (meaningless objects, slideshow motion, unclear explanations) and against the principles extracted from fern (`docs/FERN_VISUAL_RESEARCH.md`, section 4). Method: the contact sheets of every redesign scene at each checkpoint and mid-beat (`docs/redesign/checkpoints-neon.jpg`), the legacy-vs-redesign sheet (`docs/redesign/original-vs-redesign.jpg`), and the scenes stepped through in the browser.

The earlier redesign already fixed the worst of the legacy lab (see `docs/STYLE_LAB_REDESIGN.md`, section 1). This critique is about what the redesign still does not do, and it is what the cinematic experiments answer.

## What works and is kept

- **Colour semantics.** Blue = systems, purple = the agent, red = threat, warm = the human's world. Every scene obeys it. Kept as the one rule that must survive any restyle.
- **The agent.** The gimbal iris is a good, faceless, recognisable character. Kept, but it now lives *inside machines* (an open rack bay), not in a void.
- **Evidence frames.** `SourcePanel` and `MediaPanel` show real material with measured highlights and true aspect ratios. Kept unchanged; X06 moves them into and out of the 3D world.
- **The engine.** Beats, frozen holds, deterministic seeking, one source of truth for preview and export. Untouched.

## Problem 1: objects without meaning (and places without matter)

| Scene | What is on screen | What fern would have shown instead |
| --- | --- | --- |
| S01 Developer (2D) | A desk is a brown band; John is a dark blob with a hood; the room is a gradient with a rectangle for a window. | A room: floor, walls, a window you can see through, a shelf, a chair. A person with clothes and hands. (X01.) |
| S02 Wrong project (2D) | The capsule travels along a drawn line through black; the data centre is five rack outlines floating in nothing. | A cable that goes down the wall, a street, a building, a hall. The route is a place you could walk. (X02.) |
| S03 Keeps running (2D) | The "far hall" is a row of rectangles; the pulse leaves to nowhere. | A hall asleep: rows of racks, fixtures off, one machine busy, a console showing the log. (X03.) |
| S04 Replication (3D) | The wide shot is boxes with glowing lines between them on a mirror floor: the "floating nodes" look the brief rejects. | Rows and aisles. Copies travel along trays and drop into racks; buildings beyond. (X04.) |
| S07 Undetected (3D) | A green rectangle drawn on a floor, box racks, pop-up ticks. Coverage is a diagram, not a thing. | A cage you can see through, a scanning rig that physically passes racks, and a closet the rig cannot reach. (X05.) |
| S10 Callback (2D) | The data centre on the horizon is a flat box with two dots. | The same lit building that X02 travelled to, seen from John's window. (X01's window.) |

The general fault: **matter is missing.** Floors are mirrors or voids, walls are gradients, machines are outlines. Fern's frames are full of ordinary dark matter (asphalt, paper, fabric, steel) that light can fall on. Without matter there is nothing for a camera to move through, so camera moves become slides.

## Problem 2: slideshow motion

- **Beats as slides.** In S01, S03, S05, S08 and S10 each beat moves one element and the frame otherwise waits; cameras move in their own beats. The cinematic experiments give every beat one dominant action *and* a camera that travels with it or settles into it (X01 jc-agent: the head turns, the camera slides with the look, the screen writes).
- **Cuts that teleport.** S02 and S03 reach the data centre by scaling the 2D world; the viewer is told, not taken. X02 and X03 go out through the window and across the district in one continuous shot, so distance and "elsewhere" are experienced.
- **Replacement instead of mechanism.** S04 shows copies appearing at machines; the cable sparks are small. X04 makes the copy leave up the rack's own cable bundle, run the tray, and drop into the next rack's bay before that rack changes colour.
- **Holds that pose.** Several redesign holds end on diagrams (S05's probes, S08's keys). The cinematic holds end on a composed photograph of a place: a person at two screens; one purple rack in a blue row; a green cage and an open closet door.

## Problem 3: unclear without sound

- **Scale.** In the 2D scenes the main subject often covers under 15% of the frame at the hold (S02's rack, S03's hall, S10's building). Every cinematic hold frame puts the subject at a third of the frame or more, with a foreground element for depth.
- **Over-reliance on colour.** The redesign explains "agent arrived here" with a purple tint. The experiments add the physical tell: the bay slides open and the iris is inside; LEDs go busy; a console scrolls.
- **Glow eats silhouettes.** The legacy 3D samples (02, 03) and the redesign's S04 close-up have halos that swallow geometry. The cinematic stage sets the bloom threshold at 1.0 and keeps bloom strength under 0.5, so only LEDs, pulses and the iris glow; walls, racks and people never do.
- **No establishing shot.** None of the redesign scenes opens on a shot that says *where we are*. X01 opens from the doorway; X02 opens close but ends wide; X05 opens on the cage.

## Technical debts found along the way

- `Stage3D` had no shadow maps. Added (`shadows` prop, PCF soft), default off so legacy samples are unchanged.
- Three.js light units are physical: the redesign's 3D scenes compensate with emissive materials. The cinematic scenes use real intensities (a hall fixture ~40, a street lamp ~70) and almost no emissive structure.
- Rack models in the redesign are closed boxes with a painted "face". The cinematic rack is an open cabinet with server units, handles, vents and LEDs; the hall instances them (one draw call per part).
- A zero-scale mesh produces NaNs that the bloom pass smears over the whole frame (a black frame). Guarded in `Rack.tsx`; written into the builder brief.

## Verdict

The redesign made the lab *mean* something; it did not make it *a place*. The cinematic experiments keep the redesign's meaning (same cast, same colour rules, same agent) and add matter, light that comes from the scene, cameras that travel, and holds that are photographs. Which of the six did that best is in `docs/cinematic/QUALITY_REPORT.md`.
