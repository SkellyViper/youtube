import React, {useEffect, useLayoutEffect, useMemo} from 'react';
import * as THREE from 'three';
import {structureProps} from '../../../components/cyber/three';
import {cyber} from '../../../styles/cyber';
import {BOARD, MODULES, SEGMENTS, type Segment} from './layout';

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const PLATE_BOX = new THREE.BoxGeometry(BOARD.w, BOARD.top - BOARD.bottom, BOARD.d);

/**
 * Many thin lines with real thickness in one draw call: an InstancedMesh of
 * stretched boxes, one per segment, each with its own HDR colour.
 * `colors` is r, g, b per segment (linear, may exceed 1 to bloom).
 */
export const Hairlines: React.FC<{readonly segments: readonly Segment[]; readonly colors: Float32Array}> = ({segments, colors}) => {
  const mesh = useMemo(() => {
    const material = new THREE.MeshBasicMaterial({color: '#ffffff', fog: false});
    const m = new THREE.InstancedMesh(UNIT_BOX, material, segments.length);
    m.frustumCulled = false;
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(segments.length * 3), 3);
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const unitX = new THREE.Vector3(1, 0, 0);
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    segments.forEach((s, i) => {
      a.set(s.a[0], s.a[1], s.a[2]);
      b.set(s.b[0], s.b[1], s.b[2]);
      const length = a.distanceTo(b);
      quaternion.setFromUnitVectors(unitX, b.clone().sub(a).normalize());
      // A little longer than the segment, so corners close.
      matrix.compose(a.clone().add(b).multiplyScalar(0.5), quaternion, new THREE.Vector3(length + s.width, s.width, s.width));
      m.setMatrixAt(i, matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    return m;
  }, [segments]);

  useLayoutEffect(() => {
    const attribute = mesh.instanceColor;
    if (!attribute) return;
    (attribute.array as Float32Array).set(colors);
    attribute.needsUpdate = true;
  });
  useEffect(
    () => () => {
      (mesh.material as THREE.Material).dispose();
      mesh.dispose();
    },
    [mesh],
  );

  return <primitive object={mesh} />;
};

/**
 * The plate, its modules and every hairline on them. Dark structure: it reads
 * by silhouette and rim light until the scan traces it. Mounted inside
 * <Reflect>, so it must stay pure.
 */
export const Board: React.FC<{readonly colors: Float32Array}> = ({colors}) => {
  const materials = useMemo(() => {
    const body = new THREE.MeshStandardMaterial({...structureProps});
    const plate = new THREE.MeshStandardMaterial({color: cyber.color.charcoal, metalness: 0.35, roughness: 0.5});
    // The underside is in its own shadow. It is only ever seen in the floor.
    const belly = new THREE.MeshBasicMaterial({color: '#020307'});
    return {body, plate, belly, plateFaces: [plate, plate, plate, belly, plate, plate]};
  }, []);
  useEffect(
    () => () => {
      materials.body.dispose();
      materials.plate.dispose();
      materials.belly.dispose();
    },
    [materials],
  );

  return (
    <group>
      <mesh geometry={PLATE_BOX} material={materials.plateFaces} position={[0, (BOARD.top + BOARD.bottom) / 2, 0]} />
      {MODULES.map((m) => (
        <mesh key={m.id} geometry={UNIT_BOX} material={materials.body} position={[m.x, BOARD.top + m.h / 2, m.z]} scale={[m.w, m.h, m.d]} />
      ))}
      <Hairlines segments={SEGMENTS} colors={colors} />
    </group>
  );
};
