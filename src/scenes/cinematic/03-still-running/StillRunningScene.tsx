import React, {useMemo} from 'react';
import {AbsoluteFill} from 'remotion';
import * as THREE from 'three';
import {Stage3D} from '../../../components/cyber/three/Stage3D';
import {useCameraRig, type Rig, type Vec3} from '../../../components/cyber/three/rig';
import {CrashCart} from '../../../components/cinematic/three/CrashCart';
import {DataHall} from '../../../components/cinematic/three/DataHall';
import {Desk, DeskCables, Keyboard, Lamp, Monitor, Mouse, Mug, Plant} from '../../../components/cinematic/three/Desk';
import {Developer} from '../../../components/cinematic/three/Person';
import {DevRoom, Outside, WindowLight} from '../../../components/cinematic/three/Room';
import {paintChat, paintGame, paintTerminal, type TerminalScreenState} from '../../../components/cinematic/three/screens';
import {useScreenTexture} from '../../../components/cinematic/three/ScreenTexture';
import {HERO_RACK, hallToWorld, heroBayLocal} from '../../../components/cinematic/route';
import {CHAT_MONITOR, GAME_MONITOR, HALL_TO_WORLD} from '../../../components/cinematic/world';
import {createRandom} from '../../../components/random';
import {ease, lerp, smooth} from '../../../components/story/math';
import {useActiveTime, useBeats, useScalarTrack} from '../../../engine';
import {useTheme} from '../../../styles/ThemeContext';

/**
 * X03 · The process that did not stop (cinematic 3D).
 *
 * A hypothetical depiction: he closes his work and the room goes dark;
 * somewhere else, a machine keeps working. The contrast is the whole point.
 *
 * Cast:
 *   - John's room        the same room as X01/X02, late. Dark materials; the
 *                        only light is what the screens, the lamp and the
 *                        night through the window give it.
 *   - the agent window   on the portrait monitor, the "working" indicator
 *                        marching. He closes it: the window squashes to a line.
 *   - the two monitors   they power down after the window closes; their light
 *                        on the desk and on him goes with them.
 *   - John               leans back, slumps: done for the night.
 *   - the desk lamp      the last light he turns off.
 *   - the window         the night: a dark district and, far away, one lit
 *                        long building. The camera leaves through it.
 *   - the district       street lamps, unlit blocks, the horizon haze. Nothing
 *                        travels with the camera this time: it goes alone,
 *                        which says "meanwhile, elsewhere".
 *   - the data hall      asleep: fixtures mostly off, every rack idle, power
 *                        LEDs dim, the cold aisle lit by its floor strips.
 *   - the hero rack      the one machine still busy: purple activity LEDs,
 *                        the bay slides open, the gimbal iris turns inside,
 *                        purple light on the aisle floor.
 *   - the crash cart     a technician's console cart parked at the rack, its
 *                        small screen still logged in: `agent-runner — running`,
 *                        a log that keeps scrolling. The physical proof that a
 *                        process is running here.
 *
 * Beats:
 *   sr-close    over John's shoulder: the agent is working; he closes the
 *               window, the monitors power down, he leans back, the lamp goes
 *               off. The room is lit only by the night.
 *   sr-leave    one continuous crane: up from the dark desk, over it, out
 *               through the window below the blinds, and away over the
 *               district toward the one lit building.
 *   sr-arrive   through the building's shell into the sleeping hall; the
 *               camera glides down the cold aisle toward the one rack with
 *               purple lights.
 *   sr-reveal   the bay opens: the iris turns inside; the crash cart's
 *               terminal scrolls its log. Hold: purple among idle blue.
 */

const HERO_BAY_LOCAL = heroBayLocal();
const HERO_BAY = hallToWorld(HERO_BAY_LOCAL);

/** Crash cart: parked beside the hero rack (its +x side), screen turned toward the aisle. Hall-local. */
const CART_POS: Vec3 = [HERO_BAY_LOCAL[0] + 0.66, 0, HERO_BAY_LOCAL[2] - 0.62];
const CART_YAW = -2.05;
const CART_CABLE_TO: Vec3 = [HERO_BAY_LOCAL[0] + 0.2, HERO_BAY_LOCAL[1] + 0.02, HERO_BAY_LOCAL[2]];

