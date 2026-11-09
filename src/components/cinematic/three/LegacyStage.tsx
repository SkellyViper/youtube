import React, {useMemo} from 'react';
import * as THREE from 'three';
import {useLook} from '../../../shot/runtime';
import {useTheme} from '../../../styles/ThemeContext';
import {SkyDome} from '../../cyber/three/Environment';

/**
 * The legacy samples' stage, as editable objects: the void with its cold
 * horizon line, and an obsidian floor with a faint hairline grid. A shot can
 * put any subject on it instead of building a room around it.
 */

/** Horizon haze (SkyDome). Slot: haze (colour; emissive intensity = strength). */
export const HorizonHaze: React.FC = () => {
  const th = useTheme();
  const look = useLook('haze', {color: th.color.haze, emissiveIntensity: 1});
  return <SkyDome haze={look.color} intensity={look.emissiveIntensity * look.opacity} />;
};

/**
 * Obsidian floor: an unlit near-black plane (as in the legacy samples), a
 * shadow catcher so furniture and people sit on it, and a hairline grid that
 * fades out with distance. Slots: glass (colour; roughness softens the
 * shadows), grid (colour; emissive intensity = grid strength).
 */
export const ObsidianFloor: React.FC<{readonly size?: number; readonly cell?: number; readonly extent?: number}> = ({size = 60, cell = 0.5, extent = 8}) => {
  const th = useTheme();
  // glass: colour of the (unlit) floor; roughness 0..1 softens the contact shadows.
  const glass = useLook('glass', {color: '#04060C', roughness: 0.2});
  const grid = useLook('grid', {color: th.color.steel, emissiveIntensity: 0.6});
  const geometry = useMemo(() => {
    // Lines with a per-vertex fade so the grid dissolves before the horizon.
    const pts: number[] = [];
    const fade: number[] = [];
    const n = Math.floor(extent / cell);
    const f = (x: number, z: number) => Math.max(0, 1 - Math.hypot(x, z) / extent);
    for (let i = -n; i <= n; i++) {
      for (let j = -n; j < n; j++) {
        const a = j * cell;
        const b = (j + 1) * cell;
        pts.push(i * cell, 0, a, i * cell, 0, b);
        fade.push(f(i * cell, a), f(i * cell, a), f(i * cell, a), f(i * cell, b), f(i * cell, b), f(i * cell, b));
        pts.push(a, 0, i * cell, b, 0, i * cell);
        fade.push(f(a, i * cell), f(a, i * cell), f(a, i * cell), f(b, i * cell), f(b, i * cell), f(b, i * cell));
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(fade, 3));
    return g;
  }, [cell, extent]);
  const gridColor = useMemo(() => new THREE.Color(grid.color).multiplyScalar(grid.emissiveIntensity), [grid.color, grid.emissiveIntensity]);
  return (
    <group>
      {/* Unlit, like the legacy MirrorFloor: lights never wash the floor blue, it stays the void. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} userData={{noEdges: true}}>
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial color={glass.color} transparent={glass.opacity < 1} opacity={glass.opacity} />
      </mesh>
      {/* Shadow catcher: only the shadows of what stands on it, so objects sit on the floor. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} receiveShadow userData={{noEdges: true}}>
        <planeGeometry args={[size, size]} />
        <shadowMaterial transparent opacity={0.55 * (1 - glass.roughness * 0.5)} />
      </mesh>
      <lineSegments geometry={geometry} position={[0, 0.002, 0]} userData={{noEdges: true}}>
        <lineBasicMaterial color={gridColor} vertexColors transparent opacity={grid.opacity} depthWrite={false} />
      </lineSegments>
    </group>
  );
};
