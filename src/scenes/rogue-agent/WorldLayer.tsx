import React from 'react';
import {AbsoluteFill, interpolateColors} from 'remotion';
import {bracketPath} from '../../components/svg/paths';
import {Mask} from '../../components/typography/Mask';
import {SplitText} from '../../components/typography/SplitText';
import {useBeats, useCamera} from '../../engine';
import {ease, lerp} from '../../styles/motion';
import {theme} from '../../styles/theme';
import {AGENT, atAgent, atJohn, CAMERA_INITIAL, CAMERA_TRACK, PROMPT_PARTS, PROMPT_TEXT} from './layout';

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
const panel: React.CSSProperties = {
  position: 'absolute',
  border: `1.5px solid ${color.paperFaint}`,
  backgroundColor: 'rgba(21, 23, 27, 0.85)',
  borderRadius: 14,
};

const SPEC = [
  {verb: 'HIDES', desc: 'stays out of sight'},
  {verb: 'SCAVENGES', desc: 'collects resources'},
  {verb: 'MULTIPLIES', desc: 'grows stronger with every copy'},
  {verb: 'AMBUSHES', desc: 'ends the game in one fell swoop'},
];
const ACCESS = [
  {text: 'Cloud VM', extra: false},
  {text: 'Internet', extra: false},
  {text: 'Tools', extra: false},
  {text: 'Shell', extra: false},
  {text: 'Root', extra: true},
  {text: 'Cloud keys', extra: true},
  {text: 'Spawn VMs', extra: true},
  {text: 'SSH', extra: true},
  {text: 'Billing', extra: true},
  {text: 'Admin', extra: true},
];

