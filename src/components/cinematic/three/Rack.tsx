import React, {useLayoutEffect, useMemo} from 'react';
import * as THREE from 'three';
import {useTheme} from '../../../styles/ThemeContext';
import {AgentCore3D} from '../../cyber/three/AgentCore3D';
import type {Vec3} from '../../cyber/three/rig';
import {blink} from '../../story/math';
import {HALL} from '../world';
import {cineMaterials, lit, litMix, perforationTexture} from './materials';

/**
 * A server rack that looks like a server rack: a 42U cabinet with an open
 * front showing stacked servers, each with a faceplate, handles, a power LED
 * and an activity LED; a perforated top vent; a cable bundle leaving the top
 * toward the overhead tray. The machine reads by shape and by a handful of
 * small lights, not by glow.
 *
 * State (all 0..1):
 *   power     the rack is on: power LEDs steady
 *   activity  how busy: activity LEDs blink faster and brighter
 *   agent     the process we are telling the story about lives here: the
 *             activity colour shifts to the agent's tone and, in the hero
 *             detail, the gimbal iris sits in the open 2U bay
 *   threat    the agent's colour shifts to red
 *   open      0..1 the bay's front slides open to show the process
 */
export type RackState = {
  readonly power?: number;
  readonly activity?: number;
  readonly agent?: number;
  readonly threat?: number;
  readonly open?: number;
};

const R = HALL.rack;
const UNITS = 11;
const UNIT_H = 0.0875;
const FACE_W = R.width - 0.1;
const FIRST_U_Y = 0.22;
/** The open bay (where the hero process is shown): unit index and local position. */
export const BAY_UNIT = 5;
export const BAY_LOCAL: Vec3 = [0, FIRST_U_Y + BAY_UNIT * (UNIT_H * 1.25) + UNIT_H, R.depth / 2 - 0.12];

const V = (v: Vec3): [number, number, number] => [v[0], v[1], v[2]];

export const unitY = (i: number) => FIRST_U_Y + i * (UNIT_H * 1.25) + (i > BAY_UNIT ? UNIT_H : 0);

/**
 * LED colours for a rack state at a time. Activity blinks deterministically
 * from (seed, time).
 */
export const rackLeds = (th: ReturnType<typeof useTheme>, s: RackState, time: number, seed: number) => {
  const power = Math.min(1, Math.max(0, s.power ?? 1));
  const activity = Math.min(1, Math.max(0, s.activity ?? 0.3));
  const agent = Math.min(1, Math.max(0, s.agent ?? 0));
  const threat = Math.min(1, Math.max(0, s.threat ?? 0));
  const actHex = agent > 0.01 ? (threat > 0.01 ? th.tone.threat.base : th.tone.mind.base) : th.tone.system.base;
  const actMix = agent;
  return {
    power,
    activity,
    agent,
    threat,
    powerColor: lit(th.tone.system.base, 1.3 * power),
    activityColor: (unit: number) => {
      const rate = 0.6 + 2.6 * activity + 1.6 * agent;
      const b = blink(seed * 13 + unit * 3.7, time, rate, 0.45 + 0.4 * activity);
      const level = power * (0.3 + (0.6 + 2.2 * activity + 1.4 * agent) * b);
      return litMix(th.tone.system.base, actHex, actMix, level);
    },
  };
};

