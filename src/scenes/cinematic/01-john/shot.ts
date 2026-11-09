import {CHAT_MONITOR, DESK, GAME_MONITOR, JOHN, KEYBOARD, LAMP, MOUSE, MUG, PLANT} from '../../../components/cinematic/world';
import {defineShot, rigLights, type ShotPatch} from '../../../shot';
import approved from './shot.json';

/**
 * X01 as an editable shot: every object, light, the camera, the stage look
 * and the timing cues, with the values the scene was originally written with
 * as code defaults. `shot.json` (next to this file) is the approved patch on
 * top of them; the Style Lab editor edits a draft of it.
 *
 * Reset to code defaults in the editor and you get the original X01 back
 * (warm room, city outside, moving camera; only the figure keeps its
 * corrected proportions): nothing was deleted, only configured away.
 */
export const shot = defineShot({
  id: 'cine-01-john',
  title: 'X01 · John at his computer',
  // JSON imports widen tuples to number[]; the file is validated by the editor when it writes it.
  approved: approved as unknown as ShotPatch,
  approvedPath: 'src/scenes/cinematic/01-john/shot.json',
  objects: {
    // ---- the legacy stage (off in the original cut)
    horizon: {label: 'Horizon haze', group: 'Stage', purpose: 'Legacy look: the cold line of light where the floor meets the void.', defaults: {visible: false}, slots: {haze: 'Haze (emissive intensity = strength)'}},
    'stage-floor': {label: 'Obsidian floor', group: 'Stage', purpose: 'Legacy look: a dark glass floor with a fading hairline grid.', defaults: {visible: false}, slots: {glass: 'Glass', grid: 'Grid (emissive intensity = strength)'}},

    // ---- the room
    'room-floor': {label: 'Floorboards', group: 'Room', purpose: 'Context: a real room.', slots: {floor: 'Floor (colour multiplies the planks)'}},
    rug: {label: 'Rug', group: 'Room', purpose: 'Decoration.', slots: {rug: 'Rug'}},
    walls: {label: 'Walls', group: 'Room', purpose: 'Context: encloses the room.', slots: {back: 'Back wall', sides: 'Side + front walls', skirting: 'Skirting'}},
    ceiling: {label: 'Ceiling', group: 'Room', slots: {ceiling: 'Ceiling'}},
    window: {label: 'Window + blinds', group: 'Room', purpose: 'Context: night outside.', slots: {frame: 'Frame'}},
    facade: {label: 'Building facade', group: 'Room', purpose: 'Only seen from outside (X02 / X03).', slots: {facade: 'Facade'}},
    bookshelf: {label: 'Bookshelf', group: 'Room', purpose: 'Decoration.', slots: {shelves: 'Shelves'}},
    poster: {label: 'Poster', group: 'Room', purpose: 'Decoration.', slots: {frame: 'Frame'}},
    city: {label: 'City outside', group: 'Room', purpose: 'Seen through the window. Adds nothing to this shot.'},

    // ---- the workstation
    desk: {label: 'Desk', group: 'Workstation', purpose: 'Context: where he works.', pivot: [DESK.center[0], 0, DESK.center[2]], slots: {top: 'Top', frame: 'Steel frame', drawer: 'Drawer unit'}},
    'monitor-game': {label: 'Game monitor', group: 'Workstation', purpose: 'Explains: the game he is making.', pivot: GAME_MONITOR.position, slots: {body: 'Bezel + stand', screen: 'Picture (colour tints, emissive intensity = brightness)'}},
    'monitor-agent': {label: 'Agent monitor', group: 'Workstation', purpose: 'Explains: the AI agent he works with.', pivot: CHAT_MONITOR.position, slots: {body: 'Bezel + stand', screen: 'Picture (colour tints, emissive intensity = brightness)'}},
    keyboard: {label: 'Keyboard', group: 'Workstation', purpose: 'Supports the typing action.', pivot: KEYBOARD.position, slots: {body: 'Body', keys: 'Keys'}},
    mouse: {label: 'Mouse', group: 'Workstation', pivot: MOUSE.position, slots: {body: 'Body'}},
    mug: {label: 'Mug', group: 'Workstation', purpose: 'Decoration.', pivot: MUG.position},
    lamp: {label: 'Desk lamp', group: 'Workstation', purpose: 'A warm practical light.', pivot: LAMP.position},
    plant: {label: 'Plant', group: 'Workstation', purpose: 'Decoration (stacked cones).', pivot: PLANT.position},
    cables: {label: 'Cables', group: 'Workstation', purpose: 'Only needed when a message travels (X02).'},

    // ---- the person
    developer: {
      label: 'Developer (John)',
      group: 'People',
      purpose: 'The subject.',
      pivot: JOHN.position,
      variants: [
        {id: 'figure', label: 'Stylised figure (matte)'},
        {id: 'hologram', label: 'Light-dot hologram'},
      ],
      slots: {hoodie: 'Hoodie', jeans: 'Jeans', skin: 'Skin', hair: 'Hair', headphones: 'Headphones', shoes: 'Shoes', body: 'Hologram: silhouette', dots: 'Hologram: dots (emissive intensity = brightness)'},
    },
    chair: {label: 'Office chair', group: 'People', purpose: 'He sits.', pivot: JOHN.position, slots: {shell: 'Seat + back', base: 'Column'}},
  },
  lights: {
    ...rigLights(),
    'window-light': {label: 'Window (moonlight)', role: 'environment', defaults: {kind: 'practical', intensity: 1}},
    'room-bounce': {label: 'Room bounce', role: 'environment', defaults: {kind: 'practical', intensity: 1}},
    'glow-game': {label: 'Game screen glow', role: 'practical', defaults: {kind: 'practical', intensity: 1, color: ''}},
    'glow-agent': {label: 'Agent screen glow', role: 'practical', defaults: {kind: 'practical', intensity: 1, color: ''}},
    'lamp-light': {label: 'Lamp', role: 'practical', defaults: {kind: 'practical', intensity: 1, color: ''}},
  },
  camera: {
    // The original cut moves on every beat; the approved shot locks it.
    locked: false,
    position: [-2.05, 1.72, 2.95],
    target: [0.05, 1.0, -0.1],
    fov: 40,
    moves: {
      'jc-room': {position: [-1.3, 1.55, 2.2], target: [0.0, 1.0, -0.15], fov: 38},
      'jc-game': {position: [0.58, 1.46, 1.38], target: [-0.27, 1.08, -0.3], fov: 30, from: 0, until: 2.2},
      'jc-agent': {position: [-1.05, 1.42, 1.45], target: [0.5, 1.12, -0.24], fov: 27, from: 0.1, until: 2.2},
      'jc-hold': {position: [-0.95, 1.5, 2.65], target: [0.1, 1.0, -0.2], fov: 36, from: 0, until: 2.2},
    },
  },
  stage: {exposure: 1.2, bloom: {enabled: true, strength: 0.42, radius: 0.6, threshold: 1.0}, fog: 0.014, shadows: true, grade: true},
  motions: {
    'slime-split': {label: 'The slime splits (game screen)', beat: 'jc-game', from: 0.7, until: 2.3, easing: 'inOut'},
    'turn-to-agent': {label: 'He turns to the agent', beat: 'jc-agent', from: 0, until: 0.9, easing: 'inOut'},
    'agent-reply': {label: 'The agent’s reply writes itself', beat: 'jc-agent', from: 0.4, until: 2.4, easing: 'linear'},
    'agent-working': {label: 'The agent keeps working', beat: 'jc-hold', from: 0, until: 0.8, easing: 'out'},
    'turn-back': {label: 'He turns back to the game', beat: 'jc-hold', from: 0.6, until: 1.6, easing: 'inOut'},
  },
});
