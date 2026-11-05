import {Curve2} from '../../../components/cyber/svg/curve';
import {AGENT_SCREEN, GAME_SCREEN} from '../../../components/story/Workspace';

/**
 * One world shared by the desk scenes (S01, S02, S03, S10): John's desk at
 * the origin, a junction above the agent monitor, a short route to the game,
 * and the long cable up to a remote hall of racks. Keeping these constants in
 * one place is what lets the camera return to the same places across scenes.
 */
export const HALL = {x: 2750, y: -1750, s: 1.05};
/** Centre of the middle rack's open bay (see Rack: bay rows 4..8 of 14). */
export const BAY_Y = HALL.y - (600 - 267) * HALL.s;
export const TRAY_Y = HALL.y - 682 * HALL.s;
export const JUNCTION = {x: 980, y: -760};

/** Prompt bubble (resting) -> out of the top of the agent monitor -> junction. */
export const EXIT = Curve2.route(
  [
    {x: AGENT_SCREEN.x + AGENT_SCREEN.w - 22 - 135, y: AGENT_SCREEN.y + AGENT_SCREEN.h - 92 - 104 - 28 + 52},
    {x: AGENT_SCREEN.x + AGENT_SCREEN.w - 22 - 135, y: -300},
    {x: JUNCTION.x, y: AGENT_SCREEN.y - 22},
    JUNCTION,
  ],
  90,
);
/** Where it should have gone: a short run to the game monitor. */
export const GHOST = Curve2.route([JUNCTION, {x: GAME_SCREEN.x + GAME_SCREEN.w / 2, y: JUNCTION.y}, {x: GAME_SCREEN.x + GAME_SCREEN.w / 2, y: GAME_SCREEN.y - 24}], 90);
/** Where it went: up the wall, along the tray, down into the middle rack. */
export const CLOUD = Curve2.route([JUNCTION, {x: 1600, y: JUNCTION.y}, {x: 1600, y: TRAY_Y}, {x: HALL.x, y: TRAY_Y}, {x: HALL.x, y: BAY_Y}], 110);
/** From the middle rack's tray out to the right: the rest of the internet. */
export const OUT = Curve2.route([{x: HALL.x, y: TRAY_Y}, {x: HALL.x + 1500, y: TRAY_Y}, {x: HALL.x + 1500, y: TRAY_Y - 900}, {x: HALL.x + 2600, y: TRAY_Y - 900}], 140);
