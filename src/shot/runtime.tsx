import {type ThreeEvent} from '@react-three/fiber';
import React, {createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef} from 'react';
import * as THREE from 'three';
import type {Rig} from '../components/cyber/three/rig';
import {useStageQuality} from '../components/cyber/three/Stage3D';
import {Spot} from '../components/cinematic/three/Signals';
import {StoryGrade} from '../components/story/Atmosphere';
import {EpisodeComposition, useEpisodeFrame, useTimeline, type EpisodeDef} from '../engine';
import {ThemeProvider, useTheme} from '../styles/ThemeContext';
import type {ThemeId} from '../styles/themes';
import {ShotContext, ShotEditorContext, useShot, type ShotRuntime} from './context';
import {applyShotBeats, cameraAt, DEFAULT_OBJECT, motionProgress, objectAt, resolveShot, shotCameraAt, type CameraPose} from './resolve';
import type {EdgeLook, LightState, MaterialLook, ObjectState, ShotDef, ShotPatch, StageState} from './types';
import '../styles/fonts';

const DEG = Math.PI / 180;

/* ------------------------------------------------------------------ composition */

/** Composition props of an editable shot. `shot` replaces the approved patch (editor drafts, CLI renders). */
export type ShotProps = {readonly theme?: ThemeId; readonly shot?: ShotPatch};

/**
 * Wrap an episode as an editable-shot composition. The same component is the
 * gallery preview, the editor viewport and the MP4 render: only the `shot`
 * input prop differs (absent = the approved `shot.json`).
 */
export const shotComposition = (def: ShotDef, baseEpisode: EpisodeDef): React.FC<ShotProps> => {
  const C: React.FC<ShotProps> = ({theme, shot}) => {
    const patch = shot ?? def.approved;
    const editor = useContext(ShotEditorContext);
    const episode = useMemo(() => applyShotBeats(baseEpisode, patch), [patch]);
    const state = useMemo(() => resolveShot(def, baseEpisode, patch), [patch]);
    const runtime = useMemo<ShotRuntime>(() => ({def, state, editor}), [state, editor]);
    return (
      <ThemeProvider theme={theme}>
        <ShotContext.Provider value={runtime}>
          <EpisodeComposition episode={episode} />
        </ShotContext.Provider>
      </ThemeProvider>
    );
  };
  C.displayName = `Shot(${def.id})`;
  return C;
};

/** The episode a patch implies (beat timing edits change it). */
export const shotEpisode = (def: ShotDef, baseEpisode: EpisodeDef, shot?: ShotPatch): EpisodeDef => applyShotBeats(baseEpisode, shot ?? def.approved);

/** Finishing grade layer that the stage settings can switch off. */
export const ShotGrade: React.FC = () => {
  const shot = useShot();
  return shot && !shot.state.stage.grade ? null : <StoryGrade />;
};

/* ------------------------------------------------------------------ objects */

type ObjectRuntime = {readonly id: string; readonly state: ObjectState};
const ObjectContext = createContext<ObjectRuntime | null>(null);

const hiddenInTree = (o: THREE.Object3D | null): boolean => {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return true;
  return false;
};

/**
 * One editable object: a group whose transform, visibility, opacity, variant,
 * material slots and luminous edges come from the shot state (code defaults
 * <- patch <- transform motions at this frame). Children are the object's
 * geometry, written in code as usual.
 *
 * In the editor, clicking the object in the viewport selects it.
 */
