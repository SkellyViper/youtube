import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Stage3D, useStageQuality} from '../../../components/cyber/three/Stage3D';
import {HoloFigure, type HoloFigureProps} from '../../../components/cinematic/three/HoloFigure';
import {HoloPerson} from '../../../components/cinematic/three/HoloPerson';
import {HorizonHaze, ObsidianFloor} from '../../../components/cinematic/three/LegacyStage';
import {paintRepoScreen, REPO_SCREEN_LAYOUT} from '../../../components/cinematic/three/repoScreen';
import {useScreenTexture} from '../../../components/cinematic/three/ScreenTexture';
import {CurvedMonitor, LowKeyboard, MeshChair, SlimMouse, StudioDesk} from '../../../components/cinematic/three/Workstation';
import {useActiveTime, useTimeline} from '../../../engine';
import {beatActiveStart, ShotLights, ShotObject, useMotion, usePractical, useShot, useShotRig, useShotStage, useVariant} from '../../../shot';
import {useTheme} from '../../../styles/ThemeContext';
import {CHAIR, DESK, KEYBOARD, MONITOR, MOUSE} from './layout';

/**
 * X02 · The wrong project (Style Lab V2 rebuild).
 *
 * What the viewer should understand, with the sound off: a developer is
 * working on his game with a coding agent; he sends the agent a request in
 * the terminal tab that happens to be active, cloud-ops, not his game; he
 * carries on; the agent keeps working there.
 *
 * Six objects on the legacy stage (void, horizon line, obsidian floor):
 *
 *   John       a seated man made of light (a sculpted CC0 base mesh, posed by
 *              code; blue: a person, not a system)
 *   chair      dark matter with one hairline of light, clearly its own object
 *   desk       slab and panel legs, a hairline of light on the front edge
 *   monitor    a curved ultrawide: the story happens on it
 *   keyboard, mouse
 *
 * The screen (components/cinematic/three/repoScreen.ts) is an ordinary
 * setup, split the way the story is: LEFT his game (my-game open in the
 * engine editor, a big game viewport, an empty spot where the new enemy will
 * live); RIGHT a terminal with two tabs, my-game and cloud-ops, cloud-ops
 * active. He asks his agent for a new enemy that hides, scavenges,
 * multiplies and ambushes the player; the agent goes looking for the game in
 * ~/cloud-ops, an infrastructure repo, and starts writing it there. Nothing
 * on the screen says "wrong".
 *
 * Two shots (shot.json, the camera track): A, the main still over the
 * shoulder; B, a terminal insert for the trigger beat only (a very slight
 * push-in), then back to A.
 *
 * Cues (shot motions, editable in the shot editor):
 *   type-prompt                                      wp-type   Establish (A)
 *   to-enter, submit, work-begins                    wp-send   Trigger (B)
 *   reach-mouse, look-at-game, focus-left,
 *   play-game, work-spreads                          wp-carry  Outcome (A)
 *   lean-back, work-everywhere, linger               wp-hold   Casual, ominous hold (A)
 */
/** John: the sculpted light figure (default), or the older procedural one (shot editor: developer → Model). */
const John: React.FC<HoloFigureProps> = (props) => (useVariant('person') === 'procedural' ? <HoloFigure {...props} /> : <HoloPerson {...props} />);

