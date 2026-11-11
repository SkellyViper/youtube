import React, {useMemo} from 'react';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mix} from '../../../styles/cyber';
import {useTheme} from '../../../styles/ThemeContext';
import {useLook, usePractical} from '../../../shot/runtime';
import type {Vec3} from '../../cyber/three/rig';
import {lit} from './materials';

/**
 * A clean workstation for the legacy stage (Style Lab V2): fewer parts, each
 * one believable. Dark matte matter; light comes from the screen and from a
 * few deliberate luminous accents. Every component reads its materials
 * through shot slots (`useLook`), so the editor can recolour them, and takes
 * its dimensions as props, so other shots can reuse it.
 *
 *   StudioDesk      slab top on two panel legs, a hairline of light on the front edge
 *   CurvedMonitor   a curved ultrawide: bent picture, thin bezel, rear housing, stand
 *   LowKeyboard     low-profile board with instanced keycaps
 *   SlimMouse
 *   MeshChair       task chair: five-star base, cushion, mesh backrest in a frame, arms
 */

const V = (v: Vec3): [number, number, number] => [v[0], v[1], v[2]];

/* ------------------------------------------------------------------ desk */

export type DeskSpec = {readonly top: Vec3; readonly width: number; readonly depth: number; readonly thickness: number};

/** Slots: top, legs, edge (the front edge's light; emissive intensity = strength, 0 = off). */
export const StudioDesk: React.FC<{readonly desk: DeskSpec}> = ({desk}) => {
  const th = useTheme();
  const {top, width, depth, thickness} = desk;
  const topGeo = useMemo(() => new RoundedBoxGeometry(width, thickness, depth, 2, 0.006), [width, thickness, depth]);
  const legH = top[1] - thickness;
  const legGeo = useMemo(() => new RoundedBoxGeometry(0.03, legH, depth - 0.06, 2, 0.006), [legH, depth]);
  const topLook = useLook('top', {color: mix(th.color.void, th.color.slate, 0.42), roughness: 0.93, metalness: 0.02});
  const legs = useLook('legs', {color: mix(th.color.void, th.color.slate, 0.4), roughness: 0.7, metalness: 0.35});
  const edge = useLook('edge', {color: th.tone.system.base, emissiveIntensity: 1.25});
  return (
    <group>
      <mesh geometry={topGeo} position={[top[0], top[1] - thickness / 2, top[2]]} castShadow receiveShadow>
        <meshStandardMaterial {...topLook} />
      </mesh>
      {/* The front edge: one hairline of light, the legacy "luminous edge" on the object that matters. */}
      <mesh position={[top[0], top[1] - thickness * 0.5, top[2] + depth / 2 + 0.0012]} userData={{noEdges: true}}>
        <planeGeometry args={[width - 0.012, 0.0035]} />
        <meshBasicMaterial color={lit(edge.color, edge.emissiveIntensity)} toneMapped={false} transparent={edge.opacity < 1} opacity={edge.opacity} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={legGeo} position={[top[0] + s * (width / 2 - 0.07), legH / 2, top[2]]} castShadow receiveShadow>
          <meshStandardMaterial {...legs} />
        </mesh>
      ))}
      {/* A rear stretcher under the top (at the back, so the knees stay free). */}
      <mesh position={[top[0], top[1] - thickness - 0.05, top[2] - depth / 2 + 0.06]} castShadow>
        <boxGeometry args={[width - 0.16, 0.06, 0.02]} />
        <meshStandardMaterial {...legs} />
      </mesh>
    </group>
  );
};

/* ------------------------------------------------------------------ monitor */

/**
 * Bend a geometry around a vertical axis `radius` in front of it (+z): x is
 * arc length along the panel, z the offset toward the viewer. A curved panel
 * keeps its picture undistorted (UVs follow the arc).
 */
const bend = (geo: THREE.BufferGeometry, radius: number): THREE.BufferGeometry => {
  const p = geo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const a = x / radius;
    const r = radius - z;
    p.setXYZ(i, r * Math.sin(a), p.getY(i), radius - r * Math.cos(a));
  }
  p.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
};

export type MonitorSpec = {readonly center: Vec3; readonly width: number; readonly height: number; readonly radius: number};

