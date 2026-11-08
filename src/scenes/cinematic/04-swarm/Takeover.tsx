import React, {useLayoutEffect, useMemo} from 'react';
import * as THREE from 'three';
import {lit} from '../../../components/cinematic/three/materials';
import {HALL, rackAt, rackYaw} from '../../../components/cinematic/world';
import {getHaloTexture} from '../../../components/cyber/three/materials';

/**
 * The light a taken machine throws: a soft glow leaking out of the rack's
 * perforated top vent, and a pool on the aisle floor in front of its face.
 * Two instanced meshes for the whole hall, coloured per rack every frame from
 * `levelOf(row, i)` (0 = untouched, 1 = the agent's). It is what makes the
 * spread readable from above, where LEDs are too small to see.
 */
export const Takeover: React.FC<{readonly levelOf: (row: number, i: number) => number; readonly color: string; readonly glow?: number}> = ({levelOf, color, glow = 1}) => {
  const n = HALL.rows * HALL.perRow;
  const meshes = useMemo(() => {
    const tex = getHaloTexture();
    const mat = () => new THREE.MeshBasicMaterial({map: tex, color: '#ffffff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false});
    const tops = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.9, 1.3), mat(), n);
    const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.3, 1.6), mat(), n);
    const o = new THREE.Object3D();
    const black = new THREE.Color(0, 0, 0);
    let k = 0;
    for (let r = 0; r < HALL.rows; r++) {
      for (let i = 0; i < HALL.perRow; i++) {
        const p = rackAt(r, i);
        const f = Math.cos(rackYaw(r)); // +1: the rack faces +z
        o.position.set(p[0], HALL.rack.height + 0.02, p[2] - 0.02 * f);
        o.rotation.set(-Math.PI / 2, 0, 0);
        o.updateMatrix();
        tops.setMatrixAt(k, o.matrix);
        o.position.set(p[0], 0.008, p[2] + f * (HALL.rack.depth / 2 + 0.55));
        o.updateMatrix();
        pools.setMatrixAt(k, o.matrix);
        tops.setColorAt(k, black);
        pools.setColorAt(k, black);
        k++;
      }
    }
    tops.instanceMatrix.needsUpdate = true;
    pools.instanceMatrix.needsUpdate = true;
    tops.frustumCulled = false;
    pools.frustumCulled = false;
    return {tops, pools};
  }, [n]);

  useLayoutEffect(() => {
    let k = 0;
    for (let r = 0; r < HALL.rows; r++) {
      for (let i = 0; i < HALL.perRow; i++) {
        const v = Math.min(1, Math.max(0, levelOf(r, i)));
        meshes.tops.setColorAt(k, lit(color, 1.3 * v * glow));
        meshes.pools.setColorAt(k, lit(color, 0.55 * v * glow));
        k++;
      }
    }
    if (meshes.tops.instanceColor) meshes.tops.instanceColor.needsUpdate = true;
    if (meshes.pools.instanceColor) meshes.pools.instanceColor.needsUpdate = true;
  });

  useLayoutEffect(
    () => () => {
      meshes.tops.geometry.dispose();
      meshes.pools.geometry.dispose();
      (meshes.tops.material as THREE.Material).dispose();
      (meshes.pools.material as THREE.Material).dispose();
    },
    [meshes],
  );

  return (
    <group>
      <primitive object={meshes.tops} />
      <primitive object={meshes.pools} />
    </group>
  );
};
