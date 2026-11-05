import React, {useMemo} from 'react';
import * as THREE from 'three';
import {cyber} from '../../../styles/cyber';

/**
 * Sky: a huge inward-facing sphere with a thin band of haze on the horizon.
 * The haze band is the look's constant: every 3D shot has a low, cold line
 * of light where the obsidian floor meets the void.
 */
export const SkyDome: React.FC<{
  /** Haze colour (default blue-indigo). Tint towards purple/red to change the mood. */
  readonly haze?: string;
  /** 0..1.5. Dim it to zero for a "lights out" beat. */
  readonly intensity?: number;
  /** Vertical thickness of the band (in direction-y units). */
  readonly width?: number;
  readonly radius?: number;
}> = ({haze = cyber.color.haze, intensity = 1, width = 0.085, radius = 480}) => {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uVoid: {value: new THREE.Color(cyber.color.void)},
          uHaze: {value: new THREE.Color(haze)},
          uIntensity: {value: intensity},
          uWidth: {value: width},
        },
        vertexShader: /* glsl */ `
          varying vec3 vWorld;
          void main() {
            vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uVoid;
          uniform vec3 uHaze;
          uniform float uIntensity;
          uniform float uWidth;
          varying vec3 vWorld;
          void main() {
            // Direction from the eye, so the band always sits on the true horizon.
            float h = normalize(vWorld - cameraPosition).y;
            // Tight bright line plus a taller, fainter breath of haze above it.
            float line = exp(-pow(abs(h) / (uWidth * 0.22), 1.3));
            float band = exp(-pow(max(h, 0.0) / uWidth, 1.15)) * step(-0.002, h);
            float below = exp(-pow(max(-h, 0.0) / (uWidth * 0.5), 1.2)) * (1.0 - step(-0.002, h));
            vec3 col = uVoid + uHaze * uIntensity * (band * 0.55 + below * 0.3 + line * 0.9);
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      }),
    // Created once; uniforms are updated below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  material.uniforms.uHaze.value.set(haze);
  material.uniforms.uIntensity.value = intensity;
  material.uniforms.uWidth.value = width;
  return (
    <mesh material={material} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[radius, 48, 32]} />
    </mesh>
  );
};

/** Default lighting for dark structure: silhouettes first, a cold rim, almost no fill. */
export const StageLights: React.FC<{readonly intensity?: number; readonly rim?: string}> = ({
  intensity = 1,
  rim = cyber.color.blue,
}) => (
  <>
    <ambientLight intensity={0.5 * intensity} color="#8fa4ff" />
    <directionalLight position={[-6, 10, -8]} intensity={2.2 * intensity} color={rim} />
    <directionalLight position={[8, 6, 10]} intensity={0.5 * intensity} color="#b8c6ff" />
  </>
);

/**
 * The obsidian floor at height `y`: a dark, slightly translucent plane.
 * Anything wrapped in <Reflect> gets a mirrored copy under the floor that
 * shows through it, dimmed, which reads as polished black glass. Optional
 * hairline grid, fading into the fog.
 */
export const MirrorFloor: React.FC<{
  readonly y?: number;
  readonly size?: number;
  /** 0..1: how dark the glass is (1 = no reflection visible). */
  readonly opacity?: number;
  readonly color?: string;
  /** Grid cell size in world units; 0 = no grid. */
  readonly grid?: number;
  readonly gridColor?: string;
  readonly gridOpacity?: number;
  /** How far the grid extends from the origin. */
  readonly gridExtent?: number;
}> = ({y = 0, size = 900, opacity = 0.8, color = cyber.color.void, grid = 0, gridColor = cyber.color.steel, gridOpacity = 0.5, gridExtent = 120}) => {
  const gridGeometry = useMemo(() => {
    if (grid <= 0) return null;
    const n = Math.floor(gridExtent / grid);
    const pts: number[] = [];
    for (let i = -n; i <= n; i++) {
      pts.push(i * grid, 0, -gridExtent, i * grid, 0, gridExtent);
      pts.push(-gridExtent, 0, i * grid, gridExtent, 0, i * grid);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, [grid, gridExtent]);

  return (
    <group position={[0, y, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={-1}>
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
      </mesh>
      {gridGeometry ? (
        <lineSegments geometry={gridGeometry} position={[0, 0.002, 0]}>
          <lineBasicMaterial color={gridColor} transparent opacity={gridOpacity} depthWrite={false} />
        </lineSegments>
      ) : null}
    </group>
  );
};

/**
 * Renders `children` normally and again mirrored through the plane y = `y`.
 * Pair with <MirrorFloor y={y}>. The mirrored copy is drawn before the floor
 * (group render order), so the floor's translucency dims it.
 *
 * Children are mounted twice; keep them pure (they already must be).
 */
export const Reflect: React.FC<{readonly y?: number; readonly enabled?: boolean; readonly children?: React.ReactNode}> = ({
  y = 0,
  enabled = true,
  children,
}) => (
  <>
    {enabled ? (
      <group position={[0, 2 * y, 0]} scale={[1, -1, 1]} renderOrder={-5}>
        {children}
      </group>
    ) : null}
    <group>{children}</group>
  </>
);
