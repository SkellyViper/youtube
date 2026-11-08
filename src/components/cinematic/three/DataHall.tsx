import React, {useMemo} from 'react';
import * as THREE from 'three';
import {useTheme} from '../../../styles/ThemeContext';
import type {Vec3} from '../../cyber/three/rig';
import {HALL, rackAt, rackYaw} from '../world';
import {cineMaterials, lit, tileTexture} from './materials';
import {Rack, RackRow, type RackState} from './Rack';
import {Spot} from './Signals';

/**
 * A data hall: rows of racks on a raised tile floor, cold aisles between
 * them, overhead cable trays with ladder rungs, a low ceiling with light
 * fixtures that are mostly off (the hall is lights-out: machines do not need
 * light), concrete end walls and columns.
 *
 *   stateOf(row, i)  per-rack state (power, activity, agent, threat)
 *   hero             {row, i}: that rack is drawn in full detail, the others instanced
 *   lights           0..1 how many ceiling fixtures are on (maintenance mode)
 *   room             0..1 the hall's faint ambient
 *   ceiling          0..1 opacity of the ceiling plane and the fixtures' housings
 *                    (1 = solid; fade it as a camera rises through the roof)
 */
export type HallProps = {
  readonly stateOf: (row: number, i: number) => RackState;
  readonly hero?: {readonly row: number; readonly i: number; readonly showAgent?: boolean} | null;
  readonly time?: number;
  readonly lights?: number;
  readonly room?: number;
  readonly ceiling?: number;
  readonly rows?: number;
  readonly perRow?: number;
  readonly children?: React.ReactNode;
};

export const hallExtent = (rows: number = HALL.rows, perRow: number = HALL.perRow) => ({
  width: perRow * HALL.pitch + 6,
  depth: rows * HALL.aisle + 6,
});