/**
 * A curved ultrawide. The picture is unlit (exactly the painted canvas).
 * Practical lights (shot light ids): `glow` throws the screen's light on the
 * desk and on him; `accent` is a second, coloured light placed behind a part
 * of the picture (`accentAt`, fractions of the picture) whose strength the
 * scene drives (`accentLevel`).
 *
 * Slots: body (bezel, housing, stand), screen (colour tints the picture;
 * emissive intensity = brightness).
 */
export const CurvedMonitor: React.FC<{
  readonly monitor: MonitorSpec;
  readonly deskY: number;
  readonly map: THREE.Texture;
  readonly tint: string;
  readonly glow?: string;
  readonly light?: number;
  readonly accent?: string;
  readonly accentTint?: string;
  readonly accentAt?: readonly [number, number];
  readonly accentLevel?: number;
}> = ({monitor, deskY, map, tint, glow = '', light = 1, accent = '', accentTint = tint, accentAt = [0.75, 0.35], accentLevel = 0}) => {
  const th = useTheme();
  const {center, width, height, radius} = monitor;
  const bezel = 0.007;
  const picture = useMemo(() => bend(new THREE.PlaneGeometry(width, height, 64, 1), radius), [width, height, radius]);
  const shell = useMemo(() => bend(new THREE.BoxGeometry(width + bezel * 2, height + bezel * 2, 0.018, 64, 1, 1).translate(0, 0, -0.009), radius), [width, height, radius]);
  // Finely segmented along x: a bent box with few vertices would cut a straight chord through the screen.
  const housing = useMemo(() => bend(new THREE.BoxGeometry(width * 0.62, height * 0.62, 0.04, 40, 1, 1).translate(0, 0, -0.04), radius), [width, height, radius]);
  // The stand: a flat neck behind the housing, down to a thin plate on the desk.
  const neckH = center[1] - deskY - 0.05;
  const neckGeo = useMemo(() => new RoundedBoxGeometry(0.07, neckH, 0.022, 2, 0.008), [neckH]);
  const plateGeo = useMemo(() => new RoundedBoxGeometry(0.3, 0.012, 0.2, 2, 0.005), []);
  const body = useLook('body', {color: mix(th.color.void, '#0A0B10', 0.5), roughness: 0.55, metalness: 0.25});
  const screen = useLook('screen', {color: '#ffffff', emissiveIntensity: 1});
  const glowLight = usePractical(glow, tint);
  const accentLight = usePractical(accent, accentTint);
  const pictureColor = useMemo(() => new THREE.Color(screen.color).multiplyScalar(Math.max(0.015, screen.emissiveIntensity)), [screen.color, screen.emissiveIntensity]);
  // The arc's sagitta: how far the picture's edges come toward him.
  const sag = radius - radius * Math.cos(width / 2 / radius);
  const ax = (accentAt[0] - 0.5) * width;
  const ay = (0.5 - accentAt[1]) * height;
  return (
    <group position={V(center)}>
      <mesh geometry={shell} castShadow>
        <meshStandardMaterial {...body} />
      </mesh>
      <mesh geometry={housing} castShadow>
        <meshStandardMaterial {...body} />
      </mesh>
      <mesh geometry={picture} position={[0, 0, 0.0006]} userData={{noEdges: true}}>
        <meshBasicMaterial map={map} color={pictureColor} toneMapped={false} transparent={screen.opacity < 1} opacity={screen.opacity} />
      </mesh>
      {/* No glass layer: a matte anti-glare panel (a glossy one mirrored its own glow light as a blob over the text). */}
      <mesh geometry={neckGeo} position={[0, -neckH / 2 - 0.01, -0.085]} castShadow>
        <meshStandardMaterial {...body} />
      </mesh>
      <mesh geometry={plateGeo} position={[0, deskY - center[1] + 0.006, -0.06]} castShadow receiveShadow>
        <meshStandardMaterial {...body} roughness={0.9} metalness={0.05} />
      </mesh>
      {/* Power LED */}
      <mesh position={[width / 2 - 0.03, -height / 2 - bezel * 0.5, 0.002]} userData={{noEdges: true}}>
        <planeGeometry args={[0.008, 0.002]} />
        <meshBasicMaterial color={lit(th.color.white, 1.1)} toneMapped={false} />
      </mesh>
      {/* The screen's light: broad and soft, on the desk and on him. */}
      <pointLight position={[0, -0.02, 0.45 + sag]} intensity={1.6 * light * glowLight.intensity} color={glowLight.color} distance={3.2} decay={2} />
      {/* The accent: coloured light from one part of the picture. */}
      <pointLight position={[ax, ay - 0.05, 0.3 + sag * 0.6]} intensity={2.4 * accentLevel * accentLight.intensity} color={accentLight.color} distance={2.2} decay={2} />
    </group>
  );
};

