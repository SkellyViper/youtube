import React, {useLayoutEffect, useMemo} from 'react';
import * as THREE from 'three';
import {createRandom} from '../../random';
import {mix} from '../../../styles/cyber';
import {useTheme} from '../../../styles/ThemeContext';
import {AgentCore3D} from '../../cyber/three/AgentCore3D';
import {getHaloTexture} from '../../cyber/three/materials';
import type {Vec3} from '../../cyber/three/rig';
import {curveThrough} from '../../cyber/three/Signal3D';
import {blink} from '../../story/math';
import {cineMaterials, litMix, perforationTexture} from './materials';

/**
 * A comms closet off a data hall: a small partitioned room with a doorway, a
 * shelf, an old desktop tower on the shelf with a tangle of cables, a dusty
 * cardboard box or two, and one blinking LED. Nobody turned the light on.
 *
 * It is the machine the inventory does not know about. The tower's front bay
 * cover is missing and the gimbal iris (the channel's picture of an AI) sits
 * in the opening, so the viewer recognises the same character as everywhere
 * else: inside a machine, never floating.
 *
 * Local frame: origin on the floor at the centre of the footprint, the door
 * wall at +z. Position and rotate the group to place it in a hall.
 *
 *   doorOpen  0 closed .. 1 the leaf swung out into the hall
 *   agent     0..1 the iris is present and lit; its purple light spills out
 *   energy    the iris's working level (1 = steady)
 */
export type ClosetProps = {
  readonly position?: Vec3;
  readonly yaw?: number;
  readonly width?: number;
  readonly depth?: number;
  readonly height?: number;
  readonly doorWidth?: number;
  readonly doorHeight?: number;
  readonly doorOpen?: number;
  readonly agent?: number;
  readonly energy?: number;
  readonly time?: number;
  readonly seed?: number;
};

const T = 0.12;

/** A dark rubber cable along a smooth curve. */
const RubberCable: React.FC<{readonly points: readonly Vec3[]; readonly radius?: number; readonly color: string}> = ({points, radius = 0.006, color}) => {
  const geo = useMemo(() => new THREE.TubeGeometry(curveThrough(points, 0.5), 48, radius, 6, false), [points, radius]);
  useLayoutEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial color={color} roughness={0.9} metalness={0.05} />
    </mesh>
  );
};

