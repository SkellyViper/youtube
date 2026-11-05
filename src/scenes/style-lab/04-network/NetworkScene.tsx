import React from 'react';
import {AbsoluteFill} from 'remotion';
import * as THREE from 'three';
import {
  Comet3D,
  getHaloTexture,
  GlowTube,
  hdr,
  MirrorFloor,
  Reflect,
  SkyDome,
  Stage3D,
  useCameraRig,
  type Rig,
} from '../../../components/cyber/three';
import {NetworkField} from '../../../components/cyber/three/NetworkField';
import {waveVisited} from '../../../components/cyber/three/networkGraph';
import {useBeats} from '../../../engine';
import {cyber, motion} from '../../../styles/cyber';
import {
  FAR_FIELD,
  LAND_OFFSET,
  LOCAL_CENTER,
  LOCAL_FIELD,
  LOCAL_GROW_END,
  LOCAL_WAVE_END,
  PATH_CURVE,
  SCALE_WAVE,
  TARGET_DIST,
  TARGET_POS,
} from './world';

/**
 * Sample 04: the network.
 *
 * A hero cluster forms out of the dark (blue: infrastructure). One purple
 * comet crosses it in a few hops (an agent's traffic). From where it lands,
 * activity cascades through the cluster in graph order, then the camera
 * pulls back: the cluster is one of dozens on a web of long-haul arcs, and
 * the cascade keeps travelling. Finally the camera dives across the web to
 * a distant node, which the cascade reaches just as we arrive.
 *
 * All of the network is two <NetworkField>s (instanced nodes and edges);
 * the comet and the landing node are the only hero objects.
 */

export const BEATS = ['net-form', 'net-signal', 'net-cascade', 'net-scale', 'net-dive'] as const;
export const DURATION = {form: 1.6, signal: 1.4, cascade: 1.7, scale: 2.2, dive: 2.1} as const;

/* Camera: close on the cluster, a slow drift per beat, one big pull-back, one dive. */
const RIG_START: Rig = {position: [0.4, 3.35, 11.8], target: [0, 2.65, 0], fov: cyber.camera.fov};
const WIDE: Rig = {position: [0, 10.5, 48], target: [0, 2.5, -14], fov: 40};
/** Camera-right at the landing, to set the node a little off centre. */
const LAND_RIGHT = new THREE.Vector3(LAND_OFFSET[2], 0, -LAND_OFFSET[0]).normalize().multiplyScalar(0.3);
const LAND: Rig = {
  position: [TARGET_POS[0] + LAND_OFFSET[0], TARGET_POS[1] + LAND_OFFSET[1], TARGET_POS[2] + LAND_OFFSET[2]],
  target: [TARGET_POS[0] + LAND_RIGHT.x, TARGET_POS[1] + 0.06, TARGET_POS[2] + LAND_RIGHT.z],
  fov: cyber.camera.fov,
};
/** How far the dive path bows upward at mid-flight, so the camera skims over the web. */
const DIVE_BOW = 5;
/** Fog: dense in the close shots (depth), thin for the wide shot, thickening again as we land. */
const FOG_CLOSE = 0.065;
const FOG_WIDE = 0.012;
const FOG_LAND = 0.04;

/** Mid-flight the camera rises over the web and looks down at what it is crossing; both ends are untouched. */
const useRig = (bow: number): Rig => {
  const rig = useCameraRig(RIG_START, [
    {beat: 'net-form', to: {position: [0.9, 3.1, 9.0]}},
    {beat: 'net-signal', to: {position: [-1.3, 3.25, 8.5], target: [0.15, 2.7, 0]}},
    {beat: 'net-cascade', to: {position: [-0.5, 4.5, 9.9], target: [0, 2.55, -0.4]}},
    {beat: 'net-scale', to: WIDE},
    {beat: 'net-dive', to: LAND},
  ]);
  if (bow <= 0) return rig;
  return {
    ...rig,
    position: [rig.position[0], rig.position[1] + bow, rig.position[2]],
    target: [rig.target[0], rig.target[1] - bow * 0.6, rig.target[2]],
  };
};

const W3 = LOCAL_WAVE_END + 0.7;
const W4 = W3 + SCALE_WAVE;
const W5 = Math.max(W4 + 1, TARGET_DIST + 0.35);