/** The log on the cart's terminal: deterministic widths and kinds. */
const LOG_LINES: TerminalScreenState['lines'] = (() => {
  const rnd = createRandom(303);
  return Array.from({length: 26}, () => {
    const r = rnd.next();
    const kind = r < 0.5 ? undefined : r < 0.78 ? 'ok' : 'mind';
    return {w: rnd.range(0.3, 0.82), kind} as const;
  });
})();

/* ------------------------------------------------------------------ camera */

/** Over John's left shoulder: the agent monitor centre-right, the game monitor and the window left, his head a dark mass at right. */
const CAM0: Rig = {position: [-1.15, 1.58, 2.0], target: [0.2, 1.05, -0.2], fov: 34};
const CAM1: Rig = {position: [-1.0, 1.5, 1.75], target: [0.2, 1.05, -0.2], fov: 33};
const RIG_TRACK = [{beat: 'sr-close', to: CAM1, from: 0.0, until: 3.0}];

type PathKey = {readonly p: Vec3; readonly look: Vec3; readonly fov: number};

/**
 * The travelling shot, as keys on one smooth path. The camera position runs
 * along a centripetal Catmull-Rom through `p` at uniform speed per unit of
 * `t` (arc length), the look-at point along a second curve through `look`,
 * kept in step key for key. Beats drive `t` with eased scalar tracks, so the
 * speed profile is the beats' and the path is the keys'.
 */
const KEYS: readonly PathKey[] = [
  // in the room: up from the desk, over its left end, through the window below the blinds
  {p: CAM1.position, look: CAM1.target, fov: CAM1.fov},
  {p: [-1.3, 1.9, 0.95], look: [-0.05, 1.05, -0.45], fov: 34},
  {p: [-0.95, 1.55, -0.02], look: [-0.5, 1.05, -1.4], fov: 36},
  {p: [-0.78, 1.27, -0.62], look: [0.6, 0.5, -6.0], fov: 38},
  // outside: over the void, rising along the street
  {p: [-0.3, 1.55, -2.9], look: [4.0, -1.0, -30], fov: 40},
  {p: [2.5, 3.2, -12], look: [14, -4.0, -70], fov: 40},
  {p: [5.0, 6.5, -45], look: [30, -5.0, -150], fov: 40},
  {p: [3.0, 7.0, -95], look: [36, -4.0, -166], fov: 40},
  // end of sr-leave: the lit building ahead, seen from over the district
  {p: [-6.0, 4.5, -135], look: [38, -3.5, -168], fov: 40},
  // sr-arrive: down toward the building's west end, through the shell, into the aisle
  {p: [19, 3.0, -153], look: [31, -5.0, -168], fov: 40},
  {p: hallToWorld([-9.0, 2.6, -2.6]), look: hallToWorld([-2.0, 1.2, -2.5]), fov: 40},
  {p: hallToWorld([-4.8, 1.65, -2.6]), look: hallToWorld([-0.6, 1.05, -2.0]), fov: 40},
  // the three-quarter on the hero rack and the cart, from inside the aisle
  {p: hallToWorld([-2.5, 1.45, -2.85]), look: hallToWorld([-0.8, 0.95, -1.9]), fov: 39},
];
const K_WINDOW = 3;
const K_ROOM_GONE = 6;
const K_LEAVE_END = 8;

const buildPath = (keys: readonly PathKey[]) => {
  const n = keys.length;
  const divisions = (n - 1) * 200;
  const mk = (pts: readonly Vec3[]) => {
    const c = new THREE.CatmullRomCurve3(pts.map((q) => new THREE.Vector3(q[0], q[1], q[2])), false, 'centripetal');
    c.arcLengthDivisions = divisions;
    const lengths = c.getLengths(divisions);
    const total = lengths[divisions];
    // Key i sits at parameter i/(n-1); its arc-length fraction:
    const marks = keys.map((_, i) => lengths[Math.round((i / (n - 1)) * divisions)] / total);
    return {curve: c, marks};
  };
  const pos = mk(keys.map((k) => k.p));
  const look = mk(keys.map((k) => k.look));
  return {pos, look, fovs: keys.map((k) => k.fov)};
};
const PATH = buildPath(KEYS);

