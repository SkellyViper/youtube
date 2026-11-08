import React, {useMemo} from 'react';
import * as THREE from 'three';
import {useTheme} from '../../../styles/ThemeContext';
import {SkyDome} from '../../cyber/three/Environment';
import type {Vec3} from '../../cyber/three/rig';
import {HALL} from '../world';
import {hallExtent} from './DataHall';
import {cineMaterials, lit, litMix} from './materials';

/**
 * The campus around the data hall, in the hall's local frame: a dark yard, the
 * hall's own building as a roofless shell (the camera has just left through
 * its ceiling), and a few more hall-sized buildings nearby. Each building is
 * an industrial box with a roof slab, chillers and a plant room on the roof,
 * a warm lit entrance, and a row of status lights along the face that looks
 * toward the hall. `taken(index)` says how many of a building's status lights
 * have turned to the agent's colour, so the spread from building to building
 * reads from a high wide shot.
 *
 *   reveal   0..1 the campus lights come up with it (the hall is a closed box
 *            until its ceiling fades, so nothing out here is seen before then)
 *   home     draw the roofless shell around the hall
 */
export type CampusBuilding = {
  /** Footprint centre on the ground (y is ignored). */
  readonly center: Vec3;
  /** Local width (x), height, depth (z). */
  readonly size: readonly [number, number, number];
  /** Rotation about y. The local +z face carries the status lights and the entrance; turn it toward the hall. */
  readonly yaw: number;
  readonly lights?: number;
};

export const CAMPUS_GROUND_Y = -0.5;

/** Four more buildings around the hall: east, north-east, south-west, south. */
export const CAMPUS_BUILDINGS: readonly CampusBuilding[] = [
  {center: [25, 0, -1], size: [17, 5.2, 14], yaw: -Math.PI / 2},
  {center: [20, 0, -17], size: [17, 4.8, 11], yaw: 0},
  {center: [-18, 0, 19], size: [15, 5.0, 13], yaw: Math.PI / 2},
  {center: [15, 0, 25], size: [15, 5.6, 14], yaw: Math.PI},
];

/**
 * A point on a building's +z face (the one with the status lights). `u` runs
 * -1..1 along the face, `y` is height above the ground, `out` is the distance
 * in front of the face.
 */
export const buildingFacePoint = (b: CampusBuilding, u: number, y: number, out = 0): Vec3 => {
  const [w, , d] = b.size;
  const lx = u * (w / 2);
  const lz = d / 2 + out;
  const c = Math.cos(b.yaw);
  const s = Math.sin(b.yaw);
  return [b.center[0] + lx * c + lz * s, CAMPUS_GROUND_Y + y, b.center[2] - lx * s + lz * c];
};

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

export const Campus: React.FC<{
  readonly buildings?: readonly CampusBuilding[];
  /** Per building: how many status lights have turned to the agent's colour (fractional = the next one is turning). */
  readonly taken?: (index: number) => number;
  readonly reveal?: number;
  readonly home?: boolean;
  readonly children?: React.ReactNode;
}> = ({buildings = CAMPUS_BUILDINGS, taken = () => 0, reveal = 1, home = true, children}) => {
  const th = useTheme();
  const m = useMemo(() => cineMaterials(th), [th]);
  const ext = hallExtent();
  const g = CAMPUS_GROUND_Y;
  const shellH = HALL.ceilingY + 0.35 - g;
  const hw = ext.width / 2 + 0.3;
  const hd = ext.depth / 2 + 0.3;
  const groundColor = useMemo(() => new THREE.Color(m.concrete).multiplyScalar(0.9), [m.concrete]);
  return (
    <group>
      {/* The channel's horizon haze, once there is a horizon to see. */}
      <SkyDome haze={th.color.haze} intensity={1.1 * reveal} width={0.1} />
      <hemisphereLight intensity={1.6 * reveal} color="#2A3F86" groundColor="#1A1410" />
      <directionalLight position={[-40, 60, -30]} intensity={1.6 * reveal} color="#4A6AC0" />
      {/* The yard */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, g, 0]}>
        <planeGeometry args={[420, 420]} />
        <meshStandardMaterial color={groundColor} roughness={0.95} />
      </mesh>
      {/* The hall's own building: four exterior walls just outside the hall's inner walls, open above. */}
      {home
        ? [-1, 1].map((s) => (
            <group key={s}>
              <mesh position={[s * hw, g + shellH / 2, 0]}>
                <boxGeometry args={[0.3, shellH, hd * 2 + 0.3]} />
                <meshStandardMaterial color={m.concrete} roughness={0.9} />
              </mesh>
              <mesh position={[0, g + shellH / 2, s * hd]}>
                <boxGeometry args={[hw * 2 + 0.3, shellH, 0.3]} />
                <meshStandardMaterial color={m.concrete} roughness={0.9} />
              </mesh>
            </group>
          ))
        : null}
      {buildings.map((b, bi) => (
        <Building key={bi} b={b} taken={taken(bi)} reveal={reveal} />
      ))}
      {children}
    </group>
  );
};

