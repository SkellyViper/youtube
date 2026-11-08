import React, {useMemo} from 'react';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {useTheme} from '../../../styles/ThemeContext';
import type {Vec3} from '../../cyber/three/rig';
import {DESK, KEYBOARD, LAMP, MOUSE, MUG, PLANT, WALL_PORT} from '../world';
import {cineMaterials, lit} from './materials';
import {curveThrough, GlowTube} from '../../cyber/three/Signal3D';
import {Spot} from './Signals';

/**
 * The workstation: desk, monitors, keyboard, mouse, mug, lamp, a plant and the
 * cables. Everything is ordinary matter; the monitors are the light sources.
 */

const V = (v: Vec3): [number, number, number] => [v[0], v[1], v[2]];

export const Desk: React.FC<{readonly children?: React.ReactNode}> = ({children}) => {
  const th = useTheme();
  const m = useMemo(() => cineMaterials(th), [th]);
  const top = useMemo(() => new RoundedBoxGeometry(DESK.width, DESK.thickness, DESK.depth, 3, 0.012), []);
  const [cx, cy, cz] = DESK.center;
  const legH = cy - DESK.thickness / 2;
  return (
    <group>
      <mesh geometry={top} position={[cx, cy - DESK.thickness / 2, cz]} castShadow receiveShadow>
        <meshStandardMaterial color={m.desk} roughness={0.62} metalness={0.02} />
      </mesh>
      {/* Steel frame: two trestle legs */}
      {[-1, 1].map((s) => (
        <group key={s} position={[cx + s * (DESK.width / 2 - 0.12), 0, cz]}>
          <mesh position={[0, legH / 2, 0]} castShadow>
            <boxGeometry args={[0.05, legH, 0.05]} />
            <meshStandardMaterial color={m.steelDark} roughness={0.55} metalness={0.5} />
          </mesh>
          <mesh position={[0, 0.02, 0]} castShadow>
            <boxGeometry args={[0.06, 0.04, DESK.depth - 0.16]} />
            <meshStandardMaterial color={m.steelDark} roughness={0.55} metalness={0.5} />
          </mesh>
          <mesh position={[0, legH - 0.03, 0]}>
            <boxGeometry args={[0.06, 0.04, DESK.depth - 0.16]} />
            <meshStandardMaterial color={m.steelDark} roughness={0.55} metalness={0.5} />
          </mesh>
        </group>
      ))}
      <mesh position={[cx, legH - 0.05, cz - DESK.depth / 2 + 0.1]}>
        <boxGeometry args={[DESK.width - 0.3, 0.04, 0.04]} />
        <meshStandardMaterial color={m.steelDark} roughness={0.55} metalness={0.5} />
      </mesh>
      {/* A drawer unit under the right side */}
      <mesh position={[cx + 0.55, 0.3, cz]} castShadow receiveShadow>
        <boxGeometry args={[0.42, 0.6, DESK.depth - 0.2]} />
        <meshStandardMaterial color={m.plastic} roughness={0.7} />
      </mesh>
      {[0.12, 0.3, 0.48].map((y) => (
        <mesh key={y} position={[cx + 0.55, y, cz + DESK.depth / 2 - 0.095]}>
          <boxGeometry args={[0.2, 0.012, 0.012]} />
          <meshStandardMaterial color={m.steel} roughness={0.4} metalness={0.7} />
        </mesh>
      ))}
      {children}
    </group>
  );
};

/**
 * A monitor: thin bezel, a screen plane showing `map`, a stand, and a point
 * light in front of the screen in the picture's dominant colour, so the screen
 * really lights the desk and the person. `power` dims both picture and light.
 */