/** Camera pose at arc-length fraction t of the path. */
const poseAt = (t: number, out: {pos: THREE.Vector3; look: THREE.Vector3}): Rig => {
  const tt = Math.min(1, Math.max(0, t));
  const marks = PATH.pos.marks;
  let k = 0;
  while (k < marks.length - 2 && tt > marks[k + 1]) k++;
  const s = marks[k + 1] > marks[k] ? (tt - marks[k]) / (marks[k + 1] - marks[k]) : 0;
  PATH.pos.curve.getPointAt(tt, out.pos);
  PATH.look.curve.getPointAt(lerp(PATH.look.marks[k], PATH.look.marks[k + 1], s), out.look);
  return {position: [out.pos.x, out.pos.y, out.pos.z], target: [out.look.x, out.look.y, out.look.z], fov: lerp(PATH.fovs[k], PATH.fovs[k + 1], smooth(s))};
};

/** Path progress per beat. Overlapping segments hand over smoothly (both eased). */
const PATH_TRACK = [
  {beat: 'sr-leave', to: PATH.pos.marks[K_WINDOW], from: 0.0, until: 1.35, easing: ease.inOut},
  {beat: 'sr-leave', to: PATH.pos.marks[K_LEAVE_END], from: 0.95, until: 3.4, easing: ease.inOut},
  {beat: 'sr-arrive', to: 1, from: 0.0, until: 3.1, easing: ease.camera},
];

