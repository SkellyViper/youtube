import React from 'react';
import {AbsoluteFill} from 'remotion';
import {DrawPath} from '../../components/svg/DrawPath';
import {Mask} from '../../components/typography/Mask';
import {SplitText} from '../../components/typography/SplitText';
import {formatCount} from '../../components/typography/format';
import {useBeats} from '../../engine';
import {ease, lerp} from '../../styles/motion';
import {theme} from '../../styles/theme';
import {CLAIM_LAYOUT} from './layout';
import {NETWORK} from './network';

const {color, font, size} = theme;

const monoLabel: React.CSSProperties = {
  fontFamily: font.mono,
  fontSize: size.label,
  fontWeight: 500,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: color.muted,
  whiteSpace: 'nowrap',
};

const TITLE_LINES = ['NO BUGS', 'DETECTED.'] as const;

/**
 * Scene 1 typography, which then *becomes* the persistent report header for
 * scenes 2–3 instead of being cut away (spatial continuity).
 */
export const ClaimLayer: React.FC = () => {
  const b = useBeats(['title', 'evidence', 'system', 'recount', 'assemble']);
  const {scanned} = NETWORK.stats;

  // ── Title → header transform (beat "system") ───────────────────────────
  const h = b.system.at(0, 1.05, ease.inOut);
  const titleScale = lerp(1, CLAIM_LAYOUT.header.scale, h);
  const titleLeft = lerp(960, CLAIM_LAYOUT.header.left, h);
  const titleTop = lerp(CLAIM_LAYOUT.titleCenterY, CLAIM_LAYOUT.header.top, h);
  const titleFade = 1 - b.assemble.at(0, 0.5, ease.out);

  // ── Title reveal (beat "claim") ────────────────────────────────────────
  const seam = b.title.at(0, 0.7, ease.out);
  const tracking = lerp(0.05, 0, b.title.at(0.1, 1.6, ease.out));
  const charRise = (line: number) => (i: number) => {
    const p = b.title.stagger(i, {start: 0.12 + line * 0.16, each: 0.045, dur: 0.85, easing: ease.outExpo});
    return p;
  };

  // ── Evidence row (beat "evidence") ──────────────────────────────────────
  const evidenceOut = b.system.at(0, 0.5, ease.in);
  const evidence = [
    {label: 'Issues found', value: 0, suffix: '', accent: true, start: 0.15},
    {label: 'Nodes checked', value: scanned, suffix: '', accent: false, start: 0.27},
    {label: 'Coverage', value: 100, suffix: '%', accent: false, start: 0.39},
  ];

  // ── Footer metadata (beat "claim", out on "system") ─────────────────────
  const metaIn = b.title.at(1.05, 1.7, ease.out);
  const metaOut = b.system.at(0, 0.35, ease.out);

  // ── Header stats (in on "system", out on "recount") ─────────────────────
  const headerStatsOut = b.recount.at(0, 0.45, ease.out);
  const headerItems = [
    {text: '0 issues', accent: true},
    {text: `${scanned}/${scanned} nodes`, accent: false},
    {text: '100% coverage', accent: false},
  ];

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {/* Title block */}
      <div
        style={{
          position: 'absolute',
          left: titleLeft,
          top: titleTop,
          translate: `${-50 * (1 - h)}% ${-50 * (1 - h)}%`,
          scale: titleScale,
          transformOrigin: '0 0',
          display: 'inline-flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          opacity: titleFade,
          fontFamily: font.display,
          fontWeight: 800,
          fontStretch: '72%',
          fontSize: size.hero,
          lineHeight: 0.9,
          color: color.paper,
          letterSpacing: `${tracking}em`,
          whiteSpace: 'nowrap',
        }}
      >
        {TITLE_LINES.map((line, li) => (
          <Mask
            key={line}
            edge={li === 0 ? 'bottom' : 'top'}
            style={{
              position: 'relative',
              left: `${50 * (1 - h)}%`,
              translate: `${-50 * (1 - h)}% 0`,
              width: 'fit-content',
              marginTop: li === 1 ? 26 : 0,
            }}
          >
            <SplitText
              text={line}
              unitStyle={(i, _n, ch) => {
                const p = charRise(li)(i);
                return {
                  translate: `0 ${(li === 0 ? 1 : -1) * (1 - p) * 104}%`,
                  color: ch === '.' ? color.scan : undefined,
                };
              }}
            />
          </Mask>
        ))}
        {/* The seam both lines emerge from */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: 1320,
            height: 2,
            translate: '-50% -50%',
            scale: `${seam} 1`,
            backgroundColor: color.paperFaint,
            opacity: 1 - h,
          }}
        />
      </div>

      {/* Evidence row */}
      <div
        style={{
          position: 'absolute',
          left: 960,
          top: CLAIM_LAYOUT.evidenceCenterY,
          translate: `-50% calc(-50% - ${evidenceOut * 40}px)`,
          scale: lerp(1, 0.94, evidenceOut),
          opacity: 1 - evidenceOut,
          display: 'flex',
          alignItems: 'stretch',
        }}
      >
        {evidence.map((item, i) => {
          const labelIn = b.evidence.at(item.start, item.start + 0.55, ease.out);
          const numberIn = b.evidence.at(item.start + 0.08, item.start + 0.8, ease.outExpo);
          const count = b.evidence.at(item.start + 0.1, item.start + 1.05, ease.out);
          const rule = b.evidence.at(0.05 + i * 0.1, 0.6 + i * 0.1, ease.out);
          return (
            <div key={item.label} style={{display: 'flex'}}>
              {i > 0 ? (
                <div
                  style={{
                    width: 1,
                    backgroundColor: color.paperFaint,
                    scale: `1 ${rule}`,
                    transformOrigin: '50% 100%',
                  }}
                />
              ) : null}
              <div
                style={{
                  width: 360,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 14,
                  padding: '6px 0',
                }}
              >
                <div style={{...monoLabel, opacity: labelIn, translate: `0 ${(1 - labelIn) * 14}px`}}>{item.label}</div>
                <Mask edge="both">
                  <div
                    style={{
                      fontFamily: font.display,
                      fontWeight: 700,
                      fontStretch: '80%',
                      fontSize: size.stat,
                      lineHeight: 1,
                      fontVariantNumeric: 'tabular-nums',
                      color: item.accent ? color.scan : color.paper,
                      translate: `0 ${(1 - numberIn) * 100}%`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 18,
                    }}
                  >
                    {formatCount(item.value * count)}
                    {item.suffix}
                    {item.accent ? (
                      <svg width={46} height={46} viewBox="0 0 46 46" style={{marginTop: 4}}>
                        <DrawPath
                          d="M6 24 L18 36 L40 10"
                          progress={b.evidence.at(1.0, 1.45, ease.out)}
                          stroke={color.scan}
                          strokeWidth={5}
                          strokeLinecap="square"
                        />
                      </svg>
                    ) : null}
                  </div>
                </Mask>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer metadata for the opening */}
      <div
        style={{
          position: 'absolute',
          left: theme.safe.x,
          right: theme.safe.x,
          bottom: theme.safe.y - 10,
          display: 'flex',
          justifyContent: 'space-between',
          opacity: metaIn * (1 - metaOut),
          translate: `0 ${(1 - metaIn) * 12}px`,
        }}
      >
        <div style={monoLabel}>Automated scan · run 0417</div>
        <div style={{...monoLabel, display: 'flex', alignItems: 'center', gap: 14}}>
          <span style={{width: 12, height: 12, borderRadius: 6, backgroundColor: color.scan, display: 'inline-block'}} />
          Status: pass
        </div>
      </div>

      {/* Compact header stats (scenes 2–3) */}
      <div
        style={{
          position: 'absolute',
          right: 1920 - CLAIM_LAYOUT.headerStatsRight,
          top: CLAIM_LAYOUT.header.top + 28,
          display: 'flex',
          gap: 34,
          opacity: 1 - headerStatsOut,
          translate: `0 ${-headerStatsOut * 10}px`,
        }}
      >
        {headerItems.map((item, i) => {
          const p = b.system.at(0.55 + i * 0.1, 1.15 + i * 0.1, ease.out);
          return (
            <div
              key={item.text}
              style={{
                ...monoLabel,
                color: item.accent ? color.scan : color.paperSoft,
                opacity: p,
                translate: `${(1 - p) * 18}px 0`,
              }}
            >
              {item.text}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