export const ShotObject: React.FC<{readonly id: string; readonly children?: React.ReactNode}> = ({id, children}) => {
  const shot = useShot();
  const timeline = useTimeline();
  const frame = useEpisodeFrame();
  const state = shot ? objectAt(shot.state, id, timeline, frame) : DEFAULT_OBJECT;
  const ref = useRef<THREE.Group>(null);
  useEdges(ref, state.edges);
  const ctx = useMemo<ObjectRuntime>(() => ({id, state}), [id, state]);
  const pivot = shot?.def.objects[id]?.pivot ?? DEFAULT_OBJECT.position;
  const editor = shot?.editor;
  const onClick = editor
    ? (e: ThreeEvent<MouseEvent>) => {
        if (hiddenInTree(e.object)) return;
        e.stopPropagation();
        editor.select({kind: 'object', id});
      }
    : undefined;
  return (
    <ObjectContext.Provider value={ctx}>
      <group
        ref={ref}
        name={id}
        position={[state.position[0], state.position[1], state.position[2]]}
        rotation={[state.rotation[0] * DEG, state.rotation[1] * DEG, state.rotation[2] * DEG]}
        scale={Math.max(1e-4, state.scale)}
        visible={state.visible && state.opacity > 0.001}
        onClick={onClick}
      >
        <group position={[-pivot[0], -pivot[1], -pivot[2]]}>{children}</group>
      </group>
    </ObjectContext.Provider>
  );
};

/**
 * How far the enclosing object has been moved from its pivot (position - pivot).
 * Components that reach for something outside themselves (a figure's hands on
 * the keyboard) subtract it so the reach still lands when the object moves.
 */
export const useObjectOffset = (): readonly [number, number, number] => {
  const obj = useContext(ObjectContext);
  const shot = useShot();
  if (!obj || !shot) return [0, 0, 0];
  const pivot = shot.def.objects[obj.id]?.pivot ?? DEFAULT_OBJECT.position;
  return [obj.state.position[0] - pivot[0], obj.state.position[1] - pivot[1], obj.state.position[2] - pivot[2]];
};

/** The enclosing object's state (variant, opacity...). Null outside a ShotObject. */
export const useObjectState = (): ObjectState | null => useContext(ObjectContext)?.state ?? null;

/** The enclosing object's variant, or `fallback`. */
export const useVariant = (fallback: string): string => {
  const v = useContext(ObjectContext)?.state.variant;
  return v ? v : fallback;
};

export type LookBase = {
  readonly color: string;
  readonly roughness?: number;
  readonly metalness?: number;
  readonly emissive?: string;
  readonly emissiveIntensity?: number;
  readonly opacity?: number;
  readonly transparent?: boolean;
};

export type LookProps = {
  color: string;
  roughness: number;
  metalness: number;
  emissive: string;
  emissiveIntensity: number;
  transparent: boolean;
  opacity: number;
  depthWrite: boolean;
};

/**
 * Material props for one slot of the enclosing ShotObject: the component's
 * own values (`base`) with the slot's patch applied, and the object's opacity.
 * Spread it on a standard material:
 *
 *   const top = useLook('top', {color: m.desk, roughness: 0.62});
 *   <meshStandardMaterial {...top} />
 */
export const useLook = (slot: string, base: LookBase): LookProps => {
  const obj = useContext(ObjectContext);
  const shot = useShot();
  const patch: MaterialLook | undefined = obj?.state.materials[slot];
  const look: Required<MaterialLook> = {
    color: patch?.color || base.color,
    roughness: patch?.roughness ?? base.roughness ?? 0.8,
    metalness: patch?.metalness ?? base.metalness ?? 0,
    emissive: patch?.emissive || base.emissive || '#000000',
    emissiveIntensity: patch?.emissiveIntensity ?? base.emissiveIntensity ?? 1,
  };
  const opacity = (base.opacity ?? 1) * (obj?.state.opacity ?? 1);
  const editor = shot?.editor;
  const key = JSON.stringify(look);
  useEffect(() => {
    if (editor && obj) editor.report(obj.id, slot, JSON.parse(key));
  }, [editor, obj, slot, key]);
  return {...look, transparent: Boolean(base.transparent) || opacity < 0.999, opacity, depthWrite: opacity >= 0.999};
};

/* ------------------------------------------------------------------ luminous edges */

