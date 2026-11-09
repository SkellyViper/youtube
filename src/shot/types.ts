/**
 * Shot configuration: the editable art direction of one 3D shot.
 *
 * A shot has two layers of truth:
 *
 *   code      `defineShot()` in the scene folder declares the objects, lights,
 *             camera, stage and named motions with their *default* values.
 *             Advanced animation logic stays in React/Remotion code.
 *   patch     a sparse JSON document (`ShotPatch`) that overrides only the
 *             properties someone changed: "developer.position", "key.intensity",
 *             "camera.locked". The approved patch is a file in the repo
 *             (`shot.json` next to the scene); the editor works on a draft copy.
 *
 * The effective state is `code defaults <- patch`. Because a patch only names
 * what changed, a small edit never overwrites unrelated values, two edits merge
 * cleanly, and the diff of `shot.json` in a pull request reads like a list of
 * art-direction notes.
 *
 * Units: metres, degrees for rotations and angles (friendlier to type than
 * radians), seconds for time. Colours are `#rrggbb`.
 */

export type Vec3 = readonly [number, number, number];

/** Easing presets a motion or camera move can use (see easing.ts). */
export type EasingName = 'linear' | 'in' | 'out' | 'inOut' | 'arrive' | 'ignite' | 'glide' | 'camera' | 'signal' | 'overshoot';

/** One editable material slot of an object (e.g. a desk's "top" or "frame"). */
export type MaterialLook = {
  readonly color?: string;
  readonly emissive?: string;
  readonly emissiveIntensity?: number;
  readonly roughness?: number;
  readonly metalness?: number;
};

/** Luminous edge lines drawn on an object's hard edges (the legacy "clean luminous edges"). */
export type EdgeLook = {
  readonly enabled: boolean;
  readonly color: string;
  /** Multiplier; above ~1 it blooms (same scale as `cyber.emissive`: 0.55 dim, 1.5 base, 2.6 strong). */
  readonly intensity: number;
  /** Crease angle in degrees: only edges sharper than this are drawn. */
  readonly threshold: number;
};

export type ObjectState = {
  readonly position: Vec3;
  /** Degrees, XYZ order. */
  readonly rotation: Vec3;
  /** Uniform scale. */
  readonly scale: number;
  readonly visible: boolean;
  /** 0..1, applied to every material slot of the object. */
  readonly opacity: number;
  /** Model / preset reference, when the object offers variants ('' = none). */
  readonly variant: string;
  readonly materials: Readonly<Record<string, MaterialLook>>;
  readonly edges: EdgeLook;
};

export type LightKind = 'ambient' | 'hemisphere' | 'directional' | 'point' | 'spot' | 'practical';

/**
 * rig          the reusable key / fill / rim / ambient set every shot has.
 * environment  scene-specific "where we are" light (window, room bounce);
 *              lighting presets switch these off.
 * practical    light that belongs to an object (a monitor's glow, a lamp).
 *              The object renders it; the config scales and tints it.
 */
export type LightRole = 'rig' | 'environment' | 'practical';

export type LightState = {
  readonly kind: LightKind;
  readonly enabled: boolean;
  /** Empty string = the colour the code chooses (practicals: the screen's tint). */
  readonly color: string;
  /** Hemisphere lights: the ground colour. */
  readonly groundColor: string;
  /** Physical units for point/spot (three.js r155+); for practicals a multiplier. */
  readonly intensity: number;
  readonly position: Vec3;
  readonly target: Vec3;
  readonly castShadow: boolean;
  /** Spot cone half-angle, degrees. */
  readonly angle: number;
  readonly penumbra: number;
  /** 0 = infinite. */
  readonly distance: number;
};

/** A camera move bound to a beat; only used when the camera is unlocked. */
export type CameraMove = {
  readonly enabled: boolean;
  readonly position: Vec3;
  readonly target: Vec3;
  readonly fov: number;
  /** Seconds into the beat. */
  readonly from: number;
  /** Seconds into the beat; null = end of beat. */
  readonly until: number | null;
  readonly easing: EasingName;
};

export type Projection = 'perspective' | 'orthographic';

/** How a camera keyframe is reached from the previous one. */
export type CameraEase = EasingName | 'smooth';

