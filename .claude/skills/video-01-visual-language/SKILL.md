---
name: video-01-visual-language
description: The approved look of Video 01 (the rogue AI agents episode), "Legacy / Digital Noir": light figure, near-black void with grid floor, blue / purple / red semantics, locked cameras, story told on screens. Use this whenever you create, edit, review or render any scene, shot, diagram, evidence panel or thumbnail for Video 01 in this repository, when the user mentions John, the wrong project shot, X02, the noir theme, the holographic character, or asks for "the same style as the approved render", and before changing lighting, bloom, camera or the figure in a Video 01 scene. Not for other episodes or for the older Style Lab experiments.
---

# Video 01 · Legacy / Digital Noir

Video 01 has one approved reference shot, **X02 · The wrong project**. The user approved its direction and wants every other scene of the episode to look like it belongs next to it. They have rejected, more than once, scenes that moved the camera a lot, filled the frame with objects, or drifted from the legacy look. Consistency and clarity matter more than visual complexity.

This skill is scoped to Video 01. The style is provisional and editable; it is not a rule for other videos.

## Read first

1. `docs/VIDEO_01_VISUAL_LANGUAGE.md`: the guide. Exact tokens, character material, lighting, camera rules, animation grammar, 2D-versus-3D rules, anti-patterns, a step-by-step for new scenes and a review checklist. Read the sections that match the task; read sections 11 and 12 before building anything new.
2. `docs/video-01/SCENE_PLAN.md`: which treatment each remaining story beat gets.
3. Look at the reference frames before designing: `docs/video-01/frames/` (plain) and `docs/video-01/img/ref-0*.jpg` (annotated). Compare new frames against them side by side.

## Where things live

- Tokens: `src/styles/video01.ts` (`video01`). Theme: `noir` in `src/styles/themes.ts`.
- Kit: `src/components/video01/three.ts` (3D: `NoirStage`, `HoloPerson`, workstation parts, `screenInsert`, `noirRig`, `noirStage`) and `src/components/video01/index.ts` (2D: source and media panels, `AgentGlyph`).
- Reference implementation: `src/scenes/cinematic/02-wrong-project/` (`layout.ts`, `shot.ts`, `shot.json`, `WrongProjectScene.tsx`).

## The rules that matter most, and why

- **Build from the kit and the tokens; do not copy values or make new materials, figures or light rigs.** The reference shot reads the same tokens, so a scene built this way matches it by construction, and one edit to `video01.ts` retunes the episode.
- **Lock the camera. A close-up is a cut to an insert, and it must show something the wide shot cannot.** Camera travel was the user's main complaint about earlier work; the only movement allowed is a push of at most 0.07 m inside an insert.
- **The screen that carries the story is the brightest thing in the frame; the light figure is second.** The approved render had this backwards and it was the first thing the user asked to fix.
- **Few objects, each one touching what it stands on.** Justify every object; check contact from a second camera on a rendered frame (a floating monitor passed unnoticed in the editor).
- **Blue = people and ordinary systems, purple = an agent acting on its own, red = the moment of compromise.** Purple needs a visible source and rises with activity; red is spent once per idea.
- **Structure in the wide shot, readable text only in the insert.** Do not try to make a terminal readable from across the room, and do not label mistakes on screen.
- **Nothing moves to fill time.** Trim the beat instead. Everything is frame-driven through the beat engine so the presenter can hold on any checkpoint.
- **Real sources are framed, never restyled.**
- **A diagram does not need a person or a room.** Use 2D when it explains better (guide, section 10).

## Workflow

1. State what a muted viewer should understand, in four beats or fewer, and pick the treatment from the scene plan.
2. Build with the kit (guide, section 12 has the skeleton).
3. Check in the live Style Lab with `?theme=noir`, stepping through every beat with the right arrow, and take export-path stills (`npm run cine:stills -- <slug> --theme=noir --scale=1`) to judge the look on real frames.
4. Go through the review checklist at the end of section 12 on those frames. Do not report a visual problem as fixed unless a rendered frame shows it.
5. Give the user the localhost URL and wait for their go before rendering an MP4. They review in the browser first, and full renders are heavy on their machine.

## Changing the style

When the user asks for a change to the look itself, change the token or the theme, re-render the reference stills, and add a line to the change log at the end of the guide. If a rule changes, update the guide's anti-pattern table and this file together.