const edgeCache = new WeakMap<THREE.BufferGeometry, Map<number, THREE.EdgesGeometry>>();
const edgesFor = (geo: THREE.BufferGeometry, threshold: number): THREE.EdgesGeometry => {
  let byAngle = edgeCache.get(geo);
  if (!byAngle) edgeCache.set(geo, (byAngle = new Map()));
  let e = byAngle.get(threshold);
  if (!e) byAngle.set(threshold, (e = new THREE.EdgesGeometry(geo, threshold)));
  return e;
};
const noRaycast = () => undefined;

/**
 * Draws crease edges of every mesh under `ref` as HDR lines (they bloom above
 * ~1). Instanced meshes, points and meshes tagged `userData.noEdges` are
 * skipped. Synced after every render, so it follows geometry that changes
 * with the frame (a figure's limbs) and stays deterministic.
 */
const useEdges = (ref: React.RefObject<THREE.Group | null>, look: EdgeLook) => {
  const material = useMemo(() => new THREE.LineBasicMaterial({transparent: true, depthWrite: false}), []);
  useEffect(() => () => material.dispose(), [material]);
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const existing: THREE.Object3D[] = [];
    root.traverse((o) => {
      if (o.userData.__edge) existing.push(o);
    });
    if (!look.enabled || look.intensity <= 0) {
      existing.forEach((l) => l.removeFromParent());
      return;
    }
    material.color.set(look.color).multiplyScalar(look.intensity);
    material.opacity = 1;
    const keep = new Set<THREE.Object3D>();
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || (o as THREE.InstancedMesh).isInstancedMesh || o.userData.__edge || o.userData.noEdges) return;
      const geo = edgesFor(mesh.geometry, look.threshold);
      let line = mesh.children.find((c) => c.userData.__edge) as THREE.LineSegments | undefined;
      if (!line) {
        line = new THREE.LineSegments(geo, material);
        line.userData.__edge = true;
        line.raycast = noRaycast;
        mesh.add(line);
      } else if (line.geometry !== geo) {
        line.geometry = geo;
      }
      keep.add(line);
    });
    existing.forEach((l) => {
      if (!keep.has(l)) l.removeFromParent();
    });
  });
};

/* ------------------------------------------------------------------ motions */

/** 0..1 progress of a named motion (cue) at the current frame. */
export const useMotion = (id: string): number => {
  const shot = useShot();
  const timeline = useTimeline();
  const frame = useEpisodeFrame();
  const m = shot?.state.motions[id];
  if (!m) throw new Error(`[shot] unknown motion "${id}"${shot ? ` in shot "${shot.def.id}"` : ' (no shot context)'}`);
  return motionProgress(m, timeline, frame);
};

/* ------------------------------------------------------------------ camera + stage */

/**
 * The shot camera at this frame. `codeRig` is the camera the scene computes
 * itself (its original choreography); it is used in `code` mode and is
 * reported to the editor so it can be keyed or baked into the timeline.
 * Locked: the fixed pose. Keys: the timeline's camera track. In the editor,
 * the free inspection camera replaces all of these in the viewport only.
 *
 * Outside a shot composition (old scenes) it simply returns `codeRig`.
 */
export const useShotRig = (codeRig?: Rig): Rig => {
  const shot = useShot();
  const timeline = useTimeline();
  const frame = useEpisodeFrame();
  const cam = shot?.state.camera;
  const codePose: CameraPose | null = codeRig ? {position: codeRig.position, target: codeRig.target, fov: codeRig.fov, roll: ((codeRig.roll ?? 0) * 180) / Math.PI} : cam ? {...cameraAt({...cam, locked: false}, timeline, frame), roll: cam.roll} : null;
  const editor = shot?.editor;
  const codeKey = codePose ? JSON.stringify(codePose) : '';
  useEffect(() => {
    if (editor && codeKey) editor.reportCode(frame, JSON.parse(codeKey));
  }, [editor, frame, codeKey]);
  if (!shot || !cam) {
    if (!codeRig) throw new Error('[shot] useShotRig() needs a shot composition or a code camera');
    return codeRig;
  }
  if (editor?.inspect) return editor.inspect;
  const pose = shotCameraAt(cam, timeline, frame, codeRig ? codePose : null);
  return {position: pose.position, target: pose.target, fov: pose.fov, roll: pose.roll * DEG, projection: cam.projection, orthoHeight: cam.orthoHeight};
};

