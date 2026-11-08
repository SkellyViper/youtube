import React, {useMemo} from 'react';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {useTheme} from '../../../styles/ThemeContext';
import type {Vec3} from '../../cyber/three/rig';
import {JOHN, KEYBOARD} from '../world';
import {cineMaterials} from './materials';

/**
 * John, the developer: a stylised figure, seen mostly from behind and three
 * quarter. No face: a head of dark hair under headphones, a hoodie, jeans,
 * forearms reaching to the keyboard. The silhouette says "someone working at
 * a computer, late" before any light reaches him.
 *
 * Pose is a pure function of props:
 *   typing  0..1  hands drum on the keyboard (driven by `time`)
 *   lean    -1..1 back in the chair .. leaning into the screen
 *   turn    head yaw toward the agent monitor (+) or the game (-), radians
 *   reach   0..1 the right hand goes to the mouse instead of the keyboard
 *   slump   0..1 shoulders drop, head bows (tired, done for the night)
 */
export type Pose = {
  readonly typing?: number;
  readonly lean?: number;
  readonly turn?: number;
  readonly reach?: number;
  readonly slump?: number;
};

const V = (v: Vec3): [number, number, number] => [v[0], v[1], v[2]];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** A capsule between two points. */
const Limb: React.FC<{readonly a: Vec3; readonly b: Vec3; readonly r: number; readonly color: string; readonly roughness?: number}> = ({a, b, r, color, roughness = 0.85}) => {
  const {position, quaternion, length} = useMemo(() => {
    const A = new THREE.Vector3(...a);
    const B = new THREE.Vector3(...b);
    const dir = B.clone().sub(A);
    const length = dir.length();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    return {position: A.clone().add(B).multiplyScalar(0.5), quaternion: q, length};
  }, [a, b]);
  return (
    <mesh position={position} quaternion={quaternion} castShadow>
      <capsuleGeometry args={[r, Math.max(0.01, length - r * 0.6), 6, 14]} />
      <meshStandardMaterial color={color} roughness={roughness} />
    </mesh>
  );
};

