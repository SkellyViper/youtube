import React, {useMemo} from 'react';
import {AbsoluteFill, Sequence, useVideoConfig} from 'remotion';
import {MountOffsetContext, TimelineContext} from './context';
import {buildTimeline, resolveRange} from './timeline';
import type {EpisodeDef} from './types';

type MountItem = {
  readonly key: string;
  readonly name: string;
  readonly start: number;
  readonly end: number;
  readonly z: number;
  readonly order: number;
  readonly Component: React.ComponentType;
};

/**
 * Renders an episode: every scene component is mounted for its scene range,
 * every layer for its declared range, all inside Remotion <Sequence>s (so they
 * show up as named tracks in Remotion Studio).
 *
 * This component is the single source of truth: Remotion renders it to MP4
 * and the presentation app plays it in @remotion/player.
 */
export const EpisodeComposition: React.FC<{readonly episode: EpisodeDef}> = ({episode}) => {
  const {fps} = useVideoConfig();
  const timeline = useMemo(() => buildTimeline(episode, fps), [episode, fps]);

  const items = useMemo<MountItem[]>(() => {
    const list: MountItem[] = [];
    let order = 0;
    episode.scenes.forEach((scene, i) => {
      if (!scene.component) return;
      const timed = timeline.scenes[i];
      list.push({
        key: `scene:${scene.id}`,
        name: `Scene ${i + 1} · ${scene.title}`,
        start: timed.start,
        end: timed.end,
        z: 0,
        order: order++,
        Component: scene.component,
      });
    });
    for (const layer of episode.layers ?? []) {
      const range = resolveRange(timeline, layer.from, layer.to);
      list.push({
        key: `layer:${layer.id}`,
        name: `Layer · ${layer.id}`,
        start: range.start,
        end: range.end,
        z: layer.z ?? 1,
        order: order++,
        Component: layer.component,
      });
    }
    return list.sort((a, b) => a.z - b.z || a.order - b.order);
  }, [episode, timeline]);

  return (
    <AbsoluteFill style={{backgroundColor: episode.background ?? '#000', overflow: 'hidden'}}>
      <TimelineContext.Provider value={timeline}>
        {items.map(({key, name, start, end, Component}) => (
          <Sequence key={key} name={name} from={start} durationInFrames={end - start}>
            <MountOffsetContext.Provider value={start}>
              <Component />
            </MountOffsetContext.Provider>
          </Sequence>
        ))}
      </TimelineContext.Provider>
    </AbsoluteFill>
  );
};
