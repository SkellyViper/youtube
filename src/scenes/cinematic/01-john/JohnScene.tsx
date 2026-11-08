import React, {useMemo} from 'react';
import {AbsoluteFill} from 'remotion';
import {Stage3D} from '../../../components/cyber/three/Stage3D';
import {useCameraRig, type Rig, type Vec3} from '../../../components/cyber/three/rig';
import {Desk, DeskCables, Keyboard, Lamp, Monitor, Mouse, Mug, Plant} from '../../../components/cinematic/three/Desk';
import {Developer} from '../../../components/cinematic/three/Person';
import {DevRoom, Outside, WindowLight} from '../../../components/cinematic/three/Room';
import {paintChat, paintGame} from '../../../components/cinematic/three/screens';
import {useScreenTexture} from '../../../components/cinematic/three/ScreenTexture';
import {CHAT_MONITOR, GAME_MONITOR} from '../../../components/cinematic/world';
import {slimeSplit} from '../../../components/story/Game';
import {ease, lerp, seg} from '../../../components/story/math';
import {useActiveTime, useBeats} from '../../../engine';
import {useTheme} from '../../../styles/ThemeContext';

/**
 * X01 · John at his computer (cinematic 3D).
 *
 * Cast:
 *   - the room          a real room, late: floorboards, a window with blinds,
 *                       a bookshelf, a poster. Dark materials, no glow.
 *   - John              hoodie, headphones, seen from behind and three-quarter.
 *                       Lit by his two screens and the lamp. He types, looks
 *                       at the game, then turns to the agent.
 *   - the game monitor  landscape, warm. The game he is making is running:
 *                       a knight, and the new enemy, a slime that splits in two.
 *   - the agent monitor portrait, cool purple. A coding-agent chat with two
 *                       project tabs; the agent writes code while he watches.
 *   - the window        the night outside: a dark district and, far away, one
 *                       lit building (the data centre the story will go to).
 *
 * Beats:
 *   jc-room    establishing: from the doorway the camera eases toward the desk.
 *   jc-game    over John's shoulder onto the game: the slime splits.
 *   jc-agent   John turns to the agent screen; the camera slides with his look;
 *              the agent's reply writes itself and purple light rises on him.
 *   jc-hold    pull back to a medium wide: a person, two screens, a game, an
 *              AI, the night. Nothing more is needed.
 */

/**
 * Camera: one continuous move per beat, each ending on a composed frame.
 *   doorway wide -> approach (establishing)
 *   over John's right shoulder onto the game (his head is the dark foreground mass at left)
 *   over his left shoulder onto the agent screen, on a longer lens (head at right)
 *   back out to a medium wide
 */
const CAM0: Rig = {position: [-2.05, 1.72, 2.95], target: [0.05, 1.0, -0.1], fov: 40};
const RIG_TRACK = [
  {beat: 'jc-room', to: {position: [-1.3, 1.55, 2.2] as Vec3, target: [0.0, 1.0, -0.15] as Vec3, fov: 38}},
  {beat: 'jc-game', to: {position: [0.58, 1.46, 1.38] as Vec3, target: [-0.27, 1.08, -0.3] as Vec3, fov: 30}, from: 0.0, until: 2.2},
  {beat: 'jc-agent', to: {position: [-1.05, 1.42, 1.45] as Vec3, target: [0.5, 1.12, -0.24] as Vec3, fov: 27}, from: 0.1, until: 2.2},
  {beat: 'jc-hold', to: {position: [-0.95, 1.5, 2.65] as Vec3, target: [0.1, 1.0, -0.2] as Vec3, fov: 36}, from: 0, until: 2.2},
];

export const JohnScene: React.FC = () => {
  const th = useTheme();
  const time = useActiveTime();
  const b = useBeats(['jc-room', 'jc-game', 'jc-agent', 'jc-hold']);
  const rig = useCameraRig(CAM0, RIG_TRACK);

  // ---- what happens on the screens -------------------------------------------
  const split = b['jc-game'].at(0.7, 2.3, ease.inOut);
  const slimes = useMemo(() => slimeSplit(split, 120, 18, time), [split, time]);
  const reply = b['jc-agent'].at(0.4, 2.4, ease.linear);
  const working = b['jc-hold'].at(0.0, 0.8, ease.out);
  const game = useScreenTexture(GAME_MONITOR.px[0], GAME_MONITOR.px[1], (ctx, w, h) => paintGame(ctx, w, h, {time, knightX: 44, slimes, editor: 0.3}));
  const chat = useScreenTexture(CHAT_MONITOR.px[0], CHAT_MONITOR.px[1], (ctx, w, h) => paintChat(ctx, w, h, {time, theme: th, tab: 0, typed: 1, posted: 1, reply, working}));

  // ---- John --------------------------------------------------------------------
  const turnToAgent = b['jc-agent'].at(0.0, 0.9, ease.inOut);
  const turnBack = b['jc-hold'].at(0.6, 1.6, ease.inOut);
  const typing = lerp(0.9, 0.0, turnToAgent) + 0.5 * turnBack;
  const turn = lerp(-0.12, 0.42, turnToAgent) * (1 - 0.6 * turnBack);
  const lean = lerp(0.15, 0.45, seg(split, 0.2, 0.9)) * (1 - 0.5 * turnToAgent);

  // Light on John from the agent screen rises as the reply writes.
  const agentLight = 0.7 + 0.9 * seg(reply, 0, 0.4);
  const cables = useMemo<readonly Vec3[]>(() => [[GAME_MONITOR.position[0], GAME_MONITOR.position[1] - 0.15, GAME_MONITOR.position[2] - 0.05], [CHAT_MONITOR.position[0], CHAT_MONITOR.position[1] - 0.25, CHAT_MONITOR.position[2] - 0.05]], []);

  return (
    <AbsoluteFill>
      <Stage3D rig={rig} bloom={{strength: 0.42, radius: 0.6, threshold: 1.0}} fog={0.014} fogColor={th.color.void} background={th.color.void} exposure={1.2} shadows>
        <DevRoom room={1}>
          <WindowLight intensity={1.5} />
          <Outside lights={1} mind={0} exteriorLights={false} />
          <Desk>
            <Monitor position={GAME_MONITOR.position} width={GAME_MONITOR.width} height={GAME_MONITOR.height} yaw={GAME_MONITOR.yaw} map={game} tint={th.tone.human.base} light={0.85} />
            <Monitor position={CHAT_MONITOR.position} width={CHAT_MONITOR.width} height={CHAT_MONITOR.height} yaw={CHAT_MONITOR.yaw} map={chat} tint={th.tone.mind.base} light={agentLight} />
            <Keyboard />
            <Mouse />
            <Mug />
            <Lamp on={1} />
            <Plant />
            <DeskCables from={cables} />
          </Desk>
          <Developer pose={{typing, lean, turn}} time={time} />
        </DevRoom>
      </Stage3D>
    </AbsoluteFill>
  );
};
