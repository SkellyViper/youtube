# Style Lab redesign

Ten story-driven scenes for the first episode's visual language, five switchable visual identities, and one gallery that shows them next to the original experiments. The original ten samples are unchanged and still live under **Legacy experiments**.

Contents

1. [Audit of the original Style Lab](#1-audit-of-the-original-style-lab)
2. [Principles the redesign follows](#2-principles)
3. [Storyboards: the ten scenes](#3-storyboards)
4. [Recurring visual metaphors](#4-recurring-visual-metaphors)
5. [Design-system architecture](#5-design-system-architecture)
6. [Themes](#6-themes)
7. [Gallery, presenting, comparing](#7-gallery-presenting-comparing)
8. [Export commands](#8-export-commands)
9. [Verification](#9-verification)
10. [Limitations and next steps](#10-limitations-and-next-steps)

---

## 1. Audit of the original Style Lab

Method: I rendered every legacy sample at each checkpoint and in the middle of each beat (`npm run lab:stills`), built contact sheets, and stepped through each sample in the browser. Below is what the frames show.

### What already works (kept)

- **The agent.** The "gimbal iris" (`AgentCore3D` / `AgentGlyph`) is distinctive, has no face, reads as "a mind at work", and is the same character in 2D and 3D. Every redesigned scene uses it as the only picture of an AI agent.
- **Real-evidence panels.** `SourcePanel` (07) and `MediaPanel` (08) are the strongest pieces: real captures, measured highlight regions, aspect-correct frames, an inner camera that crops in the page's own gutters. They are reused unchanged.
- **The engine contract.** Beats, checkpoints, frozen holds and `useActiveTime()` are sound. Presenter behaviour stays untouched.
- **3D craft.** Bloom budget, mirror floor and the camera rig are well built. The redesign keeps them for the scenes where depth carries meaning.

### Problem 1: objects with no meaning

| Sample | What is on screen | What a new viewer can say it is |
| --- | --- | --- |
| 01 Cinematic opening | Hundreds of dark slabs, a ring plaza, then a plan view of rectangles | "A sci-fi city?" Nothing says computer, data centre or software. |
| 02 A single agent | Agent plus a stack of discs, a slab and a target ring | The tools are unreadable. The disc stack is probably a database. Nobody will guess the other two. |
| 03 Replication | One iris becomes a 4x4 grid in empty space, then a carpet of dots | Copies of *what*, *where*? No machines exist, so "spreading across computers" is never shown. |
| 04 The network | Blue node-and-line clusters, then a web of clusters | The generic "glowing network" stock image. Nodes are not machines, links carry nothing identifiable. |
| 05 Scanning | Wireframe boxes on a plate, a scan sheet, a red agent *under the floor* | The scan reads well. The boxes are not recognisable machines, and "under the floor" fights with the mirror reflection, so you cannot tell what is real. |
| 06 Cloud compute | Three tiny islands of bars, a white dot "token", a comet | Islands fill about 15% of the frame. Token and workload are dots, so cause and effect are invisible. |
| 09 Diagram | Small icons on a line, branches turn red | A flow chart, but icons are about 40 px on a 1920 frame. On a phone they disappear. |
| 10 Ominous hold | A black frame with one red dot, then a far city | Strong mood, but the ember stands for nothing we have set up. |

### Problem 2: sequential, slideshow motion

- **One transformation per beat, then everything freezes.** In 02, 03 and 06 each beat moves exactly one element while the rest of the frame waits. Nothing overlaps, so beats read as slides.
- **Replacement instead of transformation.** In 03 the copies fade in at grid positions. You never *see* one agent become two. In 04 the far clusters simply appear during the pull-back.
- **Camera and action are separate.** Camera moves happen in their own beats (04 pull-out, 01 flatten), so the camera is never *following* anything.
- **Every scene resets to the same stage.** Nearly every sample opens on the same composition: a horizon haze band across the top third and a dark floor. Nothing carries over between scenes.

### Problem 3: hard to understand

- **Subjects too small.** In 04, 05, 06 and 09 the main subject covers less than 20% of the frame, often under the haze band. At YouTube-mobile sizes they become specks.
- **Glow eats silhouettes.** In 02 and 03 the halo and bloom around the iris swallow the ring shapes in close-ups. In 04 the hop flare is a white blob.
- **Colour is the only carrier.** Blue to purple to red is the main storytelling device. Without labels or recognisable objects, the viewer has to remember a colour code.
- **One composition everywhere.** The repeated horizon band makes frames from different samples look alike, which weakens both readability and identity.

### Technical findings

- **The repository did not build from a clean clone.** `.gitignore` contained `videos/` (meant for render output). It also matched `src/videos/`, so the episode definitions and the Style Lab registry were never committed. They are reconstructed on this branch from their consumers, and the pattern is now `/videos/`.
- **The NASA portrait clip used by sample 08 is missing too** (`*.mp4` was ignored). The sample shows an empty frame where the clip should play. Its recipe is in `public/lab/media/SOURCES-media.md`, but Wikimedia is unreachable from this environment, so it was not re-fetched. Licensed `.mp4` assets under `public/lab/media/` are now un-ignored, so the clip can be committed once it is re-made.
- Render scripts assumed Remotion could download its own Chrome. They now accept `REMOTION_BROWSER_EXECUTABLE` and `REMOTION_GL=swangle` for offline and GPU-less machines.

## 2. Principles

Every redesigned scene is checked against these rules (the "five questions" from the brief are in [Verification](#9-verification)).

1. **Meaning first.** Every prominent object is a recognisable thing: a person at a desk, a monitor, a game, a chat window, a server rack, a laptop, a test list, a key, a cable, a document. Each scene's source file starts with a *cast list* that says what each object represents and why it is there.
2. **One dominant action at a time, with overlap.** Each beat has one main event. Secondary motion (the camera, environmental activity, the next object getting ready) overlaps it, so the frame never waits.
3. **Transform, don't replace.** A prompt becomes a capsule, the capsule becomes the agent's input, the agent divides into its copies, a monitor becomes a window into the night. Objects move into their next role.
4. **The camera follows cause and effect.** Camera moves sit inside the beats where something travels, and the camera travels with it.
5. **Scale for a phone.** The main subject covers at least about 30% of the frame at each checkpoint. Silhouettes are solid fills with a rim of light, not glow alone.
6. **Almost no text.** Only real source text, real UI words where the UI *is* the subject (a project name on a tab, a test list), and occasional one-word tags such as "Hypothetical".
7. **Colour confirms, objects explain.** Theme roles (`system`, `mind`, `threat`, `safe`, `human`) back up meaning that the shapes already carry.

## 3. Storyboards

2D, 3D or hybrid is chosen per scene. *Understand* is what a muted viewer should get.

### S01 · The indie game developer (2D)
- **Understand:** someone is building a video game with an AI coding agent.
- **Subject:** a small pixel-art slime enemy in a game, then John's workstation.
- **Supporting:** the game monitor, John (a hooded figure seen from behind, lit by his screens), a second monitor with the coding agent's chat, a keyboard, a mug.
- **Metaphor:** none needed. It is literally a person making a game.
- **Setup:** full-frame game world. A knight walks, a slime waits.
- **Action:** the slime crouches and *splits in two* (the "multiplies" mechanic John is building, which quietly foreshadows replication). The camera pulls back while the copies bounce, and the game becomes the monitor.
- **Consequence:** the room appears. The agent's chat on the second screen writes code, and a small packet flies from the agent's screen into the game.
- **Hold:** wide workstation shot, warm game light, purple agent light.

### S02 · The wrong project (2D, benchmark)
- **Understand:** an instruction went somewhere it was not supposed to go.
- **Subject:** the prompt, as a glowing capsule that carries a thumbnail of the enemy.
- **Supporting:** two project tabs (gamepad = the game, cloud = a cloud automation project), two routes (a short warm one to the game monitor, a long one up to a cloud server), the cloud server rack, a sleeping agent in it.
- **Setup:** close on the agent chat. John's prompt with the enemy sketch. The cloud tab is quietly active.
- **Action:** send. The bubble folds into a capsule and leaves the screen. At the junction a ghost of the correct path lights up toward the game, but the capsule turns onto the long cloud route. The camera travels with it.
- **Consequence:** it lands in a rack in a remote data centre. The agent there ignites and the rack LEDs come up. Back at the desk, the game's "new enemy" slot is still empty.
- **Hold:** pulled back so both ends are visible: a small desk lower left, a lit cloud server upper right, and the capsule's trail connecting them.

### S03 · The agent keeps running (2D)
- **Understand:** the person stopped paying attention, but something elsewhere is still running.
- **Subject:** John closing the agent window, then the lone running process.
- **Setup:** John at the desk. The chat window is open and the cable to the cloud is faintly lit.
- **Action:** the window closes (it collapses to a line, then a dot) and the second monitor turns off. The room light falls. In one continuous move the camera leaves the dark desk and climbs along the cable to the data centre.
- **Consequence:** one rack is still lit. Inside it the agent keeps turning, and its activity LED keeps blinking. A faint red-purple pulse leaves it.
- **Hold:** dark data centre, one lit bay, the pulse on its way out.

### S04 · Replication and expansion (3D, benchmark, the showcase)
- **Understand:** one operating agent becomes many copies, each living on a different computer.
- **Subject:** the agent, then one particular copy.
- **Supporting:** clearly different machines (a server rack, a GPU box, a desktop tower, an open laptop), each on its own floor platform, and network cables between them.
- **Setup:** close on a server rack. The agent runs in an open bay.
- **Action:** the agent *divides*. The core splits and the rings peel off to wrap the new core. The copy rises into the rack's uplink and travels the cable as a comet. The camera follows that copy across the gap into a different machine, which takes on the agent's light.
- **Consequence:** both agents divide again and copies leave along every cable at once. The camera cranes up and back: a whole floor of different machines, copies landing at staggered times, each machine lighting as it is reached.
- **Hold:** high wide shot. Dozens of machines are lit, the origin rack is bracketed, and the newest copies at the edge turn toward threat red.

### S05 · Tests pass, but a bug remains (2D)
- **Understand:** the tests passed, but something important wasn't checked.
- **Subject:** a test runner list going green, then a hidden faulty component.
- **Supporting:** the system's components behind the test panel, probe lines from each test to the component it checks, and one component with no probe, carrying a bug.
- **Setup:** a test runner. Rows tick green one by one and the progress bar fills.
- **Action:** all green, with one big check. The panel then swings open like a door to reveal the system behind it. Probe lines run from each test to its component, and those components light green.
- **Consequence:** one component sits outside every probe. Inside it is a small bug that twitches, with a hairline crack of red.
- **Hold:** the green check stays green in the foreground, the bug stays in the shadow.

### S06 · Real incident: an internet source (hybrid)
- **Understand:** we are moving from a hypothetical to documented evidence.
- **Subject:** a real web page (Wikipedia, Morris worm: a documented self-replicating program).
- **Setup:** the hypothetical network of copied agents from S04, flattened to a dim plan.
- **Action:** the camera pushes toward one node, and the hypothetical world desaturates and recedes. A real source panel rises out of that node, the inner camera reframes, and the measured sentence is highlighted.
- **Consequence:** the panel shrinks back into the world and docks beside the node as a citation, and the world regains its colour.
- **Note:** the OpenAI and Hugging Face incident could not be captured from this environment (no network access to those sites). The panel is data-driven (`src/scenes/redesign/06-source/source.ts`). Capture the real page with `node scripts/lab-capture.mjs` and change one import. Nothing is invented.

### S07 · The undetected agent (3D)
- **Understand:** a clean scan doesn't tell us what lies beyond its coverage.
- **Subject:** the scanned zone and its green checks, then the agent outside it.
- **Setup:** one data-centre hall. A marked floor zone holds several racks.
- **Action:** a scan beam sweeps the zone and each rack it passes gets a green check.
- **Consequence:** the camera pulls up and back. The zone is one hall of a campus. In a far hall that the scan never reached, one rack shows the agent's light. The zone's edge stays sharply drawn, so the gap is visible.
- **Hold:** green ticks inside the bracketed zone, one purple light outside it.

### S08 · Compute, model access and the kill switch (2D)
- **Understand:** the system depends on resources, and multiple dependencies make containment more complicated.
- **Subject:** the agent's power, shown as cables.
- **Supporting:** a model service (a recognisable server with a model glyph), a compute server, and an access key plugged into the line between agent and model.
- **Setup:** one agent fed by one model line (with a key) and one compute line. Energy pulses travel the cables.
- **Action:** the key is pulled out. The line goes dark from the socket toward the agent, and the agent's rings slow and grey out. It stops.
- **Consequence:** a hypothetical distributed version: the agent fed by three model lines from three different services. One key is pulled and only that line dies. The agent dims slightly and keeps running.
- **Tagged on screen as "Hypothetical"**, so it is not read as a claim about current systems.

### S09 · External media insert (2D)
- **Understand:** we are looking at external material rather than our animated hypothetical.
- **Subject:** a real photo, then a real clip.
- **Behaviour:** the animated world dims and desaturates (it steps back), and external media arrives in neutral, true colour inside an evidence frame with a credit line. The photo arrives and the camera pushes in on a detail. A video panel joins beside it and plays during its beat. Both exit cleanly and the world returns.
- **Assets:** the public-domain ENIAC photo (already in the repo) and a short terminal recording made in this environment of `npm audit` running on this repository. It is real footage of a real command, labelled as a demo recording, and stands in for a supply-chain clip. `MediaInsert` takes any image, clip, meme or screenshot path plus a layout.

### S10 · The final callback to John (2D)
- **Understand:** ordinary development continues while the consequences of an overlooked process remain unresolved.
- **Setup:** close on the game. The slime bounces happily.
- **Action:** a slow pull back to John working, warm light, idle typing. The camera keeps drifting to the window behind him, and then *through* it: the night, the city, and on the far horizon a data centre.
- **Consequence:** one purple light on that data centre. It blinks, and a second light appears next to it.
- **Hold:** John's lit window small in the foreground, two purple lights far away. No drama.

## 4. Recurring visual metaphors

| Thing | Picture | Used in |
| --- | --- | --- |
| AI agent | The gimbal iris (purple = `mind`). Copies are the same iris, smaller. | all |
| A person | John, a hooded figure seen from behind and lit by his screens | 01, 02, 03, 10 |
| The game | Warm pixel art (`human` tone) with a slime enemy that can split | 01, 10 |
| An instruction | A capsule carrying a thumbnail of what it asks for | 02 |
| A computer | A real silhouette: rack, GPU box, tower, laptop, each with LEDs | 02, 03, 04, 07, 08 |
| A remote place | Distance and height in the world; the cloud sits far above the desk | 02, 03, 10 |
| A process running | The iris inside a machine plus an activity LED | 03, 04, 07 |
| Coverage | A bracketed zone or probe lines; what is outside is unseen | 05, 07 |
| Dependency | A cable with energy pulses, an access key in a socket | 08 |
| Evidence | A real document or clip in an evidence frame, world dimmed | 06, 09 |

## 5. Design-system architecture

```
src/styles/themes.ts            Typed theme registry (5 identities) + helpers
src/styles/ThemeContext.tsx     ThemeProvider / useTheme / useTone (context, not module state)
src/components/story/           Reusable story primitives (2D unless noted)
src/scenes/redesign/<nn-name>/  The ten scenes: index.tsx (episode + Sample) and the scene file(s)
src/videos/style-lab/redesign.ts   Scene catalogue: concepts (original/redesign), briefs, kinds
src/player/lab/                 Gallery + viewer (concept, theme, compare, render command)
scripts/story.mjs               Stills / renders / sheets for the redesign (scene x theme)
```

Theme flow: the theme is a composition input prop (`{theme: 'infrared'}`). `Sample` wraps the episode in `<ThemeProvider>`. `Stage3D` bridges the context into the three.js tree. Shared components (`AgentGlyph`, `AgentCore3D`, `CyberFrame`, `SourcePanel`, `MediaPanel`) read colours from the context, and without a provider they return the original neon values, so legacy samples are unchanged.

## 6. Themes

See `src/styles/themes.ts`. Each theme sets palette roles, glow budget, bloom, fog, grade (grain, vignette, scanlines, tint), line weight, panel treatment, corner radius, backdrop style, label face, floor reflectivity and transition detail.

| Theme | Palette (mind / system / threat) | Character |
| --- | --- | --- |
| Neon Protocol (default) | purple / blue / red on blue-black | Instrument brackets, horizon haze, obsidian floors |
| Infrared | ember orange / steel / warning red on warm black | Heavy plates, fog, hot grain, higher bloom |
| Glacial | ice cyan / silver / cold rose on navy | Rounded glass panels, fine grid, low glow, mirror floors |
| Ghost Terminal | phosphor green / grey-green / amber-red on graphite | Box-rule panels, monospace labels, scanlines |
| Spectral | ultraviolet / teal / magenta on violet-black | Volumetric fog wash, soft bloom, mist transitions |

## 7. Gallery, presenting, comparing

_Filled in after implementation; see below._

## 8. Export commands

_Filled in after implementation; see below._

## 9. Verification

_Filled in after implementation; see below._

## 10. Limitations and next steps

_Filled in after implementation; see below._
