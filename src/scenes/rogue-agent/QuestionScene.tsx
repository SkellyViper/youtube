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
const serif: React.CSSProperties = {fontFamily: font.serif, fontStyle: 'italic', fontSize: 64, whiteSpace: 'nowrap'};
const mono: React.CSSProperties = {
  fontFamily: font.mono,
  fontSize: size.label,
  fontWeight: 500,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: color.muted,
};
const center: React.CSSProperties = {position: 'absolute', left: 0, right: 0, display: 'flex', justifyContent: 'center'};

/** Closing question typography (scene 4). The internet returns behind it via InternetLayer. */
export const QuestionScene: React.FC = () => {
  const b = useBeats(['today', 'lab', 'like-john', 'more', 'know']);
  const out = b.more.at(0, 0.6, ease.in);
  const label = b.today.at(0.1, 0.9, ease.out);
  const rule = b.today.at(0.4, 1.4, ease.out);
  const rise = (i: number) => b.lab.stagger(i, {start: 0.05, each: 0.035, dur: 0.85, easing: ease.outExpo});
  const sub = b.lab.at(0.9, 1.7, ease.out);
  const strike = b['like-john'].at(0, 0.5, ease.inOut);
  const john = b['like-john'].at(0.35, 1.2, ease.out);
  const lead = b.know.at(0, 0.8, ease.out);
  const riseKnow = (i: number) => b.know.stagger(i, {start: 0.5, each: 0.03, dur: 0.85, easing: ease.outExpo});

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <AbsoluteFill style={{opacity: 1 - out, translate: `0 ${-out * 40}px`}}>
        <div style={{...center, top: 300, flexDirection: 'column', alignItems: 'center', gap: 18}}>
          <div style={{...mono, opacity: label}}>Today's question</div>
          <div style={{width: 120, height: 2, backgroundColor: color.paperFaint, scale: `${rule} 1`}} />
        </div>
        <div style={{...center, top: 400}}>
          <Mask edge="bottom">
            <SplitText
              text="A ROGUE AI AGENT"
              style={{...display, color: color.paper}}
              unitStyle={(i) => ({translate: `0 ${(1 - rise(i)) * 104}%`, color: i >= 1 && i <= 5 ? color.alert : undefined})}
            />
          </Mask>
        </div>
        <div style={{...center, top: 590, opacity: sub, translate: `0 ${(1 - sub) * 14}px`}}>
          <span style={{...serif, color: color.paperSoft}}>
            that didn't come from{' '}
            <span style={{position: 'relative', opacity: 1 - 0.55 * strike}}>
              a billion-dollar AI lab
              <span
                style={{
                  position: 'absolute',
                  left: -6,
                  right: -6,
                  top: '55%',
                  height: 5,
                  backgroundColor: color.alert,
                  scale: `${strike} 1`,
                  transformOrigin: '0 50%',
                }}
              />
            </span>
          </span>
        </div>
        <div style={{...center, top: 690, opacity: john, translate: `0 ${(1 - john) * 14}px`}}>
          <span style={{...serif, color: color.paper}}>
            but from somebody like <span style={{color: color.scan}}>John</span>?
          </span>
        </div>
      </AbsoluteFill>

      {/* Final question over the (faint) internet. */}
      {b.know.started ? (
        <>
          <AbsoluteFill
            style={{background: `radial-gradient(ellipse 45% 32% at 50% 50%, ${color.ink} 30%, rgba(12,13,15,0) 100%)`, opacity: lead}}
          />
          <div style={{...center, top: 360, opacity: lead, translate: `0 ${(1 - lead) * 14}px`}}>
            <span style={{...serif, fontSize: 52, color: color.paperSoft}}>If one were already hiding somewhere on the internet…</span>
          </div>
          <div style={{...center, top: 460}}>
            <Mask edge="bottom">
              <SplitText
                text="HOW WOULD WE KNOW?"
                style={{...display, fontSize: 176, color: color.paper}}
                unitStyle={(i, n) => ({translate: `0 ${(1 - riseKnow(i)) * 104}%`, color: i === n - 1 ? color.alert : undefined})}
              />
            </Mask>
          </div>
        </>
      ) : null}
    </AbsoluteFill>
  );
};
