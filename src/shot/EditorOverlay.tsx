import {useThree, type ThreeEvent} from '@react-three/fiber';
import React, {useLayoutEffect, useMemo} from 'react';
import * as THREE from 'three';
import {useEpisodeFrame, useTimeline} from '../engine/context';
import {useShot} from './context';
import {cameraAt} from './resolve';

/**
 * Editor-only helpers drawn inside the 3D canvas: a box around the selected
 * object, a marker per positioned light (click to select it), and, while
 * the free inspection camera is active, the shot camera's frustum. Stage3D
 * mounts this only when an editor is attached, so it can never reach a render.
 */
export const ShotEditorOverlay: React.FC = () => {
  const shot = useShot();
  const scene = useThree((s) => s.scene);
  const size = useThree((s) => s.size);
  const timeline = useTimeline();
  const frame = useEpisodeFrame();
  const editor = shot?.editor;

  const box = useMemo(() => new THREE.Box3Helper(new THREE.Box3(), new THREE.Color('#FFD166')), []);
  const lightCam = useMemo(() => new THREE.PerspectiveCamera(34, 16 / 9, 0.3, 4), []);
  const camHelper = useMemo(() => new THREE.CameraHelper(lightCam), [lightCam]);
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
  const cam = shot?.state.camera;
  const pose = cam ? cameraAt(cam, timeline, frame) : null;
  useLayoutEffect(() => {
    camHelper.visible = Boolean(editor?.inspect && pose);
    if (!pose) return;
    lightCam.fov = pose.fov;
    lightCam.aspect = size.width / size.height;
    lightCam.far = 2.2;
    lightCam.position.set(...(pose.position as [number, number, number]));
    lightCam.lookAt(...(pose.target as [number, number, number]));
    lightCam.updateProjectionMatrix();
    lightCam.updateMatrixWorld();
    camHelper.update();
  });

  if (!shot || !editor) return null;
  const lights = Object.entries(shot.state.lights).filter(([, l]) => l.kind === 'directional' || l.kind === 'point' || l.kind === 'spot');

  return (
    <group name="__editor">
      <primitive object={box} />
      <primitive object={camHelper} />
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
