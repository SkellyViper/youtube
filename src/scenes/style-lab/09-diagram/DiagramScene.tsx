import React from 'react';
import {AbsoluteFill} from 'remotion';
import {DotGrid} from '../../../components/backdrop/Backdrop';
import {AgentGlyph, Comet2D, SceneAtmosphere, Trace} from '../../../components/cyber';
import {Pictogram} from '../../../components/cyber/svg/Pictograms';
import {makeProjector, useActiveTime, useBeats, useScalarTrack} from '../../../engine';
import {cyber, mix, motion} from '../../../styles/cyber';
import * as L from './layout';

/**
 * Sample 09: a technical explanation with almost no text.
 *
 * A prompt (blue capsule) sends its content as a comet to a dormant agent.
 * The agent wakes (blue -> purple), acts on a data store (a plate is pulled
 * out and re-slotted, lit purple), and from that changed object consequences
 * fan out to second- and third-order systems while the 2D camera pulls back
 * to keep the growing chain in frame. At the far end two consequences turn
 * red and a feedback path curls back under the floor towards the agent.
 *
 * Everything is a pure function of beat progress; the only ambient motion
 * (the agent's rings) runs on useActiveTime().
 */

const BEATS = ['dia-prompt', 'dia-agent', 'dia-action', 'dia-consequences', 'dia-loss'] as const;
const W = 1920;
const H = 1080;
const HY = L.HORIZON * H;
const TAIL_MAIN = 120;
const TAIL_CHAIN = 100;
const C = cyber.color;
/** `rgb(...)` (the output of `mix`) -> `rgba(...)`. */
const withAlpha = (rgb: string, a: number) => rgb.replace('rgb(', 'rgba(').replace(')', `, ${Math.min(1, Math.max(0, a)).toFixed(3)})`);

type Link = {
  readonly draw: number;
  readonly comet: number;
};
type Obj = {
  readonly lit: number;
  readonly act: number;
  readonly bracket: number;
  /** 0 = purple, 1 = red. */
  readonly red: number;
  readonly link: Link;
};

