import React from 'react';
import {AbsoluteFill} from 'remotion';
import {HERO_RACK} from '../../../components/cinematic/route';
import {DataHall} from '../../../components/cinematic/three/DataHall';
import type {RackState} from '../../../components/cinematic/three/Rack';
import {Stage3D} from '../../../components/cyber/three/Stage3D';
import {worldStepBack} from '../../../components/story/MediaInsert';
import {useActiveTime, useBeats} from '../../../engine';
import {useTheme} from '../../../styles/ThemeContext';
import {BAY, BEATS, bayGlow, evidenceDim, handoffFlare, useEvidenceRig} from './stage';

/**
 * X06, the world layer: the data hall in its own local frame, the hero rack
 * purple with its bay open, everything else idle blue. While the evidence is
 * up the whole stage steps back (`worldStepBack`: desaturated, darker); the
 * veil itself is drawn by the evidence layer, between the world and the pages.
 * See ./stage.ts for the cast list and the beats.
 */
export const WorldLayer: React.FC = () => {
  const th = useTheme();
  const time = useActiveTime();
  const b = useBeats(BEATS);
  const rig = useEvidenceRig();
  const dim = evidenceDim(b);
  const flare = handoffFlare(b);
  const glow = bayGlow(b);

  const stateOf = (row: number, i: number): RackState =>
    row === HERO_RACK.row && i === HERO_RACK.i ? {power: 1, activity: 1, agent: 1, open: 1} : {power: 1, activity: 0.12 + (0.12 * ((row * 7 + i * 3) % 5)) / 5};

  return (
    <AbsoluteFill style={worldStepBack(dim)}>
      <Stage3D rig={rig} bloom={{strength: 0.45, radius: 0.6, threshold: 1.0}} fog={0.02} fogColor={th.color.void} background={th.color.void} exposure={1.2} shadows>
        <DataHall stateOf={stateOf} hero={HERO_RACK} time={time} lights={0.9} room={1.8}>
          {/* The agent's light spilling out of the open bay onto the aisle floor. */}
          <pointLight position={[BAY[0], 1.1, BAY[2] - 0.45]} intensity={7} color={th.tone.mind.base} distance={6} decay={2} />
          {/* The iris's own light on the inside of the open bay (centimetres away, so a small intensity), stronger as the camera closes in. */}
          <pointLight position={[BAY[0], BAY[1] + 0.04, BAY[2] - 0.1]} intensity={0.9 + 2.2 * glow} color={th.tone.mind.base} distance={1.8} decay={2} />
          {/* The document's light: a flash in the bay as the page leaves the machine, and as it comes back. */}
          <pointLight position={[BAY[0], BAY[1], BAY[2] - 0.18]} intensity={(flare > 0.001) ? (20 * flare) : 0} color={th.tone.system.hot} distance={4} decay={2} />
        </DataHall>
      </Stage3D>
    </AbsoluteFill>
  );
};
