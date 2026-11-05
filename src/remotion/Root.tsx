import React from 'react';
import {Composition, Folder} from 'remotion';
import {buildTimeline} from '../engine';
import {NotDetected} from '../videos/not-detected/NotDetected';
import {notDetectedEpisode} from '../videos/not-detected/episode';
import {RogueAgent} from '../videos/rogue-agent/RogueAgent';
import {rogueAgentEpisode} from '../videos/rogue-agent/episode';
import {LAB_FPS, LAB_SAMPLES, labInfo} from '../videos/style-lab/registry';

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
    </>
  );
};
