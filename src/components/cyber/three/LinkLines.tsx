import {useThree} from '@react-three/fiber';
import React, {useLayoutEffect, useMemo} from 'react';
import * as THREE from 'three';
import {cyber} from '../../../styles/cyber';
import {fillPerInstance, type PerInstance} from './AgentSwarm';

const vertexShader = /* glsl */ `
  attribute vec3 iA;
  attribute vec3 iB;
  attribute vec4 iLink; // from, to, level, ramp

  uniform float uWidth;
  uniform float uMinPx;
  uniform float uPixel;
  uniform float uConserve;
  uniform float uIntensity;
  uniform float uTip;
  uniform float uHot;
  uniform vec3 uCool;
  uniform vec3 uBody;
  uniform vec3 uThreat;
  uniform vec3 uCoolHot;
  uniform vec3 uBodyHot;

  varying vec3 vColor;
  varying float vBehind;
  varying float vTip;
  varying float vDepth;

  void main() {
    float from = clamp(iLink.x, 0.0, 1.0);
    float to = clamp(iLink.y, 0.0, 1.0);
    float level = iLink.z;
    float rampV = clamp(iLink.w, 0.0, 2.0);

    float t = mix(from, to, position.x);
    vec4 mvPosition = modelViewMatrix * vec4(mix(iA, iB, t), 1.0);
    // A ribbon that always faces the camera.
    vec3 axis = mat3(modelViewMatrix) * (iB - iA);
    vec3 side = cross(axis, mvPosition.xyz);
    side /= max(length(side), 1e-6);
    float depth = max(-mvPosition.z, 0.001);
    float pixel = depth * uPixel / projectionMatrix[1][1];
    // Never thinner than uMinPx pixels; what is widened is dimmed instead.
    float w = max(uWidth, 0.5 * uMinPx * pixel);
    mvPosition.xyz += side * position.y * w;

    vec3 base = rampV <= 1.0 ? mix(uCool, uBody, rampV) : mix(uBody, uThreat, rampV - 1.0);
    vec3 hot = rampV <= 1.0 ? mix(uCoolHot, uBodyHot, rampV) : mix(uBodyHot, uThreat, rampV - 1.0);
    vColor = mix(base, hot, uHot) * max(level, 0.0) * uIntensity * pow(uWidth / w, uConserve);
    // World distance behind the leading end, for the hot tip while the line draws on.
    vBehind = (to - t) * length(iB - iA);
    vTip = uTip * (1.0 - smoothstep(0.9, 1.0, to));
    vDepth = depth;

    bool hidden = to - from <= 0.0005 || level <= 0.0;
    gl_Position = hidden ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * mvPosition;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTipLength;
  varying vec3 vColor;
  varying float vBehind;
  varying float vTip;
  varying float vDepth;
  #ifdef USE_FOG
    #ifdef FOG_EXP2
      uniform float fogDensity;
    #else
      uniform float fogNear;
      uniform float fogFar;
    #endif
  #endif
  void main() {
    vec3 c = vColor * (1.0 + vTip * exp(-vBehind / uTipLength));
    #ifdef USE_FOG
      // Additive light: fog takes it towards black, not towards the fog colour.
      #ifdef FOG_EXP2
        c *= exp(-fogDensity * fogDensity * vDepth * vDepth);
      #else
        c *= 1.0 - smoothstep(fogNear, fogFar, vDepth);
      #endif
    #endif
    gl_FragColor = vec4(c, 1.0);
  }
`;

let quad: THREE.BufferGeometry | null = null;
const getQuad = (): THREE.BufferGeometry => {
  if (quad) return quad;
  quad = new THREE.BufferGeometry();
  // x = position along the segment (0..1), y = side (-1 / +1).
  quad.setAttribute('position', new THREE.Float32BufferAttribute([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0], 3));
  quad.setIndex([0, 1, 2, 0, 2, 3]);
  return quad;
};

