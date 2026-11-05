import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Curve2, type Pt} from '../../../components/cyber/svg/curve';
import {Trace} from '../../../components/cyber/svg/Signal2D';
import {Canvas, Check, StoryBackdrop, Tower, World, blink, clamp01, ease, f2, lerp, seg, toScreen} from '../../../components/story';
import {useActiveTime, useBeats, useCamera} from '../../../engine';
import {alpha, cyber} from '../../../styles/cyber';
import {useTheme} from '../../../styles/ThemeContext';

/**
 * S05 · Tests pass, but a bug remains (2D, one continuous world).
 *
 * Cast (what each object stands for, and why it is here):
 *   - test runner panel   a list of eight tests. Names are bars, status is a
 *                         circle that becomes a green check; a progress bar
 *                         fills above them. It is the thing everyone looks at.
 *   - the big check       "all passed". It lifts off the panel and stays in the
 *                         corner of the frame for the rest of the scene, so the
 *                         verdict and the bug are on screen together.
 *   - the door            the panel is hinged at its left edge. It swings open
 *                         to show that the tests were a front: the system sits
 *                         behind them.
 *   - the system          six parts wired together: a gateway, two servers
 *                         (towers), a queue, a database and a scheduler.
 *   - probe lines         one per test, from the row to the part it checks.
 *                         The checked parts light green: coverage made visible.
 *   - the scheduler       the one part no probe reaches. Inside its window a
 *                         six-legged beetle twitches, and a hairline crack of
 *                         threat red grows. Nothing tested it.
 *
 * Beats:
 *   tp-run    rows tick green one by one; the progress bar fills.
 *   tp-pass   the big check stamps in; the door starts to swing.
 *   tp-open   the door opens, the camera pulls back, probes draw to their
 *             parts and those parts light green. The check lifts to the corner.
 *   tp-bug    the camera pushes on the one unlit part: the beetle, the crack.
 *             Hold: green check top-left, bug in the shadow.
 */

/* ------------------------------------------------------------------ test panel */
const PANEL = {x: -360, y: -310, w: 720, h: 620};
const ROWS = 8;
const ROW_H = 52;
const ROWS_TOP = PANEL.y + 150;
const rowY = (i: number) => ROWS_TOP + i * ROW_H + ROW_H / 2;
const NAME_W = [250, 190, 300, 220, 160, 270, 210, 240];
const DUR_W = [34, 22, 48, 30, 18, 40, 26, 36];

/* ------------------------------------------------------------------ the system */
type Comp = {readonly id: 'gateway' | 'api' | 'worker' | 'queue' | 'db' | 'sched'; readonly x: number; readonly y: number; readonly w: number; readonly h: number};
const COMPS: readonly Comp[] = [
  {id: 'gateway', x: -20, y: 20, w: 150, h: 130},
  {id: 'api', x: 250, y: -190, w: 90, h: 170},
  {id: 'worker', x: 250, y: 250, w: 90, h: 170},
  {id: 'queue', x: 560, y: 40, w: 210, h: 96},
  {id: 'db', x: 870, y: -200, w: 150, h: 190},
  {id: 'sched', x: 900, y: 250, w: 200, h: 170},
];
const comp = (id: Comp['id']) => COMPS.find((c) => c.id === id) as Comp;
/** Which part each test row checks. The scheduler is in nobody's list. */
const PROBE_TARGET: readonly Comp['id'][] = ['gateway', 'api', 'api', 'queue', 'worker', 'db', 'db', 'gateway'];

const edge = (c: Comp, side: 'l' | 'r' | 't' | 'b', off = 0): Pt =>
  side === 'l' ? {x: c.x - c.w / 2, y: c.y + off} : side === 'r' ? {x: c.x + c.w / 2, y: c.y + off} : side === 't' ? {x: c.x + off, y: c.y - c.h / 2} : {x: c.x + off, y: c.y + c.h / 2};

