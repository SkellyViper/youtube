import React from 'react';
import {AbsoluteFill, Easing, interpolateColors} from 'remotion';
import {bracketPath, circlePath, partialLinePath, roundedRectPath} from '../../components/svg/paths';
import {DrawPath} from '../../components/svg/DrawPath';
import {beatClock, evaluateCamera, makeProjector, useEpisodeFrame, useTimeline} from '../../engine';
import {clamp01, ease, lerp, remap} from '../../styles/motion';
import {theme} from '../../styles/theme';
import {CAMERA_INITIAL, CAMERA_TRACK, CLAIM_FRAME, FRAME, GLYPH, SCAN_BOX} from './layout';
import {NETWORK} from './network';

const {color, font} = theme;
const backOut = Easing.out(Easing.back(1.8));

const BOX = {
  left: SCAN_BOX.cx - SCAN_BOX.w / 2,
  right: SCAN_BOX.cx + SCAN_BOX.w / 2,
  top: SCAN_BOX.cy - SCAN_BOX.h / 2,
  bottom: SCAN_BOX.cy + SCAN_BOX.h / 2,
};

// Normalised distance of core nodes from the box centre (for radial staggers).
const coreMaxDist = Math.max(...NETWORK.nodes.filter((n) => n.scanned).map((n) => n.dist));

// Trunks that leave the core module: in scene 2 they are visible only as
// short stubs fading into darkness - the first hint that there is more.
const coreTrunks = NETWORK.edges
  .filter((e) => e.trunk && NETWORK.nodes[e.a].scanned)
  .map((e) => {
    const a = NETWORK.nodes[e.a];
    const b = NETWORK.nodes[e.b];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    return {edge: e, a, b, ux: (b.x - a.x) / len, uy: (b.y - a.y) / len, len};
  });

const label: React.CSSProperties = {
  fontFamily: font.mono,
  fontWeight: 500,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
};

/**
 * The system diagram that persists from the opening to the conclusion:
 * focus brackets → scan area → scanner sweep → zoom-out reveal →
 * ground-truth ripple → nodes reassembling into "≠".
 */
