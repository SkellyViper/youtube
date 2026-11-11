# X02 · The wrong project (Style Lab V2 rebuild)

> **This shot is the reference implementation of Video 01's visual language.** The look, its tokens and the rules extracted from it are in [docs/VIDEO_01_VISUAL_LANGUAGE.md](../VIDEO_01_VISUAL_LANGUAGE.md); rig, stage, edge and figure levels now come from `src/styles/video01.ts`, and the stage is `NoirStage` from `src/components/video01`. The 2026-11-11 pass fixed the floating monitor, the figure's brightness, the mouse grip and a ghosting terminal line, and trimmed the export from 19.9 s to 18.0 s (before/after in that guide).

One scene, rebuilt: **John, a rookie indie game developer, gives his coding agent a task for his game, but the terminal tab that is active is another project; he carries on without noticing.** The old X02 (a pulse travelling out of a room, across a district and into a data hall) is gone; it is in git history (`git show 451ddb7:src/scenes/cinematic/02-wrong-project/WrongProjectScene.tsx`).

Where it lives: Style Lab → *Cinematic 3D* → **X02 The wrong project**, `http://localhost:5173/style-lab/cine-02-wrong-project` (shot editor: `…/cine-02-wrong-project/edit`). Same keys as everywhere: → next beat, ← previous checkpoint, R replay, F fullscreen. On laptops where Chrome runs on the integrated GPU, add `?quality=low` or switch Chrome to the discrete GPU.

## What the viewer should understand (sound off)

1. A man at his computer, making a game.
2. LEFT of the ultrawide: his game (`my-game` in the engine editor, a big game viewport). RIGHT: a terminal with two tabs, `my-game` and `cloud-ops`; `cloud-ops` is active.
3. He asks his agent for a new enemy (it *hides, scavenges to grow, multiplies, then ambushes the player*). The agent goes looking for the game's files inside `~/cloud-ops`, an infrastructure repo, and starts writing the enemy there.
4. He does not notice: he takes the mouse and presses play. The agent keeps running in cloud-ops.
5. He makes the game full screen. The terminal, still working, is behind it; the purple is gone from the frame. His posture does not change.

Nothing on screen says "wrong". The mistake is carried by structure: left = intention (the game, an empty spot where the new enemy will live), right = where the task went (active tab, `~/cloud-ops`, `README → staging + prod infrastructure`, `created ~/cloud-ops/enemies/scavenger.gd`, then `terraform`).

## The set: six objects on the legacy stage

| Object | Component | Job |
| --- | --- | --- |
| John | `HoloPerson` (`components/cinematic/three/HoloPerson.tsx`) | The subject: a seated man made of light. A sculpted CC0 base mesh (below), re-proportioned to an ordinary fit man (1.78 m), posed every frame by code: seated pelvis and thighs resting on the cushion, spine lean / slouch, two-bone IK arms, per-finger curls that land on the keys, Enter and a palm grip on the mouse. Holographic shader: dim core, fresnel rim, fine contour lines, sparse sparkles. No intersections (CPU-skinned clearance check over 8 poses: ≥ 0.6 mm everywhere). The older procedural figure (`HoloFigure`, raymarched) stays available as a variant. |
| Chair | `MeshChair` (`Workstation.tsx`) | He sits. Dark matter with one hairline of light, a mesh back that veils the body behind it: never merges with the light figure. |
| Desk | `StudioDesk` | Context. Slab on two panel legs, a hairline of light on the front edge. |
| Monitor | `CurvedMonitor` | The story. A 45" 1500R ultrawide; the picture is a canvas painted every frame (3072×1320 in exports, 2048×880 in the live Player). Practical lights: the screen glow and a purple accent behind the terminal that rises while the agent works. |
| Keyboard, mouse | `LowKeyboard`, `SlimMouse` | Support the actions (typing, Enter, taking the mouse). |
| Stage | `HorizonHaze`, `ObsidianFloor` | The legacy void, horizon line and obsidian floor. |

All dimensions: `src/scenes/cinematic/02-wrong-project/layout.ts` (desk, monitor, keyboard, mouse, chair envelope, both cameras).

### The figure asset

