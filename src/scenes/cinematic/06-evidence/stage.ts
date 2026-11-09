import {HERO_RACK} from '../../../components/cinematic/route';
import {HALL, rackAt, rackYaw} from '../../../components/cinematic/world';
import {useCameraRig, type Rig, type Vec3} from '../../../components/cyber/three/rig';
import {bump, ease} from '../../../components/story/math';
import type {BeatClock} from '../../../engine';
import {useShotRig} from '../../../shot';

/**
 * X06 · Real evidence in a cinematic environment (hybrid: a 3D hall, real documents).
 *
 * What a muted viewer must understand: we leave the reenactment to look at
 * documented sources, and then we come back to the same place.
 *
 * Cast (what each object stands for, and why it is here):
 *   - the data hall      the place of X02: rows of racks, lights-out, idle blue.
 *                        It is the reenactment we are leaving and coming back to.
 *   - the hero rack      row 1, rack 3: the machine the agent landed in. Purple
 *                        LEDs, its 2U bay open, the iris turning inside. The
 *                        evidence comes out of this machine and goes back into it.
 *   - the seed           a small evidence frame forming in the open bay while the
 *                        camera is still moving: the chrome of the page before the
 *                        page. Pinned to the bay with projectPoint, so it rides the
 *                        3D camera.
 *   - the page           a real web page (Wikipedia, "Morris worm"), captured and
 *                        measured. It flies out of the bay to a readable rect, opens,
 *                        and its inner camera lands on one measured sentence. The
 *                        only words on screen are its own, plus its domain and date.
 *   - the citation       the same page docked small at the bottom-right corner:
 *                        the source stays on screen while the other material shows.
 *   - the photo          ENIAC, c. 1947 (US Army, public domain), true colour, with
 *                        an editor's push-in on the two operators.
 *   - the clip           NASA's night pass over city lights, portrait, playing on
 *                        beat time and frozen on the hold.
 *   - the veil           the world stepping back (desaturated, darker, a flat veil)
 *                        while the evidence is up; it lifts when the evidence leaves.
 *
 * Beats:
 *   ev-approach  medium three-quarter in the cold aisle on the hero rack; the camera
 *                pushes in on the open bay; the world begins to step back; the seed
 *                frame forms in the bay.
 *   ev-source    the page flies out of the bay to the readable rect, opens, the inner
 *                camera reframes onto the sentence and the passage lights.
 *   ev-media     the page docks to a citation at the corner; the photo and the clip
 *                arrive on one baseline; the clip plays; push-in on the operators.
 *   ev-return    photo and clip exit; the citation flies back into the bay; the veil
 *                lifts and the colour returns; the camera eases back out to the
 *                opening composition, a little higher than it started.
 *
 * Both layers (the 3D world, the 2D evidence) read the same beats and the same
 * rig from this module, so projectPoint pins agree with the rendered camera.
 */

export const BEATS = ['ev-approach', 'ev-source', 'ev-media', 'ev-return'] as const;
export type EvBeat = (typeof BEATS)[number];
export type EvClocks = Record<EvBeat, BeatClock>;

/* ------------------------------------------------------------------ geometry (hall-local metres) */

const heroCentre = rackAt(HERO_RACK.row, HERO_RACK.i);
const heroYaw = rackYaw(HERO_RACK.row);
/** Rack-local point -> hall-local, for the hero rack. */
const onHero = (local: Vec3): Vec3 => [heroCentre[0] + Math.cos(heroYaw) * local[0] + Math.sin(heroYaw) * local[2], local[1], heroCentre[2] - Math.sin(heroYaw) * local[0] + Math.cos(heroYaw) * local[2]];

/**
 * The pin: the iris in the open 2U bay (Rack.tsx places it at unit 5, 0.14 m
 * behind the faceplates), which is where the page comes out of the machine.
 */
export const BAY: Vec3 = onHero([0, 0.85, HALL.rack.depth / 2 - 0.08 - 0.14]);
/** The faceplates of the hero rack, for distances. */
const FACE: Vec3 = onHero([0, 1.0, HALL.rack.depth / 2 - 0.08]);
/** Unit vector pointing out of the rack into the cold aisle. */
const OUT: Vec3 = [Math.sin(heroYaw), 0, Math.cos(heroYaw)];
/** Unit vector along the row (the rack's own +x): to the camera's right when it faces the rack. */
const ALONG: Vec3 = [Math.cos(heroYaw), 0, -Math.sin(heroYaw)];
/** A point `out` metres in front of the face, `side` metres along the row, at height y. */
const aisle = (out: number, side: number, y: number): Vec3 => [FACE[0] + OUT[0] * out + ALONG[0] * side, y, FACE[2] + OUT[2] * out + ALONG[2] * side];

/**
 * Opening composition: a medium three-quarter from inside the cold aisle (the
 * aisle is 1.6 m wide between faces; 1.4 m out keeps the camera clear of the
 * opposite row), a step along the row, at head height, fov 38.
 */
export const CAM0: Rig = {position: aisle(1.38, 1.2, 1.46), target: [BAY[0], 0.98, BAY[2]], fov: 38};
/** Close on the open bay; the bay sits a little low-left of centre, so the page has somewhere to travel. */
const CAM_PUSH: Rig = {position: aisle(0.86, 0.5, 1.1), target: [BAY[0] + ALONG[0] * 0.1, BAY[1] + 0.07, BAY[2] + ALONG[2] * 0.1], fov: 33};
/** The return: the opening composition, slightly higher, so the return is not a rewind. */
const CAM_BACK: Rig = {position: aisle(1.44, 1.2, 1.74), target: [BAY[0], 1.04, BAY[2]], fov: 38};

const RIG_TRACK = [
  {beat: 'ev-approach', to: CAM_PUSH, from: 0.1, until: 2.6},
  {beat: 'ev-return', to: CAM_BACK, from: 0.3, until: 2.6},
];

/**
 * The camera, shared by the 3D layer (which renders it) and the 2D layer (which projects with it).
 * It is the shot camera: this choreography unless the shot config locks it or keys a camera track
 * (./shot.ts), so the 2D pins always follow the camera the 3D layer renders with.
 */
export const useEvidenceRig = (): Rig => {
  const codeRig = useCameraRig(CAM0, RIG_TRACK);
  return useShotRig(codeRig);
};

/* ------------------------------------------------------------------ shared progress values */

/**
 * 0..1 how far the world has stepped back behind the evidence (filter on the
 * stage + the veil). Most of the way during the push-in, so the iris still
 * shows behind the seed at that checkpoint; the rest as the page leaves the
 * bay. It lifts again while the citation returns.
 */
export const evidenceDim = (b: EvClocks): number =>
  (0.72 * b['ev-approach'].at(1.0, 2.4, ease.inOut) + 0.28 * b['ev-source'].at(0.0, 0.6, ease.inOut)) * (1 - b['ev-return'].at(0.7, 2.2, ease.inOut));

/**
 * The document's light in the bay: a flash as the page leaves the machine and
 * another as it comes back (the citation reaches the bay at ev-return 1.65 s).
 */
export const handoffFlare = (b: EvClocks): number => Math.max(bump(b['ev-source'].time, 0.0, 0.6), 0.8 * bump(b['ev-return'].time, 1.3, 1.9));

/** 0..1 the agent's light inside the open bay, rising as the camera closes in on it and settling back as it leaves. */
export const bayGlow = (b: EvClocks): number => b['ev-approach'].at(0.3, 2.4, ease.inOut) * (1 - b['ev-return'].at(0.8, 2.4, ease.inOut));
