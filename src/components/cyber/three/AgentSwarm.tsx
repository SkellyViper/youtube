import {useThree} from '@react-three/fiber';
import React, {useLayoutEffect, useMemo} from 'react';
import * as THREE from 'three';
import {cyber} from '../../../styles/cyber';
import type {Vec3} from './rig';

/** A per-instance value: one number for every instance, an array indexed by instance, or a function of the index. */
export type PerInstance = number | ArrayLike<number> | ((i: number) => number);

/** Write a per-instance value into an interleaved attribute array. */
export const fillPerInstance = (target: Float32Array, stride: number, offset: number, count: number, value: PerInstance): void => {
  if (typeof value === 'number') {
    for (let i = 0; i < count; i++) target[i * stride + offset] = value;
  } else if (typeof value === 'function') {
    for (let i = 0; i < count; i++) target[i * stride + offset] = value(i);
  } else {
    for (let i = 0; i < count; i++) target[i * stride + offset] = value[i];
  }
};

/**
 * Ring layout of the gimbal iris. Keep in sync with RINGS in AgentCore3D.tsx:
 * an instanced unit must be the same character as the full one.
 */
const RINGS = [
  {radius: 0.56, tube: 0.017, arcs: 3, sweep: 1.62, tilt: [1.02, 0.28], rate: 0.11, level: 1},
  {radius: 0.78, tube: 0.012, arcs: 2, sweep: 2.55, tilt: [-0.46, 0.94], rate: -0.07, level: 0.8},
  {radius: 1.0, tube: 0.008, arcs: 4, sweep: 0.98, tilt: [0.16, -0.36], rate: 0.045, level: 0.55},
] as const;

export type SwarmDetail = 'lite' | 'full';

/**
 * One unit as a single merged geometry. Every vertex carries the part it
 * belongs to (0 core, 1..3 rings, 4 shell edge); tube-like parts store the
 * centre line in `position` and the cross-section direction in `aDir`, so the
 * vertex shader can choose the thickness (never thinner than a pixel).
 */
const buildUnitGeometry = (detail: SwarmDetail): THREE.BufferGeometry => {
  const pos: number[] = [];
  const dir: number[] = [];
  const part: number[] = [];
  const index: number[] = [];

  // Core: the same icosahedron as AgentCore3D.
  const ico = new THREE.IcosahedronGeometry(1, 0);
  const icoPos = ico.getAttribute('position');
  for (let i = 0; i < icoPos.count; i++) {
    index.push(pos.length / 3);
    pos.push(icoPos.getX(i), icoPos.getY(i), icoPos.getZ(i));
    dir.push(0, 0, 0);
    part.push(0);
  }
  ico.dispose();

  // Broken rings.
  const ringCount = detail === 'full' ? 3 : 2;
  const radial = detail === 'full' ? 4 : 3;
  const perRadian = detail === 'full' ? 8 : 5;
  for (let k = 0; k < ringCount; k++) {
    const ring = RINGS[k];
    const gap = (Math.PI * 2) / ring.arcs;
    const steps = Math.max(3, Math.ceil(ring.sweep * perRadian));
    for (let a = 0; a < ring.arcs; a++) {
      const base = pos.length / 3;
      for (let j = 0; j <= steps; j++) {
        const u = a * gap + (ring.sweep * j) / steps;
        const cu = Math.cos(u);
        const su = Math.sin(u);
        for (let r = 0; r < radial; r++) {
          const v = (r / radial) * Math.PI * 2;
          pos.push(ring.radius * cu, ring.radius * su, 0);
          dir.push(Math.cos(v) * cu, Math.cos(v) * su, Math.sin(v));
          part.push(k + 1);
        }
      }
      for (let j = 0; j < steps; j++) {
        for (let r = 0; r < radial; r++) {
          const a0 = base + j * radial + r;
          const a1 = base + j * radial + ((r + 1) % radial);
          index.push(a0, a0 + radial, a1, a1, a0 + radial, a1 + radial);
        }
      }
    }
  }

  // Faceted shell: the edges of an icosahedron as hairline prisms (full detail only).
  if (detail === 'full') {
    const shell = new THREE.IcosahedronGeometry(1, 1);
    const sp = shell.getAttribute('position');
    const seen = new Set<string>();
    const key = (v: THREE.Vector3) => `${v.x.toFixed(4)},${v.y.toFixed(4)},${v.z.toFixed(4)}`;
    const A = new THREE.Vector3();
    const B = new THREE.Vector3();
    const axis = new THREE.Vector3();
    const n1 = new THREE.Vector3();
    const n2 = new THREE.Vector3();
    for (let f = 0; f < sp.count; f += 3) {
      for (let e = 0; e < 3; e++) {
        A.fromBufferAttribute(sp, f + e);
        B.fromBufferAttribute(sp, f + ((e + 1) % 3));
        const ka = key(A);
        const kb = key(B);
        const id = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
        if (seen.has(id)) continue;
        seen.add(id);
        axis.subVectors(B, A).normalize();
        n1.addVectors(A, B).cross(axis).normalize();
        n2.crossVectors(axis, n1);
        const base = pos.length / 3;
        for (const end of [A, B]) {
          for (let r = 0; r < 3; r++) {
            const v = (r / 3) * Math.PI * 2;
            pos.push(end.x, end.y, end.z);
            dir.push(Math.cos(v) * n1.x + Math.sin(v) * n2.x, Math.cos(v) * n1.y + Math.sin(v) * n2.y, Math.cos(v) * n1.z + Math.sin(v) * n2.z);
            part.push(4);
          }
        }
        for (let r = 0; r < 3; r++) {
          const a0 = base + r;
          const a1 = base + ((r + 1) % 3);
          index.push(a0, a0 + 3, a1, a1, a0 + 3, a1 + 3);
        }
      }
    }
    shell.dispose();
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aDir', new THREE.Float32BufferAttribute(dir, 3));
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 1));
  g.setIndex(index);
  return g;
};