export const Monitor: React.FC<{
  readonly position: Vec3;
  readonly width: number;
  readonly height: number;
  readonly yaw?: number;
  readonly map: THREE.Texture;
  readonly power?: number;
  /** Colour of the light the screen throws. */
  readonly tint: string;
  /** Light intensity multiplier. */
  readonly light?: number;
  /** Stand height (screen centre above the desk surface). */
  readonly standBase?: Vec3;
  readonly castLight?: boolean;
}> = ({position, width, height, yaw = 0, map, power = 1, tint, light = 1, castLight = true}) => {
  const th = useTheme();
  const m = useMemo(() => cineMaterials(th), [th]);
  const bezel = 0.012;
  const bodyGeo = useMemo(() => new RoundedBoxGeometry(width + bezel * 2, height + bezel * 2, 0.035, 2, 0.006), [width, height]);
  const standH = position[1] - DESK.center[1] - height / 2;
  const screenColor = useMemo(() => new THREE.Color(1, 1, 1).multiplyScalar(Math.max(0.015, 1.1 * power)), [power]);
  return (
    <group position={V(position)} rotation={[0, yaw, 0]}>
      <mesh geometry={bodyGeo} position={[0, 0, -0.0175]} castShadow>
        <meshStandardMaterial color={m.plasticDark} roughness={0.45} metalness={0.1} />
      </mesh>
      {/* The picture: unlit, so it is exactly the painted canvas. */}
      <mesh position={[0, 0, 0.0005]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={map} color={screenColor} toneMapped={false} />
      </mesh>
      {/* Glass sheen: a very faint reflective layer */}
      <mesh position={[0, 0, 0.001]}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial color="#000000" roughness={0.12} metalness={0.9} transparent opacity={0.08} />
      </mesh>
      {/* Stand: neck and base */}
      <mesh position={[0, -height / 2 - standH / 2, -0.06]} castShadow>
        <boxGeometry args={[0.05, standH + 0.02, 0.025]} />
        <meshStandardMaterial color={m.plasticDark} roughness={0.5} />
      </mesh>
      <mesh position={[0, -height / 2 - standH + 0.008, -0.02]} castShadow receiveShadow>
        <cylinderGeometry args={[0.13, 0.15, 0.016, 28]} />
        <meshStandardMaterial color={m.plasticDark} roughness={0.5} metalness={0.2} />
      </mesh>
      {/* Power LED on the bezel */}
      <mesh position={[width / 2 - 0.02, -height / 2 - 0.004, 0.001]}>
        <planeGeometry args={[0.006, 0.003]} />
        <meshBasicMaterial color={lit('#EAF2FF', 1.2 * power)} />
      </mesh>
      {castLight ? <pointLight position={[0, 0, 0.5]} intensity={2.0 * light * power} color={tint} distance={3.2} decay={2} castShadow={false} /> : null}
    </group>
  );
};

/** Keyboard with instanced keys. */
export const Keyboard: React.FC<{readonly position?: Vec3}> = ({position = KEYBOARD.position}) => {
  const th = useTheme();
  const m = useMemo(() => cineMaterials(th), [th]);
  const keys = useMemo(() => {
    const geo = new THREE.BoxGeometry(0.0155, 0.008, 0.0155);
    const mat = new THREE.MeshStandardMaterial({color: '#1C1F28', roughness: 0.6});
    const mesh = new THREE.InstancedMesh(geo, mat, 6 * 15);
    const o = new THREE.Object3D();
    let k = 0;
    for (let r = 0; r < 6; r++) {
      const n = r === 5 ? 9 : 15;
      for (let c = 0; c < n; c++) {
        const w = r === 5 && c === 4 ? 0.11 : 0.0155;
        o.position.set(-KEYBOARD.width / 2 + 0.03 + c * 0.0195 * (r === 5 ? 1.55 : 1) + (r === 5 && c > 4 ? 0.09 : 0), 0.012, -KEYBOARD.depth / 2 + 0.02 + r * 0.0215);
        o.scale.set(w / 0.0155, 1, 1);
        o.updateMatrix();
        mesh.setMatrixAt(k++, o.matrix);
      }
    }
    mesh.count = k;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    return mesh;
  }, []);
  return (
    <group position={V(position)} rotation={[0, 0.03, 0]}>
      <mesh position={[0, 0.006, 0]} castShadow receiveShadow>
        <boxGeometry args={[KEYBOARD.width, 0.012, KEYBOARD.depth]} />
        <meshStandardMaterial color={m.plastic} roughness={0.55} />
      </mesh>
      <primitive object={keys} />
    </group>
  );
};

export const Mouse: React.FC<{readonly position?: Vec3}> = ({position = MOUSE.position}) => {
  const th = useTheme();
  const m = useMemo(() => cineMaterials(th), [th]);
  return (
    <mesh position={V(position)} rotation={[0, -0.2, 0]} scale={[0.6, 0.35, 1]} castShadow>
      <sphereGeometry args={[0.055, 20, 14]} />
      <meshStandardMaterial color={m.plastic} roughness={0.45} />
    </mesh>
  );
};

export const Mug: React.FC<{readonly position?: Vec3}> = ({position = MUG.position}) => {
  const th = useTheme();
  const m = useMemo(() => cineMaterials(th), [th]);
  return (
    <group position={V(position)}>
      <mesh position={[0, 0.05, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.042, 0.038, 0.1, 24]} />
        <meshStandardMaterial color={m.ceramic} roughness={0.35} />
      </mesh>
      <mesh position={[0.05, 0.052, 0]} rotation={[0, 0, 0]}>
        <torusGeometry args={[0.024, 0.006, 8, 20, Math.PI]} />
        <meshStandardMaterial color={m.ceramic} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.038, 24]} />
        <meshStandardMaterial color="#2A1A10" roughness={0.3} />
      </mesh>
    </group>
  );
};