/** The old tower. Local origin at the centre of its base; the front is +z. */
const Tower: React.FC<{readonly agent: number; readonly energy: number; readonly time: number; readonly seed: number}> = ({agent, energy, time, seed}) => {
  const th = useTheme();
  const m = useMemo(() => cineMaterials(th), [th]);
  const beige = useMemo(() => mix(m.paper, m.plastic, 0.58), [m.paper, m.plastic]);
  const beigeDark = useMemo(() => mix(m.paper, m.plastic, 0.72), [m.paper, m.plastic]);
  const perf = useMemo(() => perforationTexture(), []);
  const W = 0.19;
  const H = 0.44;
  const D = 0.46;
  const F = D / 2 + 0.01; // front plate z
  // The open bay: a double 5.25" slot whose cover is gone.
  const bayY = 0.33;
  const bayW = 0.15;
  const bayH = 0.09;
  const led = blink(seed * 7.3, time, 0.9, 0.55);
  const ledColor = litMix(th.tone.mind.deep, th.tone.mind.hot, led, (0.6 + 1.9 * led) * th.glow * (0.4 + 0.6 * agent));
  return (
    <group>
      {/* Case */}
      <mesh position={[0, H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[W, H, D]} />
        <meshStandardMaterial color={beige} roughness={0.75} metalness={0.05} />
      </mesh>
      {/* Front plate in four pieces around the open bay */}
      <mesh position={[0, (bayY + bayH / 2 + H) / 2, F]} castShadow>
        <boxGeometry args={[W, H - (bayY + bayH / 2), 0.02]} />
        <meshStandardMaterial color={beigeDark} roughness={0.7} metalness={0.05} />
      </mesh>
      <mesh position={[0, (bayY - bayH / 2) / 2, F]} castShadow>
        <boxGeometry args={[W, bayY - bayH / 2, 0.02]} />
        <meshStandardMaterial color={beigeDark} roughness={0.7} metalness={0.05} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * (W + bayW)) / 4, bayY, F]}>
          <boxGeometry args={[(W - bayW) / 2, bayH, 0.02]} />
          <meshStandardMaterial color={beigeDark} roughness={0.7} metalness={0.05} />
        </mesh>
      ))}
      {/* The bay's dark cavity, and the iris sitting in it */}
      <mesh position={[0, bayY, F - 0.12]}>
        <boxGeometry args={[bayW, bayH, 0.22]} />
        <meshStandardMaterial color="#05060A" roughness={1} side={THREE.BackSide} />
      </mesh>
      {agent > 0.001 ? <AgentCore3D position={[0, bayY, F - 0.045]} scale={0.042} open={agent} energy={energy} spin={time + seed} halo={false} seed={seed} /> : null}
      {/* A second, covered bay above, a floppy slot, the power button and the LED */}
      <mesh position={[0, bayY + bayH / 2 + 0.028, F + 0.012]}>
        <boxGeometry args={[bayW - 0.004, 0.04, 0.006]} />
        <meshStandardMaterial color={beige} roughness={0.7} metalness={0.05} />
      </mesh>
      <mesh position={[0, bayY - bayH / 2 - 0.03, F + 0.011]}>
        <planeGeometry args={[0.1, 0.006]} />
        <meshStandardMaterial color="#0A0B10" roughness={0.9} />
      </mesh>
      <mesh position={[0.04, 0.12, F + 0.014]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.01, 16]} />
        <meshStandardMaterial color={m.plasticDark} roughness={0.5} />
      </mesh>
      <mesh position={[-0.04, 0.12, F + 0.0115]}>
        <planeGeometry args={[0.012, 0.012]} />
        <meshBasicMaterial color={ledColor} />
      </mesh>
      {/* Vent grille low on the front */}
      <mesh position={[0, 0.05, F + 0.0105]}>
        <planeGeometry args={[0.12, 0.05]} />
        <meshStandardMaterial map={perf} color={beigeDark} roughness={0.8} />
      </mesh>
      {/* Feet */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * (W / 2 - 0.02), -0.008, sz * (D / 2 - 0.04)]}>
            <boxGeometry args={[0.03, 0.016, 0.03]} />
            <meshStandardMaterial color={m.plasticDark} roughness={0.8} />
          </mesh>
        )),
      )}
      {/* Rear: a PSU grille, ports and the cable stubs */}
      <mesh position={[0, H - 0.06, -D / 2 - 0.002]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[0.13, 0.07]} />
        <meshStandardMaterial map={perf} color={m.steelDark} roughness={0.6} metalness={0.5} />
      </mesh>
      {/* The agent's light leaving the bay */}
      <pointLight position={[0, bayY, F + 0.45]} intensity={(agent > 0.001) ? (1.0 * agent * (0.7 + 0.3 * energy)) : 0} color={th.tone.mind.base} distance={3.4} decay={2} />
    </group>
  );
};

