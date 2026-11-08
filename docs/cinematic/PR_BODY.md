# Cinematic 3D experiments: Fern-informed reenactments in our own Tron-lit language

Six physically staged 3D scenes for the Style Lab, a third gallery concept ("Cinematic 3D") beside Original and Redesign, the research and playbook behind them, render/preview tooling and tests. Nothing existing is removed: the ten legacy samples and the ten 2D redesign scenes are untouched and still open from the same gallery.

## What to look at

1. `npm run dev` → http://localhost:5173/style-lab. The new section is at the top. Open **X02 The wrong project**, press `→` four times. Then press `O` to switch to the 2D Redesign of the same scene, and `C` to see both side by side.
2. `out/cinematic/*.mp4` after `npm run cine:render -- all` (six MP4s, 1920×1080 @ 60 fps, verified), and `out/cinematic/contact-sheet.jpg`.
3. The documents: `docs/FERN_VISUAL_RESEARCH.md` (what was actually inspected, with the honest coverage limit), `docs/cinematic/STYLE_LAB_CRITIQUE.md`, `docs/CINEMATIC_VISUAL_LANGUAGE.md` (the playbook), `docs/cinematic/QUALITY_REPORT.md` (scores, what worked, what is weak).

## The six experiments

| # | Experiment | What a muted viewer understands | Technique tested |
| --- | --- | --- | --- |
| X01 | John at his computer | A developer builds a game at night with an AI on the second screen | establishing shot, over-the-shoulder, practical light, faceless figure |
| X02 | The wrong project | The instruction went down the wire to a different machine than he meant | follow shot along a physical route, one continuous move across two places |
| X03 | The process that did not stop | He closed his work and the room went dark; elsewhere a machine kept working | contrast by light, single continuous sequence |
| X04 | One agent becomes a swarm | One process copied itself into other machines, then other buildings | mechanism shown physically, crane reveal of scale |
| X05 | The scanner misses something | The scan covered its area; the machine that mattered was outside it | coverage made physical (a cage, a scanner, a closet), perspective change as argument |
| X06 | Real evidence in a cinematic environment | We leave the reenactment for documented sources and come back | 2D/3D handover, readable sources, return to the world |

## Architecture

- `src/components/cinematic/`: world geography (`world.ts`, `route.ts`), room, desk, developer, racks, data hall, cage, closet, crash cart, campus, deterministic canvas screen painters. Procedural geometry only, themable through the existing five themes, no assets.
- `src/scenes/cinematic/01..06`: the experiments (episode + layers, same engine contract as everything else).
- `src/player/lab/family.ts`: a scene family = Original | Redesign | Cinematic; the viewer and URL state (`concept=cinematic`, `compare=concept:redesign`) use it.
- `scripts/cine.mjs` (`npm run cine:render|stills|thumbs|frames|sheet`), `scripts/dev/preview.mjs` (now Windows-ready, ffmpeg contact sheets).
- `Stage3D` gained an opt-in `shadows` prop (off by default; legacy unchanged).
- `tests/cinematic-lab.spec.ts`.

## Research honesty

YouTube serves about 45 seconds of a video to an automated browser before the player errors; I did not work around that. First-hand observations cover the openings of seven fern videos (all four priority videos included) plus a full 147-video catalogue inventory; camera-movement and pacing rules in the playbook are marked as inferred. Details in `docs/FERN_VISUAL_RESEARCH.md`.

## Verification

See `docs/cinematic/QUALITY_REPORT.md` → "Verification done" for the render table, the test results and what was inspected by eye.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
