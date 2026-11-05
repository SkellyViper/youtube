import React, {useMemo} from 'react';
import * as THREE from 'three';
import {structureProps} from '../../../components/cyber/three';
import {cyber} from '../../../styles/cyber';
import {CITY, SEAM_SKIRT, WAKE_REACH} from './city';

/**
 * GPU side of the city: two instanced meshes (dark slab bodies, light seams).
 * The buffers are created once per scene and shared by the real field and its
 * mirror image under the floor, so painting the seams costs one pass.
 */
export type Field = {
  readonly box: THREE.BoxGeometry;
  readonly bodyMaterial: THREE.MeshStandardMaterial;
  readonly seamMaterial: THREE.MeshBasicMaterial;
  readonly slabMatrix: THREE.InstancedBufferAttribute;
  readonly seamMatrix: THREE.InstancedBufferAttribute;
  readonly seamColor: THREE.InstancedBufferAttribute;
  /** World units per pixel at unit depth, times the minimum seam width in px. */
  readonly hairline: {value: number};
  dispose(): void;
};

export const createField = (): Field => {
  const box = new THREE.BoxGeometry(1, 1, 1);
  const bodyMaterial = new THREE.MeshStandardMaterial({...structureProps});
  const hairline = {value: 0.001};

  // Seams are unlit HDR colour (per instance). The vertex stage widens the
  // thin axis of each seam so it never drops below a hairline on screen:
  // close up it is a physical slit, in the distance it is a clean 1.5 px line
  // instead of sub-pixel shimmer.
  const seamMaterial = new THREE.MeshBasicMaterial({color: 0xffffff});
  seamMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uHairline = hairline;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uHairline;')
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec4 seamCentre = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float seamThin = length(instanceMatrix[0].xyz);
          transformed.x *= max(1.0, uHairline * max(0.0, -seamCentre.z) / seamThin);
        #endif`,
      );
  };
  seamMaterial.customProgramCacheKey = () => 'hero-seam-hairline';

  const slabMatrix = new THREE.InstancedBufferAttribute(CITY.slabMatrix, 16);
  const seamMatrix = new THREE.InstancedBufferAttribute(CITY.seamMatrix, 16);
  const seamColor = new THREE.InstancedBufferAttribute(new Float32Array(CITY.seamCount * 3), 3);
  seamColor.setUsage(THREE.DynamicDrawUsage);

  return {
    box,
    bodyMaterial,
    seamMaterial,
    slabMatrix,
    seamMatrix,
    seamColor,
    hairline,
    dispose: () => {
      box.dispose();
      bodyMaterial.dispose();
      seamMaterial.dispose();
    },
  };
};

export type SeamLight = {
  /**
   * The ignition front, as a distance from the wake origin. It starts beyond
   * WAKE_REACH and travels inwards; a seam lights when the front passes it.
   */
  readonly front: number;
  /** Steady level of slits and bands once lit (HDR multiplier). */
  readonly level: number;
  /** Level of the foot lines (the plan outlines). */
  readonly skirt: number;
};

const BLUE = new THREE.Color(cyber.color.blue);
const HOT = new THREE.Color(cyber.color.blueHot);
/** Seams flash when the front reaches them and settle over this distance. */
const FLASH_LENGTH = 42;
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/** Per-instance seam colours for one frame. Pure function of `light`. */
export const paintSeams = (field: Field, light: SeamLight): void => {
  const out = field.seamColor.array as Float32Array;
  const {seamCount, seamDist, seamKind, seamGain} = CITY;
  for (let i = 0; i < seamCount; i++) {
    const behind = seamDist[i] - light.front;
    const o = i * 3;
    if (behind <= 0) {
      out[o] = out[o + 1] = out[o + 2] = 0;
      continue;
    }
    const on = clamp01(behind / 4);
    const flash = clamp01(1 - behind / FLASH_LENGTH);
    const f2 = flash * flash;
    const skirt = seamKind[i] === SEAM_SKIRT;
    const level = on * (skirt ? light.skirt * (1 + 1.2 * f2) : seamGain[i] * (light.level + 1.6 * f2));
    // Freshly lit seams run hot and settle to the base blue.
    const heat = f2 * 0.65;
    out[o] = (BLUE.r + (HOT.r - BLUE.r) * heat) * level;
    out[o + 1] = (BLUE.g + (HOT.g - BLUE.g) * heat) * level;
    out[o + 2] = (BLUE.b + (HOT.b - BLUE.b) * heat) * level;
  }
  field.seamColor.needsUpdate = true;
};

/** Front position for a 0..1 wake progress: from just outside the reach to well past the origin. */
export const wakeFront = (progress: number): number => WAKE_REACH + 5 - (WAKE_REACH + 5 + FLASH_LENGTH + 4) * progress;

/**
 * The instanced field. Mount it inside <Reflect>: both copies share the same
 * instance buffers.
 */
export const SlabField: React.FC<{readonly field: Field}> = ({field}) => {
  const {slabs, seams} = useMemo(() => {
    const slabs = new THREE.InstancedMesh(field.box, field.bodyMaterial, CITY.slabCount);
    slabs.instanceMatrix = field.slabMatrix;
    slabs.frustumCulled = false;
    const seams = new THREE.InstancedMesh(field.box, field.seamMaterial, CITY.seamCount);
    seams.instanceMatrix = field.seamMatrix;
    seams.instanceColor = field.seamColor;
    seams.frustumCulled = false;
    // After the bodies, so a seam always wins the depth test against its own slab.
    seams.renderOrder = 1;
    return {slabs, seams};
  }, [field]);
  return (
    <>
      <primitive object={slabs} />
      <primitive object={seams} />
    </>
  );
};