const useDiagramState = () => {
  const b = useBeats(BEATS);
  const t = useActiveTime();
  const B1 = b['dia-prompt'];
  const B2 = b['dia-agent'];
  const B3 = b['dia-action'];
  const B4 = b['dia-consequences'];
  const B5 = b['dia-loss'];

  // Beat 1: the prompt appears, a path draws to the agent, the content travels it.
  const capsule = B1.at(0, 0.6, motion.arrive);
  const promptDraw = B1.at(0.3, 0.9, motion.glide);
  const promptComet = B1.at(0.5, 1.4, motion.signal);
  const promptLand = 0.5 + 0.9 * L.landing(L.PROMPT_LINK, TAIL_MAIN);
  const touched = B1.at(promptLand - 0.02, 1.4, motion.ignite);
  const send = B1.at(0.45, 0.85, motion.glide);

  // Beat 2: the agent wakes.
  const wake = B2.at(0.05, 1.05, motion.arrive);
  const warm = B2.at(0.1, 0.95, motion.glide);
  const kick = B2.at(0.05, 1.25, motion.glide);
  const flare = Math.sin(Math.PI * B2.at(0.4, 1.3));
  const ripple = B2.at(0.45, 1.35, motion.arrive);

  // Beat 3: it acts on the store.
  const actDraw = B3.at(0, 0.6, motion.glide);
  const actComet = B3.at(0.25, 1.1, motion.signal);
  const actLand = 0.25 + 0.85 * L.landing(L.ACTION_LINK, TAIL_MAIN);
  const primary: Obj = {
    lit: B3.at(actLand - 0.02, actLand + 0.3, motion.ignite),
    act: B3.at(actLand + 0.05, 1.65, motion.glide),
    bracket: B3.at(actLand + 0.1, actLand + 0.5, motion.ignite) * (1 - 0.75 * B4.at(0.1, 0.9, motion.glide)),
    red: 0,
    link: {draw: actDraw, comet: actComet},
  };
  const agentPush = Math.sin(Math.PI * B3.at(0, 0.5));

  // Beat 4: consequences, staggered by depth in the chain.
  const second: Obj[] = L.SECOND.map((_, k) => {
    const s0 = k * 0.12;
    const land = s0 + 0.2 + 0.7 * L.landing(L.SECOND_LINKS[k], TAIL_CHAIN);
    return {
      lit: B4.at(land - 0.02, land + 0.28, motion.ignite),
      act: B4.at(land, land + 0.55, motion.glide),
      bracket: 0,
      red: 0,
      link: {draw: B4.at(s0, s0 + 0.5, motion.glide), comet: B4.at(s0 + 0.2, s0 + 0.9, motion.signal)},
    };
  });
  const third: Obj[] = L.THIRD.map((_, j) => {
    const t0 = 0.95 + j * 0.08;
    const land = t0 + 0.18 + 0.64 * L.landing(L.THIRD_LINKS[j], TAIL_CHAIN);
    const lostIndex = L.LOST.indexOf(j);
    const red = lostIndex < 0 ? 0 : B5.at(0.05 + lostIndex * 0.2, 0.6 + lostIndex * 0.2, motion.glide);
    const redBracket = lostIndex < 0 ? 0 : B5.at(0.12 + lostIndex * 0.2, 0.55 + lostIndex * 0.2, motion.ignite);
    return {
      lit: B4.at(land - 0.02, land + 0.26, motion.ignite),
      act: B4.at(land, land + 0.42, motion.glide),
      bracket: redBracket,
      red,
      link: {draw: B4.at(t0, t0 + 0.45, motion.glide), comet: B4.at(t0 + 0.18, t0 + 0.82, motion.signal)},
    };
  });
  const groundExt = B4.at(0.4, 1.8, motion.glide);

  // Beat 5: loss. A feedback path curls back under the floor.
  const feedback = B5.at(0.5, 1.5, motion.signal);
  const hazeRed = B5.at(0.3, 1.5, motion.glide);

  const agent = {
    open: 0.35 + 0.07 * touched + 0.58 * wake,
    calm: 1 - warm,
    energy: 0.3 + 0.15 * touched + 0.55 * wake + 0.5 * flare + 0.3 * agentPush,
    spin: t * (0.3 + 0.7 * wake) + 2.4 * kick,
  };

  return {capsule, promptDraw, promptComet, send, agent, ripple, primary, second, third, groundExt, feedback, hazeRed};
};

type State = ReturnType<typeof useDiagramState>;

/** Zone marks: ground lines with end ticks, column ticks and a few corner brackets. Instrument marks, not boxes. */
const ZoneMarks: React.FC<{readonly s: State}> = ({s}) => {
  const Z = L.ZONES;
  const gy = L.GROUND_Y;
  const worldX1 = Z.world.x1Initial + (Z.world.x1Final - Z.world.x1Initial) * s.groundExt;
  const lines = `M${Z.prompt.x0} ${gy}H${Z.prompt.x1}M${Z.agent.x0} ${gy}H${Z.agent.x1}M${Z.world.x0} ${gy}H${worldX1.toFixed(1)}`;
  const ticks = [Z.prompt.x0, Z.prompt.x1, Z.agent.x0, Z.agent.x1, Z.world.x0, worldX1].map((x) => `M${x.toFixed(1)} ${gy}V${gy - 8}`).join('');
  const cols = L.COLUMNS.filter((x) => x < worldX1 - 20)
    .map((x) => `M${x} ${gy}V${gy - 5}`)
    .join('');
  // Corner brackets standing off the agent zone: an instrument mark, not a box.
  const arm = 12;
  const corner = (x: number, y: number, sx: number, sy: number) => `M${x} ${y + sy * arm}V${y}H${x + sx * arm}`;
  const ay0 = L.ROW - 140;
  const ay1 = L.ROW + 140;
  const agentBox = [corner(Z.agent.x0 - 8, ay0, 1, 1), corner(Z.agent.x1 + 8, ay0, -1, 1), corner(Z.agent.x1 + 8, ay1, -1, -1), corner(Z.agent.x0 - 8, ay1, 1, -1)].join('');
  return (
    <g fill="none" stroke={C.steel} strokeWidth={cyber.line.hair}>
      <path d={lines} opacity={0.8} />
      <path d={ticks + cols} opacity={0.8} />
      <path d={agentBox} opacity={0.6} />
    </g>
  );
};

