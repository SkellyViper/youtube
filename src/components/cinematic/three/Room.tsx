import React, {useMemo} from 'react';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {createRandom} from '../../random';
import {useTheme} from '../../../styles/ThemeContext';
import type {Vec3} from '../../cyber/three/rig';
import {OUTSIDE, ROOM} from '../world';
import {SkyDome} from '../../cyber/three/Environment';
import {useStageQuality} from '../../cyber/three/Stage3D';
import {Spot} from './Signals';
import {cineMaterials, lit, plankTexture} from './materials';
import {useLook, type LookProps} from '../../../shot/runtime';

/**
 * John's room: four walls, a floorboard floor, a window in the back wall with
 * blinds and a sill, a bookshelf, a framed poster and a rug. It is a real room
 * of ordinary dark materials; nothing in it glows. Light comes from the desk
 * (screens, lamp) and from the night outside through the window.
 *
 *   night   0..1 how much cold light the window admits (moonlight / city glow)
 *   room    0..1 the room's own ambient (the ceiling light is never on; this is
 *           the faint bounce that makes walls readable at all). 0 = pitch dark
 *           apart from practicals.
 */
export const DevRoom: React.FC<{readonly room?: number; readonly children?: React.ReactNode}> = ({room = 1, children}) => (
  <group>
    <RoomFloor />
    <RoomRug />
    <RoomCeiling />
    <RoomWalls />
    <RoomWindow />
    <RoomFacade />
    <Bookshelf />
    <Poster />
    <RoomBounce room={room} />
    {children}
  </group>
);

/*
 * The room's parts, exported one by one so an editable shot can wrap each in
 * its own <ShotObject> (hide the bookshelf, recolour the walls...). DevRoom
 * composes them exactly as before for the scenes that use the whole room.
 * Each reads its main material through useLook(slot), which returns the
 * component's own values when there is no shot.
 */

const useRoomMaterials = () => {
  const th = useTheme();
  return useMemo(() => cineMaterials(th), [th]);
};

/** Floorboards. Slot: floor (colour multiplies the plank texture). */
export const RoomFloor: React.FC = () => {
  const m = useRoomMaterials();
  const floorTex = useMemo(() => plankTexture(m.floor, m.plank, [5, 5]), [m.floor, m.plank]);
  const look = useLook('floor', {color: '#ffffff', roughness: 0.72, metalness: 0.02});
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, ROOM.back + ROOM.depth / 2]} receiveShadow userData={{noEdges: true}}>
      <planeGeometry args={[ROOM.width, ROOM.depth]} />
      <meshStandardMaterial map={floorTex} {...look} />
    </mesh>
  );
};

/** Rug under the chair. Slot: rug. */
export const RoomRug: React.FC = () => {
  const m = useRoomMaterials();
  const look = useLook('rug', {color: m.rug, roughness: 0.98});
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.1, 0.006, 0.95]} receiveShadow>
      <planeGeometry args={[2.3, 1.7]} />
      <meshStandardMaterial {...look} />
    </mesh>
  );
};

/** Ceiling. Slot: ceiling. */
export const RoomCeiling: React.FC = () => {
  const m = useRoomMaterials();
  const look = useLook('ceiling', {color: m.wallDark, roughness: 0.95});
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, ROOM.height, ROOM.back + ROOM.depth / 2]} userData={{noEdges: true}}>
      <planeGeometry args={[ROOM.width, ROOM.depth]} />
      <meshStandardMaterial {...look} />
    </mesh>
  );
};

