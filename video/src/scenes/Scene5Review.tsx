import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import { CameraRig } from '../effects/CameraRig';
import { Vignette } from '../effects/Vignette';
import { Scanline } from '../effects/Scanline';
import { MockWebsite } from '../components/MockWebsite';
import { FloatingIcon, PinMarker, ControlPanel } from '../components/director';

const DURATION = 120; // 4s at 30fps

const PINS = [
  { number: 1, x: 130, y: 352, priority: 'high' as const, processed: true },
  { number: 2, x: 600, y: 170, priority: 'medium' as const, processed: false },
  { number: 3, x: 280, y: 520, priority: 'low' as const, processed: false },
  { number: 4, x: 900, y: 490, priority: 'medium' as const, processed: true },
  { number: 5, x: 500, y: 620, priority: 'high' as const, processed: false },
];

export const Scene5Review: React.FC = () => {
  const frame = useCurrentFrame();

  const translateZ = interpolate(frame, [0, DURATION], [50, -200], {
    extrapolateRight: 'clamp',
  });
  const rotateY = interpolate(frame, [0, DURATION], [0, -4], {
    extrapolateRight: 'clamp',
  });
  const rotateX = interpolate(frame, [0, DURATION], [0, 3], {
    extrapolateRight: 'clamp',
  });

  const vignetteRadius = interpolate(frame, [0, DURATION], [75, 50], {
    extrapolateRight: 'clamp',
  });

  const pinVisibility = (index: number) =>
    interpolate(frame, [index * 12, index * 12 + 15], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });

  return (
    <AbsoluteFill style={{ backgroundColor: '#0d1117' }}>
      <CameraRig
        perspective={1400}
        rotateX={rotateX}
        rotateY={rotateY}
        translateZ={translateZ}
        scale={1.0}
      >
        <MockWebsite />

        {PINS.map((pin, i) => (
          <div key={pin.number} style={{ opacity: pinVisibility(i) }}>
            <PinMarker {...pin} />
          </div>
        ))}

        <ControlPanel visionMode copyState="idle" />
        <FloatingIcon active />
      </CameraRig>

      <Vignette opacity={0.8} radius={vignetteRadius} />
      <Scanline opacity={0.02} />
    </AbsoluteFill>
  );
};
