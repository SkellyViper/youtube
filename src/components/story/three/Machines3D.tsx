import React, {useMemo} from 'react';
import * as THREE from 'three';
import {useTheme} from '../../../styles/ThemeContext';
import {AgentCore3D} from '../../cyber/three/AgentCore3D';
import {hdr, hdrMix, structureProps} from '../../cyber/three/materials';
import type {Vec3} from '../../cyber/three/rig';
import {blink, clamp01} from '../math';

/**
 * Recognisable computers in 3D, the counterparts of ../Machines.tsx.
 * Each is a dark solid with a few lit details, so it reads by silhouette and
 * by one or two lights, never by glow alone.
 *
 *   rack    tall cabinet, LED column, an open bay at chest height.
 *   tower   desktop case with a lit power strip and a window.
 *   gpu     wide compute box with two fan rings.
 *   laptop  open laptop; the process shows on its screen.
 *
 * Props:
 *   power   0..1 LED brightness.  agent 0..1 the process inside (assembles).
 *   threat  0..1 the process turns red.  time seconds of motion.
 *   bay     where the process sits, local units (see layout BAY).
 */
export type Machine3DProps = {
  readonly kind: 'rack' | 'tower' | 'gpu' | 'laptop';
  readonly position: Vec3;
  readonly yaw?: number;
  readonly power?: number;
  readonly agent?: number;
  readonly agentEnergy?: number;
  readonly threat?: number;
  readonly time?: number;
  readonly seed?: number;
  readonly bay: readonly [number, number, number];
  /** Fewer agent segments for far machines. */
  readonly lite?: boolean;
};

const Box: React.FC<{readonly size: Vec3; readonly position?: Vec3; readonly color?: string; readonly emissive?: THREE.Color}> = ({size, position = [0, 0, 0], color, emissive}) => (
  <mesh position={position as [number, number, number]}>
    <boxGeometry args={size as [number, number, number]} />
    {emissive ? <meshBasicMaterial color={emissive} /> : <meshStandardMaterial {...structureProps} color={color ?? structureProps.color} />}
  </mesh>
);

export const Machine3D: React.FC<Machine3DProps> = ({kind, position, yaw = 0, power = 1, agent = 0, agentEnergy = 1, threat = 0, time = 0, seed = 0, bay, lite = false}) => {
  const th = useTheme();
  const a = clamp01(agent);
  const statusHex = a > 0.5 ? (threat > 0.5 ? th.tone.threat.base : th.tone.mind.base) : th.tone.system.base;
  const status = useMemo(() => hdr(statusHex, 0.7 + 1.1 * power), [statusHex, power]);
  const led = (i: number) => hdrMix(statusHex, th.color.white, 0.2, (0.2 + 0.55 * blink(seed * 7 + i, time, 0.9 + (i % 3) * 0.25, 0.6)) * power);
  const slate = th.color.slate;
  const face = th.color.steel;
  const agentScale = kind === 'rack' ? 0.3 : kind === 'laptop' ? 0.22 : 0.2;
  const body = (() => {
    switch (kind) {
      case 'rack':
        return (
          <>
            <Box size={[1.0, 2.2, 0.9]} position={[0, 1.1, 0]} color={slate} />
            <Box size={[0.9, 2.1, 0.02]} position={[0, 1.1, 0.45]} color={face} />
            {Array.from({length: 6}, (_, i) => (
              <Box key={`u${i}`} size={[0.78, 0.015, 0.03]} position={[-0.03, 0.3 + i * 0.26 + (i > 3 ? 0.46 : 0), 0.46]} color={slate} />
            ))}
            {/* front plate with a dark bay recess */}
            <Box size={[0.8, 0.46, 0.06]} position={[0, 1.42, 0.44]} emissive={hdr(th.color.void, 1)} />
            {Array.from({length: 7}, (_, i) => (
              <Box key={i} size={[0.05, 0.03, 0.02]} position={[0.38, 0.35 + i * 0.26 + (i > 3 ? 0.4 : 0), 0.46]} emissive={led(i)} />
            ))}
            <Box size={[0.8, 0.02, 0.02]} position={[0, 1.66, 0.46]} emissive={status} />
          </>
        );
      case 'tower':
        return (
          <>
            <Box size={[0.5, 1.0, 0.5]} position={[0, 0.5, 0]} color={slate} />
            <Box size={[0.44, 0.94, 0.02]} position={[0, 0.5, 0.25]} color={face} />
            <Box size={[0.34, 0.3, 0.04]} position={[0, 0.62, 0.25]} emissive={hdr(th.color.void, 1)} />
            <Box size={[0.26, 0.02, 0.02]} position={[0, 0.92, 0.26]} emissive={status} />
            <Box size={[0.03, 0.03, 0.02]} position={[-0.18, 0.2, 0.26]} emissive={led(0)} />
          </>
        );
      case 'gpu':
        return (
          <>
            <Box size={[1.5, 0.6, 0.9]} position={[0, 0.3, 0]} color={slate} />
            <Box size={[1.44, 0.54, 0.02]} position={[0, 0.3, 0.45]} color={face} />
            <Box size={[0.5, 0.4, 0.04]} position={[0.3, 0.3, 0.45]} emissive={hdr(th.color.void, 1)} />
            {[-0.5, -0.2].map((fx, i) => (
              <mesh key={i} position={[fx, 0.3, 0.46]} rotation={[0, 0, time * 2.5 + i]}>
                <torusGeometry args={[0.16, 0.012, 6, 24]} />
                <meshBasicMaterial color={hdrMix(th.color.steel, statusHex, 0.5, 0.7 + 0.4 * power)} />
              </mesh>
            ))}
            <Box size={[0.3, 0.02, 0.02]} position={[0.5, 0.54, 0.46]} emissive={status} />
          </>
        );
      case 'laptop':
        return (
          <>
            <Box size={[0.9, 0.05, 0.62]} position={[0, 0.025, 0]} color={slate} />
            <group position={[0, 0.05, -0.3]} rotation={[-0.32, 0, 0]}>
              <Box size={[0.9, 0.6, 0.04]} position={[0, 0.3, 0]} color={slate} />
              <Box size={[0.8, 0.5, 0.01]} position={[0, 0.3, 0.025]} emissive={hdrMix(th.color.void, statusHex, 0.18 + 0.5 * a, 1.2 * power)} />
            </group>
            <Box size={[0.08, 0.02, 0.02]} position={[0.38, 0.06, 0.31]} emissive={led(1)} />
          </>
        );
    }
  })();
  return (
    <group position={position as [number, number, number]} rotation={[0, yaw, 0]}>
      {body}
      {a > 0.001 ? <AgentCore3D position={bay} scale={agentScale} open={a} energy={agentEnergy} spin={time + seed} threat={threat} lite={lite} seed={seed} /> : null}
    </group>
  );
};
