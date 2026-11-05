import React from 'react';
import {AbsoluteFill, Easing} from 'remotion';
import {DotGrid, Grain, Vignette} from '../../components/backdrop/Backdrop';
import {partialLinePath} from '../../components/svg/paths';
import {useBeats, useCamera, useScalarTrack, makeProjector} from '../../engine';
import {clamp01, ease, lerp} from '../../styles/motion';
import {theme} from '../../styles/theme';
import {CAMERA_INITIAL, CAMERA_TRACK, DAYS_TRACK, FINAL_INSTANCES, formatElapsed, FRAME, SPREAD_TRACK, VERBS} from './layout';
import {infectedAt, INTERNET} from './internet';

const {color, font, size} = theme;
const pop = Easing.out(Easing.back(2.2));
const NS = 'non-scaling-stroke' as const;

/** Whole-episode backdrop: ink, world-anchored dot grid that recedes as the camera pulls out. */
export const BackdropLayer: React.FC = () => {
  const camera = useCamera(CAMERA_INITIAL, CAMERA_TRACK);
  const b = useBeats(['scavenge', 'dark']);
  const grid = 1 - 0.75 * b.scavenge.at(0.2, 2.0, ease.inOut) - 0.25 * b.dark.at(0, 1.5);
  return (
    <AbsoluteFill style={{backgroundColor: color.ink}}>
      <DotGrid camera={camera} color={color.paper} opacity={0.085 * grid} spacing={48} parallax={0.6} />
      <Vignette strength={0.34} />
    </AbsoluteFill>
  );
};

export const GrainLayer: React.FC = () => <Grain opacity={0.065} />;

/**
 * The internet: thousands of hosts, the spread of copies, the ambush and the
 * blackout. Static geometry is pre-built world-space paths (see internet.ts);
 * per frame only one transform, opacities and stroke widths change.
 */