export const Developer: React.FC<{readonly position?: Vec3; readonly pose?: Pose; readonly time?: number}> = ({position = JOHN.position, pose = {}, time = 0}) => {
  const th = useTheme();
  const m = useMemo(() => cineMaterials(th), [th]);
  const typing = pose.typing ?? 0;
  const lean = pose.lean ?? 0.15;
  const turn = pose.turn ?? 0;
  const reach = pose.reach ?? 0;
  const slump = pose.slump ?? 0;

  // Seat height and torso, leaning: the whole upper body pivots at the hips.
  const seatY = 0.47;
  const hipZ = 0.02; // relative to the chair's floor point
  const pivot: Vec3 = [0, seatY + 0.05, hipZ];
  const leanAngle = -0.12 - 0.22 * lean + 0.18 * slump; // negative = toward -z (the desk)
  const torsoH = 0.56 - 0.03 * slump;
  const shoulderY = pivot[1] + torsoH * Math.cos(leanAngle);
  const shoulderZ = pivot[2] + torsoH * Math.sin(leanAngle);
  const shoulderW = 0.2;
  const headY = shoulderY + 0.19 - 0.04 * slump;
  const headZ = shoulderZ - 0.03 - 0.05 * slump;

  // Hands on the keyboard (world positions relative to the chair point).
  const kb: Vec3 = [KEYBOARD.position[0] - position[0], KEYBOARD.position[1] - position[1] + 0.035, KEYBOARD.position[2] - position[2]];
  const drum = (phase: number) => (typing > 0 ? Math.max(0, Math.sin(time * 11 + phase)) * 0.012 * typing : 0);
  const leftHand: Vec3 = [kb[0] - 0.1, kb[1] + drum(0), kb[2] + 0.02];
  const mouse: Vec3 = [0.34 - position[0], 0.775 - position[1], 0.16 - position[2]];
  const rightHand: Vec3 = [lerp(kb[0] + 0.1, mouse[0], reach), lerp(kb[1] + drum(1.7), mouse[1] + 0.02, reach), lerp(kb[2] + 0.02, mouse[2], reach)];
  const leftShoulder: Vec3 = [-shoulderW, shoulderY - 0.02, shoulderZ];
  const rightShoulder: Vec3 = [shoulderW, shoulderY - 0.02, shoulderZ];
  const elbow = (sh: Vec3, hand: Vec3, side: number): Vec3 => [lerp(sh[0], hand[0], 0.45) + side * 0.08, lerp(sh[1], hand[1], 0.55) - 0.02, lerp(sh[2], hand[2], 0.42) + 0.06];
  const leftElbow = elbow(leftShoulder, leftHand, -1);
  const rightElbow = elbow(rightShoulder, rightHand, 1);

  const torsoGeo = useMemo(() => new RoundedBoxGeometry(0.4, torsoH, 0.22, 4, 0.08), [torsoH]);
  const seatGeo = useMemo(() => new RoundedBoxGeometry(0.5, 0.08, 0.5, 3, 0.03), []);
  const backGeo = useMemo(() => new RoundedBoxGeometry(0.46, 0.58, 0.07, 3, 0.03), []);

  return (
    <group position={V(position)}>
      {/* ---- chair ---- */}
      <group>
        {Array.from({length: 5}, (_, i) => (
          <mesh key={i} position={[Math.cos((i / 5) * Math.PI * 2) * 0.17, 0.03, Math.sin((i / 5) * Math.PI * 2) * 0.17]} rotation={[0, -(i / 5) * Math.PI * 2, 0]} castShadow>
            <boxGeometry args={[0.34, 0.03, 0.04]} />
            <meshStandardMaterial color={m.plasticDark} roughness={0.5} metalness={0.3} />
          </mesh>
        ))}
        <mesh position={[0, 0.25, 0]} castShadow>
          <cylinderGeometry args={[0.025, 0.03, 0.42, 16]} />
          <meshStandardMaterial color={m.steelDark} roughness={0.4} metalness={0.7} />
        </mesh>
        <mesh geometry={seatGeo} position={[0, seatY - 0.02, hipZ]} castShadow receiveShadow>
          <meshStandardMaterial color={m.plasticDark} roughness={0.75} />
        </mesh>
        <mesh geometry={backGeo} position={[0, seatY + 0.36, hipZ + 0.26]} rotation={[0.12, 0, 0]} castShadow>
          <meshStandardMaterial color={m.plasticDark} roughness={0.75} />
        </mesh>
        {[-1, 1].map((s) => (
          <group key={s}>
            <mesh position={[s * 0.27, seatY + 0.1, hipZ + 0.04]} castShadow>
              <boxGeometry args={[0.03, 0.22, 0.03]} />
              <meshStandardMaterial color={m.plasticDark} roughness={0.6} />
            </mesh>
            <mesh position={[s * 0.27, seatY + 0.22, hipZ]} castShadow>
              <boxGeometry args={[0.06, 0.025, 0.26]} />
              <meshStandardMaterial color={m.plasticDark} roughness={0.6} />
            </mesh>
          </group>
        ))}
      </group>

      {/* ---- legs: thighs forward under the desk, shins down ---- */}
      <Limb a={[-0.09, seatY + 0.03, hipZ]} b={[-0.1, seatY + 0.02, hipZ - 0.44]} r={0.065} color={m.denim} />
      <Limb a={[0.09, seatY + 0.03, hipZ]} b={[0.1, seatY + 0.02, hipZ - 0.44]} r={0.065} color={m.denim} />
      <Limb a={[-0.1, seatY + 0.02, hipZ - 0.44]} b={[-0.1, 0.06, hipZ - 0.5]} r={0.05} color={m.denim} />
      <Limb a={[0.1, seatY + 0.02, hipZ - 0.44]} b={[0.1, 0.06, hipZ - 0.5]} r={0.05} color={m.denim} />
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.1, 0.03, hipZ - 0.56]} castShadow>
          <boxGeometry args={[0.09, 0.06, 0.22]} />
          <meshStandardMaterial color="#14161C" roughness={0.6} />
        </mesh>
      ))}

      {/* ---- torso (hoodie), leaning from the hips ---- */}
      <group position={V(pivot)} rotation={[leanAngle, 0, 0]}>
        <mesh geometry={torsoGeo} position={[0, torsoH / 2, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={m.fabric} roughness={0.92} />
        </mesh>
        {/* hood, bunched behind the neck */}
        <mesh position={[0, torsoH - 0.02, 0.1]} rotation={[0.5, 0, 0]} castShadow>
          <torusGeometry args={[0.11, 0.045, 8, 18, Math.PI * 1.25]} />
          <meshStandardMaterial color={m.fabric} roughness={0.92} />
        </mesh>
        {/* kangaroo pocket seam and the drawstrings */}
        <mesh position={[0, torsoH * 0.35, -0.112]}>
          <boxGeometry args={[0.22, 0.01, 0.004]} />
          <meshStandardMaterial color={m.denim} roughness={0.95} />
        </mesh>
      </group>

      {/* ---- head: neck, hair, headphones ---- */}
      <Limb a={[0, shoulderY - 0.02, shoulderZ]} b={[0, headY - 0.1, headZ]} r={0.035} color={m.skin} roughness={0.9} />
      <group position={[0, headY, headZ]} rotation={[0.12 + 0.3 * slump, turn, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.105, 28, 20]} />
          <meshStandardMaterial color={m.skin} roughness={0.9} />
        </mesh>
        {/* hair: a cap and a back volume */}
        <mesh position={[0, 0.02, 0.012]} scale={[1.02, 0.95, 1.04]} castShadow>
          <sphereGeometry args={[0.108, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
          <meshStandardMaterial color={m.hair} roughness={0.95} />
        </mesh>
        {/* headphones: band and two cups */}
        <mesh rotation={[0, 0, 0]} position={[0, 0.03, 0]}>
          <torusGeometry args={[0.118, 0.011, 8, 28, Math.PI]} />
          <meshStandardMaterial color="#15171E" roughness={0.5} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.118, -0.005, 0.005]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.04, 0.04, 0.028, 20]} />
            <meshStandardMaterial color="#15171E" roughness={0.5} />
          </mesh>
        ))}
      </group>

      {/* ---- arms ---- */}
      <Limb a={leftShoulder} b={leftElbow} r={0.055} color={m.fabric} />
      <Limb a={rightShoulder} b={rightElbow} r={0.055} color={m.fabric} />
      <Limb a={leftElbow} b={leftHand} r={0.042} color={m.fabric} />
      <Limb a={rightElbow} b={rightHand} r={0.042} color={m.fabric} />
      <mesh position={V(leftHand)} scale={[1.1, 0.6, 1.3]} castShadow>
        <sphereGeometry args={[0.045, 16, 12]} />
        <meshStandardMaterial color={m.skin} roughness={0.9} />
      </mesh>
      <mesh position={V(rightHand)} scale={[1.1, 0.6, 1.3]} castShadow>
        <sphereGeometry args={[0.045, 16, 12]} />
        <meshStandardMaterial color={m.skin} roughness={0.9} />
      </mesh>
    </group>
  );
};
