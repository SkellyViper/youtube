import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Canvas, NightCity, StoryBackdrop, Workspace, World, WINDOW, ease, lerp} from '../../../components/story';
import {useActiveTime, useBeats, useCamera} from '../../../engine';

/**
 * S10 · The final callback to John (2D, the desk world one last time).
 *
 * Cast:
 *   - the game        three slimes now, bouncing. John's game is going well.
 *   - John            typing, lit warm by the game. Nothing is wrong here.
 *   - the window      behind the desk: the night city.
 *   - the far hall    on the horizon, the data centre from S02. One bay shows
 *                     the agent's light. Then a second one next to it.
 *
 * Beats:
 *   cb-game     close on the game, happy and busy.
 *   cb-john     slow pull back to John at work.
 *   cb-window   the camera keeps drifting up to the window and through it.
 *   cb-signal   out in the night, on the horizon: one purple light, then two.
 */

const CITY = {x: 0, y: WINDOW.y + WINDOW.h - 170, width: 3600};
const HALL_X = 760;
const CAM0 = {x: 0, y: 0, zoom: 1.7};
const CAM_TRACK = [
  {beat: 'cb-john', to: {x: 80, y: -80, zoom: 0.47}, easing: ease.camera},
  {beat: 'cb-window', to: {x: 0, y: WINDOW.y + WINDOW.h / 2, zoom: 0.58}, easing: ease.camera},
  {beat: 'cb-signal', to: {x: CITY.x + HALL_X, y: CITY.y - 70, zoom: 2.4}, from: 0, until: 2.4, easing: ease.camera},
];

export const CallbackScene: React.FC = () => {
  const time = useActiveTime();
  const b = useBeats(['cb-game', 'cb-john', 'cb-window', 'cb-signal']);
  const cam = useCamera(CAM0, CAM_TRACK);
  const bob = (phase: number) => Math.abs(Math.sin(time * 3.2 + phase)) * 3;
  const knight = 40 + Math.sin(time * 0.7) * 10;
  const night = b['cb-window'].at(0.4, 2.4, ease.inOut);
  const signals = b['cb-signal'].at(0.3, 1.0, ease.out) + b['cb-signal'].at(1.7, 2.4, ease.out);

  return (
    <AbsoluteFill>
      <StoryBackdrop intensity={0.5} />
      <Canvas>
        <World cam={cam}>
          <Workspace
            state={{
              time,
              game: {knightX: knight, slimes: [{x: 96, lift: bob(0), flip: true}, {x: 130, lift: bob(1.2)}, {x: 162, lift: bob(2.4)}]},
              chat: {tab: 0, reply: 1, time},
              typing: 1,
              room: lerp(0.9, 0.6, night),
              night,
              beyond: <NightCity x={CITY.x} y={CITY.y} width={CITY.width} time={time} signals={signals} hallX={HALL_X} />,
            }}
          />
        </World>
      </Canvas>
    </AbsoluteFill>
  );
};
