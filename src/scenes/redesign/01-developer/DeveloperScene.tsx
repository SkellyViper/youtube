import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Curve2} from '../../../components/cyber/svg/curve';
import {Cable, Canvas, Packet, StoryBackdrop, Workspace, World, AGENT_SCREEN, GAME_SCREEN, DESK_Y, ease, lerp, seg, slimeSplit, type SlimeCopy} from '../../../components/story';
import {useActiveTime, useBeats, useCamera} from '../../../engine';
import {useTheme} from '../../../styles/ThemeContext';

/**
 * S01 · The indie game developer (2D).
 *
 * Cast:
 *   - the game        a side-scroller seen full frame: a knight (the player)
 *                     and a slime (the new enemy John is making).
 *   - the split       the slime's special move: it divides in two. It is the
 *                     mechanic John is building, and a quiet rhyme with S04.
 *   - the workstation John from behind, the game monitor, the agent monitor.
 *   - the agent chat  the coding agent writing code on the second screen.
 *   - the code packet a small packet that runs from the agent's screen along
 *                     the desk into the game: the agent's work *landing* in the
 *                     game as a third enemy. Cause (agent writes) -> effect.
 *
 * Beats:
 *   dev-game       full-frame game: the knight walks in, the slime splits.
 *   dev-pullback   the game becomes a monitor; the room appears; the agent is
 *                  already writing on the second screen.
 *   dev-agent      the agent finishes; a packet runs into the game; a new
 *                  enemy drops in.
 *   dev-hold       settle on the wide workstation. Warm game light, cool
 *                  agent light.
 */

/** From the agent monitor's stand, along the desk, up into the game monitor. */
const CODE_PATH = Curve2.route(
  [
    {x: AGENT_SCREEN.x + AGENT_SCREEN.w / 2, y: AGENT_SCREEN.y + AGENT_SCREEN.h + 30},
    {x: AGENT_SCREEN.x + AGENT_SCREEN.w / 2, y: DESK_Y - 30},
    {x: GAME_SCREEN.x + GAME_SCREEN.w / 2 + 240, y: DESK_Y - 30},
    {x: GAME_SCREEN.x + GAME_SCREEN.w / 2 + 240, y: GAME_SCREEN.y + GAME_SCREEN.h - 100},
  ],
  60,
);

const CAM0 = {x: 0, y: 0, zoom: 1.7};
const CAM_TRACK = [
  {beat: 'dev-pullback', to: {x: 140, y: -60, zoom: 0.5}, easing: ease.camera},
  {beat: 'dev-agent', to: {x: 420, y: -140, zoom: 0.64}, from: 0, until: 1.4, easing: ease.camera},
  {beat: 'dev-hold', to: {x: 90, y: -80, zoom: 0.47}, easing: ease.camera},
];

export const DeveloperScene: React.FC = () => {
  const th = useTheme();
  const time = useActiveTime();
  const b = useBeats(['dev-game', 'dev-pullback', 'dev-agent', 'dev-hold']);
  const cam = useCamera(CAM0, CAM_TRACK);

  // The knight walks in, then the slime splits.
  const walk = b['dev-game'].at(0, 1.0, ease.out);
  const split = b['dev-game'].at(0.9, 2.3, ease.linear);
  const bob = (phase: number) => Math.abs(Math.sin(time * 3.2 + phase)) * 3;
  const slimes: SlimeCopy[] = split < 1 ? slimeSplit(split, 120, 18, time) : [{x: 102, lift: bob(0), flip: true}, {x: 138, lift: bob(1.2)}];
  // The agent's code lands as a third enemy.
  const packet = b['dev-agent'].at(0.5, 1.7, ease.inOut);
  const drop = b['dev-agent'].at(1.6, 2.3, ease.out);
  if (drop > 0) slimes.push({x: 165, lift: lerp(60, bob(2.4), drop), squash: Math.sin(Math.PI * seg(drop, 0.7, 1)) * 0.5, opacity: Math.min(1, drop * 3)});

  const reply = b['dev-pullback'].at(0.6, 2.6, ease.linear) * 0.6 + b['dev-agent'].at(0, 0.8, ease.out) * 0.4;
  const typing = b['dev-hold'].progress > 0 ? 1 : b['dev-game'].at(0, 0.5);

  return (
    <AbsoluteFill>
      <StoryBackdrop intensity={0.5} />
      <Canvas>
        <World cam={cam}>
          <Workspace state={{time, game: {knightX: lerp(14, 48, walk), slimes}, chat: {tab: 0, reply, time}, typing, room: 0.9}} />
          {packet > 0 && packet < 1 ? (
            <>
              <Cable curve={CODE_PATH} color={th.tone.mind.base} lit={packet} width={6} conduit={false} />
              <Packet curve={CODE_PATH} t={packet} color={th.tone.mind.hot} size={10} tail={0.15} />
            </>
          ) : null}
        </World>
      </Canvas>
    </AbsoluteFill>
  );
};
