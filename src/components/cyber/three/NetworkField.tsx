import {useThree} from '@react-three/fiber';
import React, {useEffect, useMemo} from 'react';
import * as THREE from 'three';
import {cyber} from '../../../styles/cyber';
import type {NetworkFieldData} from './networkGraph';
import type {Vec3} from './rig';

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/** The colour <NetworkNode3D> gives a node at `level` (0 unlit, 1 lit, above 1 active). */
export const nodeTint = (color: string, level: number): THREE.Color =>
  new THREE.Color(cyber.color.steel).lerp(new THREE.Color(color), clamp01(level)).multiplyScalar(0.6 + level * 1.6);

export type NetworkFieldProps = {
  /** Instance buffers from `buildNetworkFieldData` (build once, at module scope). */
  readonly data: NetworkFieldData;
  /** Wavefront in graph-distance units from the source. Whatever has a smaller distance is activated. */
  readonly wave?: number;
  /** Build-up clock: nodes appear at `born` and light at `lit`, edges draw on over their `grow` range. Default: fully built. */
  readonly grow?: number;
  /** Comet position 0..1 along its path: nodes with a `hop` value ignite as it passes them. */
  readonly hop?: number;
  /** 0..1 brightness of the whole field. */
  readonly level?: number;
  /** Network colour, signal colour, and the colour of the wave's head. */
  readonly color?: string;
  readonly signal?: string;
  readonly signalHot?: string;
  /** Node brightness on the NetworkNode3D scale (0 unlit .. 1 lit): resting, and after the wave has passed. */
  readonly nodeLevel?: number;
  readonly visitedLevel?: number;
  /** HDR multipliers: resting edges, edges the wave has passed, the head on nodes, the head on edges. */
  readonly edgeLevel?: number;
  readonly edgeVisitedLevel?: number;
  readonly headLevel?: number;
  readonly edgeHeadLevel?: number;
  /** Multiplies every node radius. */
  readonly nodeScale?: number;
  /** Node radius floor and ceiling in px: a far web stays readable, a node passing the camera never fills the frame. */
  readonly minNodePx?: number;
  readonly maxNodePx?: number;
  /** Edge width in world units and its floor / ceiling in px: a tube up close, a hairline far away, never a bar. */
  readonly lineWidth?: number;
  readonly minLinePx?: number;
  readonly maxLinePx?: number;
  /** Build-up units a node takes to arrive, and the offset it arrives from (out of depth). */
  readonly appear?: number;
  readonly arriveFrom?: Vec3;
  /** Length (build-up units) of the hot tip that leads an edge while it draws on. */
  readonly tip?: number;
  /** Wave envelope in distance units: attack length, decay rate, and how long the change of colour takes. */
  readonly rise?: number;
  readonly decay?: number;
  readonly settle?: number;
  /** Comet-hop envelope in path units (0..1): attack, decay, and how much of the signal colour a hopped node keeps. */
  readonly hopRise?: number;
  readonly hopDecay?: number;
  readonly hopKeep?: number;
  /** How much a node swells while a head passes. */
  readonly flash?: number;
};

const ENVELOPE = /* glsl */ `
  uniform float uWave;
  uniform float uGrow;
  uniform float uRise;
  uniform float uDecay;
  uniform float uSettle;
  float waveHead(float x) {
    return smoothstep(0.0, uRise, x) * exp(-max(x - uRise, 0.0) * uDecay);
  }
`;

