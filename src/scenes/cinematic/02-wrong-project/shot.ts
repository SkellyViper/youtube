import {cyber} from '../../../styles/cyber';
import {defineShot, rigLights, type ShotPatch} from '../../../shot';
import approved from './shot.json';
import {CHAIR, DESK, KEYBOARD, MONITOR, MOUSE, SHOT_A, SHOT_B} from './layout';

/**
 * X02 as an editable shot (Style Lab V2): every object, light, the camera,
 * the stage look and the timing cues.
 *
 * Code defaults: one locked main shot (Shot A). The approved `shot.json`
 * adds the camera track: Shot A, a cut to the terminal insert (Shot B, with
 * a very slight push-in) for the send beat, and a cut back to Shot A. Edit it
 * on the shot editor's timeline; "Code defaults" returns to the single shot.
 */
// The Legacy neon rig, with the rim brought down so it grazes the silhouettes instead of washing the desk top.
const rig = rigLights({key: 0.75, fill: 0.18, rim: 2.2, ambient: 0.28, sky: 0.3});
const lowRim = {...rig.rim, defaults: {...rig.rim.defaults, position: [-2.6, 2.1, -4.4] as const, target: [0, 0.95, 0.6] as const}};

export const shot = defineShot({
  id: 'cine-02-wrong-project',
  title: 'X02 · The wrong project',
  // JSON imports widen tuples to number[]; the file is validated by the editor when it writes it.
  approved: approved as unknown as ShotPatch,
  approvedPath: 'src/scenes/cinematic/02-wrong-project/shot.json',
  objects: {
    // ---- the legacy stage
    horizon: {label: 'Horizon haze', group: 'Stage', purpose: 'Legacy look: the cold line where the floor meets the void.', slots: {haze: 'Haze (emissive intensity = strength)'}},
    'stage-floor': {label: 'Obsidian floor', group: 'Stage', purpose: 'Legacy look: dark glass floor with a fading hairline grid; catches the shadows.', slots: {glass: 'Glass', grid: 'Grid (emissive intensity = strength)'}},

    // ---- the workstation
    desk: {
      label: 'Desk',
      group: 'Workstation',
      purpose: 'Context: he is at work.',
      pivot: [DESK.top[0], 0, DESK.top[2]],
      slots: {top: 'Top', legs: 'Panel legs', edge: 'Front-edge light (emissive intensity = strength)'},
    },
    monitor: {
      label: 'Curved monitor',
      group: 'Workstation',
      purpose: 'Explains: the two repositories, the agent, and where the request goes.',
      pivot: MONITOR.center,
      defaults: {edges: {enabled: true, color: cyber.color.blue, intensity: 0.55, threshold: 40}},
      slots: {body: 'Bezel, housing, stand', screen: 'Picture (colour tints, emissive intensity = brightness)'},
    },
    keyboard: {label: 'Keyboard', group: 'Workstation', purpose: 'Supports typing and the Enter that sends it.', pivot: KEYBOARD.position, slots: {body: 'Case', keys: 'Keys'}},
    mouse: {label: 'Mouse', group: 'Workstation', purpose: 'He carries on: his hand goes to it.', pivot: MOUSE.position, slots: {body: 'Body'}},

    // ---- the person
    chair: {
      label: 'Chair',
      group: 'People',
      purpose: 'He sits. Dark matter, so it never merges with the light figure.',
      pivot: CHAIR.floor,
      defaults: {edges: {enabled: true, color: cyber.color.blue, intensity: 0.45, threshold: 40}},
      slots: {frame: 'Frame, arms, base', cushion: 'Seat + arm pads', mesh: 'Back mesh', trim: 'Backrest hairline (emissive intensity = strength)'},
    },
    developer: {
      label: 'John (light figure)',
      group: 'People',
      purpose: 'The subject: a person made of light.',
      pivot: CHAIR.floor,
      variants: [
        {id: 'person', label: 'Sculpted light figure (CC0 base mesh)'},
        {id: 'procedural', label: 'Procedural light figure (older)'},
      ],
      slots: {core: 'Body light (emissive intensity = brightness)', rim: 'Silhouette + contour light (emissive intensity = brightness)'},
    },
  },
  lights: {
    // The Legacy neon rig: a cold rim draws silhouettes, a soft key gives the furniture form and shadows.
    ...rig,
    rim: lowRim,
    'glow-screen': {label: 'Screen glow', role: 'practical', defaults: {kind: 'practical', intensity: 1, color: ''}},
    'glow-agent': {label: 'Agent light (cloud-ops side)', role: 'practical', defaults: {kind: 'practical', intensity: 1, color: ''}},
    'figure-glow': {label: 'Figure spill', role: 'practical', defaults: {kind: 'practical', intensity: 1, color: ''}},
  },
  camera: {
    // Code default: the main shot, locked (shot.json adds the insert).
    mode: 'locked',
    locked: true,
    position: SHOT_A.position,
    target: SHOT_A.target,
    fov: SHOT_A.fov,
    angles: {
      'shot-a': {label: 'A · Over the shoulder (main)', position: SHOT_A.position, target: SHOT_A.target, fov: SHOT_A.fov, roll: 0},
      'shot-b': {label: 'B · Terminal insert', position: SHOT_B.position, target: SHOT_B.target, fov: SHOT_B.fov, roll: 0},
    },
  },
  stage: {exposure: 1, bloom: {enabled: true, strength: cyber.bloom.strength, radius: cyber.bloom.radius, threshold: cyber.bloom.threshold}, fog: cyber.fog.density, shadows: true, grade: true},
  motions: {
    // wp-type · Establish (Shot A): his game on the left, the terminal on the right; he types a task for his agent
    'type-prompt': {label: 'He types the task into the terminal (right)', beat: 'wp-type', from: 0.3, until: 3.9, easing: 'linear'},
    // wp-send · Trigger (Shot B, the insert): the task sits there, Enter, the agent starts in cloud-ops
    'to-enter': {label: 'His right hand goes to Enter', beat: 'wp-send', from: 1.4, until: 2.0, easing: 'inOut'},
    submit: {label: 'Enter: the task is sent to the active tab, cloud-ops', beat: 'wp-send', from: 2.1, until: 2.3, easing: 'out'},
    'work-begins': {label: 'The agent starts working in ~/cloud-ops', beat: 'wp-send', from: 2.4, until: null, easing: 'linear'},
    // wp-carry · Outcome (Shot A): the agent acts in cloud-ops; he does not react, he goes back to his game
    'reach-mouse': {label: 'His hand goes to the mouse', beat: 'wp-carry', from: 0.4, until: 1.4, easing: 'inOut'},
    'look-at-game': {label: 'He turns to his game (left)', beat: 'wp-carry', from: 0.3, until: 1.4, easing: 'inOut'},
    'focus-left': {label: 'He clicks into the game window', beat: 'wp-carry', from: 1.3, until: 1.6, easing: 'out'},
    'play-game': {label: 'He presses play and tests his game', beat: 'wp-carry', from: 1.9, until: 2.2, easing: 'out'},
    'work-spreads': {label: 'The agent keeps going, unattended', beat: 'wp-carry', from: 0, until: null, easing: 'linear'},
    // wp-hold · Casual continuation, ominous hold (Shot A)
    'lean-back': {label: 'He leans back, still playing', beat: 'wp-hold', from: 0.5, until: 2.8, easing: 'inOut'},
    'work-everywhere': {label: 'Still working in cloud-ops', beat: 'wp-hold', from: 0, until: 3.2, easing: 'inOut'},
    linger: {label: 'The purple stays on the right (ominous hold)', beat: 'wp-hold', from: 0.8, until: null, easing: 'inOut'},
  },
});