const WIRES: readonly Curve2[] = [
  Curve2.route([edge(comp('gateway'), 'r', -30), {x: 130, y: -10}, {x: 130, y: comp('api').y}, edge(comp('api'), 'l')], 30),
  Curve2.route([edge(comp('gateway'), 'r', 30), {x: 130, y: 50}, {x: 130, y: comp('worker').y}, edge(comp('worker'), 'l')], 30),
  Curve2.route([edge(comp('api'), 'r'), {x: 400, y: comp('api').y}, {x: 400, y: comp('queue').y - 20}, edge(comp('queue'), 'l', -20)], 30),
  Curve2.route([edge(comp('worker'), 'r'), {x: 400, y: comp('worker').y}, {x: 400, y: comp('queue').y + 20}, edge(comp('queue'), 'l', 20)], 30),
  Curve2.route([edge(comp('queue'), 'r', -20), {x: 740, y: comp('queue').y - 20}, {x: 740, y: comp('db').y}, edge(comp('db'), 'l')], 30),
  Curve2.route([edge(comp('queue'), 'r', 20), {x: 740, y: comp('queue').y + 20}, {x: 740, y: comp('sched').y}, edge(comp('sched'), 'l')], 30),
  Curve2.route([edge(comp('db'), 'b'), {x: comp('db').x, y: comp('sched').y - comp('sched').h / 2 - 1}], 30),
];

/** The crack in the scheduler, local to its centre. */
const CRACK = Curve2.polyline([
  {x: 100, y: -85},
  {x: 78, y: -62},
  {x: 84, y: -40},
  {x: 60, y: -22},
  {x: 66, y: 4},
  {x: 44, y: 18},
  {x: 50, y: 42},
  {x: 30, y: 58},
]);

/* ------------------------------------------------------------------ the beetle */
const pixels = (rows: readonly string[]) => {
  let d = '';
  rows.forEach((r, y) => {
    for (let x = 0; x < r.length; x++) if (r[x] === 'x') d += `M${x} ${y}h1v1h-1z`;
  });
  return d;
};
const BEETLE_BODY = pixels(['....x.x....', '...xxxxx...', '..xxxxxxx..', '..xxxxxxx..', '..xxxxxxx..', '...xxxxx...', '....xxx....']);
const BEETLE_EYES = pixels(['...........', '...x...x...']);
const BEETLE_LEGS = [
  pixels(['x.........x', '.x.......x.', '...........', 'xx.......xx', '...........', '.x.......x.', 'x.........x']),
  pixels(['...........', 'xx.......xx', '...........', '.x.......x.', 'x.........x', '.x.......x.', '...........']),
];

const Beetle: React.FC<{readonly x: number; readonly y: number; readonly px: number; readonly pose: number; readonly awake: number}> = ({x, y, px, pose, awake}) => {
  const th = useTheme();
  const t = th.tone.threat;
  return (
    <g transform={`translate(${f2(x - 5.5 * px)} ${f2(y - 3.5 * px)}) scale(${f2(px)})`} shapeRendering="crispEdges">
      <path d={BEETLE_BODY} fill={alpha(t.deep, 0.95)} />
      <path d={BEETLE_LEGS[pose]} fill={alpha(t.deep, 0.95)} />
      <path d={BEETLE_EYES} fill={t.base} opacity={0.35 + 0.65 * awake} />
    </g>
  );
};

/* ------------------------------------------------------------------ components */
const Lit: React.FC<{readonly c: Comp; readonly lit: number}> = ({c, lit}) => {
  const th = useTheme();
  if (lit <= 0.001) return null;
  const pad = 16;
  return (
    <g>
      <rect x={c.x - c.w / 2 - pad} y={c.y - c.h / 2 - pad} width={c.w + pad * 2} height={c.h + pad * 2} rx={th.radius + 6} fill={alpha(th.tone.safe.base, 0.1 * lit * th.glow)} />
      <rect x={c.x - c.w / 2 - pad} y={c.y - c.h / 2 - pad} width={c.w + pad * 2} height={c.h + pad * 2} rx={th.radius + 6} fill="none" stroke={th.tone.safe.base} strokeWidth={3} opacity={lit} />
    </g>
  );
};