const NODE_VERTEX = /* glsl */ `
  ${ENVELOPE}
  uniform float uViewH;
  uniform float uNodeScale;
  uniform float uMinPx;
  uniform float uMaxPx;
  uniform float uAppear;
  uniform float uFlash;
  uniform float uLevel;
  uniform float uHop;
  uniform float uHopRise;
  uniform float uHopDecay;
  uniform float uHopKeep;
  uniform vec3 uArrive;
  uniform vec3 uIdle;
  uniform vec3 uLit;
  uniform vec3 uVisited;
  uniform vec3 uHead;
  attribute vec4 aTimes;
  attribute float aHop;
  attribute float aPart;
  varying vec3 vColor;
  varying float vShade;
  varying float vFogDepth;

  void main() {
    vec3 centre = instanceMatrix[3].xyz;
    float size = instanceMatrix[0].x;

    // Build-up: arrive out of depth (ease-out), then light.
    float a = clamp((uGrow - aTimes.y) / uAppear, 0.0, 1.0);
    float away = (1.0 - a) * (1.0 - a) * (1.0 - a);
    float lit = clamp((uGrow - aTimes.z) / (uAppear * 0.5), 0.0, 1.0);
    float pop = lit * (1.0 - lit) * 4.0;

    // Wave: a hot head, then the visited colour stays.
    float x = uWave - aTimes.x;
    float head = waveHead(x);
    float visited = smoothstep(0.0, uSettle, x);

    // Comet hop: a brief ignition as the comet passes, a faint trace after.
    float h = uHop - aHop;
    float hopHead = smoothstep(0.0, uHopRise, h) * exp(-max(h - uHopRise, 0.0) * uHopDecay);
    visited = max(visited, smoothstep(0.0, uHopRise * 3.0, h) * uHopKeep);
    head = max(head, hopHead);

    vec3 tint = vec3(1.0);
    #ifdef USE_INSTANCING_COLOR
      tint = instanceColor;
    #endif
    vec3 col = mix(uIdle, uLit * tint, lit) + uLit * pop * 0.7;
    col = mix(col, uVisited * tint, visited) + uHead * head;

    vec4 mv = modelViewMatrix * vec4(centre + uArrive * away, 1.0);
    float pxPerUnit = uViewH * 0.5 * projectionMatrix[1][1] / max(-mv.z, 0.001);
    float r = size * uNodeScale * (1.0 + uFlash * head + 0.25 * pop);
    r = max(r, uMinPx / pxPerUnit * step(0.00001, size));
    r = min(r, uMaxPx / pxPerUnit);
    r *= (1.0 - away) * step(0.001, uLevel);
    // Nothing behind or right at the camera.
    if (mv.z > -0.25) r = 0.0;

    // Billboard: the core is a disc, the ring (hubs only) a thin annulus.
    vec2 offset = position.xy * r;
    float cap = r;
    // A little volume: the disc is brightest at its centre, the ring a touch dimmer.
    vShade = 1.0 - 0.42 * dot(position.xy, position.xy);
    if (aPart > 0.5) {
      // The ring marks a hub; it appears as the hub lights.
      offset *= aTimes.w * lit;
      vShade = 0.85;
      cap = 0.0;
    }
    vec4 p = vec4(mv.xy + offset, mv.z, 1.0);
    gl_Position = projectionMatrix * p;
    // Depth of the front of the node's sphere, so edges that end inside it are hidden.
    vec4 front = projectionMatrix * vec4(p.xy, p.z + cap, 1.0);
    gl_Position.z = front.z / front.w * gl_Position.w;

    vColor = col;
    vFogDepth = -mv.z;
  }
`;

const NODE_FRAGMENT = /* glsl */ `
  uniform float fogDensity;
  uniform float uLevel;
  varying vec3 vColor;
  varying float vShade;
  varying float vFogDepth;
  void main() {
    // Additive light: fog takes it towards black, never towards a disc of fog colour.
    float clear = exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
    gl_FragColor = vec4(vColor * (vShade * clear * uLevel), 1.0);
  }
`;

const EDGE_VERTEX = /* glsl */ `
  uniform vec2 uView;
  uniform float uLineWidth;
  uniform float uMinLinePx;
  uniform float uMaxLinePx;
  attribute vec3 aStart;
  attribute vec3 aEnd;
  attribute vec4 aTimes;
  attribute vec3 aStyle;
  varying float vU;
  varying float vSide;
  varying float vHalf;
  varying vec4 vTimes;
  varying vec2 vStyle;
  varying float vFogDepth;

  void main() {
    vec4 s = modelViewMatrix * vec4(aStart, 1.0);
    vec4 e = modelViewMatrix * vec4(aEnd, 1.0);
    float u0 = 0.0;
    float u1 = 1.0;

    // Trim the segment just in front of the near plane, otherwise the
    // screen-space direction flips when one end is behind the camera.
    float near = projectionMatrix[3][2] / (projectionMatrix[2][2] - 1.0);
    float zc = -near * 1.05;
    vU = 0.0; vSide = 0.0; vHalf = 0.0; vTimes = aTimes; vStyle = aStyle.xy; vFogDepth = 0.0;
    if (s.z > zc && e.z > zc) {
      gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
      return;
    }
    if (s.z > zc) {
      float k = (zc - s.z) / (e.z - s.z);
      s = mix(s, e, k);
      u0 = k;
    } else if (e.z > zc) {
      float k = (zc - e.z) / (s.z - e.z);
      e = mix(e, s, k);
      u1 = 1.0 - k;
    }

    vec4 cs = projectionMatrix * s;
    vec4 ce = projectionMatrix * e;
    vec2 dir = (ce.xy / ce.w - cs.xy / cs.w) * uView;
    float dl = length(dir);
    dir = dl > 0.0001 ? dir / dl : vec2(1.0, 0.0);
    vec2 nrm = vec2(-dir.y, dir.x);

    float t = position.x;
    vec4 mv = mix(s, e, t);
    vec4 clip = mix(cs, ce, t);
    // World width up close, never thinner than the hairline floor.
    float pxPerUnit = uView.y * 0.5 * projectionMatrix[1][1] / max(-mv.z, 0.001);
    float halfW = 0.5 * clamp(uLineWidth * pxPerUnit, uMinLinePx, uMaxLinePx) * aStyle.z;
    clip.xy += nrm * position.y * (halfW + 1.0) * 2.0 / uView * clip.w;
    gl_Position = clip;

    vU = mix(u0, u1, t);
    vSide = position.y;
    vHalf = halfW;
    vFogDepth = -mv.z;
  }
`;

