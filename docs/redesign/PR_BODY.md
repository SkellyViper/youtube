## Style Lab redesign: ten story-driven scenes, five visual identities, unified gallery

Builds on the existing engine and the original ten experiments (kept unchanged under **Legacy experiments**). Nothing is rendered to MP4 in this PR by request; the export command is ready (`npm run story:render`).

### What changed

- **Audit** of the original lab with contact sheets of every checkpoint and mid-beat frame; findings and the storyboards are in `docs/STYLE_LAB_REDESIGN.md`.
- **Build repair.** `.gitignore`'s `videos/` pattern had also matched `src/videos/`, so the episode definitions and lab registry were never committed and a fresh clone did not build. Reconstructed from their consumers; the pattern is now `/videos/`.
- **Ten redesigned scenes** (`src/scenes/redesign/`), each a continuous world with a cast list of what every object means: S01 developer, S02 wrong project, S03 keeps running, S04 replication (3D), S05 tests pass, S06 real source, S07 undetected (3D), S08 kill switch, S09 media insert, S10 callback.
- **Story kit** (`src/components/story/`): developer workspace, pixel-art game with a splitting enemy, agent chat with project tabs, recognisable machines in 2D and 3D, halls, cables and packets, night city, media insert, machine plan, themed backdrop and grade, 2D camera.
- **Five themes** (`src/styles/themes.ts`, React context, composition input prop): Neon Protocol, Infrared, Glacial, Ghost Terminal, Spectral. Materials, glow budget, bloom, fog, grain, panel style and backdrop change with the theme; motion does not. Shared agent/frame/panel components read the theme and fall back to the original neon tokens.
- **Gallery and viewer:** Episode scenes above Legacy experiments; Original | Redesign; theme chips; Compare off / vs Original / vs Theme with a synchronised follower Player (matching beat fraction); Present; Render copies the exact command. Selection lives in the URL.
- **Tooling:** `scripts/story.mjs` (render / stills / thumbs / sheet by scene × concept × theme), `scripts/dev/preview.mjs` (browser screenshots, no render), `scripts/browser.mjs` (offline / GPU-less rendering via `REMOTION_BROWSER_EXECUTABLE`, `REMOTION_GL`).
- **Tests:** `tests/story-lab.spec.ts` plus the existing suites; Playwright config accepts `PLAYWRIGHT_CHROMIUM` / `PLAYWRIGHT_GL` for CI without a GPU.

### How to review

```bash
npm install
npm run dev        # http://localhost:5173/style-lab
npm test
npm run story:render -- 04-replication --all-themes   # when you want MP4s
```

Keys in a scene: `→ ← R Space` beats · `O` concept · `T` theme · `C` compare · `F` present · `H` HUD.

### Contact sheets

`docs/redesign/checkpoints-neon.jpg` (all ten scenes × checkpoints), `docs/redesign/themes-s02-s04.jpg`, `docs/redesign/original-vs-redesign.jpg`.

### Known limitations

See `docs/STYLE_LAB_REDESIGN.md` §10: renders pending, verification done under SwiftShader, the OpenAI–Hugging Face capture and the NASA clip still need a networked machine.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_015mr2D1XeNAQCGMZ7EG3aZv