export const DataHall: React.FC<HallProps> = ({stateOf, hero = null, time = 0, lights = 0.25, room = 1, ceiling = 1, rows = HALL.rows, perRow = HALL.perRow, children}) => {
  const th = useTheme();
  const m = useMemo(() => cineMaterials(th), [th]);
  const floorTex = useMemo(() => tileTexture(m.hallFloor, m.hallTile, 24), [m.hallFloor, m.hallTile]);
  const ext = hallExtent(rows, perRow);
  const rowPositions = useMemo(
    () =>
      Array.from({length: rows}, (_, r) =>
        Array.from({length: perRow}, (_, i) => i)
          .filter((i) => !(hero && hero.row === r && hero.i === i))
          .map((i) => ({i, p: rackAt(r, i)})),
      ),
    [rows, perRow, hero],
  );
  const fixtures = useMemo(() => {
    const list: {p: Vec3; on: boolean}[] = [];
    for (let r = 0; r <= rows; r++) {
      for (let k = 0; k < Math.ceil(perRow / 3); k++) {
        const z = (r - rows / 2) * HALL.aisle;
        const x = (k - (Math.ceil(perRow / 3) - 1) / 2) * HALL.pitch * 3;
        list.push({p: [x, HALL.ceilingY - 0.08, z], on: (r + k) % 2 === 1});
      }
    }
    return list;
  }, [rows, perRow]);
  const trayRungs = useMemo(() => {
    const geo = new THREE.BoxGeometry(0.04, 0.03, 0.3);
    const mat = new THREE.MeshStandardMaterial({color: m.rackRail, roughness: 0.5, metalness: 0.5});
    const per = Math.floor((ext.width - 2) / 0.3);
    const mesh = new THREE.InstancedMesh(geo, mat, per * rows);
    const o = new THREE.Object3D();
    let k = 0;
    for (let r = 0; r < rows; r++) {
      const z = rackAt(r, 0)[2];
      for (let j = 0; j < per; j++) {
        o.position.set(-(ext.width - 2) / 2 + j * 0.3, HALL.trayY, z);
        o.updateMatrix();
        mesh.setMatrixAt(k++, o.matrix);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }, [rows, ext.width, m.rackRail]);

  return (
    <group>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[ext.width, ext.depth]} />
        <meshStandardMaterial map={floorTex} color="#ffffff" roughness={0.6} metalness={0.15} />
      </mesh>
      {/* Ceiling (fades with `ceiling`) */}
      {ceiling > 0.001 ? (
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, HALL.ceilingY, 0]}>
          <planeGeometry args={[ext.width, ext.depth]} />
          <meshStandardMaterial color={m.concrete} roughness={0.95} transparent={ceiling < 1} opacity={ceiling} depthWrite={ceiling >= 1} />
        </mesh>
      ) : null}
      {/* End walls and side walls */}
      {[-1, 1].map((s) => (
        <mesh key={`z${s}`} position={[0, HALL.ceilingY / 2, (s * ext.depth) / 2]} rotation={[0, s > 0 ? Math.PI : 0, 0]}>
          <planeGeometry args={[ext.width, HALL.ceilingY]} />
          <meshStandardMaterial color={m.concrete} roughness={0.95} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={`x${s}`} position={[(s * ext.width) / 2, HALL.ceilingY / 2, 0]} rotation={[0, s > 0 ? -Math.PI / 2 : Math.PI / 2, 0]}>
          <planeGeometry args={[ext.depth, HALL.ceilingY]} />
          <meshStandardMaterial color={m.concrete} roughness={0.95} />
        </mesh>
      ))}
      {/* Columns */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[(sx * (ext.width - 1.2)) / 2, HALL.ceilingY / 2, (sz * (ext.depth - 1.2)) / 2]} castShadow>
            <boxGeometry args={[0.5, HALL.ceilingY, 0.5]} />
            <meshStandardMaterial color={m.concrete} roughness={0.95} />
          </mesh>
        )),
      )}
      {/* Cable trays: two rails per row and the rungs */}
      {Array.from({length: rows}, (_, r) => {
        const z = rackAt(r, 0)[2];
        return (
          <group key={r}>
            {[-0.16, 0.16].map((dz) => (
              <mesh key={dz} position={[0, HALL.trayY, z + dz]}>
                <boxGeometry args={[ext.width - 2, 0.06, 0.03]} />
                <meshStandardMaterial color={m.rackRail} roughness={0.5} metalness={0.5} />
              </mesh>
            ))}
          </group>
        );
      })}
      <primitive object={trayRungs} />
      {/* Ceiling fixtures */}
      {fixtures.map((f, i) => {
        const on = f.on ? lights : 0;
        return (
          <group key={i} position={[f.p[0], f.p[1], f.p[2]]}>
            {ceiling > 0.001 ? (
              <mesh>
                <boxGeometry args={[1.2, 0.08, 0.16]} />
                <meshStandardMaterial color={m.steelDark} roughness={0.6} metalness={0.4} transparent={ceiling < 1} opacity={ceiling} depthWrite={ceiling >= 1} />
              </mesh>
            ) : null}
            {ceiling > 0.001 ? (
              <mesh position={[0, -0.041, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <planeGeometry args={[1.1, 0.1]} />
                <meshBasicMaterial color={lit('#D8E4FF', 0.22 + 0.75 * on)} transparent={ceiling < 1} opacity={ceiling} depthWrite={ceiling >= 1} />
              </mesh>
            ) : null}
            {on > 0.05 ? <Spot position={[0, -0.12, 0]} target={[0, -4, 0]} intensity={120 * on} angle={1.2} penumbra={0.75} distance={16} color="#C9D8FF" /> : null}
          </group>
        );
      })}
      {/* Racks: instanced rows, hero in detail */}
      {rowPositions.map((list, r) => (
        <RackRow key={r} positions={list.map((e) => e.p)} yaw={rackYaw(r)} stateOf={(k) => stateOf(r, list[k].i)} time={time} seed={r * 31} />
      ))}
      {hero ? <Rack position={rackAt(hero.row, hero.i)} yaw={rackYaw(hero.row)} state={stateOf(hero.row, hero.i)} time={time} seed={hero.row * 31 + hero.i} showAgent={hero.showAgent ?? true} /> : null}
      {/* Aisle floor strips: a thin cold line along each aisle edge, the way modern halls mark walkways. Leading lines for the camera. */}
      {Array.from({length: rows + 1}, (_, r) => {
        const z = (r - rows / 2) * HALL.aisle;
        return [-0.72, 0.72].map((dz) => (
          <mesh key={`${r}${dz}`} position={[0, 0.004, z + dz]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[ext.width - 3, 0.03]} />
            <meshBasicMaterial color={lit('#5F86D8', 0.9 * room)} />
          </mesh>
        ));
      })}
      {/* Aisle floor glow strips: emergency lighting at the ends of each aisle */}
      {Array.from({length: rows + 1}, (_, r) => {
        const z = (r - rows / 2) * HALL.aisle;
        return [-1, 1].map((s) => (
          <mesh key={`${r}${s}`} position={[(s * (ext.width - 2.4)) / 2, 0.3, z]} rotation={[0, s > 0 ? -Math.PI / 2 : Math.PI / 2, 0]}>
            <planeGeometry args={[0.5, 0.05]} />
            <meshBasicMaterial color={lit('#B8C8E8', 1.1 * room)} />
          </mesh>
        ));
      })}
      <ambientLight intensity={0.16 * room} color="#6A7AAA" />
      <hemisphereLight intensity={0.42 * room} color="#2C3A60" groundColor="#101218" />
      {children}
    </group>
  );
};

/** The local position of a rack's open bay (hero) or its front centre, for cameras and signals. */
export const rackBay = (row: number, i: number): Vec3 => {
  const p = rackAt(row, i);
  const yaw = rackYaw(row);
  const dz = HALL.rack.depth / 2 - 0.12;
  return [p[0] - Math.sin(yaw) * dz, 0.95, p[2] + Math.cos(yaw) * dz];
};

/** Top of a rack where its cable bundle meets the tray. */
export const rackTop = (row: number, i: number): Vec3 => {
  const p = rackAt(row, i);
  return [p[0], HALL.trayY - 0.05, p[2]];
};
