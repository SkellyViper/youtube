import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Mask} from '../../components/typography/Mask';
import {SplitText} from '../../components/typography/SplitText';
import {useBeats} from '../../engine';
import {ease} from '../../styles/motion';
import {theme} from '../../styles/theme';

const {color, font, size} = theme;

const display: React.CSSProperties = {
  fontFamily: font.display,
  fontWeight: 800,
  fontStretch: '72%',
  fontSize: size.display,
  lineHeight: 1,
  whiteSpace: 'nowrap',
};

/**
 * Scene 4 typography. The two statements emerge from the ≠ glyph the way
 * the opening claim emerged from its seam - a deliberate visual bookend.
 */
export const ConclusionScene: React.FC = () => {
  const b = useBeats(['statement', 'coda']);

  const rise = (i: number, line: number) =>
    b.statement.stagger(i, {start: 0.05 + line * 0.2, each: 0.035, dur: 0.85, easing: ease.outExpo});

  const coda = b.coda.at(0.45, 1.5, ease.out);

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{position: 'absolute', top: 104, left: 0, right: 0, display: 'flex', justifyContent: 'center'}}>
        <Mask edge="bottom">
          <SplitText
            text="NOT DETECTED"
            style={{...display, color: color.scan}}
            unitStyle={(i) => ({translate: `0 ${(1 - rise(i, 0)) * 104}%`})}
          />
        </Mask>
      </div>
      <div style={{position: 'absolute', top: 738, left: 0, right: 0, display: 'flex', justifyContent: 'center'}}>
        <Mask edge="top">
          <SplitText
            text="DOES NOT EXIST"
            style={{...display, color: color.paper}}
            unitStyle={(i) => ({translate: `0 ${(rise(i, 1) - 1) * 104}%`})}
          />
        </Mask>
      </div>
      <div
        style={{
          position: 'absolute',
          top: 906,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily: font.serif,
          fontStyle: 'italic',
          fontSize: 50,
          color: color.paperSoft,
          opacity: coda,
          translate: `0 ${(1 - coda) * 14}px`,
          letterSpacing: '0.005em',
        }}
      >
        Absence of evidence is not evidence of absence.
      </div>
    </AbsoluteFill>
  );
};