const Led: React.FC<{readonly x: number; readonly y: number; readonly seed: number; readonly time: number}> = ({x, y, seed, time}) => {
  const th = useTheme();
  return <rect x={x} y={y} width={12} height={4} fill={th.tone.system.base} opacity={blink(seed, time, 1, 0.6)} />;
};

const Gateway: React.FC<{readonly c: Comp; readonly time: number}> = ({c, time}) => {
  const th = useTheme();
  const k = th.color;
  return (
    <g transform={`translate(${f2(c.x)} ${f2(c.y)})`}>
      <rect x={-c.w / 2} y={-c.h / 2} width={c.w} height={c.h} rx={th.radius} fill={k.slate} stroke={alpha(k.steel, 0.95)} strokeWidth={2.5} />
      {/* an archway with an arrow going in: the entrance */}
      <path d="M-40 30V-8a40 40 0 0 1 80 0V30" fill="none" stroke={alpha(k.steel, 0.9)} strokeWidth={4} />
      <path d="M-62 10h50M-12 10l-14 -12M-12 10l-14 12" fill="none" stroke={th.tone.system.base} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
      <Led x={c.w / 2 - 26} y={-c.h / 2 + 12} seed={11} time={time} />
    </g>
  );
};

const Queue: React.FC<{readonly c: Comp; readonly time: number}> = ({c, time}) => {
  const th = useTheme();
  const k = th.color;
  const slot = (c.w - 40) / 5;
  return (
    <g transform={`translate(${f2(c.x)} ${f2(c.y)})`}>
      <rect x={-c.w / 2} y={-c.h / 2} width={c.w} height={c.h} rx={th.radius} fill={k.slate} stroke={alpha(k.steel, 0.95)} strokeWidth={2.5} />
      {Array.from({length: 5}, (_, i) => {
        const filled = i < 3 - (Math.floor(time * 1.5) % 2);
        return <rect key={i} x={-c.w / 2 + 20 + i * slot + 4} y={-24} width={slot - 8} height={48} rx={3} fill={filled ? alpha(th.tone.system.base, 0.55) : alpha(k.abyss, 0.9)} stroke={alpha(k.steel, 0.6)} strokeWidth={1.2} />;
      })}
      <Led x={c.w / 2 - 26} y={-c.h / 2 + 10} seed={23} time={time} />
    </g>
  );
};

const Database: React.FC<{readonly c: Comp; readonly time: number}> = ({c, time}) => {
  const th = useTheme();
  const k = th.color;
  const rx = c.w / 2;
  const ry = 22;
  const top = -c.h / 2 + ry;
  const bot = c.h / 2 - ry;
  return (
    <g transform={`translate(${f2(c.x)} ${f2(c.y)})`}>
      <path d={`M${-rx} ${top}v${bot - top}a${rx} ${ry} 0 0 0 ${2 * rx} 0v${top - bot}`} fill={k.slate} stroke={alpha(k.steel, 0.95)} strokeWidth={2.5} />
      <ellipse cx={0} cy={top} rx={rx} ry={ry} fill={k.slate} stroke={alpha(k.steel, 0.95)} strokeWidth={2.5} />
      {[0.3, 0.6].map((f) => (
        <path key={f} d={`M${-rx} ${lerp(top, bot, f)}a${rx} ${ry} 0 0 0 ${2 * rx} 0`} fill="none" stroke={alpha(k.steel, 0.7)} strokeWidth={2} />
      ))}
      <Led x={rx - 30} y={bot - 2} seed={37} time={time} />
    </g>
  );
};

