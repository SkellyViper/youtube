import {createContext, useContext} from 'react';
import type {Rig} from '../components/cyber/three/rig';
import type {MaterialLook, ShotDef, ShotState} from './types';

/**
 * What the editor can select. `object`/`light`/`beat`/`motion` carry an id.
 */
export type Selection =
  | {readonly kind: 'object'; readonly id: string}
  | {readonly kind: 'light'; readonly id: string}
  | {readonly kind: 'camera'}
  | {readonly kind: 'stage'}
  | {readonly kind: 'beat'; readonly id: string}
  | {readonly kind: 'motion'; readonly id: string}
  | {readonly kind: 'key'; readonly id: string}
  | {readonly kind: 'note'; readonly id: string};

/**
 * The editor's handle inside the composition. It only exists while a shot is
 * open in the Style Lab editor (it is provided around the Player); Remotion
 * renders never have one, so nothing editor-related can reach an MP4.
 */
export type ShotEditorApi = {
  readonly selected: Selection | null;
  select(sel: Selection | null): void;
  /** Free inspection camera. When set it replaces the shot camera in the editor viewport only. */
  readonly inspect: Rig | null;
  /** Draw helpers (selection box, light markers, shot camera frustum and path). */
  readonly helpers: boolean;
  /** The shot camera's pose at the current frame (for the frustum helper while inspecting). */
  readonly shotPose: {position: readonly number[]; target: readonly number[]; fov: number} | null;
  /** Effective material values, reported by `useLook` so the inspector shows real numbers. */
  report(objectId: string, slot: string, look: Required<MaterialLook>): void;
  /** The scene's own (code) camera at a frame, reported by `useShotRig` (for "key from code camera" and baking). */
  reportCode(frame: number, pose: {position: readonly number[]; target: readonly number[]; fov: number; roll: number}): void;
};

export const ShotEditorContext = createContext<ShotEditorApi | null>(null);

export type ShotRuntime = {
  readonly def: ShotDef;
  readonly state: ShotState;
  readonly editor: ShotEditorApi | null;
};

/** The resolved shot of the composition being rendered (bridged into the 3D canvas by Stage3D). */
export const ShotContext = createContext<ShotRuntime | null>(null);

export const useShot = (): ShotRuntime | null => useContext(ShotContext);