export const InternetLayer: React.FC = () => {
  const camera = useCamera(CAMERA_INITIAL, CAMERA_TRACK);
  const spread = useScalarTrack(0, SPREAD_TRACK);
  const b = useBeats(['scavenge', 'copies', 'time', 'thousands', 'move', 'dark', 'more', 'know']);
  const P = makeProjector(camera, FRAME.width, FRAME.height);
  const z = camera.zoom;

  const dotPx = 13 * Math.pow(z, 0.42);
  const ringW = Math.max(1, dotPx * 0.16);
  const grow = b.thousands.at(0.6, 3.2, ease.inOut);
  const flare = b.move.at(0.15, 0.7, ease.out);
  const redOut = b.dark.at(1.0, 1.9, ease.inOut);
  const back = b.more.at(0.5, 1.9, ease.inOut);
  const groupIn = (g: number) => b.scavenge.at(0.4 + g * 0.09, 1.1 + g * 0.09, ease.out);
  const groupDark = (g: number) => b.dark.at(0.1 + g * 0.08, 0.45 + g * 0.08, ease.in);
  const level = (g: number) => lerp(groupIn(g) * (1 - groupDark(g)) * (1 - 0.35 * flare), 0.3, back);

  const T = `translate(${FRAME.width / 2 - camera.x * z} ${FRAME.height / 2 - camera.y * z}) scale(${z})`;
  const A = INTERNET.agent;

  // Early copies: probe line from the infector, then a pulse on arrival.
  const probes: React.ReactNode[] = [];
  if (spread > 0 && spread < 0.2) {
    for (const n of INTERNET.early) {
      const q = clamp01((spread - (n.tau - 0.012)) / 0.012);
      if (q <= 0) continue;
      const src = INTERNET.nodes[n.infector];
      const fade = clamp01((spread - n.tau) / 0.03);
      if (fade < 1) {
        probes.push(
          <path
            key={`l${n.index}`}
            d={partialLinePath(P.sx(src.x), P.sy(src.y), P.sx(n.x), P.sy(n.y), ease.out(q))}
            stroke={color.alert}
            strokeWidth={2}
            strokeOpacity={0.85 * (1 - fade)}
          />,
        );
      }
      const u = clamp01((spread - n.tau) / 0.018);
      if (u > 0 && u < 1) {
        probes.push(
          <circle
            key={`p${n.index}`}
            cx={P.sx(n.x)}
            cy={P.sy(n.y)}
            r={dotPx + 44 * z * 2 * Easing.out(Easing.cubic)(u)}
            fill="none"
            stroke={color.alert}
            strokeWidth={2}
            strokeOpacity={1 - u}
          />,
        );
      }
    }
  }
  // Failed probes: the agent knocking on hosts it can't get into.
  const failed = INTERNET.failedProbes.map((n, i) => {
    const out = b.scavenge.at(0.9 + i * 0.09, 1.4 + i * 0.09, ease.out);
    const gone = b.scavenge.at(1.7 + i * 0.05, 2.3 + i * 0.05, ease.in);
    if (out <= 0 || gone >= 1) return null;
    return (
      <path
        key={`f${n.index}`}
        d={partialLinePath(P.sx(A.x), P.sy(A.y), P.sx(n.x), P.sy(n.y), out)}
        stroke={color.paper}
        strokeWidth={1.4}
        strokeOpacity={0.45 * (1 - gone)}
      />
    );
  });

  const agentIn = b.scavenge.at(0.3, 0.8, ease.out);
  const agentLabel = agentIn * (1 - b.time.at(0, 0.6));
  const johnLabel = b.time.at(1.4, 2.2, ease.out) * (1 - b.dark.at(0, 0.6));
  const hidden = b.know.at(1.6, 2.4, ease.out);
  const hiddenPulse = b.know.at(2.0, 3.2, ease.out);

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <svg width={FRAME.width} height={FRAME.height} style={{position: 'absolute', inset: 0}}>
        <g transform={T} fill="none" strokeLinecap="round">
          {INTERNET.paths.edgesByDark.map((d, g) => (
            <path key={`e${g}`} d={d} stroke={color.paper} strokeOpacity={0.17 * level(g)} strokeWidth={1} vectorEffect={NS} />
          ))}
          {INTERNET.paths.ringsByDark.map((d, g) => (
            <path key={`r${g}`} d={d} stroke={color.paper} strokeOpacity={0.75 * level(g)} strokeWidth={dotPx} vectorEffect={NS} />
          ))}
          <path d={INTERNET.paths.inner} stroke={color.ink} strokeWidth={Math.max(0, dotPx - 2 * ringW)} vectorEffect={NS} />
          {redOut < 1 && back < 1
            ? INTERNET.infectGroups.map((g, i) => {
                const p = clamp01((spread - g.tau) / g.window);
                if (p <= 0) return null;
                const w = dotPx * (1.15 + 0.55 * grow + 0.5 * flare) * pop(p);
                return (
                  <g key={`i${i}`} opacity={1 - redOut}>
                    {flare > 0 ? (
                      <path d={g.d} stroke={color.alert} strokeOpacity={0.22 * flare} strokeWidth={w * (2.2 + 2.4 * flare)} vectorEffect={NS} />
                    ) : null}
                    <path d={g.d} stroke={color.alert} strokeOpacity={lerp(0.85, 1, flare)} strokeWidth={w} vectorEffect={NS} />
                  </g>
                );
              })
            : null}
        </g>

        {failed}
        {probes}

        {/* The original agent */}
        {agentIn > 0 && redOut < 1 && back < 1 ? (
          <g opacity={1 - redOut}>
            <circle cx={P.sx(A.x)} cy={P.sy(A.y)} r={dotPx * 1.5 * pop(agentIn) * (1 + 0.4 * grow)} fill={color.alert} />
            <circle cx={P.sx(A.x)} cy={P.sy(A.y)} r={dotPx * 3 * agentIn} fill="none" stroke={color.alert} strokeOpacity={0.5 * agentLabel} strokeWidth={1.5} />
          </g>
        ) : null}
        {/* John's laptop: blissfully unaware */}
        <circle
          cx={P.sx(INTERNET.john.x)}
          cy={P.sy(INTERNET.john.y)}
          r={dotPx * 0.7}
          fill={color.ink}
          stroke={color.scan}
          strokeWidth={2}
          opacity={b.scavenge.at(0.6, 1.2) * (1 - b.dark.at(0, 0.6)) * (1 - back)}
        />
        {/* The one still hiding */}
        {hidden > 0 ? (
          <g>
            <circle cx={P.sx(INTERNET.hidden.x)} cy={P.sy(INTERNET.hidden.y)} r={dotPx * 0.6} fill={color.alert} opacity={0.9 * hidden} />
            {hiddenPulse > 0 && hiddenPulse < 1 ? (
              <circle
                cx={P.sx(INTERNET.hidden.x)}
                cy={P.sy(INTERNET.hidden.y)}
                r={dotPx + 40 * hiddenPulse}
                fill="none"
                stroke={color.alert}
                strokeWidth={1.5}
                strokeOpacity={0.6 * (1 - hiddenPulse)}
              />
            ) : null}
          </g>
        ) : null}
      </svg>

      {/* Labels */}
      {agentLabel > 0 ? (
        <div style={{...label, left: P.sx(A.x) + 34, top: P.sy(A.y) - 14, color: color.alert, opacity: agentLabel}}>agent · infra-automation</div>
      ) : null}
      {johnLabel > 0 ? (
        <div style={{...label, left: P.sx(INTERNET.john.x) + 18, top: P.sy(INTERNET.john.y) - 12, color: color.scan, opacity: johnLabel}}>John</div>
      ) : null}
    </AbsoluteFill>
  );
};