const EDGE_FRAGMENT = /* glsl */ `
  ${ENVELOPE}
  uniform float fogDensity;
  uniform float uLevel;
  uniform float uTip;
  uniform vec3 uLit;
  uniform vec3 uVisited;
  uniform vec3 uHead;
  uniform vec3 uTipColor;
  varying float vU;
  varying float vSide;
  varying float vHalf;
  varying vec4 vTimes;
  varying vec2 vStyle;
  varying float vFogDepth;

  void main() {
    // Draw-on: only the part the build-up clock has reached exists.
    float since = uGrow - mix(vTimes.z, vTimes.w, vU);
    if (since < 0.0) discard;

    // The wave enters from whichever end it reaches first.
    float arrival = min(vTimes.x + vU * vStyle.x, vTimes.y + (1.0 - vU) * vStyle.x);
    float x = uWave - arrival;
    float head = waveHead(x);
    float visited = smoothstep(0.0, uSettle, x);

    vec3 col = mix(uLit, uVisited, visited) * vStyle.y + uHead * head;
    col += uTipColor * (1.0 - smoothstep(0.0, uTip, since));

    // Analytic coverage across the width: soft, alias-free hairlines.
    float d = abs(vSide) * (vHalf + 1.0);
    float cover = clamp(vHalf + 0.5 - d, 0.0, 1.0);
    float clear = exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
    gl_FragColor = vec4(col * (cover * clear * uLevel), 1.0);
  }
`;

const CORE_SEGMENTS = 28;
const RING_SEGMENTS = 64;
const RING_INNER = 2.26;
const RING_OUTER = 2.38;

/** One disc (the node) plus one annulus (the hub ring); the shader collapses the ring where it is not wanted. */
const buildNodeGeometry = (): THREE.BufferGeometry => {
  const position: number[] = [0, 0, 0];
  const part: number[] = [0];
  const index: number[] = [];
  for (let i = 0; i < CORE_SEGMENTS; i++) {
    const a = (i / CORE_SEGMENTS) * Math.PI * 2;
    position.push(Math.cos(a), Math.sin(a), 0);
    part.push(0);
    index.push(0, 1 + i, 1 + ((i + 1) % CORE_SEGMENTS));
  }
  const base = position.length / 3;
  for (let i = 0; i < RING_SEGMENTS; i++) {
    const a = (i / RING_SEGMENTS) * Math.PI * 2;
    position.push(Math.cos(a) * RING_INNER, Math.sin(a) * RING_INNER, 0, Math.cos(a) * RING_OUTER, Math.sin(a) * RING_OUTER, 0);
    part.push(1, 1);
    const a0 = base + i * 2;
    const b0 = base + ((i + 1) % RING_SEGMENTS) * 2;
    index.push(a0, a0 + 1, b0, b0, a0 + 1, b0 + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 1));
  g.setIndex(index);
  return g;
};

/** fogColor is kept so the renderer's fog refresh finds it; both shaders fog towards black (they are additive). */
const fogUniforms = () => ({fogColor: {value: new THREE.Color(cyber.fog.color)}, fogDensity: {value: 0}});
const waveUniforms = () => ({uWave: {value: -1}, uGrow: {value: 1e6}, uRise: {value: 0.1}, uDecay: {value: 1.6}, uSettle: {value: 0.5}});