const CardboardBox: React.FC<{readonly position: Vec3; readonly size: Vec3; readonly yaw?: number; readonly color: string; readonly tape: string}> = ({position, size, yaw = 0, color, tape}) => (
  <group position={[position[0], position[1], position[2]]} rotation={[0, yaw, 0]}>
    <mesh position={[0, size[1] / 2, 0]} castShadow receiveShadow>
      <boxGeometry args={[size[0], size[1], size[2]]} />
      <meshStandardMaterial color={color} roughness={1} metalness={0} />
    </mesh>
    {/* the tape seam on the lid and the two flap edges */}
    <mesh position={[0, size[1] + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[0.05, size[2] * 0.96]} />
      <meshStandardMaterial color={tape} roughness={0.6} />
    </mesh>
    {[-1, 1].map((s) => (
      <mesh key={s} position={[(s * size[0]) / 4, size[1] + 0.0005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.004, size[2] * 0.96]} />
        <meshStandardMaterial color="#1A1510" roughness={1} />
      </mesh>
    ))}
  </group>
);

export const Closet: React.FC<ClosetProps> = ({position = [0, 0, 0], yaw = 0, width = 2.2, depth = 1.8, height = 2.6, doorWidth = 1.0, doorHeight = 2.15, doorOpen = 1, agent = 1, energy = 1, time = 0, seed = 0}) => {
  const th = useTheme();
  const m = useMemo(() => cineMaterials(th), [th]);
  const W = width;
  const D = depth;
  const H = height;
  const DW = doorWidth;
  const DH = doorHeight;
  const frontZ = D / 2 - T / 2;
  const backZ = -D / 2 + T / 2;
  const shelfY = 0.9;
  const shelfD = 0.45;
  const shelfZ = -D / 2 + T + shelfD / 2;
  const cardboard = useMemo(() => mix(m.desk, m.paper, 0.42), [m.desk, m.paper]);
  const tape = useMemo(() => mix(m.paper, m.desk, 0.3), [m.desk, m.paper]);
  const towerPos: Vec3 = [-0.18, shelfY + 0.0175, shelfZ + 0.02];
  const towerYaw = 0.14;

  // The cable tangle: a bundle from the tower's back to a wall box and a strip, each with its own slack.
  const cables = useMemo(() => {
    const rnd = createRandom(911 + seed);
    const list: Vec3[][] = [];
    const back: Vec3 = [towerPos[0] - Math.sin(towerYaw) * 0.23, shelfY + 0.36, towerPos[2] - Math.cos(towerYaw) * 0.23];
    const box: Vec3 = [0.42, 1.42, -D / 2 + T + 0.015];
    for (let k = 0; k < 4; k++) {
      const j = () => rnd.range(-0.06, 0.06);
      const dip = rnd.range(0.12, 0.3);
      const dest: Vec3 = k < 3 ? [box[0] + rnd.range(-0.03, 0.03), box[1] + rnd.range(-0.03, 0.02), box[2] + 0.01] : [0.3, shelfY + 0.04, shelfZ + 0.12];
      list.push([
        [back[0] + j() * 0.3, back[1] - 0.05 + rnd.range(0, 0.06), back[2]],
        [back[0] + 0.12 + j(), back[1] - dip, back[2] + 0.1 + j()],
        [back[0] + 0.3 + j(), back[1] - dip * 0.6 + rnd.range(0, 0.1), back[2] + 0.05 + j()],
        dest,
      ]);
    }
    return list;
  }, [seed, towerPos, D]);

  // Hinged on the +x jamb and swung out into the hall, so a camera on the +x side sees the leaf's face, not its edge.
  const hinge = DW / 2 - 0.02;
  const swing = Math.min(1, Math.max(0, doorOpen)) * (Math.PI * 0.55);

  return (
    <group position={[position[0], position[1], position[2]]} rotation={[0, yaw, 0]}>
      {/* Partition walls: back, sides, front (two piers and a header), top slab */}
      <mesh position={[0, H / 2, backZ]} receiveShadow>
        <boxGeometry args={[W, H, T]} />
        <meshStandardMaterial color={m.wallDark} roughness={0.95} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (W / 2 - T / 2), H / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[T, H, D]} />
          <meshStandardMaterial color={m.wallDark} roughness={0.95} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * (W / 2 + DW / 2)) / 2, H / 2, frontZ]} castShadow receiveShadow>
          <boxGeometry args={[W / 2 - DW / 2, H, T]} />
          <meshStandardMaterial color={m.wallDark} roughness={0.95} />
        </mesh>
      ))}
      <mesh position={[0, (DH + H) / 2, frontZ]} castShadow>
        <boxGeometry args={[DW + 0.02, H - DH, T]} />
        <meshStandardMaterial color={m.wallDark} roughness={0.95} />
      </mesh>
      <mesh position={[0, H + 0.05, 0]} castShadow>
        <boxGeometry args={[W, 0.1, D]} />
        <meshStandardMaterial color={m.concrete} roughness={0.95} />
      </mesh>
      {/* Door frame */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (DW / 2 + 0.03), DH / 2, frontZ]} castShadow>
          <boxGeometry args={[0.06, DH, T + 0.04]} />
          <meshStandardMaterial color={m.steelDark} roughness={0.5} metalness={0.5} />
        </mesh>
      ))}
      <mesh position={[0, DH + 0.03, frontZ]} castShadow>
        <boxGeometry args={[DW + 0.12, 0.06, T + 0.04]} />
        <meshStandardMaterial color={m.steelDark} roughness={0.5} metalness={0.5} />
      </mesh>
      {/* Door leaf, hinged on the -x jamb, swung out into the hall */}
      <group position={[hinge, DH / 2, D / 2 + 0.03]} rotation={[0, swing, 0]}>
        <mesh position={[-(DW / 2 - 0.02), 0, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={m.wall} roughness={0.6} metalness={0.15} />
          <boxGeometry args={[DW - 0.04, DH - 0.03, 0.045]} />
        </mesh>
        {/* lever handles both sides, a kick plate and a louvre low on the leaf: what makes a slab read as a door */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[-(DW - 0.12), -0.05, s * 0.04]}>
            <boxGeometry args={[0.12, 0.025, 0.03]} />
            <meshStandardMaterial color={m.steel} roughness={0.35} metalness={0.8} />
          </mesh>
        ))}
        <mesh position={[-(DW / 2 - 0.02), -DH / 2 + 0.17, 0.024]}>
          <planeGeometry args={[DW - 0.1, 0.26]} />
          <meshStandardMaterial color={m.steel} roughness={0.4} metalness={0.7} />
        </mesh>
        {Array.from({length: 6}, (_, k) => (
          <mesh key={k} position={[-(DW / 2 - 0.02), -DH / 2 + 0.5 + k * 0.045, 0.024]}>
            <boxGeometry args={[DW * 0.45, 0.012, 0.004]} />
            <meshStandardMaterial color={m.steelDark} roughness={0.6} metalness={0.4} />
          </mesh>
        ))}
      </group>
      {/* Shelf on two brackets along the back wall */}
      <mesh position={[0, shelfY, shelfZ]} castShadow receiveShadow>
        <boxGeometry args={[W - 2 * T - 0.08, 0.035, shelfD]} />
        <meshStandardMaterial color={m.desk} roughness={0.8} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * (W / 2 - T - 0.3), shelfY - 0.02, shelfZ]}>
          <mesh position={[0, -0.15, -shelfD / 2 + 0.015]}>
            <boxGeometry args={[0.03, 0.3, 0.03]} />
            <meshStandardMaterial color={m.steelDark} roughness={0.5} metalness={0.5} />
          </mesh>
          <mesh position={[0, -0.015, 0]}>
            <boxGeometry args={[0.03, 0.03, shelfD - 0.05]} />
            <meshStandardMaterial color={m.steelDark} roughness={0.5} metalness={0.5} />
          </mesh>
        </group>
      ))}
      {/* The tower, the boxes, the cables */}
      <group position={[towerPos[0], towerPos[1], towerPos[2]]} rotation={[0, towerYaw, 0]}>
        <Tower agent={agent} energy={energy} time={time} seed={seed} />
      </group>
      <CardboardBox position={[0.5, shelfY + 0.0175, shelfZ + 0.01]} size={[0.36, 0.26, 0.34]} yaw={-0.08} color={cardboard} tape={tape} />
      <CardboardBox position={[-0.62, 0, -0.1]} size={[0.44, 0.34, 0.4]} yaw={0.22} color={cardboard} tape={tape} />
      <CardboardBox position={[-0.58, 0.34, -0.12]} size={[0.3, 0.2, 0.3]} yaw={-0.35} color={mix(cardboard, m.paper, 0.15)} tape={tape} />
      {cables.map((pts, k) => (
        <RubberCable key={k} points={pts} color={k % 2 ? m.plasticDark : mix(m.plasticDark, m.steelDark, 0.4)} />
      ))}
      {/* Wall box the cables go to, and a coiled cable on a hook */}
      <mesh position={[0.42, 1.42, -D / 2 + T + 0.012]}>
        <boxGeometry args={[0.12, 0.1, 0.025]} />
        <meshStandardMaterial color={m.plasticDark} roughness={0.6} />
      </mesh>
      <mesh position={[W / 2 - T - 0.025, 1.6, 0.25]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.13, 0.016, 8, 32]} />
        <meshStandardMaterial color={m.plasticDark} roughness={0.9} />
      </mesh>
      <mesh position={[W / 2 - T - 0.03, 1.74, 0.25]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.008, 0.008, 0.06, 8]} />
        <meshStandardMaterial color={m.steel} roughness={0.4} metalness={0.7} />
      </mesh>
      {/* The ceiling bulb nobody switched on */}
      <mesh position={[0, H - 0.05, 0.15]}>
        <cylinderGeometry args={[0.03, 0.03, 0.1, 12]} />
        <meshStandardMaterial color={m.plasticDark} roughness={0.6} />
      </mesh>
      <mesh position={[0, H - 0.14, 0.15]}>
        <sphereGeometry args={[0.035, 12, 8]} />
        <meshStandardMaterial color={m.ceramic} roughness={0.3} />
      </mesh>
      {/* The purple spill: on the closet floor and through the doorway onto the hall floor */}
      {agent > 0.001 ? (
        <group>
          <mesh position={[-0.1, 0.012, 0.1]} rotation={[-Math.PI / 2, 0, 0]} scale={2.4}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial map={getHaloTexture()} color={litMix(th.tone.mind.deep, th.tone.mind.base, 0.7, 1.1 * agent)} transparent opacity={0.6 * agent} depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>
          <mesh position={[0.1, 0.012, D / 2 + 0.55]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.6, 2.2, 1]}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial map={getHaloTexture()} color={litMix(th.tone.mind.deep, th.tone.mind.base, 0.7, 0.7 * agent)} transparent opacity={0.45 * agent} depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>
          <pointLight position={[0.05, 0.7, D / 2 + 0.25]} intensity={0.9 * agent} color={th.tone.mind.base} distance={2.8} decay={2} />
        </group>
      ) : null}
    </group>
  );
};