/**
 * A camera keyframe on the shot's timeline (the video-editor camera track).
 *
 * Time is (beat, seconds into that beat's animation), not an absolute frame:
 * keys survive beat retiming, and the camera never moves during a hold, so
 * the presenter can rest on any checkpoint. Between two keys the camera
 * blends with the later key's `ease` (`smooth` = a Catmull-Rom path through
 * the neighbouring keys, constant pace). A key with `cut` is a hard cut: the
 * previous pose holds until the key's time, then the shot changes.
 */
export type CameraKey = {
  readonly beat: string;
  readonly t: number;
  readonly position: Vec3;
  readonly target: Vec3;
  readonly fov: number;
  /** Degrees. */
  readonly roll: number;
  readonly ease: CameraEase;
  readonly cut: boolean;
  /** Name shown on the timeline ("Wide", "Over the shoulder"). */
  readonly label: string;
};

/** A saved camera angle (the angle bin): drop it on the timeline as a key or a cut. */
export type CameraAngle = {
  readonly label: string;
  readonly position: Vec3;
  readonly target: Vec3;
  readonly fov: number;
  readonly roll: number;
};

/**
 * locked  one fixed pose for the whole shot
 * keys    the keyframe track (cuts and moves edited on the timeline)
 * code    the camera the scene's code computes (its original choreography)
 */
export type CameraMode = 'locked' | 'keys' | 'code';

/** A timestamped review note on the timeline ("camera too fast here"). Never rendered. */
export type ShotNote = {
  readonly beat: string;
  readonly t: number;
  readonly text: string;
  readonly done: boolean;
};

export type CameraState = {
  /**
   * Locked (the default for new shots): the camera stays exactly at
   * position/target/fov for the whole shot, whatever the beats do. Unlocked:
   * the authored `moves` play, starting from this pose.
   */
  readonly locked: boolean;
  readonly projection: Projection;
  readonly position: Vec3;
  readonly target: Vec3;
  /** Vertical field of view, degrees (perspective). */
  readonly fov: number;
  /** World units visible vertically (orthographic). */
  readonly orthoHeight: number;
  /** Degrees. */
  readonly roll: number;
  readonly moves: Readonly<Record<string, CameraMove>>;
  /** Effective mode (derived: an explicit `mode`, else `locked`, else keys if any, else code). */
  readonly mode: CameraMode;
  readonly keys: Readonly<Record<string, CameraKey>>;
  readonly angles: Readonly<Record<string, CameraAngle>>;
};

export type BloomState = {readonly enabled: boolean; readonly strength: number; readonly radius: number; readonly threshold: number};

export type StageState = {
  readonly exposure: number;
  readonly bloom: BloomState;
  /** Exponential fog density; 0 = off. */
  readonly fog: number;
  /** Empty string = the theme's void colour. */
  readonly background: string;
  readonly shadows: boolean;
  /** Finishing grade (vignette + grain) on top of the 3D stage. */
  readonly grade: boolean;
};

export type BeatState = {
  /** Animation length, seconds. */
  readonly duration: number;
  /** Export-only hold after the beat, seconds. */
  readonly hold: number;
};

/** What a transform motion moves an object to. Omitted fields stay as they are. */
export type MotionTarget = {
  readonly position?: Vec3;
  readonly rotation?: Vec3;
  readonly scale?: number;
  readonly opacity?: number;
  readonly visible?: boolean;
};

/**
 * A named piece of timing inside a beat.
 *
 * cue        code-driven: the scene reads its 0..1 progress with
 *            `useMotion(id)` and decides what it means (a head turn, a reply
 *            writing itself). The editor changes *when* and *how* (beat,
 *            offsets, easing), not what.
 * transform  config-driven: moves/rotates/scales/fades/hides `object` to `to`.
 *            These can be added in the editor without code.
 */
export type MotionState = {
  readonly kind: 'cue' | 'transform';
  readonly label: string;
  readonly beat: string;
  /** Seconds into the beat. */
  readonly from: number;
  /** Seconds into the beat; null = end of beat. */
  readonly until: number | null;
  readonly easing: EasingName;
  readonly enabled: boolean;
  readonly object?: string;
  readonly to?: MotionTarget;
};

