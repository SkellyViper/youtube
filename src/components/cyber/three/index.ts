/** 3D primitives of the Style Lab look. See Stage3D for the rendering rules. */
export {Stage3D, type BloomSettings} from './Stage3D';
export {useCameraRig, evaluateRig, projectPoint, type Rig, type RigKey, type Vec3} from './rig';
export {hdr, hdrMix, hdrRamp, structureProps, getHaloTexture} from './materials';
export {SkyDome, StageLights, MirrorFloor, Reflect} from './Environment';
export {AgentCore3D} from './AgentCore3D';
export {GlowTube, Comet3D, cometArrival, NetworkNode3D, curveThrough, arcBetween} from './Signal3D';

// Built with the Style Lab samples (see docs/STYLE_LAB.md for what each one is for).
export * from './AgentSwarm';
export * from './LinkLines';
export * from './NetworkField';
export * from './networkGraph';
export * from './ScanField';
export * from './ComputeIsland';
export * from './PlanCamera';
export * from './RouteCurve';