const objColor = (o: Obj) => (o.red > 0 ? mix(C.purple, C.red, o.red) : C.purple);
const objHot = (o: Obj) => (o.red > 0 ? mix(C.purpleHot, C.redHot, o.red) : C.purpleHot);

/** The diagram in world coordinates. Rendered once in front and once, reduced, as a floor reflection. */
const Ink: React.FC<{readonly s: State; readonly reflection?: boolean}> = ({s, reflection = false}) => {
  const feedbackTail = 90;
  const feedbackPass = s.feedback / (1 + feedbackTail / L.FEEDBACK.length);
  return (
    <>
      {reflection ? null : <ZoneMarks s={s} />}

      {/* Links: cause before effect. The line draws, the comet travels, then the target reacts. */}
      <Trace curve={L.PROMPT_LINK} to={s.promptDraw} color={C.blue} width={cyber.line.thin} halo={7} />
      <Trace curve={L.ACTION_LINK} to={s.primary.link.draw} color={C.purple} width={cyber.line.thin} halo={7} />
      {L.SECOND_LINKS.map((curve, k) => (
        <Trace key={k} curve={curve} to={s.second[k].link.draw} color={C.purple} width={1.75} halo={6} />
      ))}
      {L.THIRD_LINKS.map((curve, j) => {
        const o = s.third[j];
        return (
          <g key={j}>
            <Trace curve={curve} to={o.link.draw} color={C.purple} width={1.75} halo={6} />
            {o.red > 0 ? <Trace curve={curve} from={1 - 0.55 * o.red} to={1} color={C.red} width={1.75} halo={6} opacity={o.red} /> : null}
          </g>
        );
      })}
      {reflection ? null : (
        <>
          <Trace curve={L.FEEDBACK} to={s.feedback} color={C.red} width={cyber.line.thin} halo={7} />
          <Comet2D curve={L.FEEDBACK} t={feedbackPass} color={C.red} tail={feedbackTail} width={3} persist />
        </>
      )}

      {/* Objects. In the reflection only lit things show. */}
      <Pictogram kind="message" x={L.PROMPT.x} y={L.PROMPT.y} size={L.SIZE} color={C.blue} hot={C.blueHot} level={1} appear={s.capsule} act={s.send} />
      <Pictogram
        kind={L.PRIMARY.kind}
        x={L.PRIMARY.x}
        y={L.PRIMARY.y}
        size={L.SIZE}
        color={C.purple}
        hot={C.purpleHot}
        level={s.primary.lit}
        act={s.primary.act}
        bracket={s.primary.bracket}
        opacity={reflection && s.primary.lit < 0.03 ? 0 : 1}
      />
      {L.SECOND.map((o, k) => (
        <Pictogram key={o.id} kind={o.kind} x={o.x} y={o.y} size={L.SIZE} color={C.purple} hot={C.purpleHot} level={s.second[k].lit} act={s.second[k].act} opacity={reflection && s.second[k].lit < 0.03 ? 0 : 1} />
      ))}
      {L.THIRD.map((o, j) => {
        const st = s.third[j];
        return (
          <Pictogram
            key={o.id}
            kind={o.kind}
            x={o.x}
            y={o.y}
            size={L.SIZE}
            color={objColor(st)}
            hot={objHot(st)}
            level={st.lit}
            act={st.act}
            bracket={st.bracket}
            opacity={reflection && st.lit < 0.03 ? 0 : 1}
          />
        );
      })}

      {/* Comets travel above the objects they leave. */}
      <Comet2D curve={L.PROMPT_LINK} t={s.promptComet} color={C.blue} tail={TAIL_MAIN} width={3.5} />
      <Comet2D curve={L.ACTION_LINK} t={s.primary.link.comet} color={C.purple} tail={TAIL_MAIN} width={3.5} />
      {L.SECOND_LINKS.map((curve, k) => (
        <Comet2D key={k} curve={curve} t={s.second[k].link.comet} color={C.purple} tail={TAIL_CHAIN} width={3} />
      ))}
      {L.THIRD_LINKS.map((curve, j) => (
        <Comet2D key={j} curve={curve} t={s.third[j].link.comet} color={C.purple} tail={TAIL_CHAIN} width={3} />
      ))}

      {/* The agent. */}
      <AgentGlyph x={L.AGENT.x} y={L.AGENT.y} r={L.AGENT.r} open={s.agent.open} energy={s.agent.energy} spin={s.agent.spin} calm={s.agent.calm} />
      {s.ripple > 0 && s.ripple < 1 ? (
        <circle cx={L.AGENT.x} cy={L.AGENT.y} r={L.AGENT.r * (0.8 + 1.4 * s.ripple)} fill="none" stroke={C.purple} strokeWidth={cyber.line.hair} opacity={0.6 * (1 - s.ripple)} />
      ) : null}
    </>
  );
};

