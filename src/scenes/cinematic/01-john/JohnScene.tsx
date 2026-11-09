import React, {useMemo} from 'react';
import {AbsoluteFill} from 'remotion';
import {Stage3D} from '../../../components/cyber/three/Stage3D';
import type {Vec3} from '../../../components/cyber/three/rig';
import {Desk, DeskCables, Keyboard, Lamp, Monitor, Mouse, Mug, Plant} from '../../../components/cinematic/three/Desk';
import {HorizonHaze, ObsidianFloor} from '../../../components/cinematic/three/LegacyStage';
import {Developer, OfficeChair} from '../../../components/cinematic/three/Person';
import {Bookshelf, Outside, Poster, RoomBounce, RoomCeiling, RoomFacade, RoomFloor, RoomRug, RoomWalls, RoomWindow, WindowLight} from '../../../components/cinematic/three/Room';
import {paintChat, paintGame} from '../../../components/cinematic/three/screens';
import {useScreenTexture} from '../../../components/cinematic/three/ScreenTexture';
import {CHAT_MONITOR, GAME_MONITOR} from '../../../components/cinematic/world';
import {slimeSplit} from '../../../components/story/Game';
import {lerp, seg} from '../../../components/story/math';
import {useActiveTime} from '../../../engine';
import {ShotLights, ShotObject, useMotion, usePractical, useShotRig, useShotStage} from '../../../shot';
import {useTheme} from '../../../styles/ThemeContext';

/**
 * X01 · John at his computer, as an editable shot (see ./shot.ts).
 *
 * What is code and what is configuration:
 *   code     what things are and how they behave: the room, the desk, John's
 *            pose as a function of the cues, what the screens paint.
 *   config   where things are, whether they are there at all, what they are
 *            made of, how they are lit, where the camera is (locked or not),
 *            and when each cue happens. All of it from the shot state, so the
 *            editor can change it and a render reproduces it.
 *
 * Cues (shot motions):
 *   slime-split     the new enemy splits on the game screen       (jc-game)
 *   turn-to-agent   John turns his head to the agent monitor      (jc-agent)
 *   agent-reply     the agent's reply writes itself; purple light rises on him
 *   agent-working   the agent keeps working                        (jc-hold)
 *   turn-back       he turns back to the game                      (jc-hold)
 */
export const JohnScene: React.FC = () => {
  const th = useTheme();
  const time = useActiveTime();
  const rig = useShotRig();
  const stage = useShotStage();

  // ---- what happens on the screens -------------------------------------------
  const split = useMotion('slime-split');
  const slimes = useMemo(() => slimeSplit(split, 120, 18, time), [split, time]);
  const reply = useMotion('agent-reply');
  const working = useMotion('agent-working');
  const game = useScreenTexture(GAME_MONITOR.px[0], GAME_MONITOR.px[1], (ctx, w, h) => paintGame(ctx, w, h, {time, knightX: 44, slimes, editor: 0.3}));
  const chat = useScreenTexture(CHAT_MONITOR.px[0], CHAT_MONITOR.px[1], (ctx, w, h) => paintChat(ctx, w, h, {time, theme: th, tab: 0, typed: 1, posted: 1, reply, working}));

  // ---- John --------------------------------------------------------------------
  const turnToAgent = useMotion('turn-to-agent');
  const turnBack = useMotion('turn-back');
  const typing = lerp(0.9, 0.0, turnToAgent) + 0.5 * turnBack;
  const turn = lerp(-0.12, 0.42, turnToAgent) * (1 - 0.6 * turnBack);
  const lean = lerp(0.15, 0.45, seg(split, 0.2, 0.9)) * (1 - 0.5 * turnToAgent);

  // Light on John from the agent screen rises as the reply writes.
  const agentLight = 0.7 + 0.9 * seg(reply, 0, 0.4);
  const cables = useMemo<readonly Vec3[]>(() => [[GAME_MONITOR.position[0], GAME_MONITOR.position[1] - 0.15, GAME_MONITOR.position[2] - 0.05], [CHAT_MONITOR.position[0], CHAT_MONITOR.position[1] - 0.25, CHAT_MONITOR.position[2] - 0.05]], []);

  // Environment lights belong to the room; the config scales them.
  const windowLight = usePractical('window-light', th.tone.system.base);
  const bounce = usePractical('room-bounce', '#5A6A9A');

  return (
    <AbsoluteFill>
      <Stage3D rig={rig} bloom={stage.bloom} fog={stage.fog} fogColor={stage.fogColor} background={stage.background} exposure={stage.exposure} shadows={stage.shadows}>
        <ShotLights />
        <WindowLight intensity={1.5 * windowLight.intensity} color={windowLight.color} />
        <RoomBounce room={bounce.intensity} />

        {/* The legacy stage */}
        <ShotObject id="horizon">
          <HorizonHaze />
        </ShotObject>
        <ShotObject id="stage-floor">
          <ObsidianFloor />
        </ShotObject>

        {/* The room */}
        <ShotObject id="room-floor">
          <RoomFloor />
        </ShotObject>
        <ShotObject id="rug">
          <RoomRug />
        </ShotObject>
        <ShotObject id="walls">
          <RoomWalls />
        </ShotObject>
        <ShotObject id="ceiling">
          <RoomCeiling />
        </ShotObject>
        <ShotObject id="window">
          <RoomWindow />
        </ShotObject>
        <ShotObject id="facade">
          <RoomFacade />
        </ShotObject>
        <ShotObject id="bookshelf">
          <Bookshelf />
        </ShotObject>
        <ShotObject id="poster">
          <Poster />
        </ShotObject>
        <ShotObject id="city">
          <Outside lights={1} mind={0} exteriorLights={false} />
        </ShotObject>

        {/* The workstation */}
        <ShotObject id="desk">
          <Desk />
        </ShotObject>
        <ShotObject id="monitor-game">
          <Monitor position={GAME_MONITOR.position} width={GAME_MONITOR.width} height={GAME_MONITOR.height} yaw={GAME_MONITOR.yaw} map={game} tint={th.tone.human.base} light={0.85} glow="glow-game" />
        </ShotObject>
        <ShotObject id="monitor-agent">
          <Monitor position={CHAT_MONITOR.position} width={CHAT_MONITOR.width} height={CHAT_MONITOR.height} yaw={CHAT_MONITOR.yaw} map={chat} tint={th.tone.mind.base} light={agentLight} glow="glow-agent" />
        </ShotObject>
        <ShotObject id="keyboard">
          <Keyboard />
        </ShotObject>
        <ShotObject id="mouse">
          <Mouse />
        </ShotObject>
        <ShotObject id="mug">
          <Mug />
        </ShotObject>
        <ShotObject id="lamp">
          <Lamp on={1} glow="lamp-light" />
        </ShotObject>
        <ShotObject id="plant">
          <Plant />
        </ShotObject>
        <ShotObject id="cables">
          <DeskCables from={cables} />
        </ShotObject>

        {/* The person */}
        <ShotObject id="chair">
          <OfficeChair />
        </ShotObject>
        <ShotObject id="developer">
          <Developer pose={{typing, lean, turn}} time={time} chair={false} refined />
        </ShotObject>
      </Stage3D>
    </AbsoluteFill>
  );
};