`public/models/john/john.glb`: derived from **Universal Base Characters** (Standard, free) by **Quaternius**, **CC0 1.0** (`public/models/john/LICENSE.txt`). Kept: the male body mesh, its 65-bone humanoid rig, the short side-parted hairstyle (same skeleton). Removed: eyes, eyebrows, textures, materials. At load the figure is re-proportioned (per-bone scales re-skinned, volume-preserving smoothing to remove the base's bodybuilder definition, forearm twist bones, one subdivision pass). References that informed it: featureless male mannequins and hologram figures (for silhouette and the light treatment), and seated adult-male anthropometry (seat-to-eye ≈ 0.79 m, seat-to-shoulder ≈ 0.60 m, elbow rest ≈ 0.23 m above the seat).

### The screen

`paintRepoScreen` (`components/cinematic/three/repoScreen.ts`), a pure canvas painter in a 2048×880 design space at any resolution.

- **Left, the game:** an engine editor (`my-game`): file dock (`enemies/scavenger.gd`, `player.gd`, `level_01.tscn`…), play controls, and a large viewport with his level (night sky, hills, platforms, the knight, coins) and a faint dashed creature half hidden behind a bush: where the new enemy will live. When he presses play the knight runs and a `▶ running` pill lights.
- **Right, the wrong repo:** a terminal, tabs `my-game | cloud-ops` (cloud-ops active), an earlier finished staging deploy above, the agent's prompt box, `~/cloud-ops` under it. After Enter: `Search(enemies/**) → No matches`, `Read(README.md) → cloud-ops · staging + prod infrastructure`, `Write(enemies/scavenger.gd) → created ~/cloud-ops/enemies/scavenger.gd`, later `terraform plan`, `terraform apply`. No real product name or logo.

## Shots and beats

| Beat | Shot | What happens |
| --- | --- | --- |
| `wp-type` · Establish, 4.2 s | A, main | His game on the left, the terminal on the right; he types the task (eyes on the terminal). |
| `wp-send` · Trigger, 4.5 s | B, insert | Tight on the terminal: the task sits in the prompt (`~/cloud-ops`, the active tab readable), Enter at 2.1 s, the agent's first lines show it working inside cloud-ops. A very slight push-in. |
| `wp-carry` · Outcome, 3.8 s | A | The agent keeps working on the right; he does not react: hand to the mouse, eyes to his game, click, play. |
| `wp-hold` · He forgets it, 3.6 s + 1 s final hold | A | The cloud-ops tab pulses purple, `terraform apply` is running, purple light on that side of the desk. At 1.4 s he makes the game full screen (0.35 s): the terminal and its light disappear behind it. He plays on; his posture does not change. |

Shot A: still three-quarter from behind his right shoulder (`SHOT_A`). Shot B: nearly frontal on the terminal, from just above and right of his shoulder (`SHOT_B`). The cuts are camera keys in `shot.json` (two cut keys, one push key), edited on the shot editor's timeline; **Code defaults** gives the single locked shot A. Cut keys sit 0.01 s into their beat so each checkpoint hold keeps its own shot.

## What is editable / reusable

- **Shot editor, no code:** every object (visibility, transform, material slots: desk top/legs/edge, monitor body/screen, chair frame/cushion/mesh/trim, figure core/rim, keyboard, mouse, floor, haze), John's model variant (sculpted / procedural), every light (Legacy neon rig with a low rim, screen glow, agent accent, figure spill), the two-shot camera track, stage look, beat durations and holds, every cue's timing and easing (`type-prompt`, `to-enter`, `submit`, `work-begins`, `reach-mouse`, `look-at-game`, `focus-left`, `play-game`, `work-spreads`, `work-everywhere`, `linger`, `fullscreen`).
- **Reusable components:** `HoloPerson` (any seated light figure: pose props, chair envelope, keyboard/Enter/mouse targets), `Workstation.tsx` (desk, curved monitor with any canvas and practical lights, keyboard, mouse, chair; all sized by props), `repoScreen.ts` (game editor + agent terminal; a pattern for other "story on the screen" shots).
- **Code:** what each cue means (the pose, what the screen shows), the screen's text.

## Preview and render

```bash
npm run dev                                                # then open the URL above
node scripts/dev/preview.mjs cine-02-wrong-project         # checkpoint screenshots + contact sheet (dev server running)
npm run cine:stills -- 02-wrong-project --theme=noir --frames=120,382,682,1000
npm run cine:render -- 02-wrong-project --theme=noir       # approved shot.json -> out/cinematic/02-wrong-project-noir.mp4 (18.0 s)
npm run cine:render -- 02-wrong-project --code-defaults    # single locked shot A
```

## Known limits

- His heels lift ~2 cm (the seat is high for a barefoot figure; hidden by the desk in shot A).
- The mouse is small for his hand: the palm grip covers most of it (the fingertips now end at its front edge instead of curling onto the desk).
- Contour lines are horizontal in figure space, so they run lengthwise along forearms and thighs.
- `HoloPerson` reads a few scene values it has no props for (desk front edge, mouse shape, cushion and backrest geometry) from the current layout.