/** Desk lamp: a weighted base, an arm, a shade, and a warm practical light. `on` 0..1. */
export const Lamp: React.FC<{readonly position?: Vec3; readonly on?: number}> = ({position = LAMP.position, on = 1}) => {
  const th = useTheme();
  const m = useMemo(() => cineMaterials(th), [th]);
  const warm = th.tone.human.base;
  return (
    <group position={V(position)} rotation={[0, -0.5, 0]}>
      <mesh position={[0, 0.012, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.09, 0.024, 24]} />
        <meshStandardMaterial color={m.steelDark} roughness={0.4} metalness={0.7} />
      </mesh>
      <mesh position={[0, 0.2, 0]} rotation={[0, 0, 0.25]} castShadow>
        <cylinderGeometry args={[0.008, 0.008, 0.4, 10]} />
        <meshStandardMaterial color={m.steelDark} roughness={0.4} metalness={0.7} />
      </mesh>
      <mesh position={[-0.14, 0.5, 0]} rotation={[0, 0, -0.9]} castShadow>
        <cylinderGeometry args={[0.008, 0.008, 0.36, 10]} />
        <meshStandardMaterial color={m.steelDark} roughness={0.4} metalness={0.7} />
      </mesh>
      <group position={[-0.28, 0.58, 0]} rotation={[0, 0, 0.9]}>
        <mesh castShadow>
          <coneGeometry args={[0.085, 0.14, 24, 1, true]} />
          <meshStandardMaterial color={m.steelDark} roughness={0.4} metalness={0.6} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, -0.06, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.06, 20]} />
          <meshBasicMaterial color={lit(warm, 0.85 * on)} />
        </mesh>
        <Spot position={[0, -0.08, 0]} target={[0, -1.2, 0]} intensity={6.5 * on} angle={0.8} penumbra={0.7} distance={2.6} color={warm} castShadow />
      </group>
    </group>
  );
};

export const Plant: React.FC<{readonly position?: Vec3}> = ({position = PLANT.position}) => {
  const th = useTheme();
  const m = useMemo(() => cineMaterials(th), [th]);
  const leaves = useMemo(() => Array.from({length: 7}, (_, i) => ({a: (i / 7) * Math.PI * 2 + 0.4, tilt: 0.55 + 0.25 * ((i * 7) % 3), len: 0.16 + 0.04 * ((i * 5) % 3)})), []);
  return (
    <group position={V(position)}>
      <mesh position={[0, 0.06, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.06, 0.05, 0.12, 20]} />
        <meshStandardMaterial color={m.deskEdge} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.118, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.052, 20]} />
        <meshStandardMaterial color="#17120E" roughness={1} />
      </mesh>
      {leaves.map((l, i) => (
        <group key={i} position={[0, 0.12, 0]} rotation={[0, l.a, 0]}>
          <mesh position={[0, l.len * 0.5, 0]} rotation={[l.tilt, 0, 0]} castShadow>
            <coneGeometry args={[0.02, l.len, 6]} />
            <meshStandardMaterial color="#1F4A2E" roughness={0.8} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

/**
 * The desk's cables: from the back of each monitor, down behind the desk,
 * along the skirting to the wall port. A dark conduit always; `lit` draws a
 * coloured pulse along it (0..1 along the run) for "a message leaving".
 */
export const deskCable = (from: Vec3): THREE.Curve<THREE.Vector3> => {
  const [, , cz] = DESK.center;
  const backZ = cz - DESK.depth / 2 - 0.05;
  return curveThrough([from, [from[0], from[1] - 0.25, backZ], [from[0] + 0.1, 0.12, backZ + 0.02], [WALL_PORT[0] - 0.3, 0.1, WALL_PORT[2] + 0.1], WALL_PORT], 0.4);
};

export const DeskCables: React.FC<{readonly from: readonly Vec3[]}> = ({from}) => {
  const th = useTheme();
  const curves = useMemo(() => from.map((f) => deskCable(f)), [from]);
  return (
    <group>
      {curves.map((c, i) => (
        <GlowTube key={i} curve={c} radius={0.006} color={th.color.steel} intensity={0.5} segments={48} radial={5} />
      ))}
      {/* Wall port plate */}
      <mesh position={[WALL_PORT[0], WALL_PORT[1], WALL_PORT[2] + 0.004]}>
        <boxGeometry args={[0.08, 0.08, 0.008]} />
        <meshStandardMaterial color="#1B1F2A" roughness={0.6} />
      </mesh>
    </group>
  );
};