export const NetworkLayer: React.FC = () => {
  const timeline = useTimeline();
  const frame = useEpisodeFrame();
  const clock = (id: string) => beatClock(timeline, id, frame);
  const claim = clock('title');
  const system = clock('system');
  const scan = clock('scan');
  const clear = clock('clear');
  const zoomOut = clock('zoom-out');
  const ground = clock('ground-truth');
  const recount = clock('recount');
  const assemble = clock('assemble');
  const coda = clock('coda');

  const camera = evaluateCamera(timeline, frame, CAMERA_INITIAL, CAMERA_TRACK);
  const P = makeProjector(camera, FRAME.width, FRAME.height);

  // Structure (borders, labels, edges) dissolves as the conclusion begins.
  const structure = 1 - assemble.at(0, 0.5, ease.out);
  const edgeFade = 1 - assemble.at(0, 0.7, ease.out);

  // ── Scanner sweep (world x of the beam) ────────────────────────────────
  const sweep = scan.at(0.15, 2.7, ease.sweep);
  const beamX = lerp(BOX.left - 30, BOX.right + 340, sweep);
  const beamInBox = scan.started && sweep > 0 && beamX < BOX.right + 6;

  // ── Ground-truth ripple radius (world units) ───────────────────────────
  const ripple = ground.at(0.1, 2.1, Easing.bezier(0.33, 0, 0.45, 1));
  const R = ripple * 3700;

  // ── Glint across the final glyph (screen x) ────────────────────────────
  const glintX = lerp(GLYPH.cx - 700, GLYPH.cx + 760, coda.at(0, 1.0, ease.sweep));
  const glintOn = coda.started && coda.progress < 1;

  // ── Nodes ──────────────────────────────────────────────────────────────
  let ringsPlain = '';
  let ringsScan = '';
  let fills = '';
  let scanDots = '';
  const pulses: React.ReactNode[] = [];
  const bugs: React.ReactNode[] = [];
  const nodeScreen = new Array<{x: number; y: number; vis: number}>(NETWORK.nodes.length);

  for (const n of NETWORK.nodes) {
    // Appearance
    let appear: number;
    if (n.scanned) {
      const t0 = 0.55 + 0.75 * (n.dist / coreMaxDist);
      appear = system.at(t0, t0 + 0.55);
    } else {
      const t0 = n.reveal * zoomOut.duration - 0.05;
      appear = zoomOut.at(Math.max(0, t0), Math.max(0, t0) + 0.5);
    }
    if (appear <= 0) {
      nodeScreen[n.index] = {x: 0, y: 0, vis: 0};
      continue;
    }

    // Departure into the ≠ glyph
    const start = n.bug ? 0.15 + 0.35 * n.departure : 0.1 + 0.75 * n.departure;
    const travel = assemble.at(start, start + 1.3, ease.inOut);
    const wx = P.sx(n.x);
    const wy = P.sy(n.y);
    const arc = Math.sin(Math.PI * travel) * (n.seed - 0.5) * 160;
    const dx = n.glyphX - wx;
    const dy = n.glyphY - wy;
    const dl = Math.hypot(dx, dy) || 1;
    const x = lerp(wx, n.glyphX, travel) + (-dy / dl) * arc;
    const y = lerp(wy, n.glyphY, travel) + (dx / dl) * arc;
    nodeScreen[n.index] = {x, y, vis: appear};

    const baseR = P.mark(7, 0.75) * backOut(appear);

    if (n.bug) {
      const found = clamp01((R - n.dist) / 90);
      const pulse = clamp01((R - n.dist) / 700);
      const bugR = lerp(P.mark(9, 0.5), 9.5, travel);
      const r = lerp(baseR, bugR, found);
      if (found <= 0) {
        ringsPlain += circlePath(x, y, r);
        continue;
      }
      bugs.push(
        <g key={`bug-${n.index}`}>
          <circle cx={x} cy={y} r={r * lerp(2.6, 1, travel)} fill="none" stroke={color.alert} strokeOpacity={0.45 * found * (1 - travel)} strokeWidth={1.4} />
          <circle cx={x} cy={y} r={r * found} fill={color.alert} />
        </g>,
      );
      if (pulse > 0 && pulse < 1) {
        pulses.push(
          <circle
            key={`bp-${n.index}`}
            cx={x}
            cy={y}
            r={r + 46 * Easing.out(Easing.cubic)(pulse)}
            fill="none"
            stroke={color.alert}
            strokeWidth={2}
            strokeOpacity={(1 - pulse) * 0.9}
          />,
        );
      }
      continue;
    }

    // Scan state for core nodes
    const checked = n.scanned ? clamp01((beatX(beamX, scan) - n.x) / 40) : 0;
    const r = lerp(baseR, 4.7, travel);
    const solid = travel;
    const glint = glintOn ? Math.exp(-Math.pow((x - glintX) / 46, 2)) : 0;

    if (checked >= 0.5 && travel < 0.6) ringsScan += circlePath(x, y, r);
    else ringsPlain += circlePath(x, y, r);
    if (solid > 0) fills += circlePath(x, y, r * solid);
    if (checked > 0 && travel < 1) scanDots += circlePath(x, y, Math.max(0, r * 0.42 * checked * (1 - travel)));
    if (glint > 0.02) {
      pulses.push(<circle key={`g-${n.index}`} cx={x} cy={y} r={r + 0.6} fill={color.scan} fillOpacity={glint} />);
    }

    if (n.scanned && scan.started) {
      const q = clamp01((beatX(beamX, scan) - n.x) / 260);
      if (q > 0 && q < 1) {
        pulses.push(
          <circle
            key={`p-${n.index}`}
            cx={x}
            cy={y}
            r={r + 26 * Easing.out(Easing.cubic)(q)}
            fill="none"
            stroke={color.scan}
            strokeWidth={1.6}
            strokeOpacity={(1 - q) * 0.85}
          />,
        );
      }
    }
  }

  // ── Edges ──────────────────────────────────────────────────────────────
  let edgesPlain = '';
  let edgesLit = '';
  let trunkPath = '';
  if (edgeFade > 0) {
    for (const e of NETWORK.edges) {
      const a = NETWORK.nodes[e.a];
      const b = NETWORK.nodes[e.b];
      const A = nodeScreen[e.a];
      const B = nodeScreen[e.b];
      if (e.trunk) {
        let p: number;
        const fromCore = a.scanned;
        if (fromCore) {
          p = zoomOut.at(0.15, Math.max(0.6, b.reveal * zoomOut.duration + 0.25), ease.out);
        } else {
          const t0 = Math.min(a.reveal, b.reveal) * zoomOut.duration;
          const t1 = Math.max(a.reveal, b.reveal) * zoomOut.duration + 0.35;
          p = zoomOut.at(t0, t1, ease.out);
        }
        if (p <= 0) continue;
        const [s, t] = a.reveal <= b.reveal || fromCore ? [a, b] : [b, a];
        trunkPath += partialLinePath(P.sx(s.x), P.sy(s.y), P.sx(t.x), P.sy(t.y), p);
        continue;
      }
      if (A.vis <= 0 || B.vis <= 0) continue;
      let p: number;
      if (a.scanned) {
        const t0 = 0.75 + 0.75 * (Math.min(a.dist, b.dist) / coreMaxDist);
        p = system.at(t0, t0 + 0.45, ease.out);
      } else {
        const t0 = Math.max(a.reveal, b.reveal) * zoomOut.duration + 0.1;
        p = zoomOut.at(t0, t0 + 0.4, ease.out);
      }
      if (p <= 0) continue;
      const [s, t] = a.dist <= b.dist ? [A, B] : [B, A];
      edgesPlain += partialLinePath(s.x, s.y, t.x, t.y, p);

      // Lit portion: the part of a core edge the beam has already crossed.
      if (a.scanned && scan.started) {
        const bx = beatX(beamX, scan);
        const [l, r] = a.x <= b.x ? [a, b] : [b, a];
        const [Ls, Rs] = a.x <= b.x ? [A, B] : [B, A];
        if (bx > l.x) {
          const f = r.x === l.x ? 1 : clamp01((bx - l.x) / (r.x - l.x));
          edgesLit += partialLinePath(Ls.x, Ls.y, Rs.x, Rs.y, f * p);
        }
      }
    }
  }

  // ── Module boundaries & labels (revealed by the zoom-out) ──────────────
  const modules = NETWORK.modules.map((m) => {
    const t0 = m.reveal * zoomOut.duration;
    const draw = m.scanned ? zoomOut.at(0.2, 1.4, ease.out) : zoomOut.at(t0, t0 + 0.8, ease.out);
    const text = m.scanned ? zoomOut.at(0.9, 1.5, ease.out) : zoomOut.at(t0 + 0.25, t0 + 0.85, ease.out);
    const x = P.sx(m.cx - m.w / 2);
    const y = P.sy(m.cy - m.h / 2);
    return {m, draw, text, x, y, w: P.len(m.w), h: P.len(m.h)};
  });

  // ── Focus brackets: claim frame → scan area ────────────────────────────
  const snap = claim.spring(0, {duration: 0.9, damping: 14});
  const toBox = system.at(0.1, 1.15, ease.inOut);
  const fcx = (CLAIM_FRAME.left + CLAIM_FRAME.right) / 2;
  const fcy = (CLAIM_FRAME.top + CLAIM_FRAME.bottom) / 2;
  const startScale = lerp(0.9, 1, snap);
  const fr = {
    left: lerp(fcx + (CLAIM_FRAME.left - fcx) * startScale, BOX.left, toBox),
    right: lerp(fcx + (CLAIM_FRAME.right - fcx) * startScale, BOX.right, toBox),
    top: lerp(fcy + (CLAIM_FRAME.top - fcy) * startScale, BOX.top, toBox),
    bottom: lerp(fcy + (CLAIM_FRAME.bottom - fcy) * startScale, BOX.bottom, toBox),
  };
  const bracketOpacity = lerp(0.3, 1, claim.at(0, 0.4)) * structure;
  const cleared = clear.at(0.2, 0.8, ease.out);
  const bracketArm = P.mark(46, 0.6);

  // ── Scan box frame + clear state ───────────────────────────────────────
  const boxX = P.sx(BOX.left);
  const boxY = P.sy(BOX.top);
  const boxW = P.len(SCAN_BOX.w);
  const boxH = P.len(SCAN_BOX.h);
  const borderDraw = system.at(0.6, 1.5, ease.inOut);
  const hatch = clear.at(0, 0.85, ease.inOut);
  const hatchFade = 1 - 0.6 * zoomOut.at(0, 1.2);
  const tabIn = clear.at(0.45, 1.1, ease.out);
  const scanLabel = system.at(1.0, 1.6, ease.out) * (1 - zoomOut.at(0, 0.5));
  const stubs = system.at(1.35, 2.15, ease.out) * (1 - zoomOut.at(0.1, 0.6));
  const recountFocus = recount.at(0.2, 0.9, ease.out) * (1 - recount.at(1.3, 1.9, ease.inOut) * 0.5);

  // ── Slash of the ≠ (drawn through the undetected bugs) ─────────────────
  const slash = assemble.at(1.75, 2.45, ease.inOut);

  // Beam geometry (screen)
  const beamSX = P.sx(Math.min(beamX, BOX.right));
  const trail = P.len(240);
  const checkedCount = NETWORK.nodes.filter((n) => n.scanned && n.x < beatX(beamX, scan)).length;

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <svg width={FRAME.width} height={FRAME.height} style={{position: 'absolute', inset: 0}}>
        <defs>
          <pattern id="hatch" width={11} height={11} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1={0} y1={0} x2={0} y2={11} stroke={color.scan} strokeWidth={1.3} />
          </pattern>
          <linearGradient id="beamTrail" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor={color.scan} stopOpacity={0} />
            <stop offset="1" stopColor={color.scan} stopOpacity={0.2} />
          </linearGradient>
          <clipPath id="boxClip">
            <rect x={boxX} y={boxY} width={boxW} height={boxH} />
          </clipPath>
          {coreTrunks.map(({edge, a, ux, uy}) => (
            <linearGradient
              key={`sg-${edge.a}-${edge.b}`}
              id={`stub-${edge.a}-${edge.b}`}
              gradientUnits="userSpaceOnUse"
              x1={P.sx(a.x)}
              y1={P.sy(a.y)}
              x2={P.sx(a.x + ux * 230)}
              y2={P.sy(a.y + uy * 230)}
            >
              <stop offset="0" stopColor={color.paper} stopOpacity={0.55} />
              <stop offset="1" stopColor={color.paper} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>

        {/* Module boundaries */}
        <g opacity={structure}>
          {modules.map(({m, draw, x, y, w, h}) =>
            m.scanned ? null : (
              <DrawPath
                key={m.id}
                d={roundedRectPath(x, y, w, h, P.mark(28, 1))}
                progress={draw}
                stroke={color.paper}
                strokeOpacity={0.2}
                strokeWidth={1.2}
              />
            ),
          )}
        </g>

        {/* Hatch: "this area has been examined" */}
        {hatch > 0 ? (
          <g clipPath="url(#boxClip)" opacity={0.16 * hatchFade * structure}>
            <rect x={boxX} y={boxY} width={boxW * hatch} height={boxH} fill="url(#hatch)" />
          </g>
        ) : null}

        {/* Edges */}
        <path d={edgesPlain} stroke={color.paper} strokeOpacity={0.2 * edgeFade} strokeWidth={1.3} fill="none" />
        <path d={edgesLit} stroke={color.scan} strokeOpacity={0.7 * edgeFade} strokeWidth={1.6} fill="none" />
        {/* Inter-module trunks: one solid path (dashed strokes are expensive to rasterise every frame) */}
        <path d={trunkPath} stroke={color.paper} strokeOpacity={0.26 * edgeFade} strokeWidth={1.1} fill="none" />
        {stubs > 0
          ? coreTrunks.map(({edge, a, ux, uy}) => (
              <path
                key={`stub-${edge.a}-${edge.b}`}
                d={partialLinePath(P.sx(a.x), P.sy(a.y), P.sx(a.x + ux * 230), P.sy(a.y + uy * 230), stubs)}
                stroke={`url(#stub-${edge.a}-${edge.b})`}
                strokeWidth={1.2}
                opacity={stubs}
              />
            ))
          : null}

        {/* Scanner beam */}
        {beamInBox ? (
          <g clipPath="url(#boxClip)">
            <rect x={beamSX - trail} y={boxY} width={trail} height={boxH} fill="url(#beamTrail)" />
            <line x1={beamSX} x2={beamSX} y1={boxY} y2={boxY + boxH} stroke={color.scan} strokeWidth={2.5} />
          </g>
        ) : null}

        {/* Nodes */}
        <path d={ringsPlain} fill={color.ink} stroke={color.paper} strokeOpacity={0.7} strokeWidth={1.6} />
        <path d={ringsScan} fill={color.ink} stroke={color.scan} strokeWidth={1.8} />
        <path d={scanDots} fill={color.scan} />
        <path d={fills} fill={color.paper} />
        {pulses}

        {/* Ground-truth ripple */}
        {ground.started && ripple > 0 && ripple < 1 ? (
          <g fill="none" stroke={color.paper}>
            <circle cx={P.sx(SCAN_BOX.cx)} cy={P.sy(SCAN_BOX.cy)} r={P.len(R)} strokeOpacity={0.5 * (1 - ripple)} strokeWidth={1.5} />
            <circle cx={P.sx(SCAN_BOX.cx)} cy={P.sy(SCAN_BOX.cy)} r={P.len(Math.max(0, R - 260))} strokeOpacity={0.18 * (1 - ripple)} strokeWidth={1} />
          </g>
        ) : null}

        {/* ≠ slash */}
        <DrawPath
          d={`M${GLYPH.cx - GLYPH.slashDx} ${GLYPH.cy + GLYPH.slashDy}L${GLYPH.cx + GLYPH.slashDx} ${GLYPH.cy - GLYPH.slashDy}`}
          progress={slash}
          stroke={color.alert}
          strokeWidth={8}
          strokeLinecap="round"
        />
        {bugs}

        {/* Scan-area frame */}
        <g opacity={structure}>
          <DrawPath
            d={`M${boxX} ${boxY}H${boxX + boxW}V${boxY + boxH}H${boxX}Z`}
            progress={borderDraw}
            stroke={color.paper}
            strokeOpacity={0.3 * (1 - cleared)}
            strokeWidth={1.2}
          />
          {cleared > 0 ? (
            <rect x={boxX} y={boxY} width={boxW} height={boxH} fill="none" stroke={color.scan} strokeOpacity={0.55 * cleared} strokeWidth={1.4} />
          ) : null}
          {recountFocus > 0 ? (
            <rect
              x={boxX - 8}
              y={boxY - 8}
              width={boxW + 16}
              height={boxH + 16}
              fill={color.scan}
              fillOpacity={0.08 * recountFocus}
              stroke={color.scan}
              strokeWidth={2}
              strokeOpacity={recountFocus}
            />
          ) : null}
          <path
            d={bracketPath(P.sx(fr.left), P.sy(fr.top), P.sx(fr.right), P.sy(fr.bottom), bracketArm)}
            fill="none"
            stroke={interpolateColors(cleared, [0, 1], [color.paper, color.scan])}
            strokeOpacity={bracketOpacity}
            strokeWidth={2.5}
          />
        </g>
      </svg>

      {/* HTML labels (crisp text at any zoom) */}
      <div style={{position: 'absolute', inset: 0, opacity: structure}}>
        {modules.map(({m, text, x, y, h}) =>
          text > 0 ? (
            <div
              key={m.id}
              style={{
                ...label,
                position: 'absolute',
                left: x,
                // The scanned module's top edge carries the coverage tab, so
                // its name sits underneath instead.
                top: m.scanned ? y + h + 14 : y - 34,
                fontSize: 22,
                color: m.scanned ? color.scan : color.paperSoft,
                opacity: text,
                translate: `0 ${(1 - text) * 8}px`,
                whiteSpace: 'nowrap',
              }}
            >
              {m.label}
            </div>
          ) : null,
        )}
        {scanLabel > 0 ? (
          <div
            style={{
              ...label,
              position: 'absolute',
              left: boxX,
              top: boxY - 44,
              fontSize: 24,
              color: color.paperSoft,
              opacity: scanLabel,
              translate: `${(1 - scanLabel) * -14}px 0`,
            }}
          >
            Scan area
          </div>
        ) : null}
        {beamInBox ? (
          <div
            style={{
              ...label,
              position: 'absolute',
              left: beamSX,
              top: boxY + boxH + 18,
              translate: '-50% 0',
              fontSize: 22,
              color: color.scan,
              whiteSpace: 'nowrap',
              fontVariantNumeric: 'tabular-nums',
              opacity: remap(sweep, 0, 0.04),
            }}
          >
            {`Checked ${String(checkedCount).padStart(2, '0')}/${NETWORK.stats.scanned}`}
          </div>
        ) : null}
        {tabIn > 0 ? (
          <div
            style={{
              ...label,
              position: 'absolute',
              left: boxX + boxW,
              top: boxY - P.mark(44, 0.35),
              translate: `-100% 0`,
              fontSize: P.mark(24, 0.15),
              color: color.scan,
              opacity: tabIn,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              whiteSpace: 'nowrap',
              clipPath: `inset(-20% ${(1 - tabIn) * 100}% -20% 0)`,
            }}
          >
            <span>Coverage 100%</span>
            <svg width={20} height={20} viewBox="0 0 20 20">
              <path d="M3 10.5 L8 15.5 L17 4.5" fill="none" stroke={color.scan} strokeWidth={2.6} />
            </svg>
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

/** Beam position, but only once the scan beat has started (before that, nothing is checked). */
function beatX(beamX: number, scan: {started: boolean}): number {
  return scan.started ? beamX : -Infinity;
}