/* ------------------------------------------------------------------ keyboard + mouse */

export type KeyboardSpec = {readonly position: Vec3; readonly width: number; readonly depth: number};

/** Slots: body, keys. */
export const LowKeyboard: React.FC<{readonly keyboard: KeyboardSpec}> = ({keyboard}) => {
  const th = useTheme();
  const {width, depth} = keyboard;
  const caseGeo = useMemo(() => new RoundedBoxGeometry(width, 0.014, depth, 2, 0.005), [width, depth]);
  const keys = useMemo(() => {
    const cols = 15;
    const rows = 5;
    const pitch = (width - 0.03) / cols;
    const cap = pitch * 0.82;
    const geo = new RoundedBoxGeometry(cap, 0.007, cap, 1, 0.0015);
    const mat = new THREE.MeshStandardMaterial({color: '#0E1220', roughness: 0.7});
    const mesh = new THREE.InstancedMesh(geo, mat, cols * rows);
    const o = new THREE.Object3D();
    let k = 0;
    for (let r = 0; r < rows; r++) {
      const z = -depth / 2 + 0.018 + r * ((depth - 0.03) / (rows - 1));
      if (r === rows - 1) {
        // Bottom row: modifiers and one long space bar.
        const layout = [1, 1, 1, 6, 1, 1, 1];
        let x = -width / 2 + 0.015;
        for (const w of layout) {
          o.position.set(x + (w * pitch) / 2, 0.0145, z);
          o.scale.set((w * pitch - (pitch - cap)) / cap, 1, 1);
          o.updateMatrix();
          mesh.setMatrixAt(k++, o.matrix);
          x += w * pitch;
        }
      } else {
        for (let c = 0; c < cols; c++) {
          o.position.set(-width / 2 + 0.015 + pitch * (c + 0.5) + (r % 2) * pitch * 0.25 - (c === cols - 1 && r % 2 ? pitch * 0.25 : 0), 0.0145, z);
          o.scale.set(1, 1, 1);
          o.updateMatrix();
          mesh.setMatrixAt(k++, o.matrix);
        }
      }
    }
    mesh.count = k;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    return mesh;
  }, [width, depth]);
  const body = useLook('body', {color: mix(th.color.void, th.color.slate, 0.5), roughness: 0.6, metalness: 0.3});
  const keyLook = useLook('keys', {color: '#0E1220', roughness: 0.7});
  const keyMat = keys.material as THREE.MeshStandardMaterial;
  keyMat.color.set(keyLook.color);
  keyMat.roughness = keyLook.roughness;
  keyMat.metalness = keyLook.metalness;
  keyMat.emissive.set(keyLook.emissive);
  keyMat.emissiveIntensity = keyLook.emissiveIntensity;
  return (
    <group position={V(keyboard.position)}>
      <mesh geometry={caseGeo} position={[0, 0.007, 0]} castShadow receiveShadow>
        <meshStandardMaterial {...body} />
      </mesh>
      <primitive object={keys} />
    </group>
  );
};

/** Slots: body. */
export const SlimMouse: React.FC<{readonly position: Vec3}> = ({position}) => {
  const th = useTheme();
  const body = useLook('body', {color: mix(th.color.void, th.color.slate, 0.55), roughness: 0.5, metalness: 0.2});
  return (
    <mesh position={[position[0], position[1] + 0.016, position[2]]} rotation={[0, -0.12, 0]} scale={[0.034, 0.018, 0.058]} castShadow>
      <sphereGeometry args={[1, 28, 18]} />
      <meshStandardMaterial {...body} />
    </mesh>
  );
};