export const StillRunningScene: React.FC = () => {
  const th = useTheme();
  const time = useActiveTime();
  const b = useBeats(['sr-close', 'sr-leave', 'sr-arrive', 'sr-reveal']);
  const keyed = useCameraRig(CAM0, RIG_TRACK);
  const pathT = useScalarTrack(0, PATH_TRACK);
  const scratch = useMemo(() => ({pos: new THREE.Vector3(), look: new THREE.Vector3()}), []);

  // ---- sr-close: he shuts everything down -------------------------------------------
  const reach = b['sr-close'].at(0.1, 0.5, ease.inOut) * (1 - b['sr-close'].at(1.0, 1.7, ease.inOut)); // the hand goes to the mouse, then comes back
  const close = b['sr-close'].at(0.45, 1.1, ease.inOut); // the agent window squashes to a line
  const chatPower = 1 - b['sr-close'].at(1.2, 1.7, ease.inOut);
  const gamePower = 1 - b['sr-close'].at(1.45, 1.95, ease.inOut);
  const leanBack = b['sr-close'].at(0.9, 2.2, ease.inOut);
  const slump = 0.6 * b['sr-close'].at(1.3, 2.5, ease.inOut);
  const lampOn = 1 - b['sr-close'].at(2.3, 2.65, ease.inOut);
  const dark = b['sr-close'].at(1.2, 2.7, ease.inOut); // how far the room has gone dark
  const working = 1 - close;
  const game = useScreenTexture(GAME_MONITOR.px[0], GAME_MONITOR.px[1], (ctx, w, h) => paintGame(ctx, w, h, {time, knightX: 44, slimes: [{x: 150, lift: Math.abs(Math.sin(time * 3.2)) * 3}], editor: 0.3, power: gamePower}));
  const chat = useScreenTexture(CHAT_MONITOR.px[0], CHAT_MONITOR.px[1], (ctx, w, h) => paintChat(ctx, w, h, {time, theme: th, tab: 1, typed: 1, posted: 1, reply: 1, working, close, power: chatPower}));
  const pose = {typing: 0.25 * (1 - reach) * (1 - leanBack), lean: lerp(0.3, -0.6, leanBack), turn: lerp(0.38, 0.05, leanBack), reach, slump};
  const nightLight = lerp(1.5, 2.2, dark);
  const roomAmbient = lerp(1, 0.55, dark);
  const cables = useMemo<readonly Vec3[]>(() => [[GAME_MONITOR.position[0], GAME_MONITOR.position[1] - 0.15, GAME_MONITOR.position[2] - 0.05], [CHAT_MONITOR.position[0], CHAT_MONITOR.position[1] - 0.25, CHAT_MONITOR.position[2] - 0.05]], []);

  // ---- camera ----------------------------------------------------------------------------
  // Keyed in the room; on the path from the first frame of sr-leave; a slow push during sr-reveal.
  const onPath = pathT > 0;
  const pathRig = onPath ? poseAt(pathT, scratch) : keyed;
  const push = b['sr-reveal'].at(0.2, 2.5, ease.camera);
  const revealPos = hallToWorld([-2.35, 1.42, -2.8]);
  const revealTarget = hallToWorld([-0.82, 0.95, -1.88]);
  const rig: Rig = {
    position: [lerp(pathRig.position[0], revealPos[0], push), lerp(pathRig.position[1], revealPos[1], push), lerp(pathRig.position[2], revealPos[2], push)],
    target: [lerp(pathRig.target[0], revealTarget[0], push), lerp(pathRig.target[1], revealTarget[1], push), lerp(pathRig.target[2], revealTarget[2], push)],
    fov: lerp(pathRig.fov, 38, push),
  };

  // ---- the hall --------------------------------------------------------------------------
  const inside = b['sr-arrive'].at(0.25, 1.25, ease.inOut); // the building's shell fades as the camera reaches it
  const open = b['sr-reveal'].at(0.3, 1.5, ease.inOut); // the bay slides open
  const stateOf = (row: number, i: number) => {
    if (row === HERO_RACK.row && i === HERO_RACK.i) return {power: 1, activity: 1, agent: 1, open};
    return {power: 0.7, activity: 0.03 + (0.05 * ((row * 7 + i * 3) % 5)) / 4};
  };
  const logProgress = useScalarTrack(0.3, [{beat: 'sr-reveal', to: 1, from: 0.1, until: 2.6, easing: ease.linear}]);
  const terminal = useScreenTexture(288, 200, (ctx, w, h) => paintTerminal(ctx, w, h, {time, theme: th, progress: logProgress, lines: LOG_LINES, title: 'agent-runner — running'}));
  const heroLight = 6 + 5 * open;

  const showRoom = pathT < PATH.pos.marks[K_ROOM_GONE];
  const fog = lerp(lerp(0.014, 0.009, smooth(pathT / Math.max(1e-6, PATH.pos.marks[K_WINDOW + 1]))), 0.02, inside);

  return (
    <AbsoluteFill>
      <Stage3D rig={rig} bloom={{strength: 0.45, radius: 0.6, threshold: 1.0}} fog={fog} fogColor={th.color.void} background={th.color.void} exposure={1.2} shadows>
        {showRoom ? (
          <DevRoom room={roomAmbient}>
            <WindowLight intensity={nightLight} />
            <Desk>
              <Monitor position={GAME_MONITOR.position} width={GAME_MONITOR.width} height={GAME_MONITOR.height} yaw={GAME_MONITOR.yaw} map={game} tint={th.tone.human.base} light={0.85} power={gamePower} />
              <Monitor position={CHAT_MONITOR.position} width={CHAT_MONITOR.width} height={CHAT_MONITOR.height} yaw={CHAT_MONITOR.yaw} map={chat} tint={th.tone.mind.base} light={1.3} power={chatPower} />
              <Keyboard />
              <Mouse />
              <Mug />
              <Lamp on={lampOn} />
              <Plant />
              <DeskCables from={cables} />
            </Desk>
            <Developer pose={pose} time={time} />
          </DevRoom>
        ) : null}
        <Outside lights={1} mind={0.4} shell={1 - inside} />
        {/* The data hall inside the building */}
        <group position={[HALL_TO_WORLD.position[0], HALL_TO_WORLD.position[1], HALL_TO_WORLD.position[2]]} rotation={[0, HALL_TO_WORLD.yaw, 0]}>
          <DataHall stateOf={stateOf} hero={HERO_RACK} time={time} lights={0.15} room={1.4} />
          {/* The busy rack's light on the aisle floor */}
          <pointLight position={[HERO_BAY_LOCAL[0], 1.1, HERO_BAY_LOCAL[2] - 0.5]} intensity={heroLight} color={th.tone.mind.base} distance={6} decay={2} />
          <CrashCart position={CART_POS} yaw={CART_YAW} map={terminal} tint={th.color.text} light={0.8} cableTo={CART_CABLE_TO} />
        </group>
      </Stage3D>
    </AbsoluteFill>
  );
};

/** Exported for tests and tooling: where the story's machine is, in world coordinates. */
export const STILL_RUNNING_HERO_BAY = HERO_BAY;
