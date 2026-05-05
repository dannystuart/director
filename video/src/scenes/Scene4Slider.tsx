import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from 'remotion';
import { CameraRig } from '../effects/CameraRig';
import { Vignette } from '../effects/Vignette';
import { MockWebsite } from '../components/MockWebsite';
import { FloatingIcon, AnnotationCard } from '../components/director';

const DURATION = 150; // 5s at 30fps

export const Scene4Slider: React.FC = () => {
  const frame = useCurrentFrame();

  const sliderValue = Math.round(
    interpolate(
      frame,
      [0, 50, 90, DURATION],
      [28, 52, 16, 40],
      { extrapolateRight: 'clamp' }
    )
  );

  const cardPadding = sliderValue;

  const translateZ = interpolate(frame, [0, DURATION], [300, -50], {
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });
  const rotateY = interpolate(frame, [0, DURATION], [0, -3], {
    extrapolateRight: 'clamp',
  });
  const scale = interpolate(frame, [0, DURATION], [1.3, 1.0], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  const pageBlur = interpolate(frame, [0, 60, 100, DURATION], [4, 3, 0, 0], {
    extrapolateRight: 'clamp',
  });
  const cardBlur = interpolate(frame, [0, 60, 100, DURATION], [0, 0, 0, 0], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#0d1117' }}>
      <CameraRig
        perspective={900}
        rotateX={1}
        rotateY={rotateY}
        translateZ={translateZ}
        translateX={-100}
        translateY={-40}
        scale={scale}
      >
        <div style={{ filter: `blur(${pageBlur}px)`, width: '100%', height: '100%' }}>
          <MockWebsite cardPadding={cardPadding} />
        </div>

        <div style={{ filter: `blur(${cardBlur}px)` }}>
          <AnnotationCard
            position={{ top: 200, left: 1100 }}
            number={1}
            selector="div.feature-card"
            comment="Padding feels too tight on feature cards."
            quickActions={['SPACING']}
            priority="medium"
            showSlider
            sliderValue={sliderValue}
            sliderLabel="padding"
          />
        </div>

        <FloatingIcon active />
      </CameraRig>

      <Vignette opacity={0.5} radius={70} />
    </AbsoluteFill>
  );
};
