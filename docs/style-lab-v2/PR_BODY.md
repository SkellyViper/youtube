# Style Lab V2: legacy look, still cameras, and a shot editor

Course correction after the cinematic experiments: back to the Legacy Experiments look, a camera that stays still, far fewer objects, and a small **shot editor** in the Style Lab so a 3D shot can be refined property by property instead of regenerated. No new scenes. X01 is the proof of concept; nothing else was redesigned.

Stacked on `cinematic-3d-experiments` (its PR is not opened yet). Open that one first, or open this one against `main` to see both.

## What to look at

1. `npm run dev` → http://localhost:5173/style-lab → X01 → **Edit shot** (or `/style-lab/cine-01-john/edit`). Click things in the viewport, press → to play beats, try **Code defaults** (the original X01) and **Revert**.
2. `docs/STYLE_LAB_V2.md`: visual language, camera / lighting / object rules, the editor, the schema, save / export / render, limits, how to make another scene editable.
3. `docs/style-lab-v2/AUDIT.md`: the audit of X01–X06 against the legacy look (camera distances per beat, object counts, modelling defects, verdicts).
4. `src/scenes/cinematic/01-john/shot.json`: the whole art direction of the new X01 as a reviewable diff (75 property changes vs code).

## What changed

- **`src/shot/`** (new): typed, serializable shot configuration. Code declares objects (label, group, purpose, pivot, material slots, variants), lights (a reusable key / fill / rim / ambient / sky rig plus environment and practical lights), camera (locked by default), stage look and named timing cues; a sparse JSON patch overrides only what changed. `ShotObject`, `useLook`, `useVariant`, `useMotion`, `usePractical`, `useShotRig`, `useShotStage`, `ShotLights`, lighting presets (Legacy neon, Legacy night, Practicals only), patch validation and stable formatting.
- **Shot editor** (`src/player/lab/editor/`): hierarchy, inspector, beat strip, undo/redo, draft in browser storage, export/import JSON, **Save to repo** (dev-server endpoint that only writes `src/scenes/**/shot.json`), free inspection camera that never touches the shot camera, editor-only helpers. Uses the existing Presenter, so → / ← / R / F / checkpoints work unchanged.
- **One source of truth**: `shotComposition()` is what the gallery plays, the editor previews and Remotion renders; the `shot` input prop (editor draft or `--shot=file.json`) replaces the approved file; `calculateMetadata` follows retimed beats.
- **Editable components**: room split into parts, desk / monitor / keyboard / mouse / lamp / chair / figure read material slots; chair is its own object; developer variants *stylised figure* and *light-dot hologram*; `refined` figure (IK arms with real proportions, thighs on the seat, hood clear of the chair, hands stay on the keyboard when moved). Old scenes (X02–X06) render as before.
- **Legacy stage** components: `HorizonHaze`, unlit `ObsidianFloor` with a shadow catcher and fading grid.
- `Stage3D`: bridges the shot context, supports orthographic shots.
- `scripts/cine.mjs`: `--shot=<file>` and `--code-defaults`.
- Tests: `tests/shot-editor.spec.ts`.

## Verification

- `npm run typecheck`: clean.
- `tests/shot-editor.spec.ts`: 9/9 in a real GPU Chromium. Pixel differences are measured in the page, not assumed: a transform edit changes the viewport, undo and reset return it to the same pixels; hiding the desk, a red rim light and a preset all change it; with the camera locked the upper band of the frame is **pixel-identical** at the checkpoints of beats 1 and 3 (mean difference 0.000), unlocked it moves (1.9); retiming `jc-game` 2.8 → 4 s adds exactly 72 frames to the presenter timeline; a draft survives a reload; export → code defaults → import restores it; → / ← work inside the editor.
- Full suite (`npm test`): 81 passed (9.4 min): the 72 existing tests (timeline, presenter, Style Lab, story, cinematic: all six experiments walked beat by beat) plus the 9 editor tests. `vite build` passes.
- Renders (1920×1080, 60 fps, H.264, each checked by `verify-video`): approved X01 852 frames PASS; one-property draft (`docs/style-lab-v2/examples/x01-hide-agent-monitor.shot.json`) 852 frames PASS; code defaults 900 frames PASS (the original timing).
- The one-property draft differs from the approved render only where it should: at frame 558, 9.5 % of pixels changed, nothing outside x 472–1573, y 256–1079; inside that box the amplified difference image shows the monitor itself and the violet light it threw on John, the desk and the chair. The sky and horizon line are untouched. `python scripts/dev/frame-diff.py` reproduces this.
- Camera in the MP4s: across the four checkpoints the top band of the approved render differs by 0.37/255 (film grain only) and the whole frame by 1.0–1.6 (the action); in the code-default render the same band differs by 5.7–14.3 and the frame by 9.7–29.4.
- Inspected by eye: contact sheets of the approved render and of every editor iteration (the glossy-floor and desk-glare failures are described in `docs/STYLE_LAB_V2.md` §9). No intersections in the approved framing; the figure still reads as built from primitives (documented, next step).

## Not in this PR

Viewport drag gizmos, adding objects / GLB models from the editor, editing the beat list, multi-key camera paths, converting X02–X06 (part of their redesign), final character art. Blender was evaluated and not adopted yet (reasons in `docs/STYLE_LAB_V2.md` §8).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
