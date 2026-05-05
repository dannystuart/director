import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import { CameraRig } from '../effects/CameraRig';
import { Vignette } from '../effects/Vignette';
import { Scanline } from '../effects/Scanline';
import { MockWebsite } from '../components/MockWebsite';
import { FloatingIcon } from '../components/director';

const DURATION = 90; // 3s at 30fps

export const Scene1Hero: React.FC = () => {
  const frame = useCurrentFrame();

  const rotateY = interpolate(frame, [0, DURATION], [-2, 1], {
    extrapolateRight: 'clamp',
  });
  const rotateX = interpolate(frame, [0, DURATION], [1, 2], {
    extrapolateRight: 'clamp',
  });
  const translateX = interpolate(frame, [0, DURATION], [0, 30], {
    extrapolateRight: 'clamp',
  });

  const pulseOpacity = interpolate(
    frame % 30,
    [0, 15, 30],
    [0.3, 1, 0.3],
  );

  return (
    <AbsoluteFill style={{ backgroundColor: '#0d1117' }}>
      <CameraRig
        perspective={1200}
        rotateX={rotateX}
        rotateY={rotateY}
        translateZ={0}
        translateX={translateX}
        scale={1.05}
      >
        <MockWebsite />
        <FloatingIcon active={false} pulseOpacity={pulseOpacity} />
      </CameraRig>

      <Vignette opacity={0.7} radius={65} />
      <Scanline opacity={0.03} />
    </AbsoluteFill>
  );
};