/* ------------------------------------------------------------------ chair */

export type ChairSpec = {
  readonly floor: Vec3;
  readonly seat: {readonly top: number; readonly halfWidth: number; readonly zFront: number; readonly zBack: number; readonly thickness: number};
  readonly back: {readonly bottom: number; readonly top: number; readonly halfWidth: number; readonly zFront: number; readonly tilt: number};
  readonly arms: {readonly x: number; readonly top: number; readonly zFront: number; readonly zBack: number; readonly padWidth: number};
};

/** A tube along a closed rounded rectangle (the backrest frame). */
const roundedRectTube = (w: number, h: number, r: number, tube: number): THREE.TubeGeometry => {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  const pts = s.getSpacedPoints(160).map((p) => new THREE.Vector3(p.x, p.y, 0));
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 220, tube, 10, true);
};

/**
 * Task chair with a mesh back. It is drawn as dark matter with a few
 * luminous hairlines so it always reads as an object of its own, apart from
 * the light figure sitting in it. `chair` gives the envelope (layout.ts).
 *
 * Slots: frame (backrest frame, arms, base), cushion, mesh (the back's mesh;
 * opacity via colour alpha is not editable, the mesh stays dark), trim
 * (the luminous hairline on the backrest frame; emissive intensity = strength).
 */