const unitGeometries = new Map<SwarmDetail, THREE.BufferGeometry>();
const getUnitGeometry = (detail: SwarmDetail): THREE.BufferGeometry => {
  let g = unitGeometries.get(detail);
  if (!g) {
    g = buildUnitGeometry(detail);
    unitGeometries.set(detail, g);
  }
  return g;
};

const vertexShader = /* glsl */ `
  attribute vec3 aDir;
  attribute float aPart;
  attribute vec3 iPos;
  attribute vec4 iState; // energy, ramp, facing, open
  attribute vec3 iExtra; // scale, seed, flash

  uniform float uSpin;
  uniform vec3 uFaceTarget;
  uniform float uFaceMode;
  uniform float uPixel;
  uniform float uMinPx;
  uniform float uConserve;
  uniform float uIntensity;
  uniform vec3 uTilt[3]; // tilt x, tilt y, rate
  uniform vec3 uRing[3]; // tube radius, level, unused
  uniform vec3 uCool;
  uniform vec3 uBody;
  uniform vec3 uThreat;
  uniform vec3 uCoolHot;
  uniform vec3 uBodyHot;
  uniform vec3 uThreatHot;

  varying vec3 vColor;
  #include <fog_pars_vertex>

  float sat(float x) { return clamp(x, 0.0, 1.0); }
  float smooth01(float x) { x = sat(x); return x * x * (3.0 - 2.0 * x); }
  mat3 rotX(float a) { float c = cos(a); float s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
  mat3 rotY(float a) { float c = cos(a); float s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
  mat3 rotZ(float a) { float c = cos(a); float s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }

  void main() {
    float energy = max(iState.x, 0.0);
    float rampV = clamp(iState.y, 0.0, 2.0);
    float facing = sat(iState.z);
    float open = sat(iState.w);
    float size = iExtra.x;
    float phase = iExtra.y * 1.7;
    float flash = max(iExtra.z, 0.0);
    float threat = sat(rampV - 1.0);

    vec3 body = rampV <= 1.0 ? mix(uCool, uBody, rampV) : mix(uBody, uThreat, threat);
    vec3 hot = rampV <= 1.0 ? mix(uCoolHot, uBodyHot, rampV) : mix(uBodyHot, uThreatHot, threat);

    // World size of one pixel at this unit's depth.
    vec4 mvCentre = modelViewMatrix * vec4(iPos, 1.0);
    float pixel = max(-mvCentre.z, 0.001) * uPixel / projectionMatrix[1][1];

    vec3 local = vec3(0.0);
    vec3 offsetDir = vec3(0.0);
    float tube = 0.0;
    float keep = 1.0;
    float shown = 1.0;
    vec3 col = vec3(0.0);

    if (aPart < 0.5) {
      // Core.
      float coreOpen = smooth01(open / 0.35);
      float r = 0.17 * coreOpen * (0.9 + 0.1 * min(energy, 1.6)) * size;
      float rr = max(r, 0.7 * uMinPx * pixel);
      keep = r / rr;
      keep *= keep;
      local = rotX(uSpin * 0.4 + phase) * rotY(uSpin * 0.3) * position * rr;
      col = hot * (4.5 * (0.25 + 0.75 * min(energy, 1.6))) * (1.0 + 0.8 * flash);
      shown = step(0.001, coreOpen);
    } else if (aPart < 3.5) {
      // Gimbal rings.
      int k = int(aPart + 0.5) - 1;
      float fk = float(k);
      float p = smooth01((open - 0.22 - fk * 0.16) / 0.46);
      float tx = uTilt[k].x * (1.0 - facing) + (1.0 - p) * 1.4;
      float ty = uTilt[k].y * (1.0 - facing) - (1.0 - p) * 0.9;
      float turn = uSpin * uTilt[k].z * 6.28318530718 + phase + fk;
      mat3 R = rotX(tx) * rotY(ty) * rotZ(turn);
      if (uFaceMode > 0.5) {
        // Turn the facing plane from +z towards the target.
        vec3 d = normalize(uFaceTarget - iPos);
        R = rotY(atan(d.x, d.z) * facing) * rotX(-asin(clamp(d.y, -1.0, 1.0)) * facing) * R;
      }
      float s = (0.55 + 0.45 * p) * size;
      local = R * position * s;
      offsetDir = R * aDir;
      tube = uRing[k].x * s;
      float level = 2.6 * uRing[k].y * p * (0.3 + 0.7 * min(energy, 1.4)) * (1.0 - 0.3 * threat);
      col = mix(k == 0 ? hot : body, hot, 0.5 * sat(flash)) * level * (1.0 + 1.6 * flash);
      shown = step(0.001, p);
    } else {
      // Faceted shell.
      float shellOpen = smooth01((open - 0.1) / 0.4);
      mat3 R = rotX(-uSpin * 0.21 + phase) * rotY(uSpin * 0.17) * rotZ(uSpin * 0.09);
      float s = 0.33 * (0.6 + 0.4 * shellOpen) * size;
      local = R * position * s;
      offsetDir = R * aDir;
      tube = 0.0022 * size;
      col = body * (1.5 * 0.9 * shellOpen * (0.35 + 0.65 * min(energy, 1.3))) * (1.0 + flash);
      shown = step(0.001, shellOpen);
    }

    vec4 mvPosition = modelViewMatrix * vec4(iPos + local, 1.0);
    if (tube > 0.0) {
      // Never thinner than uMinPx pixels; what is widened is dimmed instead.
      float w = max(tube, 0.5 * uMinPx * pixel);
      keep = aPart > 3.5 ? 1.0 : tube / w;
      mvPosition.xyz += normalize(mat3(modelViewMatrix) * offsetDir) * w;
    }
    vColor = col * uIntensity * pow(keep, uConserve);
    gl_Position = shown > 0.5 ? projectionMatrix * mvPosition : vec4(2.0, 2.0, 2.0, 1.0);
    #include <fog_vertex>
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  #include <fog_pars_fragment>
  void main() {
    gl_FragColor = vec4(vColor, 1.0);
    #include <fog_fragment>
  }
`;

