/**
 * Video 01 kit, 3D half (Legacy / Digital Noir). One import for everything a
 * physical reenactment needs; each piece is the component the approved
 * reference shot (X02 The wrong project) is built from, not a copy.
 * Guide: docs/VIDEO_01_VISUAL_LANGUAGE.md. 2D half: ./index.ts.
 *
 *   NoirStage, noirStageObjects   void + horizon + obsidian grid floor, lit and graded by the shot
 *   noirRig, noirStage            the episode's light rig and stage look for a shot definition
 *   screenInsert                  the close-up camera on a part of a screen (cut to it, do not travel)
 *   HoloPerson                    the light figure (featureless, contour lines), posed by props
 *   StudioDesk, CurvedMonitor, LowKeyboard, SlimMouse, MeshChair   the minimal workstation, sized by props
 *   useScreenTexture, paintRepoScreen   a screen's picture as a pure per-frame canvas painter; the game + coding-agent interface
 */
export {NoirStage, noirStageObjects} from './NoirStage';
export {noirRig, noirStage} from '../../shot/presets';
export {screenInsert, screenPoint, type InsertOptions, type ScreenRegion, type ScreenSpec} from '../../shot/cameras';
export {HoloPerson} from '../cinematic/three/HoloPerson';
export type {HoloFigureProps, HoloPose, ChairEnvelope} from '../cinematic/three/HoloFigure';
export {StudioDesk, CurvedMonitor, LowKeyboard, SlimMouse, MeshChair, type DeskSpec, type MonitorSpec, type KeyboardSpec, type ChairSpec} from '../cinematic/three/Workstation';
export {HorizonHaze, ObsidianFloor} from '../cinematic/three/LegacyStage';
export {useScreenTexture, type Painter} from '../cinematic/three/ScreenTexture';
export {paintRepoScreen, REPO_SCREEN_LAYOUT} from '../cinematic/three/repoScreen';
export {video01} from '../../styles/video01';