/** Back wall (around the window), side walls, front wall, skirting. Slots: back, sides, skirting. */
export const RoomWalls: React.FC = () => {
  const m = useRoomMaterials();
  const backLook = useLook('back', {color: m.wall, roughness: 0.95});
  const sides = useLook('sides', {color: m.wallDark, roughness: 0.95});
  const skirting = useLook('skirting', {color: m.deskEdge, roughness: 0.8});
  const W = ROOM.width;
  const D = ROOM.depth;
  const H = ROOM.height;
  const back = ROOM.back;
  const front = back + D;
  const win = ROOM.window;
  return (
    <group>
      <WallPiece x={-W / 2} y={0} w={win.x - win.width / 2 + W / 2} h={H} z={back} look={backLook} />
      <WallPiece x={win.x + win.width / 2} y={0} w={W / 2 - (win.x + win.width / 2)} h={H} z={back} look={backLook} />
      <WallPiece x={win.x - win.width / 2} y={0} w={win.width} h={win.y - win.height / 2} z={back} look={backLook} />
      <WallPiece x={win.x - win.width / 2} y={win.y + win.height / 2} w={win.width} h={H - (win.y + win.height / 2)} z={back} look={backLook} />
      <mesh position={[-W / 2, H / 2, back + D / 2]} rotation={[0, Math.PI / 2, 0]} receiveShadow userData={{noEdges: true}}>
        <planeGeometry args={[D, H]} />
        <meshStandardMaterial {...sides} />
      </mesh>
      <mesh position={[W / 2, H / 2, back + D / 2]} rotation={[0, -Math.PI / 2, 0]} receiveShadow userData={{noEdges: true}}>
        <planeGeometry args={[D, H]} />
        <meshStandardMaterial {...sides} />
      </mesh>
      {/* Front wall (behind the camera in most shots, but it closes the room for reflections and fog) */}
      <mesh position={[0, H / 2, front]} rotation={[0, Math.PI, 0]} userData={{noEdges: true}}>
        <planeGeometry args={[W, H]} />
        <meshStandardMaterial {...sides} />
      </mesh>
      <mesh position={[0, 0.05, back + 0.012]}>
        <boxGeometry args={[W, 0.1, 0.024]} />
        <meshStandardMaterial {...skirting} />
      </mesh>
      <mesh position={[-W / 2 + 0.012, 0.05, back + D / 2]}>
        <boxGeometry args={[0.024, 0.1, D]} />
        <meshStandardMaterial {...skirting} />
      </mesh>
      <mesh position={[W / 2 - 0.012, 0.05, back + D / 2]}>
        <boxGeometry args={[0.024, 0.1, D]} />
        <meshStandardMaterial {...skirting} />
      </mesh>
    </group>
  );
};