const Building: React.FC<{readonly b: CampusBuilding; readonly taken: number; readonly reveal: number}> = ({b, taken, reveal}) => {
  const th = useTheme();
  const m = useMemo(() => cineMaterials(th), [th]);
  const [w, h, d] = b.size;
  const n = b.lights ?? 7;
  return (
    <group position={[b.center[0], CAMPUS_GROUND_Y, b.center[2]]} rotation={[0, b.yaw, 0]}>
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={m.concrete} roughness={0.9} />
      </mesh>
      {/* Roof slab with a visible edge */}
      <mesh position={[0, h + 0.12, 0]}>
        <boxGeometry args={[w + 0.3, 0.24, d + 0.3]} />
        <meshStandardMaterial color={m.steelDark} roughness={0.85} />
      </mesh>
      {/* Roof plant: a row of chillers and a plant room */}
      {Array.from({length: 4}, (_, i) => (
        <mesh key={i} position={[-w / 2 + 2.2 + i * ((w - 4.4) / 3), h + 0.24 + 0.65, -d / 4]}>
          <boxGeometry args={[2.2, 1.3, 2.2]} />
          <meshStandardMaterial color={m.steelDark} roughness={0.8} />
        </mesh>
      ))}
      <mesh position={[w / 2 - 2.6, h + 0.24 + 0.9, d / 4]}>
        <boxGeometry args={[3.6, 1.8, 3]} />
        <meshStandardMaterial color={m.concrete} roughness={0.9} />
      </mesh>
      {/* Status lights along the face toward the hall: system blue, turning to the agent's colour one by one */}
      {Array.from({length: n}, (_, j) => {
        const k = clamp01(taken - j);
        return (
          <mesh key={j} position={[-w / 2 + 1.5 + j * ((w - 3) / Math.max(1, n - 1)), h - 0.8, d / 2 + 0.03]}>
            <planeGeometry args={[0.6, 0.6]} />
            <meshBasicMaterial color={litMix(th.tone.system.base, th.tone.mind.base, k, (1.5 + 1.7 * k) * (0.2 + 0.8 * reveal))} />
          </mesh>
        );
      })}
      {/* Entrance: a warm door under a canopy */}
      <mesh position={[-w / 2 + 3, 1.3, d / 2 + 0.02]}>
        <planeGeometry args={[2, 2.6]} />
        <meshBasicMaterial color={lit('#FFD9A0', 0.8 * reveal)} />
      </mesh>
      <mesh position={[-w / 2 + 3, 2.75, d / 2 + 1.0]}>
        <boxGeometry args={[4, 0.2, 2.2]} />
        <meshStandardMaterial color={m.steelDark} roughness={0.8} />
      </mesh>
      {reveal > 0.02 ? <pointLight position={[-w / 2 + 3, 2.3, d / 2 + 1.0]} intensity={26 * reveal} color="#FFC98A" distance={18} decay={2} /> : null}
    </group>
  );
};