export type AgentSwarmProps = {
  /** Number of units. Changing it rebuilds the buffers; keep it constant and hide units with `open = 0`. */
  readonly count: number;
  /** xyz per unit (length >= 3 * count). Re-read on every render, so it can be a scratch buffer the caller refills each frame. */
  readonly positions: ArrayLike<number>;
  /** 0 dark, 1 working, up to ~1.6 for a flare (same meaning as AgentCore3D). */
  readonly energy?: PerInstance;
  /** Control-loss ramp: 0 blue, 1 purple (default), 2 red. */
  readonly ramp?: PerInstance;
  /** 0..1: rings rotate into one plane, facing +z or `faceTarget`. */
  readonly facing?: PerInstance;
  /** 0..1: assembles like AgentCore3D (core, then rings from the inside out). 0 = not drawn. */
  readonly open?: PerInstance;
  /** Unit size; outer ring radius = 1 x scale. */
  readonly scale?: PerInstance;
  /** Phase offset per unit. Leave at 0 for a swarm that turns in perfect unison. */
  readonly seed?: PerInstance;
  /**
   * 0..1: a brief overexposure, for a signal passing through the crowd. Unlike `energy` (which
   * saturates like AgentCore3D's) it is not clamped, and it pales the rings towards the hot colour.
   */
  readonly flash?: PerInstance;
  /** Seconds of motion, shared by all units (pass `useActiveTime()`). */
  readonly spin?: number;
  /** When set, `facing` turns the rings towards this point (e.g. the camera position) instead of +z. */
  readonly faceTarget?: Vec3;
  /** Brightness multiplier for the whole swarm. */
  readonly intensity?: number;
  /** 'lite': core + two rings (about 300 triangles). 'full': three rings and the faceted shell, for units near the camera. */
  readonly detail?: SwarmDetail;
  /** Minimum on-screen thickness of ring tubes, in pixels. Keeps distant units from breaking up. */
  readonly minPixels?: number;
  /** 0..1: how much a ring that had to be widened is dimmed (1 = energy conserving). */
  readonly conserve?: number;
  /** Sort order (the material is opaque; useful only when mixing with transparent glass). */
  readonly renderOrder?: number;
};

