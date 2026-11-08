import React, {useMemo} from 'react';
import {AbsoluteFill} from 'remotion';
import * as THREE from 'three';
import {Stage3D} from '../../../components/cyber/three/Stage3D';
import {Comet3D, GlowTube} from '../../../components/cyber/three/Signal3D';
import {useCameraRig, type Rig, type Vec3} from '../../../components/cyber/three/rig';
import {DataHall} from '../../../components/cinematic/three/DataHall';
import {Desk, DeskCables, Keyboard, Lamp, Monitor, Mouse, Mug, Plant} from '../../../components/cinematic/three/Desk';
import {Developer} from '../../../components/cinematic/three/Person';
import {DevRoom, Outside, WindowLight} from '../../../components/cinematic/three/Room';
import {paintChat, paintGame} from '../../../components/cinematic/three/screens';
import {useScreenTexture} from '../../../components/cinematic/three/ScreenTexture';
import {buildRoute, HERO_RACK, hallDirToWorld, hallToWorld, heroBayLocal} from '../../../components/cinematic/route';
import {CHAT_MONITOR, GAME_MONITOR, HALL_TO_WORLD, ROOM, WALL_PORT} from '../../../components/cinematic/world';
import {ease, lerp, seg, smooth} from '../../../components/story/math';
import {useActiveTime, useBeats, useScalarTrack} from '../../../engine';
import {useTheme} from '../../../styles/ThemeContext';

/**
 * X02 · The wrong project (cinematic 3D).
 *
 * Cast:
 *   - the agent window   two project tabs. `my-game` (gamepad) is what John
 *                        means; `cloud-ops` (cloud) is what is active. The
 *                        underline is purple, not warm: the only clue, and it
 *                        is a small one, as it was for him.
 *   - the prompt         the request with the slime thumbnail. He presses send.
 *   - the pulse          the message as a point of light. It leaves the screen
 *                        down the monitor cable, along the skirting to the wall
 *                        port, down the outside of the building, along the
 *                        street, and into the data centre. It never crosses
 *                        empty air: the viewer can follow the wire.
 *   - the game monitor   shows an empty dashed slot where the enemy should
 *                        have appeared. It stays empty.
 *   - the data hall      rows of racks, lights-out. The pulse drops into one
 *                        rack; its LEDs turn purple and the agent ignites there.
 *
 * Beats:
 *   wp-tab      close on the agent screen: the prompt is ready; the camera
 *               pushes in; the active tab is the cloud project.
 *   wp-send     enter. The bubble posts, a pulse leaves down the cable; the
 *               camera tilts down and follows it to the wall port.
 *   wp-travel   one continuous shot: the camera goes out through the window
 *               and travels with the pulse across the district to the data
 *               centre, John's lit window shrinking behind.
 *   wp-arrive   into the hall: the roof opens for the camera; the pulse runs
 *               the tray and drops into a rack, which changes hands. Hold on
 *               that rack: purple among blue.
 */

const ROUTE = buildRoute();
const HERO_BAY = hallToWorld(heroBayLocal());

const CAM0: Rig = {position: [-1.1, 1.42, 1.45], target: [0.5, 1.12, -0.24], fov: 27};
const RIG_TRACK = [
  {beat: 'wp-tab', to: {position: [-0.62, 1.3, 0.9] as Vec3, target: [0.5, 1.12, -0.24] as Vec3, fov: 22}, from: 0.2, until: 2.6},
  // Tilt down and pull out as the pulse runs down the cable to the wall port.
  {beat: 'wp-send', to: {position: [0.2, 1.1, 1.3] as Vec3, target: [WALL_PORT[0] - 0.3, 0.35, WALL_PORT[2]] as Vec3, fov: 32}, from: 0.5, until: 2.4},
  // Then to the window and out: the camera leaves the room the way the eye would, not through the wall.
  {beat: 'wp-travel', to: {position: [ROOM.window.x, 0.95, ROOM.back + 0.9] as Vec3, target: [ROOM.window.x + 0.4, 0.2, ROOM.back - 6] as Vec3, fov: 36}, from: 0.0, until: 0.9},
];

/** Route progress per beat: the pulse's position along ROUTE as a fraction of its length. */
const ROUTE_TRACK = [
  {beat: 'wp-send', to: ROUTE.marks.outside * 0.92, from: 0.55, until: 2.4, easing: ease.inOut},
  {beat: 'wp-travel', to: ROUTE.marks.building, from: 0.0, until: 3.6, easing: ease.inOut},
  {beat: 'wp-arrive', to: 1, from: 0.0, until: 2.4, easing: ease.inOut},
];