const label: React.CSSProperties = {
  position: 'absolute',
  fontFamily: font.mono,
  fontSize: 20,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
};

const mono: React.CSSProperties = {
  fontFamily: font.mono,
  fontSize: size.label,
  fontWeight: 500,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: color.muted,
  whiteSpace: 'nowrap',
};

/** Spread-scene readouts: the four objectives, elapsed time, copies, alerts. */
export const HudLayer: React.FC = () => {
  const spread = useScalarTrack(0, SPREAD_TRACK);
  const days = Math.expm1(useScalarTrack(0, DAYS_TRACK));
  const b = useBeats(['scavenge', 'copies', 'thousands', 'move', 'dark']);
  const enter = b.scavenge.at(1.0, 1.7, ease.out);
  const exit = b.dark.at(0, 0.6, ease.in);

  const lateFrac = clamp01((spread - 0.15) / 0.85);
  const raw = infectedAt(spread);
  const instances = Math.round(raw * lerp(1, FINAL_INSTANCES / (INTERNET.stats.infected + 1), Math.pow(lateFrac, 1.4)));

  const active = [b.scavenge.at(1.2, 1.5), b.scavenge.at(1.5, 1.8), b.scavenge.at(2.2, 2.5), b.move.at(0.1, 0.4)];
  const standby = b.thousands.at(2.0, 2.6);

  return (
    <AbsoluteFill style={{pointerEvents: 'none', opacity: enter * (1 - exit)}}>
      <div
        style={{
          position: 'absolute',
          left: theme.safe.x - 24,
          top: theme.safe.y - 24,
          padding: '20px 24px',
          borderRadius: 12,
          backgroundColor: 'rgba(12, 13, 15, 0.82)',
          width: 420,
        }}
      >
        <div style={mono}>Agent objectives</div>
        {VERBS.map((verb, i) => {
          const on = active[i];
          const isAmbush = i === 3;
          const state = isAmbush ? (on > 0.5 ? 'execute' : standby > 0.5 ? 'standby' : '—') : on > 0.5 ? 'active' : '—';
          return (
            <div
              key={verb}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: 12,
                paddingTop: 10,
                borderTop: `1px solid ${color.paperGhost}`,
                ...mono,
                color: on > 0.5 ? color.alert : color.paperSoft,
              }}
            >
              <span>
                0{i + 1} {verb}
              </span>
              <span style={{color: on > 0.5 ? color.alert : color.muted}}>{on > 0.5 ? `● ${state}` : state}</span>
            </div>
          );
        })}
      </div>

      <div
        style={{
          position: 'absolute',
          right: theme.safe.x - 24,
          top: theme.safe.y - 24,
          padding: '20px 24px',
          borderRadius: 12,
          backgroundColor: 'rgba(12, 13, 15, 0.82)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 6,
        }}
      >
        {[
          {k: 'Elapsed', v: formatElapsed(days), c: color.paper},
          {k: 'Copies running', v: instances.toLocaleString('en-US'), c: color.alert},
          {k: 'Alerts raised', v: '0', c: color.scan},
        ].map((r) => (
          <div key={r.k} style={{display: 'flex', alignItems: 'baseline', gap: 22}}>
            <span style={mono}>{r.k}</span>
            <span
              style={{
                fontFamily: font.display,
                fontWeight: 700,
                fontStretch: '80%',
                fontSize: 64,
                lineHeight: 1.05,
                color: r.c,
                fontVariantNumeric: 'tabular-nums',
                minWidth: 230,
                textAlign: 'right',
              }}
            >
              {r.v}
            </span>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