/** Stage3D props from the stage settings. */
export const useShotStage = (): {bloom: {strength: number; radius: number; threshold: number} | false; exposure: number; fog: number; background: string; fogColor: string; shadows: boolean} => {
  const shot = useShot();
  const th = useTheme();
  const s: StageState | undefined = shot?.state.stage;
  if (!s) return {bloom: false, exposure: 1, fog: 0, background: th.color.void, fogColor: th.color.void, shadows: false};
  const bg = s.background || th.color.void;
  return {
    bloom: s.bloom.enabled ? {strength: s.bloom.strength, radius: s.bloom.radius, threshold: s.bloom.threshold} : false,
    exposure: s.exposure,
    fog: s.fog,
    background: bg,
    fogColor: bg,
    shadows: s.shadows,
  };
};

/* ------------------------------------------------------------------ lights */

/**
 * A practical light's multiplier and colour: the object that owns the light
 * (a monitor, a lamp, the window) multiplies its own intensity by this.
 */
export const usePractical = (id: string, fallbackColor: string): {intensity: number; color: string} => {
  const l = useShot()?.state.lights[id];
  if (!l) return {intensity: 1, color: fallbackColor};
  return {intensity: l.enabled ? l.intensity : 0, color: l.color || fallbackColor};
};

const ShotLight: React.FC<{readonly id: string; readonly light: LightState}> = ({id, light}) => {
  const quality = useStageQuality();
  const target = useMemo(() => new THREE.Object3D(), []);
  target.position.set(light.target[0], light.target[1], light.target[2]);
  const i = light.enabled ? Math.max(0, light.intensity) : 0;
  const pos: [number, number, number] = [light.position[0], light.position[1], light.position[2]];
  const shadow = light.enabled && light.castShadow;
  switch (light.kind) {
    case 'ambient':
      return <ambientLight name={id} intensity={i} color={light.color} />;
    case 'hemisphere':
      return <hemisphereLight name={id} intensity={i} color={light.color} groundColor={light.groundColor} />;
    case 'directional':
      return (
        <>
          <primitive object={target} />
          <directionalLight
            name={id}
            position={pos}
            target={target}
            intensity={i}
            color={light.color}
            castShadow={shadow}
            shadow-mapSize-width={quality.shadow}
            shadow-mapSize-height={quality.shadow}
            shadow-camera-left={-4}
            shadow-camera-right={4}
            shadow-camera-top={4}
            shadow-camera-bottom={-4}
            shadow-camera-near={0.5}
            shadow-camera-far={40}
            shadow-bias={-0.0004}
            shadow-normalBias={0.02}
          />
        </>
      );
    case 'point':
      return <pointLight name={id} position={pos} intensity={i} color={light.color} distance={light.distance} decay={2} castShadow={shadow} />;
    case 'spot':
      return <Spot position={light.position} target={light.target} intensity={i} color={light.color} angle={light.angle * DEG} penumbra={light.penumbra} distance={light.distance} castShadow={shadow} />;
    default:
      return null;
  }
};

/**
 * Every non-practical light of the shot (the key / fill / rim / ambient rig
 * and any environment lights declared as real lights). Lights stay mounted
 * at intensity 0 when disabled: changing the number of lights would make
 * three.js recompile every shader in the middle of a beat.
 */
export const ShotLights: React.FC = () => {
  const shot = useShot();
  if (!shot) return null;
  return (
    <>
      {Object.entries(shot.state.lights)
        .filter(([, l]) => l.kind !== 'practical')
        .map(([id, l]) => (
          <ShotLight key={id} id={id} light={l} />
        ))}
    </>
  );
};