export const MeshChair: React.FC<{readonly chair: ChairSpec}> = ({chair}) => {
  const th = useTheme();
  const {seat, back, arms} = chair;
  const backH = back.top - back.bottom;
  const backW = back.halfWidth * 2;
  const tilt = (back.tilt * Math.PI) / 180;
  const frameTube = 0.014;
  const frameGeo = useMemo(() => roundedRectTube(backW, backH, 0.07, frameTube), [backW, backH]);
  const meshGeo = useMemo(() => {
    const s = new THREE.Shape();
    const w = backW - 0.02;
    const h = backH - 0.02;
    const r = 0.062;
    s.moveTo(-w / 2 + r, -h / 2);
    s.lineTo(w / 2 - r, -h / 2);
    s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    s.lineTo(w / 2, h / 2 - r);
    s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
    s.lineTo(-w / 2 + r, h / 2);
    s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
    s.lineTo(-w / 2, -h / 2 + r);
    s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    return new THREE.ShapeGeometry(s, 12);
  }, [backW, backH]);
  const cushionGeo = useMemo(() => new RoundedBoxGeometry(seat.halfWidth * 2, seat.thickness, seat.zBack - seat.zFront, 4, 0.028), [seat.halfWidth, seat.thickness, seat.zBack, seat.zFront]);
  const shellGeo = useMemo(() => new RoundedBoxGeometry(seat.halfWidth * 2 - 0.03, 0.03, seat.zBack - seat.zFront - 0.04, 2, 0.01), [seat.halfWidth, seat.zBack, seat.zFront]);
  const padGeo = useMemo(() => new RoundedBoxGeometry(arms.padWidth, 0.025, arms.zBack - arms.zFront, 3, 0.011), [arms.padWidth, arms.zBack, arms.zFront]);

  const frame = useLook('frame', {color: mix(th.color.void, th.color.steel, 0.45), roughness: 0.42, metalness: 0.65});
  const cushion = useLook('cushion', {color: mix(th.color.abyss, th.color.slate, 0.55), roughness: 0.95, metalness: 0});
  const mesh = useLook('mesh', {color: '#03050B', roughness: 1});
  const trim = useLook('trim', {color: th.tone.system.base, emissiveIntensity: 0.9});

  const seatCz = (seat.zFront + seat.zBack) / 2;
  const seatY = seat.top - seat.thickness / 2;
  const column = seatY - seat.thickness / 2 - 0.05; // top of the gas column (under the seat shell)
  // Backrest centre: its bottom edge sits above the seat's rear, tilted back about that edge.
  const backPivot: Vec3 = [0, back.bottom, back.zFront + frameTube];
  return (
    <group position={V(chair.floor)}>
      {/* Five-star base with casters */}
      {Array.from({length: 5}, (_, i) => {
        const a = (i / 5) * Math.PI * 2 + Math.PI / 10;
        const L = 0.3;
        return (
          <group key={i} rotation={[0, -a, 0]}>
            <mesh position={[L / 2, 0.075, 0]} rotation={[0, 0, 0.06]} castShadow>
              <boxGeometry args={[L, 0.022, 0.036]} />
              <meshStandardMaterial {...frame} />
            </mesh>
            <mesh position={[L - 0.005, 0.03, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[0.026, 0.026, 0.024, 18]} />
              <meshStandardMaterial {...frame} roughness={0.6} metalness={0.2} />
            </mesh>
          </group>
        );
      })}
      <mesh position={[0, 0.09, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.06, 0.04, 24]} />
        <meshStandardMaterial {...frame} />
      </mesh>
      {/* Gas column */}
      <mesh position={[0, (0.1 + column) / 2, 0]} castShadow>
        <cylinderGeometry args={[0.022, 0.028, column - 0.1, 20]} />
        <meshStandardMaterial {...frame} />
      </mesh>
      {/* Seat: shell under the cushion */}
      <mesh geometry={shellGeo} position={[0, seatY - seat.thickness / 2 - 0.012, seatCz]} castShadow>
        <meshStandardMaterial {...frame} />
      </mesh>
      <mesh geometry={cushionGeo} position={[0, seatY, seatCz]} castShadow receiveShadow>
        <meshStandardMaterial {...cushion} />
      </mesh>
      {/* Spine: from under the seat's rear up behind the backrest */}
      <mesh position={[0, (seatY + back.bottom + 0.12) / 2, seat.zBack + 0.03]} rotation={[tilt * 0.6, 0, 0]} castShadow>
        <boxGeometry args={[0.06, back.bottom + 0.12 - seatY + 0.06, 0.022]} />
        <meshStandardMaterial {...frame} />
      </mesh>
      {/* Backrest: a frame with a dark mesh, tilted back about its lower edge (+x rotation: the top goes to +z, away from the desk) */}
      <group position={V(backPivot)} rotation={[tilt, 0, 0]}>
        <group position={[0, backH / 2, 0]}>
          <mesh geometry={frameGeo} castShadow>
            <meshStandardMaterial {...frame} />
          </mesh>
          {/* Drawn after the light figure (transparent pass, renderOrder -1) so the mesh veils the body behind it. */}
          <mesh geometry={meshGeo} position={[0, 0, 0.004]} renderOrder={2} userData={{noEdges: true}}>
            <meshStandardMaterial color={mesh.color} roughness={mesh.roughness} metalness={mesh.metalness} transparent opacity={0.72 * mesh.opacity} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
          {/* The trim: one luminous hairline along the top of the frame, facing away from him (toward the camera side). */}
          <mesh position={[0, backH / 2 - 0.0005, frameTube + 0.0005]} userData={{noEdges: true}}>
            <boxGeometry args={[backW - 0.16, 0.0028, 0.0028]} />
            <meshBasicMaterial color={lit(trim.color, trim.emissiveIntensity)} toneMapped={false} transparent={trim.opacity < 1} opacity={trim.opacity} />
          </mesh>
        </group>
      </group>
      {/* Arms: post from the seat shell, pad on top, outside the body */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * arms.x, (seatY + arms.top) / 2 - 0.02, (arms.zFront + arms.zBack) / 2 + 0.04]} castShadow>
            <boxGeometry args={[0.028, arms.top - seatY + 0.02, 0.05]} />
            <meshStandardMaterial {...frame} />
          </mesh>
          <mesh position={[s * (arms.x - 0.04), seatY - seat.thickness / 2 - 0.01, (arms.zFront + arms.zBack) / 2 + 0.04]} castShadow>
            <boxGeometry args={[0.1, 0.018, 0.05]} />
            <meshStandardMaterial {...frame} />
          </mesh>
          <mesh geometry={padGeo} position={[s * arms.x, arms.top - 0.0125, (arms.zFront + arms.zBack) / 2]} castShadow>
            <meshStandardMaterial {...cushion} />
          </mesh>
        </group>
      ))}
    </group>
  );
};
