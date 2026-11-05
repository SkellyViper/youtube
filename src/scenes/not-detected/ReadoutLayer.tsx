import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Mask} from '../../components/typography/Mask';
import {formatCount} from '../../components/typography/format';
import {useBeats} from '../../engine';
import {ease, lerp} from '../../styles/motion';
import {theme} from '../../styles/theme';
import {NETWORK} from './network';

const {color, font, size} = theme;

const mono: React.CSSProperties = {
  fontFamily: font.mono,
  fontSize: size.label,
  fontWeight: 500,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: color.muted,
  whiteSpace: 'nowrap',
};

const BAR_WIDTH = 440;

/**
 * Scene 3 data readout. The same "100% coverage" from the opening is
 * re-measured against the whole system and collapses to its real value.
 */
export const ReadoutLayer: React.FC = () => {
  const b = useBeats(['recount', 'assemble']);
  const {scanned, total, bugs, coverage} = NETWORK.stats;

  // Enters once the camera pan (0–0.85s) has cleared the left third.
  const enter = b.recount.at(0.5, 1.05, ease.out);
  const fall = b.recount.at(0.8, 1.7, ease.inOut);
  const value = lerp(100, coverage, fall);
  const rows = [b.recount.at(1.2, 1.7, ease.out), b.recount.at(1.3, 1.85, ease.out)];
  const present = b.recount.at(1.3, 1.9, ease.out);
  const exit = b.assemble.at(0, 0.55, ease.in);

  return (
    <AbsoluteFill style={{pointerEvents: 'none', opacity: 1 - exit, translate: `${-exit * 40}px 0`}}>
      <div style={{position: 'absolute', left: theme.safe.x, top: 300, width: BAR_WIDTH}}>
        <div style={{...mono, opacity: enter, translate: `0 ${(1 - enter) * 12}px`}}>Coverage of the system</div>
        <Mask edge="both" style={{marginTop: 8}}>
          <div
            style={{
              fontFamily: font.display,
              fontWeight: 800,
              fontStretch: '72%',
              fontSize: 200,
              lineHeight: 1,
              color: color.scan,
              fontVariantNumeric: 'tabular-nums',
              translate: `0 ${(1 - enter) * 100}%`,
            }}
          >
            {formatCount(value)}%
          </div>
        </Mask>
        {/* Proportional bar: what was scanned vs. what exists */}
        <div style={{position: 'relative', height: 10, marginTop: 18, opacity: enter}}>
          <div style={{position: 'absolute', inset: 0, backgroundColor: color.paperGhost, scale: `${enter} 1`, transformOrigin: '0 50%'}} />
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: BAR_WIDTH * (value / 100) * enter,
              backgroundColor: color.scan,
            }}
          />
        </div>
        <div style={{...mono, color: color.paperSoft, marginTop: 20, opacity: enter}}>
          {scanned} of {total} nodes scanned
        </div>

        <div style={{marginTop: 64, display: 'flex', flexDirection: 'column', gap: 18}}>
          {[
            {label: 'Detected', value: 0, tint: color.scan, p: rows[0], count: 1},
            {label: 'Present', value: bugs, tint: color.alert, p: rows[1], count: present},
          ].map((row) => (
            <div
              key={row.label}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                borderTop: `1px solid ${color.paperFaint}`,
                paddingTop: 12,
                opacity: row.p,
                translate: `${(1 - row.p) * -24}px 0`,
              }}
            >
              <span style={{...mono, color: color.paperSoft}}>{row.label}</span>
              <span
                style={{
                  fontFamily: font.display,
                  fontWeight: 700,
                  fontStretch: '80%',
                  fontSize: size.stat,
                  lineHeight: 1,
                  color: row.tint,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatCount(row.value * row.count)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