export const WrongProjectScene: React.FC = () => {
  const th = useTheme();
  const time = useActiveTime();
  const rig = useShotRig();
  const stage = useShotStage();

  // ---- the screen ------------------------------------------------------------
  const typed = useMotion('type-prompt');
  const submit = useMotion('submit');
  const working = 0.35 * useMotion('work-begins') + 0.35 * useMotion('work-spreads') + 0.3 * useMotion('work-everywhere');
  const focusLeft = useMotion('focus-left');
  const playing = useMotion('play-game');
  const linger = useMotion('linger');
  // Seconds since he pressed play (the knight's run starts from its beginning), on the same animation clock as `time`.
  const timeline = useTimeline();
  const play = useShot()?.state.motions['play-game'];
  const playClock = play ? Math.max(0, time - beatActiveStart(timeline, play.beat) - play.from) : 0;
  // The agent's spinner counts real seconds since Enter.
  const sent = useShot()?.state.motions.submit;
  const elapsed = sent ? Math.max(0, time - beatActiveStart(timeline, sent.beat) - sent.from) : 0;
  // Exports (and ?quality=full) paint the picture at 3072 px; the live Player at 2048 px (a 16 MB upload per frame is what slows an iGPU).
  const px = useStageQuality().name === 'full' ? MONITOR.px : MONITOR.pxPreview;
  const screen = useScreenTexture(px[0], px[1], (ctx, w, h) => paintRepoScreen(ctx, w, h, {time, theme: th, typed, submit, working, focusLeft, playing, linger, playClock, elapsed}));

  // ---- John ------------------------------------------------------------------
  const toEnter = useMotion('to-enter');
  const leanBack = useMotion('lean-back');
  const look = useMotion('look-at-game');
  const reach = useMotion('reach-mouse');
  const pose = {
    // Typing while he writes the task; then the right hand goes to Enter and strikes it.
    typing: (1 - toEnter) * (1 - reach),
    lean: 0.25 - 0.95 * leanBack,
    // Eyes on the terminal (to his right) while he types, then on his game (to his left), never back to the terminal.
    headYaw: -0.1 + 0.3 * look,
    headPitch: 0.12 - 0.06 * look,
    toEnter: toEnter * (1 - reach),
    tap: toEnter * (1 - submit),
    reach,
  };

  // ---- light from the terminal side of the screen -----------------------------
  const term = REPO_SCREEN_LAYOUT.terminal;
  const accent = 0.25 * submit + 0.5 * working + 0.45 * linger;
  const figureGlow = usePractical('figure-glow', th.tone.system.base);

  return (
    <AbsoluteFill>
      <Stage3D rig={rig} bloom={stage.bloom} fog={stage.fog} fogColor={stage.fogColor} background={stage.background} exposure={stage.exposure} shadows={stage.shadows}>
        <ShotLights />

        {/* The legacy stage */}
        <ShotObject id="horizon">
          <HorizonHaze />
        </ShotObject>
        <ShotObject id="stage-floor">
          <ObsidianFloor />
        </ShotObject>

        {/* The workstation */}
        <ShotObject id="desk">
          <StudioDesk desk={DESK} />
        </ShotObject>
        <ShotObject id="monitor">
          <CurvedMonitor
            monitor={MONITOR}
            deskY={DESK.top[1]}
            map={screen}
            tint={th.tone.system.base}
            glow="glow-screen"
            accent="glow-agent"
            accentTint={th.tone.mind.base}
            accentAt={[term.x + term.w / 2, term.y + term.h / 2]}
            accentLevel={accent}
          />
        </ShotObject>
        <ShotObject id="keyboard">
          <LowKeyboard keyboard={KEYBOARD} />
        </ShotObject>
        <ShotObject id="mouse">
          <SlimMouse position={MOUSE.position} />
        </ShotObject>

        {/* The person */}
        <ShotObject id="chair">
          <MeshChair chair={CHAIR} />
        </ShotObject>
        <ShotObject id="developer">
          <John position={CHAIR.floor} pose={pose} time={time} keyboard={[KEYBOARD.position[0], KEYBOARD.position[1] + KEYBOARD.keyTop, KEYBOARD.position[2]]} enter={KEYBOARD.enter} mouse={MOUSE.position} chair={CHAIR} />
          {/* He is light: a faint blue spill on the chair and the desk edge around him. */}
          <pointLight position={[CHAIR.floor[0], 0.95, CHAIR.floor[2] - 0.12]} intensity={0.5 * figureGlow.intensity} color={figureGlow.color} distance={1.3} decay={2} />
        </ShotObject>
      </Stage3D>
    </AbsoluteFill>
  );
};