export type ShotState = {
  readonly objects: Readonly<Record<string, ObjectState>>;
  readonly lights: Readonly<Record<string, LightState>>;
  readonly camera: CameraState;
  readonly stage: StageState;
  readonly beats: Readonly<Record<string, BeatState>>;
  readonly motions: Readonly<Record<string, MotionState>>;
  readonly notes: Readonly<Record<string, ShotNote>>;
};

/* ------------------------------------------------------------------ patch */

export type ObjectPatch = {
  position?: Vec3;
  rotation?: Vec3;
  scale?: number;
  visible?: boolean;
  opacity?: number;
  variant?: string;
  materials?: Record<string, MaterialLook>;
  edges?: Partial<EdgeLook>;
};

export type CameraPatch = {
  locked?: boolean;
  projection?: Projection;
  position?: Vec3;
  target?: Vec3;
  fov?: number;
  orthoHeight?: number;
  roll?: number;
  moves?: Record<string, Partial<CameraMove>>;
  mode?: CameraMode;
  keys?: Record<string, CameraKey>;
  angles?: Record<string, CameraAngle>;
};

export type StagePatch = {
  exposure?: number;
  bloom?: Partial<BloomState>;
  fog?: number;
  background?: string;
  shadows?: boolean;
  grade?: boolean;
};

/** Sparse overrides. Every leaf is optional; arrays (Vec3) are replaced whole. */
export type ShotPatch = {
  /** Schema version of the file. */
  version?: 1;
  /** The shot id this patch belongs to (checked on import). */
  shot?: string;
  /** Free-form note for reviewers (shown in the editor). */
  note?: string;
  objects?: Record<string, ObjectPatch>;
  lights?: Record<string, Partial<LightState>>;
  camera?: CameraPatch;
  stage?: StagePatch;
  beats?: Record<string, Partial<BeatState>>;
  motions?: Record<string, Partial<MotionState>>;
  notes?: Record<string, ShotNote>;
};

/* ------------------------------------------------------------------ definition */

export type ObjectDef = {
  readonly label: string;
  /** Hierarchy folder ("Room", "Workstation", "Stage"). */
  readonly group: string;
  /** Why the object exists (explain / context / composition). Shown in the inspector. */
  readonly purpose?: string;
  /**
   * World point the object rotates and scales around, and where its position
   * starts. The children are authored in world coordinates as usual; the
   * object's position is where that pivot ends up.
   */
  readonly pivot?: Vec3;
  /** Code defaults; anything omitted uses the generic defaults (origin, visible, no edges). */
  readonly defaults?: Partial<Omit<ObjectState, 'materials' | 'edges'>> & {readonly edges?: Partial<EdgeLook>};
  /** Material slots the object's component reads with `useLook(slot)`, with labels. */
  readonly slots?: Readonly<Record<string, string>>;
  /** Model / preset choices. The first is the default unless `defaults.variant` says otherwise. */
  readonly variants?: readonly {readonly id: string; readonly label: string}[];
};

export type LightDef = {
  readonly label: string;
  readonly role: LightRole;
  readonly defaults: Partial<LightState> & {readonly kind: LightKind};
};

export type MotionDef = Partial<MotionState> & {readonly beat: string; readonly label: string};

export type ShotDef = {
  /** Same as the composition id, e.g. `cine-01-john`. */
  readonly id: string;
  readonly title: string;
  readonly objects: Readonly<Record<string, ObjectDef>>;
  readonly lights: Readonly<Record<string, LightDef>>;
  readonly camera: Partial<Omit<CameraState, 'moves' | 'mode' | 'keys' | 'angles'>> & {
    readonly moves?: Readonly<Record<string, Partial<CameraMove>>>;
    /** Default mode when the patch does not choose one ('code' for scenes with authored cameras). */
    readonly mode?: CameraMode;
    /** Starter angles for the angle bin. */
    readonly angles?: Readonly<Record<string, CameraAngle>>;
  };
  readonly stage?: Partial<Omit<StageState, 'bloom'>> & {readonly bloom?: Partial<BloomState>};
  readonly motions?: Readonly<Record<string, MotionDef>>;
  /** The approved patch, imported from the scene's `shot.json`. */
  readonly approved: ShotPatch;
  /** Repo path of that file (the editor's "Save to repo" writes it). */
  readonly approvedPath: string;
};
