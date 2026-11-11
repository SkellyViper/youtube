# Video 01 · visual plan for the remaining scenes

A plan, not a build. Each row says which treatment a story beat gets in the Legacy / Digital Noir language ([guide](../VIDEO_01_VISUAL_LANGUAGE.md)), what is in the frame, and what it reuses. Nothing here is built yet except scene 1. Scene order and wording follow the episode outline; the script decides the final beats.

Treatments: **3D** = reenactment on `NoirStage` with the kit; **Insert** = a cut to a close-up inside a 3D scene; **2D** = diagram in the same palette; **Evidence** = source / media panel.

| # | Story beat | Treatment | The frame | Colour | Reuses |
| --- | --- | --- | --- | --- | --- |
| 1 | John sends the instruction to the wrong project | 3D + insert | Done: X02, the reference | Blue; purple arrives with the agent | |
| 2 | The agent keeps operating, unattended | 3D + insert | The same set from the same wide camera, **without John**: empty chair pushed back, the game still full screen and idle. The script decides how the terminal comes back into view (the game exits, or it is closed in an insert); when it does, it is still scrolling on the right. Insert on the terminal: tool calls arriving, the elapsed counter in minutes | The only light that moves is purple | X02's set, camera A and `paintRepoScreen` (longer transcript); `HoloPerson` omitted |
| 3 | Tests pass, the defect is not found | 2D | A row of checks resolving to "passed" one by one in bright cyan; one region of the system the checks never touch stays dark, then gets a single purple mark. No figure | Cyan for passed, purple for the untested part; no red yet | `tone.safe`, hairline diagram language; rework of the idea in `src/scenes/redesign/05-tests-pass` |
| 4 | A real AI security incident | Evidence | The primary source (report or article) as a panel, the relevant passage lit and the rest dimmed; a second panel (screenshot or clip) beside it if the narration compares | Blue frame; the source keeps its own colours | `SourcePanel`, `PassageHighlight`, `MediaPanel` |
| 5 | Hypothetical: an agent replicates | 2D (2.5D at most) | One agent mark on one machine outline; it copies to a second, then each copies again; the picture ends on a small, countable tree, not a swarm | Purple marks on blue-hairline machines | `AgentGlyph`, pictograms; rework of `redesign/04-replication` |
| 6 | AI worms and computing resources | 2D, then one 3D still | Diagram: copies drawing on a bar of available compute until it is full. Then one physical image to make it concrete: a single server rack on the stage, no figure, its lights going from blue to purple unit by unit | Purple filling blue; **red once**, when the capacity runs out | Diagram language; `Rack` (re-lit with `noirRig`, dark matter + hairline edges) on `NoirStage` |
| 7 | Security monitoring and containment | 2D + one insert | A scanner's coverage as a lit area moving over a plan of the system; what lies outside it stays dark (the blind spot), then the area is redrawn to include it and the purple marks are fenced one by one. Insert only if a real console action matters (a kill command in the same terminal interface) | Blue coverage, purple outside it, red only on what is confirmed compromised, back to blue when contained | Rework of `redesign/07-undetected` and `08-kill-switch`; `paintRepoScreen`-style painter for the console |
| 8 | Return to John | 3D + insert | X02's wide shot exactly (same camera, same set): John back in the chair. He leaves full screen and the terminal is there again, purple. Insert on the terminal: he reads what the agent did. Final hold on the wide | Blue, with the purple still present on the right until he acts | X02 entirely; new pose props and transcript |

## How the scenes connect

- **1 → 2**: direct cut on the same wide frame (scene 1 now ends on the full-screen game with no purple in the frame); only John is gone. The matched frame is the transition.
- **2 → 3**: cut from the terminal insert to the diagram; the terminal's rectangle becomes the diagram's frame (matched shape).
- **3 → 4 → 5**: short fades through the void (0.3 to 0.5 s). Evidence panels build and close with their own aperture; nothing else moves.
- **5 → 6**: the tree of copies stays in place and the compute bar draws in under it (continuity, no cut).
- **6 (rack) → 7**: direct cut.
- **7 → 8**: direct cut back to the wide shot of scene 1. The camera pose is identical, so the return is felt without a move.

## Constraints that apply to all of them

- The human figure appears only in scenes 1 and 8 (and, by its absence, in 2). Diagrams never get a figure.
- Three 3D sets at most for the whole episode: the workstation (scenes 1, 2, 8) and the rack (scene 6). No room, no city, no data hall.
- One wide camera per set, locked. Inserts are cuts. No new angles for variety.
- Red is used twice in the episode at most: capacity running out (6) and confirmed compromise (7).
- The existing X03 to X06 experiments and the ten redesign scenes are references for ideas only. They predate this language (travelling cameras, rooms, warm light, green and amber) and are not reused as they are.

## Suggested build order

1. Scene 2 (smallest step from the reference: same set, no figure, longer transcript). It proves the kit is reusable.
2. Scene 8 (same set, new poses).
3. Scene 4 (evidence panel in the `noir` theme, with the real source).
4. Scenes 3, 5, 7 (the diagram language, decided once and shared).
5. Scene 6 (the only new 3D object).

Each scene is reviewed on localhost before it is rendered.
