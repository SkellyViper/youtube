# Fern: visual research for our 3D storytelling

A study of how the documentary channel **fern** (`@fern-tv`, watchfern.com) uses 3D animation to stage events, made to inform our own cinematic language. It is a study of technique, not a template: nothing here is to be copied as artwork. The deliverables that came out of it are `docs/CINEMATIC_VISUAL_LANGUAGE.md` (the playbook) and the six cinematic experiments in the Style Lab.

Contents

1. [What was actually inspected, and how](#1-what-was-actually-inspected-and-how)
2. [The catalogue](#2-the-catalogue)
3. [Direct observations, frame by frame](#3-direct-observations-frame-by-frame)
4. [Interpretation: what makes the 3D storytelling work](#4-interpretation-what-makes-the-3d-storytelling-work)
5. [Secondary sources: the studio and its process](#5-secondary-sources-the-studio-and-its-process)
6. [What this research could not establish](#6-what-this-research-could-not-establish)
7. [How the findings were used](#7-how-the-findings-were-used)

---

## 1. What was actually inspected, and how

**Honesty first.** This research is grounded in frames I looked at myself, but the coverage is narrow, and the reasons are documented here so nobody over-reads it.

- **Metadata:** the public catalogue was inventoried at the title/date level for all 147 long-form uploads (see `docs/cinematic/FERN_CATALOG_INVENTORY.md`, built from the channel's RSS feed, a fan-maintained episode index, two statistics sites and the studio's own site). Watch IDs were confirmed for 47 videos. No video was watched for that inventory.
- **Primary visual inspection:** seven videos were opened on their public YouTube watch pages in a Playwright-driven Chromium and frames were captured from the player. YouTube's player stopped serving video to the automated browser after about 45 seconds of each video ("Something went wrong" error 153 / player error), in headless and in a visible window alike, with seeking and with plain playback. I did not try to work around that. **So the first-hand evidence is the opening 45 to 60 seconds of seven videos (21 frames), plus one frame at 1:30 of the CIA video from the first attempt.** Everything in section 3 comes from those frames. The frames are research notes only; none are kept in the repository.
- **The four priority videos named in the brief were all inspected first-hand** for their openings. Deeper analysis of camera movement over time, pacing, and the 2D/3D handovers inside the body of the films could not be done with the tools available in this session; a person watching the videos (or a connected browser session) could extend section 3 quickly.

| Video | ID | Date | Length | Inspected |
| --- | --- | --- | --- | --- |
| The Kids Who Hacked The CIA | PmtFtWVrxFE | 2024-03-17 | 23:05 | 0:00, 0:15, 0:30, 0:45, 1:30 |
| The Kids Who Hacked Xbox | LZkl0_9xFOU | 2024-09-23 | 27:38 | 0:00, 0:15, 0:30, 0:45 |
| How an FBI Agent Infiltrated the KKK | wLFY_Zu_O08 | 2025-11-12 | 41:04 | 0:00, 0:15, 0:30, 0:45 |
| The Death of Educational Content on YouTube | -Gnrp_caPvo | 2026-09-02 | 28:11 | 0:00, 0:15, 0:30, 0:45 |
| Mapping the Trump Shooting | aVA7aXOH1pk | 2024-07-16 | 6:11 | 0:00, 0:25, 0:50 |
| The Hunt for the King of the Dark Web | gq01C2kjMiM | 2023-08-20 | ~25 min | 0:00, 0:25, 0:50 |
| The Most Feared Kids on the Internet | 88itHnh8eMI | 2026-10-14 | ~26 min | 0:00, 0:25, 0:50 |

Everything else about fern in this document is from secondary sources and is marked as such.

## 2. The catalogue

The full table (147 rows, date-sorted, with inferred topic and a one-line relevance note) is in `docs/cinematic/FERN_CATALOG_INVENTORY.md`. In brief:

- **147 public long-form videos** from 2023-07-11 ("How a Pilot Hijacked a Plane") to late 2026; roughly one a week.
- **Topics** (inferred from titles): cybersecurity and hacking biographies (the largest and most-viewed group: Silk Road, ANØM, Hansa, Stuxnet, Mitnick, teenage hacker crews), investigative and true-crime reconstructions (the Trump and Kirk shootings, the KKK infiltration), technology and data (surveillance buildings, app telemetry, vending machines), internet culture, and a few on-the-ground reports (Afghanistan).
- **Stated animation approach** is almost never in the metadata. Two videos are labelled "animated reconstruction" by the fan index; the rest is unknown from text.
- A 26-item shortlist of videos worth inspecting across eras and genres is in section 4 of the inventory. Only the seven above were reached.

## 3. Direct observations, frame by frame

Format: timestamp, what is in the frame, then what it is doing. Observations are what the pixels show; anything beyond that is in section 4.

### The Kids Who Hacked The CIA (PmtFtWVrxFE)

- **0:15.** A high-angle, almost top-down 3D shot: one small figure walks across a dark plaza of raised rectangular slabs; the ground is wet and reflects a few overhead lights. The figure is tiny in the frame. *Staging:* an establishing shot that uses height and emptiness to make one person look alone and watched; the reflections give a flat plane depth without any glow.
- **0:30.** A real photograph (an official portrait of John Brennan, with flags) sits in the frame like a lit panel inside a dark room; behind it, out-of-focus points of light. A small credit line in the bottom-left corner. *Staging:* the photo is treated as an object in 3D space, not a full-screen cut; the room stays dark around it.
- **0:45.** A legal document (an affidavit) fills the frame at a slight angle, lit from one side so the paper has shading; the text is readable. *Staging:* a document shown as paper, large enough to read, with a physical angle rather than a flat screenshot.
- **1:30.** Same photo-panel setup as 0:30 (the frame was buffering; no new information).

### The Kids Who Hacked Xbox (LZkl0_9xFOU)

- **0:00.** Very dark close-up of a car's body with a few specular edges.
- **0:15.** A macro shot of a circuit board: one chip in focus, capacitors around it, strong motion blur and shallow depth of field, cool teal light. *Staging:* the subject (hardware) introduced at a scale and with a lens the eye associates with real photography.
- **0:30.** A stylised human figure in medium close-up: long hair, glasses, and **a smooth face with no features**, in a warm lamp-lit room with soft points of light behind. *Staging:* the person is recognisable by hair, glasses and clothes; the absence of a face removes both the uncanny valley and any claim about likeness.
- **0:45.** Two spaces side by side: on the left a figure at a desk in a warm room with bookshelves; on the right a figure in a room lit orange-red. *Staging:* two characters in two places shown at once; each room has its own practical light colour.

### How an FBI Agent Infiltrated the KKK (wLFY_Zu_O08)

- **0:15 and 0:30.** A line of men in silhouette, hands on each other's shoulders, backlit by a few warm lights in otherwise total darkness; the figures are rim-lit, faces unreadable. A place-and-date caption ("Alabama / April 21, 2017") sits bottom-left in a light typeface; at 0:30 the title "Ku-Klux-Klan" appears top-centre in a serif. *Staging:* a group rendered as silhouettes against light; the lighting carries menace without any detail.
- **0:45.** A man in an olive t-shirt with a tattooed forearm, framed from the chin down so his face is out of frame, low-key light. *Staging:* an intimate close shot that again withholds the face, this time by framing.

### The Death of Educational Content on YouTube (-Gnrp_caPvo)

- **0:00.** A night street, wet asphalt, shop lights reflecting.
- **0:15.** Live-action footage of several people (a film clip) with a yellow subtitle, letterboxed. *Staging:* real media is cut in at its own aspect ratio with its own look; it is not restyled.
- **0:30.** A matte grey, featureless 3D figure sitting on the edge of a bed in a plain room with posters on the wall; soft, even light; nothing glows. *Staging:* a person in a room, told by posture and setting alone.
- **0:45.** A portrait-orientation real video (a man by the sea) pillarboxed on black. *Staging:* vertical source media kept vertical.

### Mapping the Trump Shooting (aVA7aXOH1pk)

- **0:00.** A white clay-model aerial view of the rally grounds (buildings, roads, a flag) with the on-screen warning "Graphic imagery. Viewer discretion is advised."
- **0:25.** The same clay-model world at ground level: the stage, figures in dark suits, one figure with a red cap, the crowd as white figures. Everything is matte white except a few coloured details. *Staging:* a forensic reconstruction look where geometry and positions are the point; colour is reserved for the few identifying details.
- **0:50.** Black frame (a cut).

### The Hunt for the King of the Dark Web (gq01C2kjMiM, 2023)

- **0:25.** A white, faceless mannequin-like figure stepping out of a silver sedan at an ornate iron gate; the car, the gate and the walls are rendered with realistic materials. *Staging:* the environment is realistic and specific, the person is stylised and anonymous. In 2023 the figure is plain white; by 2024 (Xbox) the figures have hair, clothes and skin tones but still no faces.
- **0:50.** Eight agency logos (FBI, BKA, NCA, Dutch police, others) laid out as hexagonal tiles on black. *Staging:* real identifiers used as evidence, arranged, not animated into a diagram.

### The Most Feared Kids on the Internet (88itHnh8eMI, 2026)

- **0:00.** Two small photographs of teenagers on black.
- **0:25.** The dark interior of a car; place-and-date caption bottom-left ("March 28, 2014 / Mississauga, Ontario").
- **0:50.** A 3D bedroom: a monitor on a desk shows a browser window drawn as a **glowing outlined wireframe** (a simplified luminous UI, not a screenshot); the room is lit pink-magenta; blinds and clutter behind. *Staging:* screens are shown as simplified glowing interfaces inside a real room with coloured practical light.

## 4. Interpretation: what makes the 3D storytelling work

These are inferences from the frames above and from the repeated patterns across the seven openings. They are what we take from fern, as *principles*, into our own visual language.

1. **Environments are specific and material; people are stylised and anonymous.** Seen in five of seven videos: realistic gates, cars, rooms, posters, circuit boards; figures with no faces (smooth, silhouetted, or framed out). The place carries credibility, the person carries role. Our adaptation: John has a hoodie, headphones and hands, and no face; his room has floorboards, a window, a shelf.
2. **Light comes from the scene.** Lamps, screens, a line of backlights, a pink bedroom. No frame showed objects glowing for decoration. Our adaptation: the only emissive things are LEDs, signal pulses, screens and the agent; everything else is matte and lit by those.
3. **Scale and position are told by the camera, not by labels.** The top-down plaza shot makes one person small; the clay reconstruction is an aerial first, then ground level. Our adaptation: establishing shots from above or from a doorway; the "elsewhere" of the data centre is a lit building far away that the camera travels to.
4. **Evidence is physical.** A photo is a lit panel in a dark room; a document is angled paper with readable type; logos are tiles; real footage keeps its own aspect ratio and look. Our adaptation: the existing `SourcePanel`/`MediaPanel` frames already do this; X06 makes them rise out of a machine in the 3D scene and return to it.
5. **Colour is reserved.** The clay reconstruction is white except a red cap; rooms have one dominant practical colour each. Our adaptation: blue is infrastructure, purple is the agent, red is threat, warm orange is the human's world; a frame is mostly dark.
6. **Place and time are stated quietly.** Lower-left captions with place and date, in a light face, appear twice. We have not adopted on-screen captions (the channel's rule is almost no text), but the convention is noted for episode work.
7. **Screens are simplified, luminous interfaces.** The bedroom monitor shows an outlined browser, not a screenshot. Our adaptation: the game and chat screens are painted as clean, readable interfaces, with real UI words only where the UI is the subject.
8. **Two places at once is a legitimate device.** The split frame at Xbox 0:45 shows cause and effect in parallel. Noted for future use; the experiments prefer travelling between places in one shot.

What I could not verify and therefore did not claim: fern's camera *movement* vocabulary over time (dolly speeds, how often the camera is static), its cutting rhythm, how it transitions between 3D and diagrams or maps, and how it stages crowds and vehicles in motion. Section 6 lists these as open.

## 5. Secondary sources: the studio and its process

From the catalogue inventory (sources listed there), not from first-hand inspection:

- fern started in July 2023, founded by the people behind the German channel Simplicissimus, with an Amsterdam office and a team across Europe. The studio's own about page lists a head of design, four art directors (one also a senior 3D animator), eleven 3D animators, twelve 2D motion designers, ten editors, a writer and set designer, a 3D thumbnail designer, a fact-checking team and sound design.
- In its own process video ("The Truth About fern", TlioXObelHU, 2026-07-22, summarised by a third party, not watched here) the studio describes 500 to 1,000 labour hours per video, around 30 projects in parallel, months of research with expert interviews, an editor-in-chief and fact-check pass, and two to four months of animation, music and sound.
- **No primary source names the software.** One secondary blog claims Blender; it cites nothing. Treat the tool question as unknown. This matters for us only as a reminder that the look comes from art direction (materials, light, staging), not from a package.

## 6. What this research could not establish

- Camera movement, pacing, cut lengths, and 2D/3D transitions inside the body of the films (stills only, first minute only).
- How maps, timelines and diagrams are integrated with reenactments.
- Crowd, vehicle and action staging beyond the two reconstruction frames.
- Any per-video statement of technique.

To close these gaps: watch the four priority videos in full (about two hours), noting timestamps of camera moves and 2D handovers, or connect the Claude-in-Chrome extension so a session can step through the public player in your own browser. The playbook marks every principle that relies only on interpretation.

## 7. How the findings were used

- `docs/cinematic/STYLE_LAB_CRITIQUE.md`: the existing lab measured against the principles above.
- `docs/CINEMATIC_VISUAL_LANGUAGE.md`: the principles turned into rules, each with the problem it solves, the fern observation behind it (where there is one), our adaptation, and the experiment that implements it.
- `src/scenes/cinematic/*`: the six experiments. X01 (a person in a specific room, lit by practicals), X02 (cause travelling along a physical route to a far place, one continuous camera), X03 (contrast by light: a dark room, one busy machine), X04 (mechanism shown physically, scale revealed by a crane), X05 (coverage made physical: a cage, a scanner, a machine outside), X06 (evidence as physical panels rising out of the scene).
