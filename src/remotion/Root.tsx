import React from 'react';
import {Composition, Folder} from 'remotion';
import {buildTimeline} from '../engine';
import {NotDetected} from '../videos/not-detected/NotDetected';
import {notDetectedEpisode} from '../videos/not-detected/episode';
import {RogueAgent} from '../videos/rogue-agent/RogueAgent';
import {rogueAgentEpisode} from '../videos/rogue-agent/episode';
import {LAB_FPS, LAB_SAMPLES, labInfo} from '../videos/style-lab/registry';
import {STORY_SCENES} from '../videos/style-lab/redesign';
import {CINEMATIC_SCENES} from '../videos/style-lab/cinematic';
import {DEFAULT_THEME} from '../styles/themes';
import {shotEpisode, type ShotPatch} from '../shot';

/**
 * Remotion registration. Durations are derived from the same timeline the
 * presentation app uses, so export length always matches the beat sheet.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Folder name="Episodes">
        <Composition
          id="NotDetected"
          component={NotDetected}
          fps={60}
          width={1920}
          height={1080}
          durationInFrames={buildTimeline(notDetectedEpisode, 60).durationInFrames}
        />
        {/* 30 fps compatibility variant: identical timing, half the frames. */}
        <Composition
          id="NotDetected30"
          component={NotDetected}
          fps={30}
          width={1920}
          height={1080}
          durationInFrames={buildTimeline(notDetectedEpisode, 30).durationInFrames}
        />
        <Composition
          id="RogueAgent"
          component={RogueAgent}
          fps={60}
          width={1920}
          height={1080}
          durationInFrames={buildTimeline(rogueAgentEpisode, 60).durationInFrames}
        />
      </Folder>
      {/* Style Lab: ten visual experiments (ids `lab-01-hero` ... `lab-10-ending`). */}
      <Folder name="StyleLab">
        {LAB_SAMPLES.map((sample) => {
          const info = labInfo(sample);
          return (
            <Composition
              key={sample.id}
              id={sample.id}
              component={sample.component as React.ComponentType<Record<string, unknown>>}
              fps={LAB_FPS}
              width={sample.episode.width ?? 1920}
              height={sample.episode.height ?? 1080}
              durationInFrames={info.durationInFrames}
              // Timing info for scripts/lab.mjs (the component ignores it).
              defaultProps={{lab: info}}
            />
          );
        })}
      </Folder>
      {/* Redesign: story-driven scenes (ids `story-02-wrong-project` ...). Theme is an input prop: --props='{"theme":"infrared"}'. */}
      <Folder name="Story">
        {STORY_SCENES.map((scene) => {
          const t = buildTimeline(scene.episode, LAB_FPS);
          return (
            <Composition
              key={scene.id}
              id={scene.id}
              component={scene.component as React.ComponentType<Record<string, unknown>>}
              fps={LAB_FPS}
              width={scene.episode.width ?? 1920}
              height={scene.episode.height ?? 1080}
              durationInFrames={t.durationInFrames}
              defaultProps={{theme: DEFAULT_THEME}}
            />
          );
        })}
      </Folder>
      {/* Cinematic 3D experiments (ids `cine-01-john` ...). Theme is an input prop, as for Story. */}
      <Folder name="Cinematic">
        {CINEMATIC_SCENES.map((scene) => {
          const t = buildTimeline(scene.episode, LAB_FPS);
          const {shot, baseEpisode} = scene;
          return (
            <Composition
              key={scene.id}
              id={scene.id}
              component={scene.component as React.ComponentType<Record<string, unknown>>}
              fps={LAB_FPS}
              width={scene.episode.width ?? 1920}
              height={scene.episode.height ?? 1080}
              durationInFrames={t.durationInFrames}
              defaultProps={{theme: DEFAULT_THEME}}
              // Editable shots: a `shot` prop (an editor draft passed with --props) can retime beats,
              // so the duration is derived from the props, exactly as the Player derives it.
              calculateMetadata={
                shot && baseEpisode
                  ? ({props}) => ({durationInFrames: buildTimeline(shotEpisode(shot, baseEpisode, (props as {shot?: ShotPatch}).shot), LAB_FPS).durationInFrames})
                  : undefined
              }
            />
          );
        })}
      </Folder>
    </>
  );
};
