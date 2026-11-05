import React, {useLayoutEffect, useMemo} from 'react';
import * as THREE from 'three';

/**
 * Thousands of small HDR lights in one draw call.
 *
 * Each light is a soft round point sprite with a size in screen pixels, so a
 * field that is hundreds of units away stays a field of crisp points instead
 * of dissolving into sub-pixel noise. Lights ignore the scene fog (they are
 * meant to be seen through it); distance only dims them (`fade`). They are
 * depth-tested, so dark foreground structure cuts a clean silhouette out of
 * them, and they blend additively, so dense areas bloom on their own.
 *
 * `reflect` > 0 draws a second, mirrored copy through the plane y = 0 at that
 * fraction of the brightness: the obsidian floor's reflection, without
 * depending on the floor's draw order.
 *
 * Nothing in here animates; `intensity` (and `travel` for streaks) come from
 * the caller's beat clocks.
 */

export type LightFieldData = {
  readonly count: number;
  /** xyz per light. */
  readonly position: Float32Array;
  /** Linear rgb per light, already multiplied by the light's HDR intensity. */
  readonly color: Float32Array;
  /** Diameter in pixels at distance `sizeRef`. */
  readonly size: Float32Array;
};

export type StreakData = LightFieldData & {
  /** Full travel vector per point: position + dir * t. */
  readonly dir: Float32Array;
  /** Per point: start phase, speed (path fractions per unit of `travel`), tail offset (path fraction). */
  readonly k: Float32Array;
};

const VERTEX = /* glsl */ `
  attribute vec3 aColor;
  attribute float aSize;
  #ifdef STREAK
    attribute vec3 aDir;
    attribute vec3 aK;
    uniform float uTravel;
  #endif
  uniform float uIntensity;
  uniform float uReflect;
  uniform float uFade;
  uniform float uSizeRef;
  uniform vec2 uSizeClamp;
  varying vec3 vColor;
  void main() {
    vec3 p = position;
    float vis = 1.0;
    #ifdef STREAK
      float t = aK.x + uTravel * aK.y - aK.z;
      p += aDir * t;
      // Streaks appear and disappear softly at the ends of their avenue.
      vis = smoothstep(0.0, 0.08, t) * (1.0 - smoothstep(0.92, 1.0, t));
    #endif
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float dist = length(mv.xyz);
    // The mirrored copy lives in a group scaled by -1 on y.
    float mirrored = modelMatrix[1][1] < 0.0 ? uReflect : 1.0;
    gl_PointSize = clamp(aSize * uSizeRef / dist, uSizeClamp.x, uSizeClamp.y);
    vColor = aColor * (uIntensity * mirrored * vis * exp(-dist / uFade));
  }
`;

const FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float d = dot(p, p);
    // Gaussian core that reaches zero at the sprite edge: no square corners.
    float a = exp(-d * 2.6) * (1.0 - smoothstep(0.55, 1.0, d));
    gl_FragColor = vec4(vColor * a, 1.0);
  }
`;

type CommonProps = {
  /** Master brightness, 0 = off (nothing is drawn). */
  readonly intensity?: number;
  /** Brightness of the mirrored copy under y = 0, as a fraction. 0 = none. */
  readonly reflect?: number;
  /** Distance over which brightness falls to 1/e. */
  readonly fade?: number;
  /** Distance at which a light is drawn at its nominal pixel size. */
  readonly sizeRef?: number;
  readonly minSize?: number;
  readonly maxSize?: number;
};

const makeMaterial = (streak: boolean) =>
  new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    defines: streak ? {STREAK: ''} : {},
    uniforms: {
      uIntensity: {value: 1},
      uReflect: {value: 0},
      uFade: {value: 400},
      uSizeRef: {value: 300},
      uSizeClamp: {value: new THREE.Vector2(2, 6)},
      uTravel: {value: 0},
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
    toneMapped: false,
  });

const useLights = (data: LightFieldData | StreakData, streak: boolean, props: CommonProps, travel = 0) => {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(data.position, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(data.color, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(data.size, 1));
    if ('dir' in data) {
      g.setAttribute('aDir', new THREE.BufferAttribute(data.dir, 3));
      g.setAttribute('aK', new THREE.BufferAttribute(data.k, 3));
    }
    g.setDrawRange(0, data.count);
    return g;
  }, [data]);
  const material = useMemo(() => makeMaterial(streak), [streak]);
  useLayoutEffect(() => () => geometry.dispose(), [geometry]);
  useLayoutEffect(() => () => material.dispose(), [material]);

  const {intensity = 1, reflect = 0, fade = 400, sizeRef = 300, minSize = 2, maxSize = 6} = props;
  material.uniforms.uIntensity.value = intensity;
  material.uniforms.uReflect.value = reflect;
  material.uniforms.uFade.value = fade;
  material.uniforms.uSizeRef.value = sizeRef;
  material.uniforms.uSizeClamp.value.set(minSize, maxSize);
  material.uniforms.uTravel.value = travel;
  return {geometry, material, visible: intensity > 0.0005, reflect};
};

const Pair: React.FC<{readonly geometry: THREE.BufferGeometry; readonly material: THREE.Material; readonly reflect: number}> = ({
  geometry,
  material,
  reflect,
}) => (
  <>
    <points geometry={geometry} material={material} frustumCulled={false} />
    {reflect > 0 ? (
      <group scale={[1, -1, 1]}>
        <points geometry={geometry} material={material} frustumCulled={false} />
      </group>
    ) : null}
  </>
);

/** A static field of lights. */
export const LightField: React.FC<CommonProps & {readonly data: LightFieldData}> = ({data, ...props}) => {
  const l = useLights(data, false, props);
  return l.visible ? <Pair geometry={l.geometry} material={l.material} reflect={l.reflect} /> : null;
};

/**
 * Comets for the far distance: each streak is a short run of points sliding
 * along a straight path. `travel` (0..1) moves all of them; drive it from a
 * beat clock so a hold is perfectly still.
 */
export const LightStreaks: React.FC<CommonProps & {readonly data: StreakData; readonly travel: number}> = ({data, travel, ...props}) => {
  const l = useLights(data, true, props, travel);
  return l.visible ? <Pair geometry={l.geometry} material={l.material} reflect={l.reflect} /> : null;
};
