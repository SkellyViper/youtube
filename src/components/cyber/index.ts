/**
 * Shared "obsidian neon" primitives for the Style Lab (and future episodes).
 * 2D pieces are exported here; 3D pieces live in './three' so that purely 2D
 * scenes do not pull three.js into their bundle chunk.
 */
export {SceneAtmosphere, CyberGrade} from './atmosphere/SceneAtmosphere';
export {Curve2, type Pt} from './svg/curve';
export {Trace, Comet2D, Node2D, glow} from './svg/Signal2D';
export {AgentGlyph} from './svg/AgentGlyph';
export {CyberFrame, RegionHighlight, type CyberFrameProps} from './frame/CyberFrame';
export {frameFor, fitMedia, reframe, lerpRect, type Rect} from './frame/fit';

// External media (first-class: every episode shows real sources and clips).
export * from './media/SourcePanel';
export * from './media/MediaPanel';
// Diagram pictograms in the instrument line language.
export * from './svg/Pictograms';
