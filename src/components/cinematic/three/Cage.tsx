import React, {useLayoutEffect, useMemo} from 'react';
import * as THREE from 'three';
import {mix} from '../../../styles/cyber';
import {useTheme} from '../../../styles/ThemeContext';
import type {Vec3} from '../../cyber/three/rig';
import {cineMaterials, litMix} from './materials';

/**
 * A chain-link security cage around part of a data hall: the kind colocation
 * halls use to fence one customer's rows off from the next. Galvanised posts,
 * top and bottom rails, wire-mesh panels between them, sliding gates on the
 * aisle ends and a small sign plate with one indicator lamp. The top is open.
 *
 * It is dark steel, not a glowing outline. The only light it carries is a
 * hairline LED strip along the top rail and the lamp on each sign, and those
 * come on only when `clear` is raised: the zone has been scanned and passed.
 *
 *   spec    footprint (hall-local x/z), height, gates
 *   clear   0..1 the top-rail strip and the sign lamps light in the safe tone
 */
export type CageGate = {
  /** Which x end of the cage the gate is on. */
  readonly end: -1 | 1;
  /** The z interval of the opening. */
  readonly z0: number;
  readonly z1: number;
  /** 0 closed .. 1 slid fully open (the leaf slides toward +z along the fence). */
  readonly open: number;
};

export type CageSpec = {
  readonly min: readonly [number, number];
  readonly max: readonly [number, number];
  readonly height: number;
  readonly gates: readonly CageGate[];
  /** Target spacing of the posts along the long sides. */
  readonly postSpacing?: number;
};

/** World size of one texture tile: two diamonds of mesh. */
const CELL = 0.1;

let chain: THREE.DataTexture | null = null;

/**
 * Chain-link mesh as an RGBA tile: two diagonal families of wire, soft
 * edges so that the mipmaps keep a faint grey veil at a distance instead of
 * vanishing. Generated once, deterministic, no asset.
 */
export const chainLinkTexture = (): THREE.DataTexture => {
  if (chain) return chain;
  const W = 64;
  const P = 32;
  const data = new Uint8Array(W * W * 4);
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const a = (((x + y) % P) + P) % P;
      const b = (((x - y) % P) + P) % P;
      const da = Math.min(a, P - a) / Math.SQRT2;
      const db = Math.min(b, P - b) / Math.SQRT2;
      const d = Math.min(da, db);
      // Wire radius ~1.7 px (about 2.5 mm at a 10 cm tile), one soft pixel at the edge.
      const alpha = Math.min(1, Math.max(0, (2.4 - d) / 1.0));
      // The knuckles where the wires cross are a little brighter: the twist catches light.
      const cross = da < 2.4 && db < 2.4 ? 1.15 : 1;
      const v = Math.min(255, 215 * cross);
      const i = (y * W + x) * 4;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = Math.round(alpha * 255);
    }
  }
  chain = new THREE.DataTexture(data, W, W, THREE.RGBAFormat);
  chain.colorSpace = THREE.SRGBColorSpace;
  chain.wrapS = THREE.RepeatWrapping;
  chain.wrapT = THREE.RepeatWrapping;
  chain.minFilter = THREE.LinearMipmapLinearFilter;
  chain.magFilter = THREE.LinearFilter;
  chain.anisotropy = 8;
  chain.generateMipmaps = true;
  chain.needsUpdate = true;
  return chain;
};

/** A plane whose UVs are scaled so that the mesh tile keeps its world size whatever the panel's size. */
const panelGeometry = (w: number, h: number): THREE.PlaneGeometry => {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (w / CELL), uv.getY(i) * (h / CELL));
  uv.needsUpdate = true;
  return g;
};

type Panel = {readonly center: Vec3; readonly width: number; readonly height: number; readonly yaw: number};
type Rail = {readonly center: Vec3; readonly length: number; readonly alongX: boolean};

const POST = 0.06;

