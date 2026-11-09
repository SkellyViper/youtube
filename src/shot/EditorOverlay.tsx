import {useThree, type ThreeEvent} from '@react-three/fiber';
import React, {useLayoutEffect, useMemo} from 'react';
import * as THREE from 'three';
import {useTimeline} from '../engine/context';
import {useShot} from './context';
import {keyFrame, keysPoseAt, sortedKeys} from './resolve';

/**
 * Editor-only helpers drawn inside the 3D canvas: a box around the selected
 * object, a marker per positioned light (click to select it) and, while the
 * free inspection camera is active, the shot camera's frustum and the keyed
 * camera path with its keyframes (click one to select it). Stage3D mounts
 * this only when an editor is attached, so it can never reach a render.
 */
export const ShotEditorOverlay: React.FC = () => {
  const shot = useShot();
  const scene = useThree((s) => s.scene);
  const size = useThree((s) => s.size);
  const timeline = useTimeline();
  const editor = shot?.editor;

  const box = useMemo(() => new THREE.Box3Helper(new THREE.Box3(), new THREE.Color('#FFD166')), []);
  const shotCam = useMemo(() => new THREE.PerspectiveCamera(34, 16 / 9, 0.3, 4), []);
  const camHelper = useMemo(() => new THREE.CameraHelper(shotCam), [shotCam]);
  useLayoutEffect(() => {
    for (const h of [box, camHelper]) {
      h.renderOrder = 999;
      const m = h.material as THREE.LineBasicMaterial;
      m.depthTest = false;
      m.transparent = true;
      m.toneMapped = false;
    }
  }, [box, camHelper]);

  const sel = editor?.selected;
  // Selection box: recomputed every render (objects move with the frame).
  useLayoutEffect(() => {
    box.visible = false;
    if (!sel || sel.kind !== 'object') return;
    const target = scene.getObjectByName(sel.id);
    if (!target || !target.visible) return;
    box.box.setFromObject(target, true);
    if (!box.box.isEmpty()) box.visible = true;
  });

  // Shot camera frustum, shown only while inspecting with the free camera.
  const pose = editor?.shotPose ?? null;
  useLayoutEffect(() => {
    camHelper.visible = Boolean(editor?.inspect && pose);
    if (!pose) return;
    shotCam.fov = pose.fov;
    shotCam.aspect = size.width / size.height;
    shotCam.far = 1.6;
    shotCam.position.set(pose.position[0], pose.position[1], pose.position[2]);
    shotCam.lookAt(pose.target[0], pose.target[1], pose.target[2]);
    shotCam.updateProjectionMatrix();
    shotCam.updateMatrixWorld();
    camHelper.update();
  });

  // The keyed camera path: sampled every 4 frames over the animation.
  const cam = shot?.state.camera;
  const path = useMemo(() => {
    if (!cam || cam.mode !== 'keys' || Object.keys(cam.keys).length < 2) return null;
    const pts: THREE.Vector3[] = [];
    for (const b of timeline.beats) {
      for (let f = b.start; f <= b.animEnd; f += 4) {
        const p = keysPoseAt(cam, timeline, f);
        if (p) pts.push(new THREE.Vector3(p.position[0], p.position[1], p.position[2]));
      }
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [cam, timeline]);

  if (!shot || !editor) return null;
  const lights = Object.entries(shot.state.lights).filter(([, l]) => l.kind === 'directional' || l.kind === 'point' || l.kind === 'spot');
  const keys = cam && cam.mode === 'keys' ? sortedKeys(cam, timeline) : [];

  return (
    <group name="__editor">
      <primitive object={box} />
      <primitive object={camHelper} />
      {editor.inspect && path ? (
        <line>
          <primitive object={path} attach="geometry" />
          <lineBasicMaterial color="#FFC35C" depthTest={false} transparent opacity={0.85} toneMapped={false} />
        </line>
      ) : null}
      {editor.inspect
        ? keys.map(([id, k]) => {
            const active = sel?.kind === 'key' && sel.id === id;
            return (
              <mesh
                key={id}
                position={[k.position[0], k.position[1], k.position[2]]}
                renderOrder={1001}
                onClick={(e: ThreeEvent<MouseEvent>) => {
                  e.stopPropagation();
                  editor.select({kind: 'key', id});
                }}
                userData={{frame: keyFrame(timeline, k)}}
              >
                <octahedronGeometry args={[active ? 0.07 : 0.045, 0]} />
                <meshBasicMaterial color={k.cut ? '#FF5A68' : '#FFC35C'} depthTest={false} transparent toneMapped={false} />
              </mesh>
            );
          })
        : null}
      {lights.map(([id, l]) => {
        const active = sel?.kind === 'light' && sel.id === id;
        const on = l.enabled && l.intensity > 0;
        return (
          <group key={id}>
            <mesh
              position={[l.position[0], l.position[1], l.position[2]]}
              renderOrder={1000}
              onClick={(e: ThreeEvent<MouseEvent>) => {
                e.stopPropagation();
                editor.select({kind: 'light', id});
              }}
            >
              <octahedronGeometry args={[active ? 0.09 : 0.06, 0]} />
              <meshBasicMaterial color={on ? l.color : '#555a66'} wireframe={!active} depthTest={false} transparent toneMapped={false} />
            </mesh>
            {l.kind !== 'point' && active ? <Segment a={l.position} b={l.target} color={l.color} /> : null}
          </group>
        );
      })}
    </group>
  );
};

const Segment: React.FC<{readonly a: readonly number[]; readonly b: readonly number[]; readonly color: string}> = ({a, b, color}) => {
  const geo = useMemo(() => new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(a[0], a[1], a[2]), new THREE.Vector3(b[0], b[1], b[2])]), [a, b]);
  return (
    <lineSegments geometry={geo} renderOrder={1000}>
      <lineBasicMaterial color={color} depthTest={false} transparent toneMapped={false} />
    </lineSegments>
  );
};