/**
 * A crowd of agents in one draw call: GPU-instanced "gimbal iris" units that
 * match AgentCore3D (same core, ring radii, tilts, turn rates, colours and
 * `open` / `energy` / `facing` behaviour), with per-instance position, energy,
 * colour ramp, facing, assembly, size and flash. Thousands are cheap: all per-unit
 * maths runs in the vertex shader, and per frame only a few floats per unit
 * are uploaded.
 *
 * It animates nothing by itself; every pixel is a function of the props.
 * Safe inside <Reflect>.
 */
export const AgentSwarm: React.FC<AgentSwarmProps> = ({
  count,
  positions,
  energy = 1,
  ramp = 1,
  facing = 0,
  open = 1,
  scale = 1,
  seed = 0,
  flash = 0,
  spin = 0,
  faceTarget,
  intensity = 1,
  detail = 'lite',
  minPixels = 1.25,
  conserve = 0.85,
  renderOrder = 0,
}) => {
  const height = useThree((s) => s.size.height);

  const swarm = useMemo(() => {
    const base = getUnitGeometry(detail);
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.setIndex(base.getIndex());
    geometry.setAttribute('position', base.getAttribute('position'));
    geometry.setAttribute('aDir', base.getAttribute('aDir'));
    geometry.setAttribute('aPart', base.getAttribute('aPart'));
    const iPos = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
    const iState = new THREE.InstancedBufferAttribute(new Float32Array(count * 4), 4);
    const iExtra = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
    for (const a of [iPos, iState, iExtra]) a.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('iPos', iPos);
    geometry.setAttribute('iState', iState);
    geometry.setAttribute('iExtra', iExtra);
    geometry.instanceCount = count;

    const c = cyber.color;
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      fog: true,
      side: THREE.DoubleSide,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uSpin: {value: 0},
          uFaceTarget: {value: new THREE.Vector3(0, 0, 1)},
          uFaceMode: {value: 0},
          uPixel: {value: 2 / 1080},
          uMinPx: {value: 1.25},
          uConserve: {value: 0.6},
          uIntensity: {value: 1},
          uTilt: {value: RINGS.map((r) => new THREE.Vector3(r.tilt[0], r.tilt[1], r.rate))},
          uRing: {value: RINGS.map((r) => new THREE.Vector3(r.tube, r.level, 0))},
          uCool: {value: new THREE.Color(c.blue)},
          uBody: {value: new THREE.Color(c.purple)},
          uThreat: {value: new THREE.Color(c.red)},
          uCoolHot: {value: new THREE.Color(c.blueHot)},
          uBodyHot: {value: new THREE.Color(c.purpleHot)},
          // Red clips to pink when pushed hard, so the hot threat colour stays the pure red (as in AgentCore3D).
          uThreatHot: {value: new THREE.Color(c.red)},
        },
      ]),
    });
    return {geometry, material, iPos, iState, iExtra};
  }, [count, detail]);

  useLayoutEffect(
    () => () => {
      swarm.geometry.dispose();
      swarm.material.dispose();
    },
    [swarm],
  );

  // Runs after every render: the props are the frame.
  useLayoutEffect(() => {
    const {iPos, iState, iExtra, material} = swarm;
    const p = iPos.array as Float32Array;
    const n = Math.min(p.length, positions.length);
    for (let i = 0; i < n; i++) p[i] = positions[i];
    const state = iState.array as Float32Array;
    fillPerInstance(state, 4, 0, count, energy);
    fillPerInstance(state, 4, 1, count, ramp);
    fillPerInstance(state, 4, 2, count, facing);
    fillPerInstance(state, 4, 3, count, open);
    const extra = iExtra.array as Float32Array;
    fillPerInstance(extra, 3, 0, count, scale);
    fillPerInstance(extra, 3, 1, count, seed);
    fillPerInstance(extra, 3, 2, count, flash);
    iPos.needsUpdate = true;
    iState.needsUpdate = true;
    iExtra.needsUpdate = true;

    const u = material.uniforms;
    u.uSpin.value = spin;
    u.uFaceMode.value = faceTarget ? 1 : 0;
    if (faceTarget) u.uFaceTarget.value.set(faceTarget[0], faceTarget[1], faceTarget[2]);
    u.uPixel.value = 2 / height;
    u.uMinPx.value = minPixels;
    u.uConserve.value = conserve;
    u.uIntensity.value = intensity;
  });

  if (count <= 0) return null;
  return <mesh geometry={swarm.geometry} material={swarm.material} frustumCulled={false} renderOrder={renderOrder} />;
};
