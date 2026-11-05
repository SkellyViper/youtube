import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Cable, Canvas, Hall, Packet, StoryBackdrop, Workspace, World, ease, lerp, seg, smooth} from '../../../components/story';
import {useActiveTime, useBeats, useCamera} from '../../../engine';
import {mix} from '../../../styles/cyber';
import {useTheme} from '../../../styles/ThemeContext';
import {BAY_Y, CLOUD, HALL, OUT} from '../shared/deskWorld';

/**
 * S03 · The agent keeps running (2D, continues S02's world).
 *
 * Cast:
 *   - the chat window   John closes it: it collapses to a line, then a dot.
 *   - the agent monitor goes dark; the room light falls with it.
 *   - the cloud cable   the same cable the prompt took in S02, still faintly lit.
 *   - the hall          the same remote hall. Everything in it is dim except
 *                       one rack: the one the prompt landed in.
 *   - the agent         still turning in that rack's bay.
 *   - the pulse         a signal leaving the rack along a cable that goes on
 *                       toward the rest of the internet. Tinted toward threat.
 *
 * Beats:
 *   kr-close   John closes the window; the agent monitor switches off.
 *   kr-dark    the room goes dark; in one continuous move the camera leaves
 *              the desk and climbs the cable.
 *   kr-hall    the camera arrives at the hall: one lit bay, the agent turning.
 *   kr-pulse   a pulse leaves the rack toward the internet; another follows.
 */

const CAM0 = {x: 330, y: -180, zoom: 0.56};
const CAM_TRACK = [
  {beat: 'kr-dark', to: {x: 1300, y: -1100, zoom: 0.42}, from: 0.5, easing: ease.inOut},
  {beat: 'kr-hall', to: {x: HALL.x + 60, y: BAY_Y + 20, zoom: 0.78}, easing: ease.camera},
  {beat: 'kr-pulse', to: {x: HALL.x + 560, y: BAY_Y - 330, zoom: 0.7}, from: 0.3, easing: ease.camera},
];

export const KeepsRunningScene: React.FC = () => {
  const th = useTheme();
  const time = useActiveTime();
  const b = useBeats(['kr-close', 'kr-dark', 'kr-hall', 'kr-pulse']);
  const cam = useCamera(CAM0, CAM_TRACK);

  const reach = b['kr-close'].at(0, 0.7, ease.inOut); // John's hand goes to the keyboard
  const close = b['kr-close'].at(0.7, 1.7, ease.inOut);
  const agentPower = 1 - b['kr-close'].at(1.5, 2.0, ease.in) * 0.92 - b['kr-dark'].at(0, 0.4) * 0.08;
  const room = lerp(0.9, 0.12, smooth(b['kr-dark'].at(0, 1.0, ease.inOut)));
  const gamePower = lerp(1, 0.3, b['kr-dark'].at(0.2, 1.2, ease.inOut));

  // The hall: one rack alive, the rest asleep.
  const hallRoom = lerp(0.25, 0.55, b['kr-hall'].at(0.8, 2.4, ease.out));
  const threat = 0.3 * b['kr-pulse'].at(0, 1.2, ease.inOut);
  const pulse1 = b['kr-pulse'].at(0.1, 1.6, ease.inOut);
  const pulse2 = b['kr-pulse'].at(0.9, 2.2, ease.inOut);
  const outDraw = b['kr-hall'].at(1.4, 2.8, ease.out);
  const signal = mix(th.tone.mind.base, th.tone.threat.base, 0.45);

  return (
    <AbsoluteFill>
      <StoryBackdrop intensity={0.5} />
      <Canvas>
        <World cam={cam}>
          <Workspace
            state={{
              time,
              game: {knightX: 48, slimes: [{x: 102, flip: true}, {x: 138}], power: gamePower},
              chat: {tab: 1, reply: 1, close, time},
              agentPower,
              typing: reach * (1 - close),
              room,
            }}
          />
          <Hall
            x={HALL.x}
            y={HALL.y}
            s={HALL.s}
            count={5}
            state={{
              time,
              room: hallRoom,
              power: (i) => (i === 2 ? 1 : 0.18),
              agent: (i) => (i === 2 ? 1 : 0),
              threat: (i) => (i === 2 ? threat : 0),
            }}
          />
          <Cable curve={CLOUD} color={th.tone.system.base} lit={1} width={9} glow={0.35} opacity={0.8} />
          {/* Onward: the rest of the internet. */}
          <Cable curve={OUT} color={th.tone.system.base} draw={outDraw} lit={seg(pulse1, 0, 1)} width={9} glow={0.5} />
          {pulse1 > 0 ? <Packet curve={OUT} t={pulse1} color={signal} size={16} tail={0.14} /> : null}
          {pulse2 > 0 ? <Packet curve={OUT} t={pulse2} color={signal} size={13} tail={0.12} /> : null}
        </World>
      </Canvas>
    </AbsoluteFill>
  );
};