export const WrongProjectScene: React.FC = () => {
  const th = useTheme();
  const time = useActiveTime();
  const b = useBeats(['wp-tab', 'wp-send', 'wp-travel', 'wp-arrive']);
  const keyed = useCameraRig(CAM0, RIG_TRACK);
  const routeT = useScalarTrack(0, ROUTE_TRACK);

  // ---- beat 1-2: the screen --------------------------------------------------
  const hit = b['wp-send'].at(0.0, 0.35, ease.out); // the hand presses enter
  const posted = b['wp-send'].at(0.1, 0.5, ease.out);
  const pending = b['wp-send'].at(1.4, 2.2, ease.out); // the game shows the empty slot
  const game = useScreenTexture(GAME_MONITOR.px[0], GAME_MONITOR.px[1], (ctx, w, h) => paintGame(ctx, w, h, {time, knightX: 44, slimes: [{x: 150, lift: Math.abs(Math.sin(time * 3.2)) * 3}], pending, pendingX: 104, editor: 0.3}));
  const chat = useScreenTexture(CHAT_MONITOR.px[0], CHAT_MONITOR.px[1], (ctx, w, h) => paintChat(ctx, w, h, {time, theme: th, tab: 1, typed: 1, posted, working: seg(posted, 0.8, 1) * (1 - b['wp-travel'].at(0, 0.2))}));

  // ---- the pulse ---------------------------------------------------------------
  const pulse = useMemo(() => new THREE.Vector3(), []);
  if (routeT > 0 && routeT < 1) ROUTE.curve.getPointAt(routeT, pulse);
  else if (routeT >= 1) pulse.set(HERO_BAY[0], HERO_BAY[1], HERO_BAY[2]);

  // ---- camera: keyed for the room beats, then a travelling shot that follows the pulse --------
  const travel = b['wp-travel'].at(0, 3.6, ease.inOut);
  const arrive = b['wp-arrive'].at(0, 2.4, ease.inOut);
  const follow = smooth(seg(b['wp-travel'].time, 0.7, 1.9)); // once at the window, the camera lets go of the room and takes the pulse's side
  // Follow offset: an aerial trailing view over the street (the district and the lit building stay in frame),
  // closing in as the pulse climbs the facade, then low and near once it is inside.
  const near = smooth(seg(routeT, ROUTE.marks.building - 0.08, ROUTE.marks.roof));
  // The dive: once the pulse is on the roof, the camera closes from a high trailing view to a low one inside.
  const dive = smooth(seg(routeT, ROUTE.marks.roof - 0.01, ROUTE.marks.tray));
  const back = lerp(lerp(13, 11, near), 2.6, dive);
  const up = lerp(lerp(8.5, 7.5, near), 1.2, dive);
  const side = lerp(lerp(-4.5, -5.5, near), -1.3, dive);
  // Direction of travel, for the offset.
  const ahead = useMemo(() => new THREE.Vector3(), []);
  const inHall = routeT > ROUTE.marks.roof - 0.005;
  if (inHall) {
    // Inside the hall the camera travels along the row, whatever the cable does.
    const d = hallDirToWorld([1, 0, 0]);
    ahead.set(d[0], 0, d[2]);
  } else if (routeT > 0.001 && routeT < 0.999) ROUTE.curve.getTangentAt(routeT, ahead);
  else ahead.set(0, 0, -1);
  ahead.y = 0;
  if (ahead.lengthSq() < 1e-4) ahead.set(0, 0, -1);
  ahead.normalize();
  const perp = new THREE.Vector3(-ahead.z, 0, ahead.x);
  const followPos: Vec3 = [pulse.x - ahead.x * back + perp.x * side, pulse.y + up, pulse.z - ahead.z * back + perp.z * side];
  const followTarget: Vec3 = [pulse.x + ahead.x * lerp(6, 1.2, dive), pulse.y + lerp(1.0, 0.1, dive), pulse.z + ahead.z * lerp(6, 1.2, dive)];
  // The final composition: a medium three-quarter on the hero rack, settled during the last second of wp-arrive.
  const settle = b['wp-arrive'].at(1.1, 2.7, ease.camera);
  // In the cold aisle in front of the hero rack (row 1 faces -z), a step to the left, at head height.
  // Down the cold aisle on a longer lens: the row recedes, the hero rack sits a third of the way in, purple among blue.
  const finalPos = hallToWorld([heroBayLocal()[0] - 1.7, 1.4, heroBayLocal()[2] - 1.3]);
  const finalTarget: Vec3 = [HERO_BAY[0], HERO_BAY[1] + 0.05, HERO_BAY[2]];
  const rig: Rig = {
    position: [
      lerp(lerp(keyed.position[0], followPos[0], follow), finalPos[0], settle),
      lerp(lerp(keyed.position[1], followPos[1], follow), finalPos[1], settle),
      lerp(lerp(keyed.position[2], followPos[2], follow), finalPos[2], settle),
    ],
    target: [
      lerp(lerp(keyed.target[0], followTarget[0], follow), finalTarget[0], settle),
      lerp(lerp(keyed.target[1], followTarget[1], follow), finalTarget[1], settle),
      lerp(lerp(keyed.target[2], followTarget[2], follow), finalTarget[2], settle),
    ],
    fov: lerp(lerp(keyed.fov, 36, follow), 40, settle),
  };

  // ---- the hall ------------------------------------------------------------------
  const inside = seg(routeT, ROUTE.marks.building, ROUTE.marks.building + 0.55 * (ROUTE.marks.roof - ROUTE.marks.building)); // the roof opens while the pulse climbs the facade, so coming over the edge reveals the hall
  const landed = routeT >= 0.999 ? 1 : 0;
  const ignite = b['wp-arrive'].at(2.3, 3.0, ease.out) * landed + seg(arrive, 0.97, 1) * (1 - landed);
  const stateOf = (row: number, i: number) => {
    const hero = row === HERO_RACK.row && i === HERO_RACK.i;
    return hero ? {power: 1, activity: 0.25 + 0.75 * ignite, agent: ignite, open: ignite} : {power: 1, activity: 0.15 + 0.15 * ((row * 7 + i * 3) % 5) / 5};
  };
  const cables = useMemo<readonly Vec3[]>(() => [[GAME_MONITOR.position[0], GAME_MONITOR.position[1] - 0.15, GAME_MONITOR.position[2] - 0.05], [CHAT_MONITOR.position[0], CHAT_MONITOR.position[1] - 0.25, CHAT_MONITOR.position[2] - 0.05]], []);
  const showRoom = travel < 0.999 || arrive < 0.01;
  const fog = lerp(0.009, 0.02, inside);

  return (
    <AbsoluteFill>
      <Stage3D rig={rig} bloom={{strength: 0.5, radius: 0.6, threshold: 1.0}} fog={fog} fogColor={th.color.void} background={th.color.void} exposure={1.2} shadows>
        {showRoom ? (
          <DevRoom room={1}>
            <WindowLight intensity={1.5} />
            <Desk>
              <Monitor position={GAME_MONITOR.position} width={GAME_MONITOR.width} height={GAME_MONITOR.height} yaw={GAME_MONITOR.yaw} map={game} tint={th.tone.human.base} light={0.85} />
              <Monitor position={CHAT_MONITOR.position} width={CHAT_MONITOR.width} height={CHAT_MONITOR.height} yaw={CHAT_MONITOR.yaw} map={chat} tint={th.tone.mind.base} light={1.3} />
              <Keyboard />
              <Mouse />
              <Mug />
              <Lamp on={1} />
              <Plant />
              <DeskCables from={cables} />
            </Desk>
            <Developer pose={{typing: 0.2 * (1 - hit), lean: 0.4, turn: 0.42, reach: 0}} time={time} />
          </DevRoom>
        ) : null}
        <Outside lights={1} mind={ignite} shell={1 - inside} />
        {/* The data hall inside the building */}
        <group position={[HALL_TO_WORLD.position[0], HALL_TO_WORLD.position[1], HALL_TO_WORLD.position[2]]} rotation={[0, HALL_TO_WORLD.yaw, 0]}>
          <DataHall stateOf={stateOf} hero={HERO_RACK} time={time} lights={0.9} room={1.8} ceiling={1 - inside} />
          {/* The agent's light on the aisle floor when it lands */}
          {ignite > 0.001 ? <pointLight position={[heroBayLocal()[0], 1.1, heroBayLocal()[2] - 0.5]} intensity={9 * ignite} color={th.tone.mind.base} distance={6} decay={2} /> : null}
        </group>
        {/* The route: a faint conduit the whole way, lit behind the pulse, and the pulse itself */}
        <GlowTube curve={ROUTE.curve} radius={0.03} color={th.color.steel} intensity={0.5} segments={400} radial={5} />
        {routeT > 0 && routeT < 0.999 ? <GlowTube curve={ROUTE.curve} radius={0.028} color={th.tone.mind.base} intensity={1.3 * th.glow} from={Math.max(0, routeT - 0.08)} to={Math.min(1, routeT)} segments={400} radial={5} /> : null}
        {routeT > 0 && routeT < 1 ? <Comet3D curve={ROUTE.curve} t={routeT / 1.04} tail={0.04} color={th.tone.mind.base} radius={0.05} intensity={3.2 * th.glow} head={2.2} /> : null}
        {routeT > 0 && routeT < 1 ? <pointLight position={pulse} intensity={6} color={th.tone.mind.base} distance={6} decay={2} /> : null}
      </Stage3D>
    </AbsoluteFill>
  );
};
