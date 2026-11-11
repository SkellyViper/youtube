import React from 'react';
import {Stage3D} from '../cyber/three/Stage3D';
import {HorizonHaze, ObsidianFloor} from '../cinematic/three/LegacyStage';
import {ShotLights, ShotObject, useShotRig, useShotStage, type ObjectDef} from '../../shot';

/**
 * The Video 01 stage (Legacy / Digital Noir): the near-black void with its
 * cold horizon line and, when the shot has ground to stand on, the obsidian
 * floor with its fading hairline grid. Camera, lights, bloom, fog and
 * exposure come from the shot (`useShotRig`, `ShotLights`, `useShotStage`),
 * so a scene only adds its subject:
 *
 *   <NoirStage>
 *     <ShotObject id="desk"><StudioDesk desk={DESK} /></ShotObject>
 *     ...
 *   </NoirStage>
 *
 * and its shot definition spreads the matching objects and presets:
 *
 *   objects: {...noirStageObjects(), desk: {...}},
 *   lights:  {...noirRig(), 'glow-screen': {...}},
 *   stage:   noirStage(),
 *
 * `floor={false}` (with `noirStageObjects({floor: false})`) leaves only the
 * void and the horizon: for inserts and diagram-like 3D where a grid would
 * be decoration.
 */
export const NoirStage: React.FC<{readonly floor?: boolean; readonly children?: React.ReactNode}> = ({floor = true, children}) => {
  const rig = useShotRig();
  const stage = useShotStage();
  return (
    <Stage3D rig={rig} bloom={stage.bloom} fog={stage.fog} fogColor={stage.fogColor} background={stage.background} exposure={stage.exposure} shadows={stage.shadows}>
      <ShotLights />
      <ShotObject id="horizon">
        <HorizonHaze />
      </ShotObject>
      {floor ? (
        <ShotObject id="stage-floor">
          <ObsidianFloor />
        </ShotObject>
      ) : null}
      {children}
    </Stage3D>
  );
};

/** The stage's entries for a shot definition's `objects` (editable in the shot editor like any other object). */
export const noirStageObjects = ({floor = true}: {readonly floor?: boolean} = {}): Record<string, ObjectDef> => ({
  horizon: {label: 'Horizon haze', group: 'Stage', purpose: 'Legacy look: the cold line where the floor meets the void.', slots: {haze: 'Haze (emissive intensity = strength)'}},
  ...(floor
    ? {'stage-floor': {label: 'Obsidian floor', group: 'Stage', purpose: 'Legacy look: dark glass floor with a fading hairline grid; catches the shadows.', slots: {glass: 'Glass', grid: 'Grid (emissive intensity = strength)'}}}
    : {}),
});