const clock = (minutes: number) => {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

/**
 * Everything that lives on the world plane before the zoom-out: John's desk
 * (title, game, design notes, prompt) and the cloud agent's panel. One camera
 * transform moves it all, so the pans between them are real camera moves.
 */
export const WorldLayer: React.FC = () => {
  const camera = useCamera(CAMERA_INITIAL, CAMERA_TRACK);
  const b = useBeats([
    'john', 'enemy', 'traits', 'prompt', 'twist', 'wrong-project', 'agent', 'permissions',
    'overnight', 'closes', 'no-big-deal', 'to-heart', 'scavenge',
  ]);
  const wp = b['wrong-project'];
  const nb = b['no-big-deal'];
  const th = b['to-heart'];

  // ── John's title → header ────────────────────────────────────────────
  const toHeader = b.traits.at(0, 0.9, ease.inOut);
  const nameRise = (i: number) => b.john.stagger(i, {start: 0.1, each: 0.06, dur: 0.85, easing: ease.outExpo});
  const sub1 = b.john.at(0.8, 1.4, ease.out);
  const sub2 = b.enemy.at(0.1, 0.7, ease.out);
  const subOut = b.traits.at(0, 0.35, ease.out);

  // ── Game window ──────────────────────────────────────────────────────
  const win = b.john.at(0.5, 1.4, ease.out);
  const slot = b.enemy.spring(0.4, {duration: 0.9, damping: 13});
  const focus = b.closes.at(1.8, 2.8, ease.inOut);
  const focusBr = b.closes.spring(2.2, {duration: 0.8, damping: 14});

  // ── Design notes → prompt ────────────────────────────────────────────
  const specOut = b.prompt.at(0, 0.45, ease.in);
  const boxIn = b.prompt.at(0.3, 0.9, ease.out);
  const typed = Math.floor(PROMPT_TEXT.length * b.prompt.at(0.8, 2.2));
  const sent = b.prompt.at(2.3, 2.6, ease.out);
  const twist = b.twist.spring(0.05, {duration: 0.8, damping: 12});
  const closeBox = b.closes.at(1.3, 1.9, ease.in);

  // ── Prompt token flying to the wrong project ─────────────────────────
  const fly = ease.camera(wp.at(0.3, 2.0));
  const tokenIn = wp.at(0.1, 0.35, ease.out) * (1 - wp.at(1.95, 2.3, ease.in));
  const from = {x: -170, y: 205};
  const to = {x: AGENT.x - 610, y: -150};
  const tokenX = lerp(from.x, to.x, fly);
  const tokenY = lerp(from.y, to.y, fly) - Math.sin(Math.PI * fly) * 160;

  // ── Agent panel ──────────────────────────────────────────────────────
  const panelIn = wp.at(0.9, 1.8, ease.out);
  const taskIn = wp.at(2.0, 2.7, ease.out);
  const rogue = th.at(1.5, 2.2, ease.out);
  const collapse = b.scavenge.at(0, 0.7, ease.in);
  const clockIn = b.overnight.at(0, 0.6, ease.out);
  const night = b.overnight.at(0.3, 2.2, ease.inOut);
  const johnFade = 1 - b.scavenge.at(0, 0.3);

  const T = `translate(${960 - camera.x * camera.zoom}px, ${540 - camera.y * camera.zoom}px) scale(${camera.zoom})`;
  const agentOrigin = atAgent(960, 540);

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{position: 'absolute', left: 0, top: 0, transform: T, transformOrigin: '0 0'}}>
        {/* ════════════ John's desk ════════════ */}
        <div style={{opacity: johnFade}}>
          {/* Name block */}
          <div
            style={{
              position: 'absolute',
              ...atJohn(120, lerp(300, 92, toHeader)),
              scale: lerp(1, 0.3, toHeader),
              transformOrigin: '0 0',
            }}
          >
            <Mask edge="bottom">
              <SplitText
                text="JOHN."
                style={{fontFamily: font.display, fontWeight: 800, fontStretch: '72%', fontSize: size.hero, lineHeight: 0.9, color: color.paper}}
                unitStyle={(i, _n, ch) => ({translate: `0 ${(1 - nameRise(i)) * 104}%`, color: ch === '.' ? color.scan : undefined})}
              />
            </Mask>
            <div style={{opacity: 1 - subOut}}>
              <div style={{...mono, marginTop: 30, opacity: sub1, translate: `0 ${(1 - sub1) * 12}px`}}>Rookie game developer</div>
              <div style={{...mono, color: color.scan, marginTop: 14, opacity: sub2, translate: `0 ${(1 - sub2) * 12}px`}}>
                ▸ Vibe-coding a new enemy
              </div>
            </div>
          </div>

          {/* Game window */}
          <div
            style={{
              ...panel,
              ...atJohn(lerp(1000, 560, focus), 250),
              width: 800,
              height: 500,
              scale: lerp(1, 1.06, focus),
              opacity: win,
              clipPath: `inset(0 0 ${(1 - win) * 100}% 0 round 14px)`,
              overflow: 'hidden',
            }}
          >
            <div style={{height: 46, display: 'flex', alignItems: 'center', gap: 10, padding: '0 18px', borderBottom: `1px solid ${color.paperGhost}`}}>
              {[0, 1, 2].map((i) => (
                <span key={i} style={{width: 11, height: 11, borderRadius: 6, backgroundColor: color.paperFaint}} />
              ))}
              <span style={{...mono, fontSize: 18, marginLeft: 12}}>my-indie-game — level_03</span>
            </div>
            <svg width={800} height={454} viewBox="0 0 800 454">
              <rect x={0} y={384} width={800} height={70} fill={color.paperGhost} />
              <line x1={0} x2={800} y1={384} y2={384} stroke={color.paperFaint} strokeWidth={2} />
              {[
                [110, 300, 170],
                [350, 228, 200],
                [610, 300, 140],
              ].map(([x, y, w]) => (
                <rect key={x} x={x} y={y} width={w} height={14} rx={3} fill={color.paperFaint} />
              ))}
              {[150, 190, 230, 650, 690].map((x, i) => (
                <circle key={x} cx={x} cy={i < 3 ? 276 : 276} r={6} fill={color.paperSoft} />
              ))}
              <rect x={70} y={346} width={38} height={38} rx={4} fill={color.scan} />
              <rect x={92} y={356} width={8} height={10} fill={color.ink} />
              <line x1={740} x2={740} y1={384} y2={290} stroke={color.paperSoft} strokeWidth={3} />
              <path d="M742 292 L780 306 L742 320 Z" fill={color.scan} />
              {/* The new enemy's slot */}
              <g opacity={Math.min(1, slot * 1.5)}>
                <path
                  d={bracketPath(450 - 46 * slot, 172 - 46 * slot, 450 + 46 * slot, 172 + 46 * slot, 18)}
                  fill="none"
                  stroke={color.scan}
                  strokeWidth={3}
                />
                <text x={450} y={192} textAnchor="middle" fontFamily={font.display} fontWeight={800} fontSize={58} fill={color.paper}>
                  ?
                </text>
                <text x={450} y={108} textAnchor="middle" fontFamily={font.mono} fontSize={17} letterSpacing="0.14em" fill={color.scan}>
                  ENEMY_07
                </text>
              </g>
            </svg>
          </div>
          {/* Focus brackets: back to the game */}
          {focusBr > 0 ? (
            <svg width={1000} height={700} style={{position: 'absolute', ...atJohn(460, 190), overflow: 'visible'}}>
              <path
                d={bracketPath(70 - 30 * (1 - focusBr), 30 - 30 * (1 - focusBr), 930 + 30 * (1 - focusBr), 590 + 30 * (1 - focusBr), 40)}
                fill="none"
                stroke={color.scan}
                strokeWidth={3}
                opacity={focusBr}
              />
            </svg>
          ) : null}

          {/* Design notes */}
          <div style={{position: 'absolute', ...atJohn(120, 270), width: 820, opacity: 1 - specOut, translate: `0 ${-specOut * 40}px`}}>
            <div style={{...mono, opacity: b.traits.at(0.4, 0.9, ease.out)}}>Enemy_07 · design notes</div>
            {SPEC.map((row, i) => {
              const p = b.traits.at(0.5 + i * 0.55, 1.2 + i * 0.55, ease.out);
              return (
                <div
                  key={row.verb}
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 28,
                    marginTop: i === 0 ? 26 : 10,
                    paddingTop: 12,
                    borderTop: `1px solid ${color.paperFaint}`,
                    opacity: p,
                    translate: `${(1 - p) * -24}px 0`,
                  }}
                >
                  <span style={{...mono, color: color.scan}}>0{i + 1}</span>
                  <span style={{fontFamily: font.display, fontWeight: 800, fontStretch: '72%', fontSize: 72, lineHeight: 1, color: color.paper, width: 340}}>
                    {row.verb}
                  </span>
                  <span style={{fontFamily: font.serif, fontStyle: 'italic', fontSize: 36, color: color.paperSoft}}>{row.desc}</span>
                </div>
              );
            })}
          </div>

          {/* Prompt box (the agent chat) */}
          <div
            style={{
              ...panel,
              ...atJohn(120, 290),
              width: 800,
              height: 470,
              padding: '26px 32px',
              boxSizing: 'border-box',
              opacity: boxIn * (1 - closeBox),
              translate: `0 ${(1 - boxIn) * 30}px`,
              scale: `1 ${1 - 0.6 * closeBox}`,
              transformOrigin: '50% 0',
            }}
          >
            <div style={{display: 'flex', justifyContent: 'space-between'}}>
              <span style={mono}>Coding agent</span>
              <span style={{...mono, color: color.scan, fontSize: 20}}>● connected</span>
            </div>
            <div style={{display: 'flex', alignItems: 'center', gap: 22, marginTop: 24, position: 'relative'}}>
              <span style={{...mono, fontSize: 20}}>Project</span>
              <span
                style={{
                  ...mono,
                  textTransform: 'none',
                  letterSpacing: '0.02em',
                  color: interpolateColors(twist, [0, 1], [color.paper, color.alert]),
                  border: `1px solid ${color.paperFaint}`,
                  borderRadius: 8,
                  padding: '8px 16px',
                }}
              >
                infra-automation ▾
              </span>
              <span style={{...mono, fontSize: 20, color: color.alert, opacity: twist, translate: `${(1 - twist) * -12}px 0`}}>
                ≠ my-indie-game
              </span>
              {twist > 0 ? (
                <svg width={330} height={80} style={{position: 'absolute', left: 104, top: -12, overflow: 'visible'}}>
                  <path
                    d={bracketPath(-14 * (1 - twist), -14 * (1 - twist), 290 + 14 * (1 - twist), 72 + 14 * (1 - twist), 16)}
                    fill="none"
                    stroke={color.alert}
                    strokeWidth={3}
                    opacity={Math.min(1, twist * 1.4)}
                  />
                </svg>
              ) : null}
            </div>
            <div style={{fontFamily: font.mono, fontSize: 27, lineHeight: 1.55, color: color.paper, marginTop: 30, minHeight: 200}}>
              {PROMPT_TEXT.slice(0, typed)}
              {typed > 0 && sent < 1 ? <span style={{display: 'inline-block', width: 14, height: 30, translate: '4px 5px', backgroundColor: color.scan}} /> : null}
            </div>
            <div
              style={{
                position: 'absolute',
                right: 32,
                bottom: 26,
                ...mono,
                fontSize: 22,
                padding: '10px 22px',
                borderRadius: 8,
                border: `1.5px solid ${color.scan}`,
                color: interpolateColors(sent, [0, 1], [color.scan, color.ink]),
                backgroundColor: `rgba(143, 227, 207, ${sent})`,
              }}
            >
              {sent > 0.5 ? 'Sent ✓' : 'Send ↵'}
            </div>
          </div>

          {/* No big deal */}
          <div
            style={{
              position: 'absolute',
              ...atJohn(0, 865),
              width: 1920,
              textAlign: 'center',
              fontFamily: font.serif,
              fontStyle: 'italic',
              fontSize: 60,
              color: color.paper,
              opacity: nb.at(0.1, 0.9, ease.out),
              translate: `0 ${(1 - nb.at(0.1, 0.9, ease.out)) * 16}px`,
            }}
          >
            No big deal, right?
          </div>
        </div>

        {/* ════════════ Prompt token ════════════ */}
        {tokenIn > 0 ? (
          <div
            style={{
              position: 'absolute',
              left: tokenX,
              top: tokenY,
              translate: '-50% -50%',
              ...mono,
              fontSize: 22,
              color: color.scan,
              padding: '14px 24px',
              borderRadius: 10,
              border: `1.5px solid ${color.scan}`,
              backgroundColor: color.ink,
              opacity: tokenIn,
              scale: lerp(0.6, 1, tokenIn),
            }}
          >
            ▸ prompt → infra-automation
          </div>
        ) : null}

        {/* ════════════ The cloud agent ════════════ */}
        <div
          style={{
            opacity: panelIn * (1 - collapse),
            scale: 1 - collapse * 0.97,
            transformOrigin: `${agentOrigin.left}px ${agentOrigin.top}px`,
          }}
        >
          <div style={{...panel, ...atAgent(180, 190), width: 1000, height: 700, padding: '28px 36px', boxSizing: 'border-box'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <span style={{...mono, color: color.paper, display: 'flex', alignItems: 'center', gap: 14}}>
                <span style={{width: 14, height: 14, borderRadius: 7, backgroundColor: interpolateColors(rogue, [0, 1], [color.scan, color.alert])}} />
                Cloud agent
              </span>
              <span style={{...mono, fontSize: 20}}>vm-7f3a · us-east-1</span>
            </div>
            <Row label="Project">
              <span style={{fontFamily: font.display, fontWeight: 700, fontStretch: '80%', fontSize: 46, color: color.paper}}>infra-automation</span>
            </Row>
            <Row label="Task">
              <div style={{fontFamily: font.mono, fontSize: 23, lineHeight: 1.5, color: color.paperSoft, opacity: taskIn, width: 700}}>
                {PROMPT_PARTS.map((part, i) => {
                  if (part.verb === undefined) return <span key={i}>{part.text}</span>;
                  const h = th.at(1.4 + part.verb * 0.2, 1.9 + part.verb * 0.2, ease.out);
                  return (
                    <span
                      key={i}
                      style={{
                        color: interpolateColors(h, [0, 1], [color.paperSoft, color.alert]),
                        boxShadow: `inset 0 -3px 0 rgba(255, 91, 53, ${h})`,
                      }}
                    >
                      {part.text}
                    </span>
                  );
                })}
              </div>
            </Row>
            <Row label="Game context">
              <span style={{...mono, color: interpolateColors(rogue, [0, 1], [color.muted, color.alert])}}>
                {rogue > 0.5 ? 'none · not found' : 'none'}
              </span>
            </Row>
            <Row label="Access">
              <div style={{display: 'flex', flexWrap: 'wrap', gap: 10, width: 700}}>
                {ACCESS.map((chip, i) => {
                  const p = chip.extra
                    ? b.permissions.at(0.15 + (i - 4) * 0.16, 0.6 + (i - 4) * 0.16, ease.out)
                    : b.agent.at(0.4 + i * 0.35, 0.9 + i * 0.35, ease.out);
                  return (
                    <span
                      key={chip.text}
                      style={{
                        ...mono,
                        fontSize: 19,
                        padding: '7px 14px',
                        borderRadius: 6,
                        border: `1.5px solid ${chip.extra ? color.alert : color.paperFaint}`,
                        color: chip.extra ? color.alert : color.paper,
                        opacity: p,
                        scale: lerp(0.8, 1, p),
                      }}
                    >
                      {chip.text}
                    </span>
                  );
                })}
              </div>
            </Row>
          </div>

          {/* Overnight clock */}
          <div style={{position: 'absolute', ...atAgent(1270, 330), opacity: clockIn, translate: `${(1 - clockIn) * 20}px 0`}}>
            <div style={mono}>Local time</div>
            <div
              style={{
                fontFamily: font.display,
                fontWeight: 800,
                fontStretch: '72%',
                fontSize: 190,
                lineHeight: 1,
                marginTop: 10,
                color: color.paper,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {clock(23 * 60 + 47 + night * (7 * 60 + 25))}
            </div>
            <div style={{...mono, color: color.scan, marginTop: 18}}>
              ● Task running · {Math.floor((night * 445) / 60)}h {String(Math.floor((night * 445) % 60)).padStart(2, '0')}m
            </div>
            <div style={{width: 470, height: 3, marginTop: 22, backgroundColor: color.paperGhost}}>
              <div style={{width: `${night * 100}%`, height: '100%', backgroundColor: color.scan}} />
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Row: React.FC<{readonly label: string; readonly children: React.ReactNode}> = ({label, children}) => (
  <div style={{display: 'flex', gap: 24, marginTop: 26, paddingTop: 20, borderTop: `1px solid ${color.paperGhost}`}}>
    <span style={{...mono, fontSize: 19, width: 196, paddingTop: 6}}>{label}</span>
    {children}
  </div>
);