export type LinkLinesProps = {
  /** Number of segments. Keep it constant; hide a segment with `to <= from` or `level = 0`. */
  readonly count: number;
  /** ax ay az bx by bz per segment (length >= 6 * count). Re-read on every render. */
  readonly segments: ArrayLike<number>;
  /** Visible part of each segment, as fractions from A to B (like GlowTube's from / to). */
  readonly from?: PerInstance;
  readonly to?: PerInstance;
  /** HDR brightness per segment; see cyber.emissive. */
  readonly level?: PerInstance;
  /** Control-loss ramp: 0 blue, 1 purple (default), 2 red. */
  readonly ramp?: PerInstance;
  /** 0 = base colour, 1 = the pale "hot" colour of the ramp. */
  readonly hot?: number;
  /** Half width in world units. */
  readonly width?: number;
  /** Minimum on-screen width in pixels: a hairline at any distance. */
  readonly minPixels?: number;
  /** 0..1: how much a widened line is dimmed (1 = energy conserving). */
  readonly conserve?: number;
  /** Extra brightness of the leading end while a segment is drawing on (0 = none); gone once `to` reaches 1. */
  readonly tip?: number;
  /** Length of that hot tip in world units. */
  readonly tipLength?: number;
  readonly intensity?: number;
  /** Sort order among transparent objects (e.g. to draw a mirrored copy before the floor glass). */
  readonly renderOrder?: number;
};

/**
 * Thousands of straight hairline links in one draw call: camera-facing
 * ribbons, additive, never thinner than a pixel, each with its own draw
 * range (so it can draw on from A to B), brightness and ramp colour.
 * The instanced counterpart of GlowTube for lattices and networks.
 *
 * A pure function of its props. Safe inside <Reflect>.
 */
export const LinkLines: React.FC<LinkLinesProps> = ({
  count,
  segments,
  from = 0,
  to = 1,
  level = cyber.emissive.base,
  ramp = 1,
  hot = 0,
  width = 0.008,
  minPixels = 1.25,
  conserve = 0.7,
  tip = 0,
  tipLength = 0.5,
  intensity = 1,
  renderOrder = 0,
}) => {
  const height = useThree((s) => s.size.height);

  const lines = useMemo(() => {
    const base = getQuad();
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.setIndex(base.getIndex());
    geometry.setAttribute('position', base.getAttribute('position'));
    const iA = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
    const iB = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
    const iLink = new THREE.InstancedBufferAttribute(new Float32Array(count * 4), 4);
    for (const a of [iA, iB, iLink]) a.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('iA', iA);
    geometry.setAttribute('iB', iB);
    geometry.setAttribute('iLink', iLink);
    geometry.instanceCount = count;

    const c = cyber.color;
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      fog: true,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uWidth: {value: 0.008},
          uMinPx: {value: 1.25},
          uPixel: {value: 2 / 1080},
          uConserve: {value: 0.5},
          uIntensity: {value: 1},
          uTip: {value: 0},
          uTipLength: {value: 0.5},
          uHot: {value: 0},
          uCool: {value: new THREE.Color(c.blue)},
          uBody: {value: new THREE.Color(c.purple)},
          uThreat: {value: new THREE.Color(c.red)},
          uCoolHot: {value: new THREE.Color(c.blueHot)},
          uBodyHot: {value: new THREE.Color(c.purpleHot)},
        },
      ]),
    });
    return {geometry, material, iA, iB, iLink};
  }, [count]);

  useLayoutEffect(
    () => () => {
      lines.geometry.dispose();
      lines.material.dispose();
    },
    [lines],
  );

  // Runs after every render: the props are the frame.
  useLayoutEffect(() => {
    const {iA, iB, iLink, material} = lines;
    const a = iA.array as Float32Array;
    const b = iB.array as Float32Array;
    const n = Math.min(count, Math.floor(segments.length / 6));
    for (let i = 0; i < n; i++) {
      a[i * 3] = segments[i * 6];
      a[i * 3 + 1] = segments[i * 6 + 1];
      a[i * 3 + 2] = segments[i * 6 + 2];
      b[i * 3] = segments[i * 6 + 3];
      b[i * 3 + 1] = segments[i * 6 + 4];
      b[i * 3 + 2] = segments[i * 6 + 5];
    }
    const link = iLink.array as Float32Array;
    fillPerInstance(link, 4, 0, count, from);
    fillPerInstance(link, 4, 1, count, to);
    fillPerInstance(link, 4, 2, count, level);
    fillPerInstance(link, 4, 3, count, ramp);
    iA.needsUpdate = true;
    iB.needsUpdate = true;
    iLink.needsUpdate = true;

    const u = material.uniforms;
    u.uWidth.value = width;
    u.uMinPx.value = minPixels;
    u.uPixel.value = 2 / height;
    u.uConserve.value = conserve;
    u.uIntensity.value = intensity;
    u.uTip.value = tip;
    u.uTipLength.value = Math.max(1e-4, tipLength);
    u.uHot.value = hot;
  });

  if (count <= 0) return null;
  return <mesh geometry={lines.geometry} material={lines.material} frustumCulled={false} renderOrder={renderOrder} />;
};