/** The detailed rack for close and medium shots. */
export const Rack: React.FC<{readonly position: Vec3; readonly yaw?: number; readonly state?: RackState; readonly time?: number; readonly seed?: number; readonly showAgent?: boolean}> = ({position, yaw = 0, state = {}, time = 0, seed = 0, showAgent = true}) => {
  const th = useTheme();
  const m = useMemo(() => cineMaterials(th), [th]);
  const leds = rackLeds(th, state, time, seed);
  const open = Math.min(1, Math.max(0, state.open ?? 0));
  const agent = leds.agent;
  const perf = useMemo(() => perforationTexture(), []);
  const units = useMemo(() => Array.from({length: UNITS}, (_, i) => ({i, tall: i % 4 === 2})), []);
  return (
    <group position={V(position)} rotation={[0, yaw, 0]}>
      {/* Cabinet: an open front. Two side panels, a top, a plinth and a deep core behind the servers. */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (R.width / 2 - 0.012), R.height / 2, -0.02]} castShadow receiveShadow>
          <boxGeometry args={[0.024, R.height, R.depth - 0.04]} />
          <meshStandardMaterial color={m.rackBody} roughness={0.55} metalness={0.35} />
        </mesh>
      ))}
      <mesh position={[0, R.height - 0.015, -0.02]} castShadow>
        <boxGeometry args={[R.width, 0.03, R.depth - 0.04]} />
        <meshStandardMaterial color={m.rackBody} roughness={0.55} metalness={0.35} />
      </mesh>
      <mesh position={[0, 0.06, -0.02]} castShadow receiveShadow>
        <boxGeometry args={[R.width, 0.12, R.depth - 0.04]} />
        <meshStandardMaterial color={m.rackBody} roughness={0.55} metalness={0.35} />
      </mesh>
      <mesh position={[0, R.height / 2, -0.16]} castShadow receiveShadow>
        <boxGeometry args={[R.width - 0.05, R.height - 0.15, 0.72]} />
        <meshStandardMaterial color={m.rackBody} roughness={0.55} metalness={0.35} />
      </mesh>
      {/* Front rails */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (FACE_W / 2 + 0.018), R.height / 2, R.depth / 2 - 0.03]}>
          <boxGeometry args={[0.03, R.height - 0.1, 0.05]} />
          <meshStandardMaterial color={m.rackRail} roughness={0.5} metalness={0.5} />
        </mesh>
      ))}
      {/* Inner dark cavity behind the servers */}
      <mesh position={[0, R.height / 2, R.depth / 2 - 0.35]}>
        <boxGeometry args={[FACE_W, R.height - 0.1, 0.02]} />
        <meshStandardMaterial color="#05060A" roughness={1} />
      </mesh>
      {/* Top vent */}
      <mesh position={[0, R.height + 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[R.width - 0.08, R.depth - 0.2]} />
        <meshStandardMaterial map={perf} color={m.rackFace} roughness={0.6} metalness={0.4} />
      </mesh>
      {/* Servers */}
      {units.map(({i, tall}) => {
        const y = unitY(i);
        const h = tall ? UNIT_H * 2 - 0.01 : UNIT_H - 0.008;
        const z = R.depth / 2 - 0.08;
        const isBay = i === BAY_UNIT;
        return (
          <group key={i} position={[0, y + (tall ? UNIT_H / 2 : 0), 0]}>
            {isBay ? (
              /* The open bay: a 2U sled whose front plate slides open */
              <group>
                <mesh position={[0, UNIT_H / 2, z - 0.26]}>
                  <boxGeometry args={[FACE_W - 0.02, UNIT_H * 2 - 0.02, 0.5]} />
                  <meshStandardMaterial color="#0A0C12" roughness={0.8} metalness={0.3} />
                </mesh>
                <mesh position={[0, UNIT_H / 2, z]} rotation={[0, 0, 0]}>
                  <boxGeometry args={[FACE_W - 0.02, UNIT_H * 2 - 0.02, 0.012]} />
                  <meshStandardMaterial color="#070A12" roughness={0.15} metalness={0.2} transparent opacity={0.55} />
                </mesh>
                {open < 0.995 ? (
                  /* Never scale a mesh to exactly 0: a singular matrix makes NaN normals, and bloom spreads a NaN over the whole frame. */
                  <mesh position={[-(FACE_W - 0.02) / 2 + (1 - open) * (FACE_W - 0.02) * 0.5, UNIT_H / 2, z + 0.004]} scale={[Math.max(0.002, 1 - open), 1, 1]}>
                    <boxGeometry args={[FACE_W - 0.02, UNIT_H * 2 - 0.02, 0.014]} />
                    <meshStandardMaterial color={m.rackFace} roughness={0.5} metalness={0.5} />
                  </mesh>
                ) : null}
                {/* a strip of green/blue drive LEDs across the sled */}
                {Array.from({length: 8}, (_, k) => (
                  <mesh key={k} position={[-FACE_W / 2 + 0.06 + k * 0.055, UNIT_H * 1.55, z + 0.012]}>
                    <planeGeometry args={[0.012, 0.006]} />
                    <meshBasicMaterial color={leds.activityColor(20 + k)} />
                  </mesh>
                ))}
                {showAgent && agent > 0.001 && open > 0.02 ? (
                  <AgentCore3D position={[0, UNIT_H * 0.95, z - 0.14]} scale={0.085 * Math.min(1, 0.4 + 0.6 * open)} open={agent} energy={0.9 + 0.5 * leds.activity} spin={time + seed} threat={leds.threat} seed={seed} halo={false} />
                ) : null}
              </group>
            ) : (
              <group>
                <mesh position={[0, h / 2, z]} castShadow>
                  <boxGeometry args={[FACE_W, h, 0.03]} />
                  <meshStandardMaterial color={m.rackFace} roughness={0.5} metalness={0.5} />
                </mesh>
                {/* ventilation strip */}
                <mesh position={[0.02, h / 2, z + 0.016]}>
                  <planeGeometry args={[FACE_W * 0.55, h * 0.5]} />
                  <meshStandardMaterial map={perf} color="#1A1E28" roughness={0.7} metalness={0.3} />
                </mesh>
                {/* handles */}
                {[-1, 1].map((s) => (
                  <mesh key={s} position={[s * (FACE_W / 2 - 0.03), h / 2, z + 0.02]}>
                    <boxGeometry args={[0.012, h * 0.6, 0.01]} />
                    <meshStandardMaterial color={m.rackRail} roughness={0.4} metalness={0.6} />
                  </mesh>
                ))}
                {/* power + activity LEDs */}
                <mesh position={[-FACE_W / 2 + 0.07, h * 0.5, z + 0.017]}>
                  <planeGeometry args={[0.008, 0.008]} />
                  <meshBasicMaterial color={leds.powerColor} />
                </mesh>
                <mesh position={[-FACE_W / 2 + 0.09, h * 0.5, z + 0.017]}>
                  <planeGeometry args={[0.008, 0.008]} />
                  <meshBasicMaterial color={leds.activityColor(i)} />
                </mesh>
              </group>
            )}
          </group>
        );
      })}
      {/* Cable bundle leaving the top toward the tray */}
      {[-0.08, 0, 0.08].map((dx, k) => (
        <mesh key={k} position={[dx, R.height + 0.12, -0.3]} rotation={[0.25, 0, dx * 1.5]}>
          <cylinderGeometry args={[0.008, 0.008, 0.3, 8]} />
          <meshStandardMaterial color="#1D2230" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
};

/**
 * A row of racks in two instanced draws (cabinets, faceplates) plus an
 * instanced LED field with per-instance colour. For halls of dozens of racks.
 * `stateOf(index)` gives each rack its state; LED colours are refreshed every
 * frame from `time`.
 */
export const RackRow: React.FC<{
  readonly positions: readonly Vec3[];
  readonly yaw: number;
  readonly stateOf: (i: number) => RackState;
  readonly time?: number;
  readonly seed?: number;
}> = ({positions, yaw, stateOf, time = 0, seed = 0}) => {
  const th = useTheme();
  const m = useMemo(() => cineMaterials(th), [th]);
  const n = positions.length;
  const meshes = useMemo(() => {
    const o = new THREE.Object3D();
    const bodyMat = new THREE.MeshStandardMaterial({color: m.rackBody, roughness: 0.55, metalness: 0.35});
    // The cabinet core sits behind the servers; sides and top enclose them, so the front is open.
    const cab = new THREE.InstancedMesh(new THREE.BoxGeometry(R.width - 0.05, R.height - 0.15, 0.72), bodyMat, n);
    cab.castShadow = true;
    cab.receiveShadow = true;
    const side = new THREE.InstancedMesh(new THREE.BoxGeometry(0.024, R.height, R.depth - 0.04), bodyMat, n * 2);
    side.castShadow = true;
    side.receiveShadow = true;
    const top = new THREE.InstancedMesh(new THREE.BoxGeometry(R.width, 0.03, R.depth - 0.04), bodyMat, n);
    const plinth = new THREE.InstancedMesh(new THREE.BoxGeometry(R.width, 0.12, R.depth - 0.04), bodyMat, n);
    const face = new THREE.InstancedMesh(new THREE.BoxGeometry(FACE_W, UNIT_H - 0.008, 0.03), new THREE.MeshStandardMaterial({color: m.rackFace, roughness: 0.5, metalness: 0.5}), n * UNITS);
    const led = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.014, 0.011), new THREE.MeshBasicMaterial({color: '#ffffff'}), n * UNITS * 2);
    const vent = new THREE.InstancedMesh(new THREE.PlaneGeometry(FACE_W * 0.5, (UNIT_H - 0.008) * 0.45), new THREE.MeshStandardMaterial({color: '#0E1119', roughness: 0.9}), n * UNITS);
    let f = 0;
    let l = 0;
    positions.forEach((p, i) => {
      o.position.set(p[0], p[1] + R.height / 2, p[2]);
      o.rotation.set(0, yaw, 0);
      o.translateZ(-0.16);
      o.updateMatrix();
      cab.setMatrixAt(i, o.matrix);
      for (let s = 0; s < 2; s++) {
        o.position.set(p[0], p[1] + R.height / 2, p[2]);
        o.rotation.set(0, yaw, 0);
        o.translateZ(-0.02);
        o.translateX((s === 0 ? -1 : 1) * (R.width / 2 - 0.012));
        o.updateMatrix();
        side.setMatrixAt(i * 2 + s, o.matrix);
      }
      o.position.set(p[0], p[1] + R.height - 0.015, p[2]);
      o.rotation.set(0, yaw, 0);
      o.translateZ(-0.02);
      o.updateMatrix();
      top.setMatrixAt(i, o.matrix);
      o.position.set(p[0], p[1] + 0.06, p[2]);
      o.rotation.set(0, yaw, 0);
      o.translateZ(-0.02);
      o.updateMatrix();
      plinth.setMatrixAt(i, o.matrix);
      for (let u = 0; u < UNITS; u++) {
        const y = unitY(u) + (UNIT_H - 0.008) / 2;
        o.position.set(p[0], p[1] + y, p[2]);
        o.rotation.set(0, yaw, 0);
        o.translateZ(R.depth / 2 - 0.08);
        o.updateMatrix();
        face.setMatrixAt(f, o.matrix);
        o.position.set(p[0], p[1] + y, p[2]);
        o.rotation.set(0, yaw, 0);
        o.translateZ(R.depth / 2 - 0.08 + 0.016);
        o.translateX(0.03);
        o.updateMatrix();
        vent.setMatrixAt(f++, o.matrix);
        for (let k = 0; k < 2; k++) {
          o.position.set(p[0], p[1] + y, p[2]);
          o.rotation.set(0, yaw, 0);
          o.translateZ(R.depth / 2 - 0.08 + 0.017);
          o.translateX(-FACE_W / 2 + 0.06 + k * 0.024);
          o.updateMatrix();
          led.setMatrixAt(l++, o.matrix);
        }
      }
    });
    cab.instanceMatrix.needsUpdate = true;
    side.instanceMatrix.needsUpdate = true;
    top.instanceMatrix.needsUpdate = true;
    plinth.instanceMatrix.needsUpdate = true;
    face.instanceMatrix.needsUpdate = true;
    vent.instanceMatrix.needsUpdate = true;
    led.instanceMatrix.needsUpdate = true;
    return {cab, side, top, plinth, face, vent, led};
  }, [positions, yaw, n, m.rackBody, m.rackFace]);

  // Per-frame LED colours.
  useLayoutEffect(() => {
    let l = 0;
    for (let i = 0; i < n; i++) {
      const leds = rackLeds(th, stateOf(i), time, seed + i);
      for (let u = 0; u < UNITS; u++) {
        meshes.led.setColorAt(l++, leds.powerColor);
        meshes.led.setColorAt(l++, leds.activityColor(u));
      }
    }
    if (meshes.led.instanceColor) meshes.led.instanceColor.needsUpdate = true;
  });

  useLayoutEffect(
    () => () => {
      meshes.cab.geometry.dispose();
      meshes.side.geometry.dispose();
      meshes.top.geometry.dispose();
      meshes.plinth.geometry.dispose();
      meshes.face.geometry.dispose();
      meshes.vent.geometry.dispose();
      meshes.led.geometry.dispose();
    },
    [meshes],
  );

  return (
    <group>
      <primitive object={meshes.cab} />
      <primitive object={meshes.side} />
      <primitive object={meshes.top} />
      <primitive object={meshes.plinth} />
      <primitive object={meshes.face} />
      <primitive object={meshes.vent} />
      <primitive object={meshes.led} />
    </group>
  );
};