const createField = (data: NetworkFieldData) => {
  /* Nodes: one InstancedMesh; the instance matrix carries position and radius, the instance colour a tint. */
  const nodeGeometry = buildNodeGeometry();
  nodeGeometry.setAttribute('aTimes', new THREE.InstancedBufferAttribute(data.nodeTimes, 4));
  nodeGeometry.setAttribute('aHop', new THREE.InstancedBufferAttribute(data.nodeHop, 1));
  const nodeMaterial = new THREE.ShaderMaterial({
    vertexShader: NODE_VERTEX,
    fragmentShader: NODE_FRAGMENT,
    fog: true,
    side: THREE.DoubleSide,
    // Additive, but writing depth: a node still hides the edges that end inside it.
    transparent: true,
    depthWrite: true,
    blending: THREE.AdditiveBlending,
    uniforms: {
      ...fogUniforms(),
      ...waveUniforms(),
      uViewH: {value: 1080},
      uNodeScale: {value: 1},
      uMinPx: {value: 1.4},
      uMaxPx: {value: 140},
      uAppear: {value: 0.5},
      uFlash: {value: 0.5},
      uLevel: {value: 1},
      uHop: {value: -1},
      uHopRise: {value: 0.02},
      uHopDecay: {value: 9},
      uHopKeep: {value: 0.6},
      uArrive: {value: new THREE.Vector3()},
      uIdle: {value: new THREE.Color()},
      uLit: {value: new THREE.Color()},
      uVisited: {value: new THREE.Color()},
      uHead: {value: new THREE.Color()},
    },
  });
  const nodes = new THREE.InstancedMesh(nodeGeometry, nodeMaterial, Math.max(1, data.nodeCount));
  nodes.count = data.nodeCount;
  nodes.frustumCulled = false;
  nodes.renderOrder = 0;
  const m = new THREE.Matrix4();
  const tint = new THREE.Color();
  for (let i = 0; i < data.nodeCount; i++) {
    const s = data.nodeSize[i];
    m.makeScale(s, s, s).setPosition(data.nodePosition[i * 3], data.nodePosition[i * 3 + 1], data.nodePosition[i * 3 + 2]);
    nodes.setMatrixAt(i, m);
    nodes.setColorAt(i, tint.setRGB(data.nodeTint[i * 3], data.nodeTint[i * 3 + 1], data.nodeTint[i * 3 + 2]));
  }
  nodes.instanceMatrix.needsUpdate = true;
  if (nodes.instanceColor) nodes.instanceColor.needsUpdate = true;

  /* Edges: instanced screen-facing quads, one per straight piece. */
  const edgeGeometry = new THREE.InstancedBufferGeometry();
  edgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0, -1, 0, 0, 1, 0, 1, -1, 0, 1, 1, 0], 3));
  edgeGeometry.setIndex([0, 2, 1, 1, 2, 3]);
  edgeGeometry.setAttribute('aStart', new THREE.InstancedBufferAttribute(data.segStart, 3));
  edgeGeometry.setAttribute('aEnd', new THREE.InstancedBufferAttribute(data.segEnd, 3));
  edgeGeometry.setAttribute('aTimes', new THREE.InstancedBufferAttribute(data.segTimes, 4));
  edgeGeometry.setAttribute('aStyle', new THREE.InstancedBufferAttribute(data.segStyle, 3));
  edgeGeometry.instanceCount = data.segCount;
  const edgeMaterial = new THREE.ShaderMaterial({
    vertexShader: EDGE_VERTEX,
    fragmentShader: EDGE_FRAGMENT,
    fog: true,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      ...fogUniforms(),
      ...waveUniforms(),
      uView: {value: new THREE.Vector2(1920, 1080)},
      uLineWidth: {value: 0.012},
      uMinLinePx: {value: 1.15},
      uMaxLinePx: {value: 8},
      uLevel: {value: 1},
      uTip: {value: 0.12},
      uLit: {value: new THREE.Color()},
      uVisited: {value: new THREE.Color()},
      uHead: {value: new THREE.Color()},
      uTipColor: {value: new THREE.Color()},
    },
  });
  const edges = new THREE.Mesh(edgeGeometry, edgeMaterial);
  edges.frustumCulled = false;
  // After the nodes, so their depth hides the edge ends inside them.
  edges.renderOrder = 1;

  return {
    nodes,
    edges,
    nodeMaterial,
    edgeMaterial,
    dispose: () => {
      nodeGeometry.dispose();
      nodeMaterial.dispose();
      edgeGeometry.dispose();
      edgeMaterial.dispose();
      nodes.dispose();
    },
  };
};