/** Window in the back wall: frame, glass, sill, blinds. Slot: frame. */
export const RoomWindow: React.FC = () => {
  const m = useRoomMaterials();
  const frame = useLook('frame', {color: m.plastic, roughness: 0.6});
  const win = ROOM.window;
  const windowGlass = useMemo(() => new THREE.MeshPhysicalMaterial({color: '#0A1020', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.1, side: THREE.DoubleSide}), []);
  return (
    <group position={[win.x, win.y, ROOM.back]}>
      {/* Frame: four members and a mullion (not a slab: the view beyond must show through) */}
      {[
        [0, win.height / 2 + 0.03, win.width + 0.12, 0.06],
        [0, -win.height / 2 - 0.03, win.width + 0.12, 0.06],
        [-win.width / 2 - 0.03, 0, 0.06, win.height],
        [win.width / 2 + 0.03, 0, 0.06, win.height],
      ].map(([x, y, w, h], i) => (
        <mesh key={i} position={[x, y, 0.02]} castShadow>
          <boxGeometry args={[w, h, 0.05]} />
          <meshStandardMaterial {...frame} />
        </mesh>
      ))}
      <mesh position={[0, 0, 0.0]} userData={{noEdges: true}}>
        <planeGeometry args={[win.width, win.height]} />
        <primitive object={windowGlass} attach="material" />
      </mesh>
      <mesh position={[0, 0, 0.03]}>
        <boxGeometry args={[0.04, win.height, 0.03]} />
        <meshStandardMaterial {...frame} />
      </mesh>
      <mesh position={[0, -win.height / 2 - 0.02, 0.1]} castShadow receiveShadow>
        <boxGeometry args={[win.width + 0.2, 0.04, 0.22]} />
        <meshStandardMaterial color={m.deskEdge} roughness={0.75} />
      </mesh>
      {/* Blinds, pulled most of the way up: a short stack of slats under the head rail */}
      <mesh position={[0, win.height / 2 + 0.02, 0.05]} castShadow>
        <boxGeometry args={[win.width, 0.05, 0.05]} />
        <meshStandardMaterial color="#3A3B40" roughness={0.7} />
      </mesh>
      {Array.from({length: 5}, (_, i) => (
        <mesh key={i} position={[0, win.height / 2 - 0.04 - i * 0.03, 0.05]} rotation={[0.9, 0, 0]} castShadow userData={{noEdges: true}}>
          <boxGeometry args={[win.width - 0.04, 0.004, 0.034]} />
          <meshStandardMaterial color="#6E6F74" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
};

/**
 * Exterior: the building John's room is in, seen when the camera leaves through the window.
 * A facade around the window reveal, the storeys below down to the street, and the roof above.
 * Slot: facade.
 */
export const RoomFacade: React.FC = () => {
  const look = useLook('facade', {color: '#11141D', roughness: 0.95});
  const W = ROOM.width;
  const D = ROOM.depth;
  const H = ROOM.height;
  const back = ROOM.back;
  const win = ROOM.window;
  return (
    <group>
      <mesh position={[0, H / 2, back - 0.16]} rotation={[0, Math.PI, 0]} userData={{noEdges: true}}>
        <planeGeometry args={[W + 0.6, H + 0.2]} />
        <meshStandardMaterial {...look} side={THREE.FrontSide} />
      </mesh>
      <mesh position={[0, OUTSIDE.groundY / 2, back + D / 2]}>
        <boxGeometry args={[W + 0.6, -OUTSIDE.groundY, D + 0.6]} />
        <meshStandardMaterial {...look} />
      </mesh>
      <mesh position={[0, H + 1.6, back + D / 2]}>
        <boxGeometry args={[W + 0.6, 3.2, D + 0.6]} />
        <meshStandardMaterial {...look} />
      </mesh>
      {/* Neighbours' dark windows on the facade, either side of John's */}
      {[-1.6, 1.6].map((dx) => (
        <mesh key={dx} position={[win.x + dx, win.y, back - 0.17]} rotation={[0, Math.PI, 0]} userData={{noEdges: true}}>
          <planeGeometry args={[1.1, 1.1]} />
          <meshStandardMaterial color="#070910" roughness={0.3} metalness={0.6} />
        </mesh>
      ))}
    </group>
  );
};

/** Bookshelf on the left wall. Slot: shelves. */
export const Bookshelf: React.FC = () => {
  const m = useRoomMaterials();
  const shelves = useLook('shelves', {color: m.desk, roughness: 0.8});
  const books = useMemo(() => {
    const rnd = createRandom(17);
    return Array.from({length: 22}, () => ({h: rnd.range(0.17, 0.27), w: rnd.range(0.025, 0.05), tilt: rnd.range(-0.05, 0.05), c: rnd.pick(['#2A2F3E', '#3A2E2A', '#263A33', '#3B3A2E', '#2E2A3E', '#41352C'])}));
  }, []);
  const shelfY = [1.35, 1.75];
  return (
    <group position={[-ROOM.width / 2 + 0.15, 0, 0.6]}>
      {shelfY.map((y) => (
        <mesh key={y} position={[0, y, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.28, 0.03, 1.4]} />
          <meshStandardMaterial {...shelves} />
        </mesh>
      ))}
      {books.map((b, i) => {
        const shelf = i < 12 ? 0 : 1;
        const idx = shelf === 0 ? i : i - 12;
        return (
          <mesh key={i} position={[0.0, shelfY[shelf] + 0.015 + b.h / 2, -0.62 + idx * 0.1 + (shelf ? 0.14 : 0)]} rotation={[b.tilt, 0, 0]} castShadow>
            <boxGeometry args={[0.2, b.h, b.w]} />
            <meshStandardMaterial color={b.c} roughness={0.9} />
          </mesh>
        );
      })}
    </group>
  );
};

/** A framed poster on the right wall. Slot: frame. */
export const Poster: React.FC = () => {
  const m = useRoomMaterials();
  const frame = useLook('frame', {color: m.plasticDark, roughness: 0.5});
  return (
    <group position={[ROOM.width / 2 - 0.03, 1.6, 0.3]} rotation={[0, -Math.PI / 2, 0]}>
      <mesh castShadow>
        <boxGeometry args={[0.62, 0.86, 0.03]} />
        <meshStandardMaterial {...frame} />
      </mesh>
      <mesh position={[0, 0, 0.017]} userData={{noEdges: true}}>
        <planeGeometry args={[0.56, 0.8]} />
        <meshStandardMaterial color="#1B2238" roughness={0.9} />
      </mesh>
      <mesh position={[-0.1, 0.12, 0.019]} userData={{noEdges: true}}>
        <circleGeometry args={[0.14, 24]} />
        <meshStandardMaterial color="#2E3C6B" roughness={0.9} />
      </mesh>
      <mesh position={[0.08, -0.2, 0.019]} userData={{noEdges: true}}>
        <planeGeometry args={[0.3, 0.05]} />
        <meshStandardMaterial color="#44507A" roughness={0.9} />
      </mesh>
    </group>
  );
};

/** Ambient: a faint bounce so unlit walls are not pure black. `room` scales it. */
export const RoomBounce: React.FC<{readonly room?: number}> = ({room = 1}) => (
  <>
    <ambientLight intensity={0.07 * room} color="#5A6A9A" />
    <hemisphereLight intensity={0.1 * room} color="#243052" groundColor="#120E0C" />
  </>
);

const WallPiece: React.FC<{readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly z: number; readonly look: LookProps}> = ({x, y, w, h, z, look}) => {
  if (w <= 0 || h <= 0) return null;
  return (
    <mesh position={[x + w / 2, y + h / 2, z]} receiveShadow userData={{noEdges: true}}>
      <planeGeometry args={[w, h]} />
      <meshStandardMaterial {...look} />
    </mesh>
  );
};

/**
 * Cold light of the night coming through the window, with shadows. (A
 * RectAreaLight would be the physical choice, but it casts no shadows; a
 * shadow-casting directional light aimed through the opening reads the same.)
 */
export const WindowLight: React.FC<{readonly intensity?: number; readonly color?: string}> = ({intensity = 1, color}) => {
  const th = useTheme();
  const quality = useStageQuality();
  const win = ROOM.window;
  const target = useMemo(() => {
    const t = new THREE.Object3D();
    t.position.set(win.x + 0.3, 0.6, 1.4);
    return t;
  }, [win.x]);
  // Stays mounted at zero intensity: removing a light recompiles every shader.
  return (
    <>
      <directionalLight
        position={[win.x - 1.2, win.y + 2.4, ROOM.back - 3.2]}
        target={target}
        intensity={1.1 * Math.max(0, intensity)}
        color={color ?? th.tone.system.base}
        castShadow={intensity > 0.001}
        shadow-mapSize-width={quality.shadow}
        shadow-mapSize-height={quality.shadow}
        shadow-bias={-0.0006}
        shadow-normalBias={0.02}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={3}
        shadow-camera-bottom={-3}
        shadow-camera-near={0.5}
        shadow-camera-far={14}
      />
      <primitive object={target} />
    </>
  );
};

/**
 * The district outside the window, far below and far away: a dark ground, a
 * skyline of unlit blocks with a few sparse windows, and the data centre: a
 * long low building with a lit entrance, roof plant and a row of status
 * lights. `lights` dims the building's lights (0 = asleep).
 */
export const Outside: React.FC<{readonly lights?: number; readonly mind?: number; readonly shell?: number; readonly exteriorLights?: boolean}> = ({lights = 1, mind = 0, shell = 1, exteriorLights = true}) => {
  const th = useTheme();
  const m = useMemo(() => cineMaterials(th), [th]);
  const dc = OUTSIDE.dataCenter;
  const blocks = useMemo(() => {
    const rnd = createRandom(23);
    const list: {p: Vec3; s: Vec3; lit: number}[] = [];
    for (let i = 0; i < 140; i++) {
      const x = rnd.range(-120, 120);
      const z = -rnd.range(14, 230);
      if (Math.abs(x - dc.center[0]) < 26 && Math.abs(z - dc.center[2]) < 16) continue;
      // Keep the street in front of John's building open.
      if (Math.abs(x) < 6 && z > -16) continue;
      list.push({p: [x, OUTSIDE.groundY, z], s: [rnd.range(5, 14), rnd.range(3, 18), rnd.range(5, 14)], lit: rnd.next()});
    }
    return list;
  }, [dc.center]);
  const windows = useMemo(() => {
    const rnd = createRandom(29);
    const geo = new THREE.PlaneGeometry(0.5, 0.7);
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({color: lit('#FFD9A0', 0.9), fog: true}), 600);
    const o = new THREE.Object3D();
    let k = 0;
    for (const b of blocks) {
      const n = Math.floor(rnd.range(0, 7) * b.lit);
      for (let j = 0; j < n && k < 600; j++) {
        // Windows on the faces that look back toward John's building (+z) and on the sides.
        const side = rnd.next();
        if (side < 0.5) {
          o.position.set(b.p[0] + rnd.range(-b.s[0] / 2 + 0.5, b.s[0] / 2 - 0.5), b.p[1] + rnd.range(1, b.s[1] - 1), b.p[2] + b.s[2] / 2 + 0.02);
          o.rotation.set(0, 0, 0);
        } else {
          const face = side < 0.75 ? 1 : -1;
          o.position.set(b.p[0] + face * (b.s[0] / 2 + 0.02), b.p[1] + rnd.range(1, b.s[1] - 1), b.p[2] + rnd.range(-b.s[2] / 2 + 0.5, b.s[2] / 2 - 0.5));
          o.rotation.set(0, face > 0 ? Math.PI / 2 : -Math.PI / 2, 0);
        }
        o.updateMatrix();
        mesh.setMatrixAt(k++, o.matrix);
      }
    }
    mesh.count = k;
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }, [blocks]);
  const statusLights = 7;
  return (
    <group>
      {/* The channel's horizon haze: a low cold band of light where the district meets the night. */}
      <SkyDome haze={th.color.haze} intensity={0.95} width={0.09} />
      {/* City glow: a faint cold wash on the district from above, and a warmer sodium glow from the streets. */}
      <hemisphereLight position={[0, 40, -60]} intensity={1.3} color="#2E4490" groundColor="#0F1018" />
      {/* Street lamps along the route from John's building toward the data centre: warm pools on the asphalt. */}
      {STREET_LAMPS.map((p, i) => (
        <group key={i} position={[p[0], OUTSIDE.groundY, p[2]]}>
          <mesh position={[0, 3.2, 0]}>
            <cylinderGeometry args={[0.06, 0.09, 6.4, 8]} />
            <meshStandardMaterial color="#141820" roughness={0.8} />
          </mesh>
          <mesh position={[0.5, 6.3, 0]}>
            <boxGeometry args={[1.1, 0.14, 0.3]} />
            <meshStandardMaterial color="#141820" roughness={0.8} />
          </mesh>
          <mesh position={[0.8, 6.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.5, 0.22]} />
            <meshBasicMaterial color={lit('#FFB86A', 1.4)} side={THREE.DoubleSide} />
          </mesh>
          <pointLight position={[0.8, 5.9, 0]} intensity={(exteriorLights) ? (95) : 0} color="#FFB070" distance={26} decay={2} />
        </group>
      ))}
      <directionalLight position={[-30, 25, -90]} intensity={0.35} color="#4A6AC0" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, OUTSIDE.groundY, -120]}>
        <planeGeometry args={[600, 500]} />
        <meshStandardMaterial color="#161B27" roughness={0.85} />
      </mesh>
      {blocks.map((b, i) => (
        <mesh key={i} position={[b.p[0], b.p[1] + b.s[1] / 2, b.p[2]]}>
          <boxGeometry args={[b.s[0], b.s[1], b.s[2]]} />
          <meshStandardMaterial color="#10141F" roughness={0.95} />
        </mesh>
      ))}
      <primitive object={windows} />
      {/* The data centre */}
      <group position={[dc.center[0], dc.center[1], dc.center[2]]} rotation={[0, dc.yaw, 0]}>
        {shell > 0.001 ? (
          <mesh position={[0, dc.height / 2, 0]} castShadow={shell > 0.5}>
            <boxGeometry args={[dc.width, dc.height, dc.depth]} />
            <meshStandardMaterial color={m.concrete} roughness={0.9} transparent={shell < 1} opacity={shell} depthWrite={shell > 0.5} />
          </mesh>
        ) : null}
        {/* Roof plant: chillers */}
        {Array.from({length: 6}, (_, i) => (
          <mesh key={i} position={[-dc.width / 2 + 3 + i * 4, dc.height + 0.7, -2.5]}>
            <boxGeometry args={[2.6, 1.4, 2.6]} />
            <meshStandardMaterial color={m.steelDark} roughness={0.8} />
          </mesh>
        ))}
        {/* Entrance canopy with a warm light, near the -x end where the fibre comes in */}
        <mesh position={[-dc.width / 2 + 6, 2.6, dc.depth / 2 + 1.2]}>
          <boxGeometry args={[5, 0.25, 2.6]} />
          <meshStandardMaterial color={m.steelDark} roughness={0.8} />
        </mesh>
        <pointLight position={[-dc.width / 2 + 6, 2.1, dc.depth / 2 + 1.2]} intensity={40 * lights} color="#FFC98A" distance={24} decay={2} />
        <mesh position={[-dc.width / 2 + 6, 1.3, dc.depth / 2 + 0.02]}>
          <planeGeometry args={[2.2, 2.6]} />
          <meshBasicMaterial color={lit('#FFD9A0', 0.9 * lights)} />
        </mesh>
        {/* Cold facade downlights along the long side */}
        {Array.from({length: 5}, (_, i) => (
          <group key={`dl${i}`} position={[-dc.width / 2 + 3.5 + i * (dc.width - 7) / 4, dc.height - 0.3, dc.depth / 2 + 0.5]}>
            <mesh>
              <boxGeometry args={[0.5, 0.2, 0.6]} />
              <meshStandardMaterial color={m.steelDark} roughness={0.7} />
            </mesh>
            {exteriorLights ? <Spot position={[0, -0.1, 0]} target={[0, -8, -0.3]} intensity={90 * lights} angle={0.75} penumbra={0.5} distance={18} color="#9FB8FF" /> : null}
          </group>
        ))}
        {/* A row of status lights along the facade: system blue, one or two turning to the agent's colour */}
        {Array.from({length: statusLights}, (_, i) => {
          const isMind = mind > 0 && (i === 2 || (mind > 0.5 && i === 3));
          const c = isMind ? th.tone.mind.base : th.tone.system.base;
          return (
            <mesh key={i} position={[-dc.width / 2 + 3 + i * 4.6, dc.height - 0.8, dc.depth / 2 + 0.03]}>
              <planeGeometry args={[0.6, 0.6]} />
              <meshBasicMaterial color={lit(c, (isMind ? 3.2 : 1.6) * lights)} />
            </mesh>
          );
        })}
        {/* Fence line */}
        <mesh position={[0, 0.6, dc.depth / 2 + 6]}>
          <boxGeometry args={[dc.width + 12, 1.2, 0.05]} />
          <meshStandardMaterial color="#0E1118" roughness={0.9} transparent opacity={0.8} />
        </mesh>
      </group>
    </group>
  );
};

/** Lamp posts along the street the message travels (world xz, on the ground). */
const STREET_LAMPS: readonly Vec3[] = Array.from({length: 19}, (_, i) => {
  // Every ~8 m along the street the message follows (see route.ts), alternating sides.
  const t = i / 18;
  const x = 1.8 + t * 29;
  const z = -3 - t * 146;
  const side = i % 2 === 0 ? -2.2 : 2.2;
  return [x + side, 0, z] as Vec3;
});

/** Geometry helper shared by desk and props: a rounded box. */
export const useRoundedBox = (w: number, h: number, d: number, r: number, segments = 3) =>
  useMemo(() => new RoundedBoxGeometry(w, h, d, segments, r), [w, h, d, r, segments]);
