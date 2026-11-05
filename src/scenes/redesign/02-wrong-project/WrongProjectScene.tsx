import React from 'react';
import {AbsoluteFill} from 'remotion';
import {
  Cable,
  Canvas,
  GamepadIcon,
  Hall,
  Packet,
  PromptCapsule,
  StoryBackdrop,
  Workspace,
  World,
  clamp01,
  ease,
  lerp,
  seg,
  smooth,
} from '../../../components/story';
import {useActiveTime, useBeats, useCamera} from '../../../engine';
import {alpha} from '../../../styles/cyber';
import {useTheme} from '../../../styles/ThemeContext';
import {BAY_Y, CLOUD, EXIT, GHOST, HALL, JUNCTION} from '../shared/deskWorld';

/**
 * S02 · The wrong project (2D, one continuous world).
 *
 * Cast (what each object stands for, and why it is here):
 *   - agent chat window   where John talks to his coding agent. Two project
 *                         tabs: "my-game" (gamepad) and "cloud-ops" (cloud).
 *                         The cloud tab is the active one. That is the mistake.
 *   - prompt capsule      John's instruction. It carries a thumbnail of the
 *                         enemy, so what it asks for is visible without text.
 *   - junction            where the capsule chooses a destination.
 *   - ghost route         the short path to the game monitor: where the prompt
 *                         *should* have gone. It lights briefly and dies.
 *   - cloud cable         the long path up and away to a remote data centre.
 *   - the hall            five racks. The capsule lands in the middle one, and
 *                         the agent there wakes up: a different machine, far away.
 *   - pending slot        a dashed outline in the game where the new enemy
 *                         should have appeared. It stays empty.
 *
 * Beats:
 *   wp-prompt   John types the request (close on the chat; cloud tab active).
 *   wp-send     the bubble posts, folds into a capsule, leaves the screen and
 *               stops at the junction; the ghost route to the game flickers.
 *   wp-travel   the capsule commits to the cloud cable; the camera follows it
 *               to the hall; the rack's agent ignites.
 *   wp-reveal   pull back: desk lower left, lit hall upper right, the cable
 *               between them, and the empty slot in the game.
 */

const CAM_INITIAL = {x: 980, y: -40, zoom: 1.15};
const CAM_TRACK = [
  {beat: 'wp-send', to: {x: 620, y: -300, zoom: 0.62}, from: 0.3, until: 2.4, easing: ease.camera},
  {beat: 'wp-travel', to: {x: HALL.x, y: BAY_Y + 40, zoom: 0.95}, easing: ease.camera},
  {beat: 'wp-reveal', to: {x: 1300, y: -820, zoom: 0.33}, from: 0.1, until: 2.6, easing: ease.camera},
];

export const WrongProjectScene: React.FC = () => {
  const th = useTheme();
  const time = useActiveTime();
  const b = useBeats(['wp-prompt', 'wp-send', 'wp-travel', 'wp-reveal']);
  const track = useCamera(CAM_INITIAL, CAM_TRACK);

  // ---- the prompt and its journey ------------------------------------------
  const typed = b['wp-prompt'].at(0.2, 1.8, ease.inOut);
  const posted = b['wp-send'].at(0, 0.5, ease.out);
  const folded = b['wp-send'].at(0.45, 0.85, ease.inOut);
  const exitT = b['wp-send'].at(0.7, 2.3, ease.inOut);
  const ghost = b['wp-send'].at(1.9, 2.5, ease.out) * (1 - b['wp-travel'].at(0, 0.6, ease.in));
  const commit = b['wp-travel'].at(0, 0.25, ease.in);
  const travelT = b['wp-travel'].at(0.15, 2.5, ease.inOut);
  const landed = b['wp-travel'].at(2.35, 3.0, ease.out);
  const capsuleOpen = folded * (1 - landed);

  // Capsule position: along EXIT during wp-send, then along CLOUD.
  const onCloud = travelT > 0;
  const cap = onCloud ? CLOUD.pointAt(travelT) : EXIT.pointAt(exitT);
  const capAngle = onCloud ? (CLOUD.angleAt(travelT) * 180) / Math.PI : (EXIT.angleAt(exitT) * 180) / Math.PI;
  // Hesitation at the junction: a small lean toward the ghost route before committing.
  const lean = ghost * (1 - commit) * -26;

  // The camera follows the capsule for the middle of the journey.
  const follow = smooth(seg(travelT, 0, 0.25)) * (1 - smooth(seg(travelT, 0.7, 1)));
  const cam = {x: lerp(track.x, cap.x, follow), y: lerp(track.y, cap.y, follow), zoom: track.zoom};

  // ---- the hall wakes up ----------------------------------------------------
  const hallPower = (i: number) => (i === 2 ? lerp(0.35, 1, landed) : lerp(0.25, 0.6, landed));
  const hallAgent = (i: number) => (i === 2 ? landed : 0);
  const pending = b['wp-send'].at(1.2, 1.8, ease.out);
  const pendingPulse = 0.75 + 0.25 * Math.sin(time * 2.6) * b['wp-reveal'].progress;
  const litCloud = clamp01(travelT + 0.02);

  return (
    <AbsoluteFill>
      <StoryBackdrop intensity={0.6} />
      <Canvas>
        <World cam={cam}>
          <Workspace
            state={{
              time,
              game: {knightX: 48, pending: pending * pendingPulse, pendingX: 122},
              chat: {tab: 1, typed, posted, folded, time},
              typing: typed > 0 && typed < 1 ? 1 : 0,
              room: 0.85,
            }}
          />
          <Hall x={HALL.x} y={HALL.y} s={HALL.s} count={5} state={{time, power: hallPower, agent: hallAgent, room: lerp(0.5, 1.1, landed)}} />

          {/* The long cable to the cloud: it exists before the capsule uses it, unlit. */}
          <Cable curve={CLOUD} color={th.tone.system.base} lit={litCloud} width={9} />

          {/* Where it should have gone. */}
          {ghost > 0.001 ? (
            <g opacity={ghost}>
              <Cable curve={GHOST} color={th.tone.human.base} lit={1} width={9} conduit={false} glow={0.6} />
              <GamepadIcon x={GHOST.pointAt(1).x} y={GHOST.pointAt(1).y - 60} s={1.6} color={th.tone.human.base} opacity={0.9} />
            </g>
          ) : null}
          {/* Junction: a small node where the choice happens. */}
          <circle cx={JUNCTION.x} cy={JUNCTION.y} r={22} fill={th.color.abyss} stroke={th.color.steel} strokeWidth={3} opacity={b['wp-send'].at(0.6, 1.2)} />


          {/* The capsule's own light on the cable behind it while it travels. */}
          {onCloud && travelT < 1 ? <Packet curve={CLOUD} t={travelT} color={th.tone.human.base} tail={0.1} size={0} /> : null}
          {capsuleOpen > 0.001 ? <PromptCapsule x={cap.x} y={cap.y} angle={capAngle + lean} open={capsuleOpen} s={onCloud ? lerp(1.6, 2.2, travelT) : lerp(1.3, 1.6, exitT)} /> : null}
          {/* Landing flash in the bay. */}
          {landed > 0 && landed < 1 ? <circle cx={CLOUD.pointAt(1).x} cy={CLOUD.pointAt(1).y} r={120 * landed} fill={alpha(th.tone.mind.hot, 0.5 * (1 - landed))} /> : null}
        </World>
      </Canvas>
    </AbsoluteFill>
  );
};
