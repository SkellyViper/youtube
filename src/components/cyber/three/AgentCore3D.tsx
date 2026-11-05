import React from 'react';
import * as THREE from 'three';
import {cyber} from '../../../styles/cyber';
import {useTheme} from '../../../styles/ThemeContext';
import {agentPalette} from '../../../styles/themes';
import {getHaloTexture, hdrMix} from './materials';
import type {Vec3} from './rig';

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const smooth = (t: number) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

type RingSpec = {
  readonly radius: number;
  readonly tube: number;
  /** Number of arc segments and the angle each one covers (radians). */
  readonly arcs: number;
  readonly sweep: number;
  /** Resting tilt of the ring's plane. */
  readonly tilt: readonly [number, number];
  /** Rotations per second-of-spin, signed. */
  readonly rate: number;
  /** Relative brightness. */
  readonly level: number;
};

const RINGS: readonly RingSpec[] = [
  {radius: 0.56, tube: 0.017, arcs: 3, sweep: 1.62, tilt: [1.02, 0.28], rate: 0.11, level: 1},
  {radius: 0.78, tube: 0.012, arcs: 2, sweep: 2.55, tilt: [-0.46, 0.94], rate: -0.07, level: 0.8},
  {radius: 1.0, tube: 0.008, arcs: 4, sweep: 0.98, tilt: [0.16, -0.36], rate: 0.045, level: 0.55},
];

/**
 * The channel's recurring picture of an AI agent: a "gimbal iris".
 * A small white-hot core, a faceted shell around it, and three broken rings
 * on different axes that turn at different rates, like an instrument that
 * keeps re-orienting itself. No face, no robot.
 *
 * It is a pure function of its props:
 *   open    0 -> 1  assembles: shell, then rings from the inside out
 *   energy  0 dark, 1 working, up to ~1.6 for a flare
 *   spin    seconds of motion (pass `useActiveTime()` or a beat's time)
 *   threat  0 -> 1  purple to red; the rings fall out of their resting planes
 *   calm    0 -> 1  blue "idle system" tint (0 = purple, the default)
 *   facing  0 -> 1  rings rotate into one plane facing +z (the "it is looking at you" pose)
 *
 * Unit size: outer ring radius = 1 x `scale`.
 */
export const AgentCore3D: React.FC<{
  readonly position?: Vec3;
  readonly scale?: number;
  readonly open?: number;
  readonly energy?: number;
  readonly spin?: number;
  readonly threat?: number;
  readonly calm?: number;
  readonly facing?: number;
  /** Fewer rings / segments, for crowds. */
  readonly lite?: boolean;
  /** Soft additive halo sprite behind the core. */
  readonly halo?: boolean;
  readonly seed?: number;
}> = ({position = [0, 0, 0], scale = 1, open = 1, energy = 1, spin = 0, threat = 0, calm = 0, facing = 0, lite = false, halo = true, seed = 0}) => {
  const theme = useTheme();
  if (open <= 0.001) return null;
  const {emissive} = cyber;
  const c = agentPalette(theme);
  const base = threat > 0 ? c.red : c.purple;
  const mid = calm > 0 && threat <= 0 ? c.blue : c.purple;
  const blend = threat > 0 ? threat : 0;
  // Red clips to pink when pushed hard, so threat rings stay on the pure red.
  const hot = threat > 0 ? c.red : c.purpleHot;
  const midHot = calm > 0 && threat <= 0 ? c.blueHot : c.purpleHot;
  const calmK = threat > 0 ? 0 : calm;

  /** Body colour at a brightness. Purple by default, towards blue with `calm`, towards red with `threat`. */
  const body = (intensity: number) =>
    hdrMix(c.purple, mid, calmK, 1).lerp(new THREE.Color(base), blend).multiplyScalar(Math.max(0, intensity));
  const bright = (intensity: number) =>
    hdrMix(c.purpleHot, midHot, calmK, 1).lerp(new THREE.Color(hot), blend).multiplyScalar(Math.max(0, intensity));

  const e = Math.max(0, energy);
  const coreOpen = smooth(open / 0.35);
  const shellOpen = smooth((open - 0.1) / 0.4);
  const phase = seed * 1.7;
  const rings = lite ? RINGS.slice(0, 2) : RINGS;

  return (
    <group position={position as [number, number, number]} scale={scale}>
      {halo ? (
        <sprite scale={[3.0, 3.0, 1]} renderOrder={2}>
          <spriteMaterial
            map={getHaloTexture()}
            color={body(0.2 * e * coreOpen)}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            fog={false}
          />
        </sprite>
      ) : null}

      {/* Core: the only white-hot thing in the frame. */}
      <mesh scale={0.17 * coreOpen * (0.9 + 0.1 * Math.min(e, 1.6))} rotation={[spin * 0.4 + phase, spin * 0.3, 0]}>
        <icosahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color={bright(emissive.hot * (0.25 + 0.75 * Math.min(e, 1.6)))} />
      </mesh>

      {/* Faceted shell. */}
      {shellOpen > 0 ? (
        <mesh scale={0.33 * (0.6 + 0.4 * shellOpen)} rotation={[-spin * 0.21 + phase, spin * 0.17, spin * 0.09]}>
          <icosahedronGeometry args={[1, lite ? 0 : 1]} />
          <meshBasicMaterial color={body(emissive.base * shellOpen * (0.35 + 0.65 * Math.min(e, 1.3)))} wireframe transparent opacity={0.9} />
        </mesh>
      ) : null}

      {/* Gimbal rings. */}
      {rings.map((ring, k) => {
        const p = smooth((open - 0.22 - k * 0.16) / 0.46);
        if (p <= 0) return null;
        // Threat pulls each ring out of its resting plane by a different amount.
        const wobble = threat * (0.55 + 0.3 * k) * Math.sin(spin * (1.1 + 0.37 * k) + k * 2.1 + phase);
        const tiltX = (ring.tilt[0] + wobble) * (1 - facing) + (1 - p) * 1.4;
        const tiltY = (ring.tilt[1] - wobble * 0.7) * (1 - facing) - (1 - p) * 0.9;
        const turn = spin * ring.rate * Math.PI * 2 * (1 + threat * 1.6) + phase + k;
        const level = emissive.strong * ring.level * p * (0.3 + 0.7 * Math.min(e, 1.4)) * (1 - 0.3 * threat);
        const gap = (Math.PI * 2) / ring.arcs;
        return (
          <group key={k} rotation={[tiltX, tiltY, 0]} scale={0.55 + 0.45 * p}>
            <group rotation={[0, 0, turn]}>
              {Array.from({length: ring.arcs}, (_, i) => (
                <mesh key={i} rotation={[0, 0, i * gap]}>
                  <torusGeometry args={[ring.radius, ring.tube, lite ? 5 : 8, lite ? 20 : 40, ring.sweep]} />
                  <meshBasicMaterial color={k === 0 ? bright(level) : body(level)} />
                </mesh>
              ))}
            </group>
          </group>
        );
      })}
    </group>
  );
};