/** Posts, panels and rails for a spec. Pure geometry, computed once. */
const layout = (spec: CageSpec) => {
  const [x0, z0] = spec.min;
  const [x1, z1] = spec.max;
  const h = spec.height;
  const spacing = spec.postSpacing ?? 1.2;
  const posts: Vec3[] = [];
  const panels: Panel[] = [];
  const rails: Rail[] = [];
  // Long sides (along x) at z0 and z1: evenly spaced posts.
  const nx = Math.max(1, Math.round((x1 - x0) / spacing));
  for (const z of [z0, z1]) {
    for (let k = 0; k <= nx; k++) posts.push([x0 + ((x1 - x0) * k) / nx, 0, z]);
    for (let k = 0; k < nx; k++) {
      const a = x0 + ((x1 - x0) * k) / nx;
      const b = x0 + ((x1 - x0) * (k + 1)) / nx;
      panels.push({center: [(a + b) / 2, h / 2, z], width: b - a - POST, height: h - 0.1, yaw: 0});
    }
    rails.push({center: [(x0 + x1) / 2, h, z], length: x1 - x0 + POST, alongX: true});
    rails.push({center: [(x0 + x1) / 2, 0.05, z], length: x1 - x0 + POST, alongX: true});
  }
  // Short sides (along z) at x0 and x1: posts at the gate jambs and a post midway in each remaining span.
  for (const end of [-1, 1] as const) {
    const x = end < 0 ? x0 : x1;
    const gate = spec.gates.find((g) => g.end === end);
    const marks = [z0, z1];
    if (gate) marks.push(gate.z0, gate.z1);
    marks.sort((a, b) => a - b);
    const zs: number[] = [];
    for (let k = 0; k < marks.length - 1; k++) {
      const a = marks[k];
      const b = marks[k + 1];
      const isGate = gate !== undefined && Math.abs(a - gate.z0) < 1e-6 && Math.abs(b - gate.z1) < 1e-6;
      zs.push(a);
      if (!isGate && b - a > spacing * 1.2) {
        const m = (a + b) / 2;
        zs.push(m);
        panels.push({center: [x, h / 2, (a + m) / 2], width: m - a - POST, height: h - 0.1, yaw: Math.PI / 2});
        panels.push({center: [x, h / 2, (m + b) / 2], width: b - m - POST, height: h - 0.1, yaw: Math.PI / 2});
      } else if (!isGate) {
        panels.push({center: [x, h / 2, (a + b) / 2], width: b - a - POST, height: h - 0.1, yaw: Math.PI / 2});
      }
    }
    zs.push(z1);
    // The corner posts are already placed by the long sides.
    for (const z of zs) if (Math.abs(z - z0) > 1e-6 && Math.abs(z - z1) > 1e-6) posts.push([x, 0, z]);
    rails.push({center: [x, h, (z0 + z1) / 2], length: z1 - z0 + POST, alongX: false});
    rails.push({center: [x, 0.05, (z0 + z1) / 2], length: z1 - z0 + POST, alongX: false});
  }
  return {posts, panels, rails};
};

/** A sliding gate leaf: a tube frame, a diagonal brace and mesh. Slides along +z. */
const Gate: React.FC<{readonly gate: CageGate; readonly x: number; readonly height: number; readonly meshMat: THREE.Material; readonly steel: string}> = ({gate, x, height, meshMat, steel}) => {
  const w = gate.z1 - gate.z0;
  const h = height - 0.12;
  const slide = gate.open * w;
  const geo = useMemo(() => panelGeometry(w - 0.1, h - 0.1), [w, h]);
  useLayoutEffect(() => () => geo.dispose(), [geo]);
  const out = gate.end * 0.075;
  return (
    <group position={[x + out, h / 2 + 0.04, (gate.z0 + gate.z1) / 2 + slide]} rotation={[0, Math.PI / 2, 0]}>
      {/* Frame */}
      {[-1, 1].map((s) => (
        <mesh key={`v${s}`} position={[(s * (w - 0.04)) / 2, 0, 0]} castShadow>
          <boxGeometry args={[0.04, h, 0.04]} />
          <meshStandardMaterial color={steel} roughness={0.45} metalness={0.7} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={`h${s}`} position={[0, (s * (h - 0.04)) / 2, 0]} castShadow>
          <boxGeometry args={[w, 0.04, 0.04]} />
          <meshStandardMaterial color={steel} roughness={0.45} metalness={0.7} />
        </mesh>
      ))}
      {/* Brace */}
      <mesh rotation={[0, 0, Math.atan2(h, w)]}>
        <boxGeometry args={[Math.hypot(w, h) - 0.1, 0.025, 0.025]} />
        <meshStandardMaterial color={steel} roughness={0.45} metalness={0.7} />
      </mesh>
      <mesh geometry={geo} material={meshMat} />
      {/* Rollers on the track */}
      {[-1, 1].map((s) => (
        <mesh key={`r${s}`} position={[(s * (w - 0.2)) / 2, h / 2 + 0.06, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.035, 0.035, 0.03, 12]} />
          <meshStandardMaterial color={steel} roughness={0.4} metalness={0.75} />
        </mesh>
      ))}
    </group>
  );
};

/**
 * A small sign plate on a post: a dark plate with a steel border, a blank
 * label block and one indicator lamp. The lamp is dark until `clear`.
 */
