/**
 * Video 01 kit, 2D half (Legacy / Digital Noir): tokens and the framing for
 * real-world evidence. No three.js here, so 2D scenes stay light; the 3D
 * half is ./three.ts. Guide: docs/VIDEO_01_VISUAL_LANGUAGE.md.
 *
 *   video01                        the episode's tokens (figure, light, stage, camera, motion)
 *   SourcePanel, PassageHighlight  a document or article as a panel; a measured passage lit, the rest dimmed
 *   MediaPanel, useMediaTime       an image or a clip in the same frame, beat-driven playback
 *   CyberFrame, RegionHighlight    the frame itself (corner brackets, hairlines), for anything else shown as evidence
 *   AgentGlyph                     the agent as a mark, for diagrams (purple; red only when the story turns)
 *
 * All of them read colours from the theme: give the composition
 * `theme={video01.theme}` (story and shot compositions wrap themselves in a
 * ThemeProvider from that prop).
 */
export {video01} from '../../styles/video01';
export * from '../cyber/media/SourcePanel';
export * from '../cyber/media/MediaPanel';
export {CyberFrame, RegionHighlight, type CyberFrameProps} from '../cyber/frame/CyberFrame';
export {frameFor, fitMedia, reframe, lerpRect, type Rect} from '../cyber/frame/fit';
export {AgentGlyph} from '../cyber/svg/AgentGlyph';
