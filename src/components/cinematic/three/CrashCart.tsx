import React, {useMemo} from 'react';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {useTheme} from '../../../styles/ThemeContext';
import type {Vec3} from '../../cyber/three/rig';
import {curveThrough} from '../../cyber/three/Signal3D';
import {cineMaterials, lit} from './materials';

/**
 * A crash cart: the wheeled console cart a data-centre technician rolls up to
 * a rack to work on it. A steel frame on four casters, a lower shelf with the
 * KVM box the cart plugs into the rack with, a worktop with a keyboard tray,
 * and a small monitor on a short post. The monitor shows `map` (paint it with
 * `useScreenTexture` + `paintTerminal`) and throws a little of its light onto
 * the worktop and the aisle, so the cart reads as "someone is logged in here"
 * even from a distance.
 *
 * Local frame: floor point at the origin, the screen faces +z (toward the
 * operator). `yaw` turns the whole cart. `cableTo` (in the parent's frame)
 * draws the console cable from the KVM box to a point on the rack: a session
 * is a physical connection, not a floating screen.
 */
export const CrashCart: React.FC<{
  readonly position: Vec3;
  readonly yaw?: number;
  readonly map: THREE.Texture;
  /** Colour of the light the screen throws. */
  readonly tint: string;
  /** 0..1 screen on. */
  readonly power?: number;
  /** Light intensity multiplier. */
  readonly light?: number;
  /** Where the console cable goes (parent frame), e.g. the rack's bay. */
  readonly cableTo?: Vec3;
}> = ({position, yaw = 0, map, tint, power = 1, light = 1, cableTo}) => {
  const th = useTheme();
  const m = useMemo(() => cineMaterials(th), [th]);
  const W = 0.58; // frame width (x)
  const D = 0.46; // frame depth (z)
  const topY = 0.88;
  const screenW = 0.36;
  const screenH = 0.25;
  const screenY = 1.13;
  const screenZ = -0.1;
  const body = useMemo(() => new RoundedBoxGeometry(screenW + 0.024, screenH + 0.024, 0.03, 2, 0.005), []);
  const screenColor = useMemo(() => new THREE.Color(1, 1, 1).multiplyScalar(0.25 + 0.85 * power), [power]);
  // Cable from the monitor's back down to the KVM box.
  const monitorCable = useMemo(() => new THREE.TubeGeometry(curveThrough([[0.04, screenY - 0.06, screenZ - 0.03], [0.06, topY - 0.02, -0.21], [0.12, 0.6, -0.2]], 0.4), 24, 0.005, 5, false), []);
  // Console cable from the KVM box to the rack, laid in the parent's frame.
  const consoleCable = useMemo(() => {
    if (!cableTo) return null;
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const local = (p: Vec3): Vec3 => [position[0] + p[0] * c + p[2] * s, position[1] + p[1], position[2] - p[0] * s + p[2] * c];
    const a = local([0.2, 0.58, -0.22]);
    const b = local([0.3, 0.3, -0.32]);
    const mid: Vec3 = [(b[0] + cableTo[0]) / 2, Math.min(b[1], cableTo[1]) - 0.1, (b[2] + cableTo[2]) / 2];
    return new THREE.TubeGeometry(curveThrough([a, b, mid, cableTo], 0.4), 40, 0.006, 5, false);
  }, [cableTo, position, yaw]);

  return (
    <group position={[position[0], position[1], position[2]]}>
      <group rotation={[0, yaw, 0]}>
        {/* Casters */}
        {[-1, 1].map((sx) =>
          [-1, 1].map((sz) => (
            <mesh key={`${sx}${sz}`} position={[sx * (W / 2 - 0.05), 0.035, sz * (D / 2 - 0.05)]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.035, 0.035, 0.028, 14]} />
              <meshStandardMaterial color={m.plasticDark} roughness={0.7} />
            </mesh>
          )),
        )}
        {/* Frame: four posts */}
        {[-1, 1].map((sx) =>
          [-1, 1].map((sz) => (
            <mesh key={`p${sx}${sz}`} position={[sx * (W / 2 - 0.012), 0.07 + (topY - 0.07) / 2, sz * (D / 2 - 0.012)]} castShadow>
              <boxGeometry args={[0.024, topY - 0.07, 0.024]} />
              <meshStandardMaterial color={m.steelDark} roughness={0.45} metalness={0.6} />
            </mesh>
          )),
        )}
        {/* Lower shelf and worktop */}
        <mesh position={[0, 0.22, 0]} castShadow receiveShadow>
          <boxGeometry args={[W - 0.02, 0.02, D - 0.02]} />
          <meshStandardMaterial color={m.plastic} roughness={0.7} />
        </mesh>
        <mesh position={[0, topY, 0]} castShadow receiveShadow>
          <boxGeometry args={[W + 0.04, 0.03, D + 0.04]} />
          <meshStandardMaterial color={m.plastic} roughness={0.6} />
        </mesh>
        {/* KVM box on the lower shelf, with its power LED */}
        <mesh position={[0, 0.29, -0.04]} castShadow receiveShadow>
          <boxGeometry args={[0.4, 0.12, 0.3]} />
          <meshStandardMaterial color={m.rackFace} roughness={0.5} metalness={0.5} />
        </mesh>
        <mesh position={[-0.15, 0.31, 0.111]}>
          <planeGeometry args={[0.01, 0.006]} />
          <meshBasicMaterial color={lit(th.tone.safe.base, 1.3 * power)} />
        </mesh>
        {/* Keyboard tray, pulled out toward the operator */}
        <mesh position={[0, topY - 0.07, D / 2 + 0.06]} castShadow receiveShadow>
          <boxGeometry args={[0.42, 0.014, 0.17]} />
          <meshStandardMaterial color={m.plasticDark} roughness={0.6} />
        </mesh>
        <mesh position={[0, topY - 0.062, D / 2 + 0.06]}>
          <boxGeometry args={[0.36, 0.006, 0.12]} />
          <meshStandardMaterial color={m.plastic} roughness={0.55} />
        </mesh>
        {/* Monitor on a short post */}
        <mesh position={[0, topY + (screenY - screenH / 2 - topY) / 2, screenZ - 0.04]} castShadow>
          <boxGeometry args={[0.03, screenY - screenH / 2 - topY + 0.02, 0.03]} />
          <meshStandardMaterial color={m.plasticDark} roughness={0.5} />
        </mesh>
        <mesh geometry={body} position={[0, screenY, screenZ - 0.015]} castShadow>
          <meshStandardMaterial color={m.plasticDark} roughness={0.45} metalness={0.1} />
        </mesh>
        <mesh position={[0, screenY, screenZ + 0.0008]}>
          <planeGeometry args={[screenW, screenH]} />
          <meshBasicMaterial map={map} color={screenColor} toneMapped={false} />
        </mesh>
        <mesh position={[screenW / 2 - 0.015, screenY - screenH / 2 - 0.004, screenZ + 0.001]}>
          <planeGeometry args={[0.005, 0.003]} />
          <meshBasicMaterial color={lit(th.color.white, 1.1 * power)} />
        </mesh>
        <mesh geometry={monitorCable}>
          <meshStandardMaterial color={m.plasticDark} roughness={0.9} />
        </mesh>
        {/* The screen's light on the worktop and the aisle */}
        {power > 0.01 && light > 0 ? <pointLight position={[0, screenY - 0.05, screenZ + 0.35]} intensity={1.6 * light * power} color={tint} distance={2.6} decay={2} /> : null}
      </group>
      {consoleCable ? (
        <mesh geometry={consoleCable} position={[-position[0], -position[1], -position[2]]}>
          <meshStandardMaterial color={m.plasticDark} roughness={0.9} />
        </mesh>
      ) : null}
    </group>
  );
};