export const CageSign: React.FC<{readonly position: Vec3; readonly yaw?: number; readonly clear?: number}> = ({position, yaw = 0, clear = 0}) => {
  const th = useTheme();
  const m = useMemo(() => cineMaterials(th), [th]);
  const c = Math.min(1, Math.max(0, clear));
  const lamp = litMix(th.tone.safe.deep, th.tone.safe.base, c, 0.25 + 2.4 * th.glow * c);
  return (
    <group position={[position[0], position[1], position[2]]} rotation={[0, yaw, 0]}>
      <mesh castShadow>
        <boxGeometry args={[0.3, 0.22, 0.012]} />
        <meshStandardMaterial color={m.plasticDark} roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0, 0.004]}>
        <boxGeometry args={[0.31, 0.23, 0.006]} />
        <meshStandardMaterial color={m.steel} roughness={0.4} metalness={0.7} />
      </mesh>
      <mesh position={[0, 0, 0.0075]}>
        <boxGeometry args={[0.29, 0.21, 0.004]} />
        <meshStandardMaterial color={m.plasticDark} roughness={0.6} metalness={0.3} />
      </mesh>
      {/* label block: a paler rectangle where a printed label would sit */}
      <mesh position={[-0.03, -0.02, 0.0105]}>
        <planeGeometry args={[0.19, 0.1]} />
        <meshStandardMaterial color={m.fabric} roughness={0.9} />
      </mesh>
      {/* indicator lamp */}
      <mesh position={[0.1, 0.06, 0.012]}>
        <cylinderGeometry args={[0.02, 0.02, 0.012, 16]} />
        <meshStandardMaterial color={m.steelDark} roughness={0.4} metalness={0.7} />
      </mesh>
      <mesh position={[0.1, 0.06, 0.019]} rotation={[Math.PI / 2, 0, 0]}>
        <sphereGeometry args={[0.014, 12, 8]} />
        <meshBasicMaterial color={lamp} />
      </mesh>
      <pointLight position={[0.1, 0.06, 0.08]} intensity={(c > 0.02) ? (0.5 * c) : 0} color={th.tone.safe.base} distance={0.9} decay={2} />
    </group>
  );
};

export const Cage: React.FC<{readonly spec: CageSpec; readonly clear?: number}> = ({spec, clear = 0}) => {
  const th = useTheme();
  const m = useMemo(() => cineMaterials(th), [th]);
  const steel = useMemo(() => mix(m.rackRail, '#6B7484', 0.5), [m.rackRail]);
  const wire = useMemo(() => mix(th.color.steel, '#AEB6C4', 0.6), [th.color.steel]);
  const {posts, panels, rails} = useMemo(() => layout(spec), [spec]);
  const c = Math.min(1, Math.max(0, clear));

  const meshMat = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      map: chainLinkTexture(),
      color: wire,
      roughness: 0.45,
      metalness: 0.7,
      transparent: true,
      alphaTest: 0.03,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    return mat;
  }, [wire]);
  useLayoutEffect(() => () => meshMat.dispose(), [meshMat]);

  const postMesh = useMemo(() => {
    const geo = new THREE.BoxGeometry(POST, spec.height + 0.05, POST);
    const mat = new THREE.MeshStandardMaterial({color: steel, roughness: 0.45, metalness: 0.7});
    const mesh = new THREE.InstancedMesh(geo, mat, posts.length);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const o = new THREE.Object3D();
    posts.forEach((p, i) => {
      o.position.set(p[0], (spec.height + 0.05) / 2, p[2]);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }, [posts, spec.height, steel]);
  useLayoutEffect(
    () => () => {
      postMesh.geometry.dispose();
      (postMesh.material as THREE.Material).dispose();
    },
    [postMesh],
  );

  const panelGeos = useMemo(() => panels.map((p) => panelGeometry(p.width, p.height)), [panels]);
  useLayoutEffect(() => () => panelGeos.forEach((g) => g.dispose()), [panelGeos]);

  const strip = litMix(th.tone.safe.deep, th.tone.safe.base, c, 0.22 + 1.9 * th.glow * c);

  return (
    <group>
      <primitive object={postMesh} />
      {panels.map((p, i) => (
        <mesh key={i} geometry={panelGeos[i]} material={meshMat} position={[p.center[0], p.center[1], p.center[2]]} rotation={[0, p.yaw, 0]} />
      ))}
      {rails.map((r, i) => (
        <mesh key={i} position={[r.center[0], r.center[1], r.center[2]]} castShadow>
          <boxGeometry args={r.alongX ? [r.length, 0.05, 0.05] : [0.05, 0.05, r.length]} />
          <meshStandardMaterial color={steel} roughness={0.45} metalness={0.7} />
        </mesh>
      ))}
      {/* The LED strip along the top rail: a hairline that is dark until the zone is cleared */}
      {rails
        .filter((r) => r.center[1] > 1)
        .map((r, i) => (
          <mesh key={`s${i}`} position={[r.center[0], r.center[1] + 0.034, r.center[2]]}>
            <boxGeometry args={r.alongX ? [r.length - 0.1, 0.014, 0.014] : [0.014, 0.014, r.length - 0.1]} />
            <meshBasicMaterial color={strip} />
          </mesh>
        ))}
      {/* Gate tracks and leaves */}
      {spec.gates.map((g, i) => {
        const x = g.end < 0 ? spec.min[0] : spec.max[0];
        const trackLen = (g.z1 - g.z0) * 2 + 0.2;
        const trackZ = (g.z0 + g.z1) / 2 + (g.z1 - g.z0) / 2;
        return (
          <group key={i}>
            <mesh position={[x + g.end * 0.075, spec.height - 0.02, trackZ]}>
              <boxGeometry args={[0.05, 0.06, trackLen]} />
              <meshStandardMaterial color={steel} roughness={0.45} metalness={0.7} />
            </mesh>
            <Gate gate={g} x={x} height={spec.height} meshMat={meshMat} steel={steel} />
          </group>
        );
      })}
    </group>
  );
};
