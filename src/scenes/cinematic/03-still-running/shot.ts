import {defineShot, type ShotPatch} from '../../../shot';
import approved from './shot.json';
import {CAM0} from './StillRunningScene';

/**
 * X03 as an editable shot, camera only: the scene still draws its objects and
 * lights itself, so the shot declares none. The camera defaults to the scene's
 * own choreography ("code" mode); the approved patch or an editor draft can
 * lock it or replace it with a keyed camera track. position / target / fov
 * are the scene's opening camera (CAM0): the pose a lock starts from.
 */
export const shot = defineShot({
  id: 'cine-03-still-running',
  title: 'X03 · The process that did not stop',
  // JSON imports widen tuples to number[]; the file is validated by the editor when it writes it.
  approved: approved as unknown as ShotPatch,
  approvedPath: 'src/scenes/cinematic/03-still-running/shot.json',
  objects: {},
  lights: {},
  camera: {mode: 'code', locked: false, position: CAM0.position, target: CAM0.target, fov: CAM0.fov},
});