const Scheduler: React.FC<{readonly c: Comp; readonly time: number; readonly awake: number; readonly crack: number; readonly heat: number}> = ({c, time, awake, crack, heat}) => {
  const th = useTheme();
  const k = th.color;
  // The beetle twitches in bursts: a leg pose that flips a few times a second, only while a gate is open.
  const gate = blink(5, time, 0.9, 0.45) > 0.5 ? 1 : 0;
  const pose = gate && Math.floor(time * 9) % 2 === 0 ? 1 : 0;
  const jitter = gate * awake * (Math.floor(time * 9) % 3 === 0 ? 1 : 0);
  const win = {x: -65, y: -5, w: 130, h: 90};
  return (
    <g transform={`translate(${f2(c.x)} ${f2(c.y)})`}>
      {heat > 0.001 ? <rect x={-c.w / 2 - 30} y={-c.h / 2 - 30} width={c.w + 60} height={c.h + 60} rx={th.radius + 12} fill={alpha(th.tone.threat.base, 0.08 * heat * th.glow)} /> : null}
      <rect x={-c.w / 2} y={-c.h / 2} width={c.w} height={c.h} rx={th.radius} fill={k.slate} stroke={alpha(k.steel, 0.95)} strokeWidth={2.5} />
      {/* clock: a scheduler */}
      <circle cx={-c.w / 2 + 34} cy={-c.h / 2 + 34} r={16} fill={k.abyss} stroke={alpha(k.steel, 0.9)} strokeWidth={2} />
      <path d={`M${-c.w / 2 + 34} ${-c.h / 2 + 34}v-10M${-c.w / 2 + 34} ${-c.h / 2 + 34}h7`} stroke={alpha(k.steel, 0.95)} strokeWidth={2.5} strokeLinecap="round" />
      <Led x={c.w / 2 - 26} y={-c.h / 2 + 12} seed={41} time={time} />
      <Led x={c.w / 2 - 44} y={-c.h / 2 + 12} seed={43} time={time} />
      {/* the window into it */}
      <rect x={win.x} y={win.y} width={win.w} height={win.h} rx={4} fill={k.void} stroke={alpha(k.steel, 0.7)} strokeWidth={2} />
      <Beetle x={win.x + win.w / 2 + jitter * 3} y={win.y + win.h / 2 + 6 - jitter * 2} px={8} pose={pose} awake={awake} />
      {crack > 0.001 ? (
        <>
          <Trace curve={CRACK} to={crack} color={th.tone.threat.base} width={2.5} halo={10} cap="butt" />
          <Trace curve={CRACK} to={crack} color={th.tone.threat.hot} width={1} cap="butt" opacity={0.8} />
        </>
      ) : null}
    </g>
  );
};

/* ------------------------------------------------------------------ camera */
const CAM_INITIAL = {x: 0, y: 0, zoom: 1.25};
const CAM_TRACK = [
  {beat: 'tp-pass', to: {x: 60, y: 0, zoom: 1.05}, from: 0, until: 1.2, easing: ease.camera},
  {beat: 'tp-pass', to: {x: 160, y: 5, zoom: 0.95}, from: 1.5, until: 2.2, easing: ease.camera},
  {beat: 'tp-open', to: {x: 300, y: 10, zoom: 0.85}, from: 0, until: 1.8, easing: ease.camera},
  {beat: 'tp-bug', to: {x: 880, y: 230, zoom: 2.2}, from: 0.1, until: 2.1, easing: ease.camera},
];

