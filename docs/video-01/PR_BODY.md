# Video 01 · Legacy / Digital Noir: lock the look from the approved Wrong Project render

Stacked on `style-lab-v2`. The first commit is the X02 rebuild exactly as it produced the approved `02-wrong-project-neon.mp4`; the second is this pass. Review the second commit for the changes.

## What this does

1. **Fixes the approved shot without redesigning it.** Same figure, palette, two shots and screen content.
2. **Extracts its look into tokens, a theme, presets and a small kit** that the shot itself now reads.
3. **Documents the language** for future sessions (guide, annotated frames, scene plan, an episode-scoped skill).
4. **Adds the style to the Style Lab** next to the existing themes and experiments.

## Fixes to X02 (before / after in `docs/VIDEO_01_VISUAL_LANGUAGE.md` §1)

| Problem | Fix |
| --- | --- |
| Monitor floats: the neck stopped 28 mm above its plate, the plate overhung the desk | Neck stands on the plate and enters the housing; plate fully on the desk |
| Stray white dash right of the monitor | The power LED follows the panel's curve |
| Figure brighter than the monitor (torso mean luma 59 vs 61 for the game, brighter peaks) | Rim 2.0 → 1.25, core 0.4 → 0.32, spill 0.5 → 0.35 (torso 38 vs 60) |
| Fingers overshoot the mouse and curl onto the desk; mouse glows purple | Wrist 64 mm behind the mouse (palm grip), matte shell |
| An arriving terminal line ghosts over the line above (insert) | The row opens, then the text fades in |
| 1.9 s of dead time in the export | Beats 4.5 / 4.5 / 4.5 / 4.5 → 4.2 / 4.5 / 3.8 / 3.6 s (19.9 → 18.0 s). Presenter holds unchanged |

No camera key was added or moved (asserted in `tests/video01.spec.ts`).

## Ending changed (user direction during the pass)

He no longer leans back. In the last beat he makes the running game full screen: it grows over the editor and the terminal (`fullscreen` cue, `repoScreen.ts`), the agent's purple light leaves with its source, and he plays on in the same posture. Show, not tell: nothing says he forgot the agent.

## New

- `src/styles/video01.ts`: the episode's tokens (figure, light, stage, edges, camera limits, motion timings).
- `noir` theme (`src/styles/themes.ts`): the lab palette frozen for the episode; `safe` is bright cyan (no green). `--theme=noir` in `cine.mjs` / `story.mjs`, `?theme=noir` and a theme button in the viewer.
- `src/shot/presets.ts`: `noirRig()`, `noirStage()`, lighting preset "Legacy / Digital Noir · Video 01" (shot editor).
- `src/shot/cameras.ts`: `screenInsert()` computes a close-up camera on a region of a flat or curved screen.
- `src/components/video01`: `NoirStage` + `noirStageObjects()`, and two barrels (`three.ts` 3D, `index.ts` 2D) re-exporting the pieces the reference shot is built from (`HoloPerson`, workstation, screen painter, source / media panels).
- Style Lab gallery: a "Video 01 · Legacy / Digital Noir" section with the reference shot, colour roles and rules read from the tokens.
- `docs/VIDEO_01_VISUAL_LANGUAGE.md`, `docs/video-01/SCENE_PLAN.md`, `docs/video-01/frames` + `img`, `scripts/dev/annotate.py`.
- `.claude/skills/video-01-visual-language/SKILL.md` (episode-scoped; other skills untouched).

## Verification

- Source reproduced the approved MP4 before the pass (PSNR 39 dB at four frames = codec error).
- Refactor onto the kit and the `noir` theme is pixel-identical to the fixed scene under `neon` (PSNR ∞ at two frames).
- Corrected render: `out/cinematic/02-wrong-project-noir.mp4`, 1080 frames, 18.000 s, 1920×1080, 60 fps, decodes clean (`verify-video`).
- Contact (stand, hand) checked from debug cameras via `cine:stills --shot=`.
- `npm run typecheck`, `npm run build`, `npm test` (see the PR conversation for the run).

## Not in this PR

- No other scene of the episode is built (plan only).
- X03 to X06 and the 2D redesign scenes are untouched.
- The mouse is still small under his hand; the figure's heels still lift about 2 cm (hidden in the wide shot).