/**
 * A whole network in two draw calls: instanced nodes and instanced edges.
 *
 * Nothing is animated on the CPU. Every node and every edge piece carries its
 * graph distance from the source and its build-up times; the shaders turn the
 * clocks you pass in into the picture:
 *
 *   grow   nodes arrive out of depth and light, edges draw on from their
 *          source end (a hot tip leads the line)
 *   hop    a comet's position along its path: the nodes on the path ignite
 *          as it passes and keep a trace of the signal colour
 *   wave   the wavefront: a hot head travels along every edge at constant
 *          graph speed, nodes flash as it reaches them, and what it has
 *          passed keeps the signal colour
 *
 * Edges have a world-space width with a pixel floor, nodes a pixel floor on
 * their radius, so the same field reads from a close shot to a far overview.
 * Fog comes from the scene (Stage3D `fog`). It is a pure function of its
 * props, so it is safe inside <Reflect>.
 */
export const NetworkField: React.FC<NetworkFieldProps> = ({
  data,
  wave = -1,
  grow = 1e6,
  hop = -1,
  level = 1,
  color = cyber.color.blue,
  signal = cyber.color.purple,
  signalHot = cyber.color.purpleHot,
  nodeLevel = 0.6,
  visitedLevel = 0.8,
  edgeLevel = 0.6,
  edgeVisitedLevel = 0.8,
  headLevel = 2.4,
  edgeHeadLevel = 2.2,
  nodeScale = 1,
  minNodePx = 1.4,
  maxNodePx = 140,
  lineWidth = 0.012,
  minLinePx = 1.15,
  maxLinePx = 8,
  appear = 0.5,
  arriveFrom = [0, 0, 0],
  tip = 0.12,
  rise = 0.1,
  decay = 1.6,
  settle = 0.5,
  hopRise = 0.02,
  hopDecay = 9,
  hopKeep = 0.6,
  flash = 0.5,
}) => {
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const field = useMemo(() => createField(data), [data]);
  useEffect(() => () => field.dispose(), [field]);

  for (const u of [field.nodeMaterial.uniforms, field.edgeMaterial.uniforms]) {
    u.uWave.value = wave;
    u.uGrow.value = grow;
    u.uRise.value = rise;
    u.uDecay.value = decay;
    u.uSettle.value = settle;
    u.uLevel.value = clamp01(level);
  }

  const n = field.nodeMaterial.uniforms;
  n.uViewH.value = height;
  n.uNodeScale.value = nodeScale;
  n.uMinPx.value = minNodePx;
  n.uMaxPx.value = maxNodePx;
  n.uAppear.value = appear;
  n.uFlash.value = flash;
  n.uHop.value = hop;
  n.uHopRise.value = hopRise;
  n.uHopDecay.value = hopDecay;
  n.uHopKeep.value = hopKeep;
  n.uArrive.value.set(arriveFrom[0], arriveFrom[1], arriveFrom[2]);
  n.uIdle.value.copy(nodeTint(color, 0));
  n.uLit.value.copy(nodeTint(color, nodeLevel));
  n.uVisited.value.copy(nodeTint(signal, visitedLevel));
  n.uHead.value.set(signalHot).multiplyScalar(headLevel);

  const e = field.edgeMaterial.uniforms;
  e.uView.value.set(width, height);
  e.uLineWidth.value = lineWidth;
  e.uMinLinePx.value = minLinePx;
  e.uMaxLinePx.value = Math.max(minLinePx, maxLinePx);
  e.uTip.value = Math.max(1e-4, tip);
  e.uLit.value.set(color).multiplyScalar(edgeLevel);
  e.uVisited.value.set(signal).multiplyScalar(edgeVisitedLevel);
  e.uHead.value.set(signalHot).multiplyScalar(edgeHeadLevel);
  e.uTipColor.value.set(cyber.color.blueHot).multiplyScalar(edgeLevel * 2.4);

  return (
    <>
      <primitive object={field.nodes} />
      <primitive object={field.edges} />
    </>
  );
};