export const DiagramScene: React.FC = () => {
  const s = useDiagramState();
  const logZoom = useScalarTrack(Math.log(L.CAMERA.startZoom), [{beat: 'dia-consequences', to: Math.log(L.CAMERA.endZoom), easing: motion.camera}]);
  const camX = useScalarTrack(L.CAMERA.startX, [{beat: 'dia-consequences', to: L.CAMERA.endX, easing: motion.camera}]);
  const zoom = Math.exp(logZoom);
  // The floor (world y = 0) is pinned to the screen horizon whatever the zoom.
  const camera = {x: camX, y: -(HY - H / 2) / zoom, zoom};
  const proj = makeProjector(camera, W, H);
  const ox = proj.sx(0);
  const oy = proj.sy(0);
  const focusX = 0.5 + (proj.sx(L.AGENT.x) / W - 0.5) * 0.6;

  return (
    <AbsoluteFill>
      <SceneAtmosphere horizon={L.HORIZON} haze={mix(C.haze, C.redDeep, 0.3 * s.hazeRed)} intensity={1} floor floorOpacity={0.45} focusX={focusX} />

      {/* Far layer: a dot grid that moves and scales less than the diagram. */}
      <AbsoluteFill
        style={{
          maskImage: `linear-gradient(to bottom, transparent 0%, #000 22%, #000 ${L.HORIZON * 100 - 9}%, transparent ${L.HORIZON * 100 - 1}%)`,
          WebkitMaskImage: `linear-gradient(to bottom, transparent 0%, #000 22%, #000 ${L.HORIZON * 100 - 9}%, transparent ${L.HORIZON * 100 - 1}%)`,
        }}
      >
        <DotGrid camera={camera} spacing={64} radius={1.1} color={C.steel} parallax={0.5} opacity={0.55} />
      </AbsoluteFill>

      {/* Floor reflection of the lit diagram, squashed and fading away from the horizon. */}
      <svg
        width={W}
        height={H}
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.62,
          maskImage: `linear-gradient(to bottom, transparent ${HY - 1}px, #000 ${HY + 2}px, rgba(0,0,0,0.3) ${HY + 170}px, transparent ${HY + 320}px)`,
          WebkitMaskImage: `linear-gradient(to bottom, transparent ${HY - 1}px, #000 ${HY + 2}px, rgba(0,0,0,0.3) ${HY + 170}px, transparent ${HY + 320}px)`,
        }}
      >
        <g transform={`translate(${ox.toFixed(2)} ${oy.toFixed(2)}) scale(${zoom.toFixed(4)} ${(-zoom * 0.55).toFixed(4)})`}>
          <Ink s={s} reflection />
        </g>
      </svg>

      {/* The diagram. */}
      <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
        <g transform={`translate(${ox.toFixed(2)} ${oy.toFixed(2)}) scale(${zoom.toFixed(4)})`}>
          <Ink s={s} />
        </g>
      </svg>

      {/* A faint pool of the agent's light on the floor, under the horizon. */}
      <div
        style={{
          position: 'absolute',
          left: proj.sx(L.AGENT.x) - 260 * zoom,
          top: HY - 10,
          width: 520 * zoom,
          height: 120 * zoom,
          background: `radial-gradient(ellipse 50% 50% at 50% 0%, ${withAlpha(mix(C.blue, C.purple, 1 - s.agent.calm), 0.16 * Math.min(1, s.agent.energy))}, transparent 70%)`,
        }}
      />
    </AbsoluteFill>
  );
};