export const TestsPassScene: React.FC = () => {
  const th = useTheme();
  const k = th.color;
  const safe = th.tone.safe;
  const time = useActiveTime();
  const b = useBeats(['tp-run', 'tp-pass', 'tp-open', 'tp-bug']);
  const cam = useCamera(CAM_INITIAL, CAM_TRACK);

  // ---- the test run ---------------------------------------------------------
  const ticks = Array.from({length: ROWS}, (_, i) => b['tp-run'].stagger(i, {start: 0.25, each: 0.24, dur: 0.35, easing: ease.out}));
  const progress = ticks.reduce((a, t) => a + t, 0) / ROWS;
  const cursor = ticks.findIndex((t) => t < 1);
  const pass = b['tp-pass'].at(0.05, 0.8, ease.out);
  const flash = Math.sin(Math.PI * b['tp-pass'].at(0, 1.1));

  // ---- the door --------------------------------------------------------------
  // One linear ramp across two beats (equal rates), eased once, so the swing never stops.
  const open = ease.inOut(b['tp-pass'].at(1.7, 2.2) * 0.25 + b['tp-open'].at(0, 1.5) * 0.75);
  const sx = lerp(1, 0.2, open);
  const tilt = -10 * open;
  const tan = Math.tan((tilt * Math.PI) / 180);
  const door = `translate(${f2(PANEL.x)} 0) skewY(${f2(tilt)}) scale(${f2(sx)} 1) translate(${f2(-PANEL.x)} 0)`;
  const doorPoint = (x: number, y: number): Pt => ({x: PANEL.x + (x - PANEL.x) * sx, y: y + (x - PANEL.x) * sx * tan});
  const reveal = b['tp-open'].at(0, 1.4, ease.inOut);
  const lift = b['tp-open'].at(0, 1.2, ease.inOut);

  // ---- probes ------------------------------------------------------------------
  const probes = Array.from({length: ROWS}, (_, i) => b['tp-open'].stagger(i, {start: 0.9, each: 0.14, dur: 0.7, easing: ease.out}));
  const lit = (id: Comp['id']) => Math.max(0, ...probes.map((p, i) => (PROBE_TARGET[i] === id ? seg(p, 0.8, 1) : 0)));
  const probeCurves = PROBE_TARGET.map((id, i) => {
    const c = comp(id);
    const twin = PROBE_TARGET.filter((t) => t === id).length > 1 ? (PROBE_TARGET.indexOf(id) === i ? -18 : 18) : 0;
    const start = doorPoint(PANEL.x + PANEL.w - 36, rowY(i));
    return Curve2.link(start, edge(c, 'l', twin), 'x', 0.5);
  });

  // ---- the bug -------------------------------------------------------------------
  const awake = b['tp-bug'].at(0.3, 1.0);
  const crack = b['tp-bug'].at(0.7, 2.1, ease.out);
  const heat = b['tp-bug'].at(1.0, 2.4);

  // ---- the big check: on the panel, then lifted into the corner of the frame ----
  const anchor = toScreen(cam, PANEL.x + PANEL.w / 2, PANEL.y + PANEL.h / 2 + 20);
  const checkPos = {x: lerp(anchor.x, 230, lift), y: lerp(anchor.y, 200, lift)};
  const checkR = lerp(120 * cam.zoom, 84, lift);

  return (
    <AbsoluteFill>
      <StoryBackdrop intensity={0.5} />
      <Canvas>
        <World cam={cam}>
          {/* The system behind the panel: in shadow until the door opens. */}
          <g opacity={lerp(0.3, 1, reveal)}>
            {WIRES.map((w, i) => (
              <path key={i} d={w.d} fill="none" stroke={alpha(k.steel, 0.9)} strokeWidth={5} strokeLinecap="round" />
            ))}
            {COMPS.map((c) => (
              <Lit key={c.id} c={c} lit={lit(c.id)} />
            ))}
            <Gateway c={comp('gateway')} time={time} />
            <Tower x={comp('api').x} y={comp('api').y + comp('api').h / 2} s={0.55} time={time} seed={2} />
            <Tower x={comp('worker').x} y={comp('worker').y + comp('worker').h / 2} s={0.55} time={time} seed={7} />
            <Queue c={comp('queue')} time={time} />
            <Database c={comp('db')} time={time} />
            <Scheduler c={comp('sched')} time={time} awake={awake} crack={crack} heat={heat} />
          </g>

          {/* The test runner: a door hinged on its left edge. */}
          <g transform={door}>
            <rect x={PANEL.x} y={PANEL.y} width={PANEL.w} height={PANEL.h} rx={th.radius} fill={k.abyss} stroke={alpha(k.steel, 0.95)} strokeWidth={2.5} />
            <rect x={PANEL.x} y={PANEL.y} width={PANEL.w} height={PANEL.h} rx={th.radius} fill={alpha(safe.base, 0.12 * flash)} />
            {/* title bar */}
            <rect x={PANEL.x} y={PANEL.y} width={PANEL.w} height={56} rx={th.radius} fill={alpha(k.slate, 0.9)} />
            {[0, 1, 2].map((i) => (
              <circle key={i} cx={PANEL.x + 30 + i * 22} cy={PANEL.y + 28} r={6} fill={alpha(k.steel, 0.9)} />
            ))}
            <rect x={PANEL.x + 110} y={PANEL.y + 22} width={150} height={12} rx={3} fill={alpha(k.steel, 0.8)} />
            {/* progress bar */}
            <rect x={PANEL.x + 40} y={PANEL.y + 84} width={PANEL.w - 80} height={14} rx={4} fill={alpha(k.slate, 0.95)} stroke={alpha(k.steel, 0.6)} strokeWidth={1.5} />
            {progress > 0.001 ? <rect x={PANEL.x + 40} y={PANEL.y + 84} width={(PANEL.w - 80) * progress} height={14} rx={4} fill={safe.base} /> : null}
            {/* rows */}
            {ticks.map((t, i) => {
              const y = rowY(i);
              const running = i === cursor && b['tp-run'].started && !b['tp-run'].done ? 1 : 0;
              return (
                <g key={i}>
                  <rect x={PANEL.x + 16} y={y - ROW_H / 2 + 3} width={PANEL.w - 32} height={ROW_H - 6} rx={4} fill={alpha(t > 0 ? safe.base : th.tone.system.base, t > 0 ? 0.07 * t : 0.1 * running)} />
                  <circle cx={PANEL.x + 56} cy={y} r={14} fill={t > 0 ? alpha(safe.deep, 0.9) : alpha(k.slate, 0.9)} stroke={t > 0 ? safe.base : alpha(k.steel, 0.9)} strokeWidth={2} />
                  {running ? <circle cx={PANEL.x + 56} cy={y} r={5} fill={th.tone.system.base} opacity={0.5 + 0.5 * Math.sin(time * 9)} /> : null}
                  {t > 0 ? (
                    <path
                      d={`M${PANEL.x + 56 - 6.5} ${y + 0.5}L${PANEL.x + 56 - 1.5} ${y + 5}L${PANEL.x + 56 + 7} ${y - 5}`}
                      fill="none"
                      stroke={safe.hot}
                      strokeWidth={2.6}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      pathLength={1}
                      strokeDasharray="1 1"
                      strokeDashoffset={1 - t}
                    />
                  ) : null}
                  <text x={PANEL.x + 92} y={y + 7} fontFamily={cyber.font.mono} fontSize={20} fill={t > 0 ? k.text : k.dim} opacity={0.9}>
                    {`test ${String(i + 1).padStart(2, '0')}`}
                  </text>
                  <rect x={PANEL.x + 200} y={y - 6} width={NAME_W[i]} height={12} rx={3} fill={alpha(k.steel, 0.85)} />
                  <rect x={PANEL.x + PANEL.w - 36 - DUR_W[i]} y={y - 4} width={DUR_W[i]} height={8} rx={2} fill={alpha(k.dim, 0.5 + 0.5 * t)} />
                </g>
              );
            })}
            {/* shading as the door turns away */}
            <rect x={PANEL.x} y={PANEL.y} width={PANEL.w} height={PANEL.h} rx={th.radius} fill={alpha(k.void, 0.5 * open)} />
          </g>
          {/* hinge */}
          <rect x={PANEL.x - 5} y={PANEL.y - 4} width={10} height={PANEL.h + 8} rx={3} fill={k.steel} opacity={open} />

          {/* Probe lines: from each row to the part it checks. */}
          {probeCurves.map((c, i) =>
            probes[i] > 0.001 ? (
              <g key={i}>
                <Trace curve={c} to={probes[i]} color={safe.base} width={3} halo={14} />
                <circle cx={c.pointAt(probes[i]).x} cy={c.pointAt(probes[i]).y} r={6} fill={safe.hot} opacity={probes[i] < 1 ? 1 : 0.9} />
              </g>
            ) : null,
          )}
        </World>

        {/* The verdict, in screen space once it lifts off the panel. */}
        {pass > 0.001 ? (
          <g>
            {lift > 0.001 ? <circle cx={checkPos.x} cy={checkPos.y} r={checkR * 1.35} fill={alpha(safe.base, 0.12 * lift * th.glow)} /> : null}
            <Check x={checkPos.x} y={checkPos.y} r={checkR} p={clamp01(pass)} />
          </g>
        ) : null}
      </Canvas>
    </AbsoluteFill>
  );
};