const useNetworkState = () => {
  const b = useBeats(BEATS);
  const form = b['net-form'];
  const signal = b['net-signal'];
  const cascade = b['net-cascade'];
  const scale = b['net-scale'];
  const dive = b['net-dive'];

  const grow = form.at(0.05, DURATION.form - 0.05, motion.signal) * LOCAL_GROW_END;
  const sky = 0.3 + 0.7 * form.at(0, 1.3, motion.arrive);
  const hop = signal.at(0.08, DURATION.signal - 0.08, motion.signal);
  // The wave rests while the pull-back begins, so the jump into the next cluster happens in view.
  const wave =
    cascade.at(0.05, DURATION.cascade - 0.02, motion.signal) * W3 +
    scale.at(0.4, DURATION.scale, motion.linear) * SCALE_WAVE +
    dive.at(0, DURATION.dive, motion.signal) * (W5 - W4);
  const growFar = scale.at(0, 2.0, motion.signal) * 64;
  const farLevel = 0.25 + 0.75 * scale.at(0, 1.3, motion.arrive);
  const farScale = 0.6 + 0.4 * scale.at(0, 1.3, motion.arrive);
  // The dive bows over the web; the same eased progress the rig uses, so the ends match exactly.
  const p = dive.at(0, DURATION.dive, motion.camera);
  const bow = DIVE_BOW * 4 * p * (1 - p);
  const fog = FOG_CLOSE + (FOG_WIDE - FOG_CLOSE) * scale.at(0, 1.6, motion.glide) + (FOG_LAND - FOG_WIDE) * dive.at(0.5, DURATION.dive, motion.glide);

  return {grow, sky, hop, wave, growFar, farLevel, farScale, bow, fog};
};

type State = ReturnType<typeof useNetworkState>;

/** The node the camera lands on: a soft pool of light and one ripple when the cascade reaches it. */
const Landing: React.FC<{readonly s: State; readonly rig: Rig}> = ({s, rig}) => {
  const x = s.wave - TARGET_DIST;
  const on = waveVisited(x, 0.25);
  const ripple = x > 0 && x < 0.3 ? x / 0.3 : -1;
  const m = new THREE.Matrix4().lookAt(
    new THREE.Vector3(rig.position[0], rig.position[1], rig.position[2]),
    new THREE.Vector3(TARGET_POS[0], TARGET_POS[1], TARGET_POS[2]),
    new THREE.Vector3(0, 1, 0),
  );
  const q = new THREE.Quaternion().setFromRotationMatrix(m);
  return (
    <>
      <sprite position={TARGET_POS as [number, number, number]} scale={[1.1, 1.1, 1]} renderOrder={2}>
        <spriteMaterial
          map={getHaloTexture()}
          color={hdr(cyber.color.purple, 0.3 * on)}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          fog={false}
        />
      </sprite>
      {ripple >= 0 ? (
        <mesh position={TARGET_POS as [number, number, number]} quaternion={q} scale={0.3 + 1.0 * ripple}>
          <torusGeometry args={[1, 0.012, 6, 72]} />
          <meshBasicMaterial color={hdr(cyber.color.purpleHot, cyber.emissive.strong * (1 - ripple))} transparent opacity={1 - ripple} depthWrite={false} />
        </mesh>
      ) : null}
    </>
  );
};

const World: React.FC<{readonly s: State; readonly rig: Rig}> = ({s, rig}) => (
  <>
    <SkyDome intensity={s.sky} />
    <MirrorFloor opacity={0.82} />
    <Reflect>
      <NetworkField
        data={LOCAL_FIELD}
        grow={s.grow}
        hop={s.hop}
        wave={s.wave}
        appear={0.8}
        arriveFrom={[LOCAL_CENTER[0], -0.5, -6.5]}
        tip={0.3}
        lineWidth={0.011}
        nodeLevel={0.62}
        visitedLevel={0.6}
        edgeVisitedLevel={0.6}
      />
      <NetworkField
        data={FAR_FIELD}
        grow={s.growFar}
        wave={s.wave}
        level={s.farLevel}
        nodeScale={s.farScale}
        maxNodePx={90}
        appear={3}
        tip={3}
        lineWidth={0.009}
        minLinePx={1.0}
        maxLinePx={6}
        nodeLevel={0.72}
        edgeLevel={0.85}
        visitedLevel={0.6}
        edgeVisitedLevel={0.65}
        headLevel={1.3}
        edgeHeadLevel={1.4}
        flash={0.35}
        decay={2.2}
        settle={0.6}
      />
      {/* The path the comet took stays, faintly, in its colour. */}
      <GlowTube curve={PATH_CURVE} radius={0.007} color={cyber.color.purple} intensity={cyber.emissive.base * 0.75} to={s.hop} segments={200} />
      <Comet3D curve={PATH_CURVE} t={s.hop} color={cyber.color.purple} radius={0.02} tail={0.16} />
      <Landing s={s} rig={rig} />
    </Reflect>
  </>
);

export const NetworkScene: React.FC = () => {
  const s = useNetworkState();
  const rig = useRig(s.bow);
  return (
    <AbsoluteFill>
      <Stage3D rig={rig} fog={s.fog}>
        <World s={s} rig={rig} />
      </Stage3D>
    </AbsoluteFill>
  );
};
