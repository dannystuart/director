import React from 'react';
import { Series } from 'remotion';
import { Scene1Hero } from './scenes/Scene1Hero';
import { Scene2Hover } from './scenes/Scene2Hover';
import { Scene3Annotate } from './scenes/Scene3Annotate';
import { Scene4Slider } from './scenes/Scene4Slider';
import { Scene5Review } from './scenes/Scene5Review';
import { Scene6Logo } from './scenes/Scene6Logo';

export const Video: React.FC = () => {
  return (
    <Series>
      <Series.Sequence durationInFrames={90}>
        <Scene1Hero />
      </Series.Sequence>
      <Series.Sequence durationInFrames={120}>
        <Scene2Hover />
      </Series.Sequence>
      <Series.Sequence durationInFrames={120}>
        <Scene3Annotate />
      </Series.Sequence>
      <Series.Sequence durationInFrames={150}>
        <Scene4Slider />
      </Series.Sequence>
      <Series.Sequence durationInFrames={120}>
        <Scene5Review />
      </Series.Sequence>
      <Series.Sequence durationInFrames={90}>
        <Scene6Logo />
      </Series.Sequence>
    </Series>
  );
};
