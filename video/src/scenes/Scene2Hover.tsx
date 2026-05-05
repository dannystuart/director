import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from 'remotion';
import { CameraRig } from '../effects/CameraRig';
import { FocusBlur } from '../effects/FocusBlur';
import { Vignette } from '../effects/Vignette';
import { MockWebsite } from '../components/MockWebsite';
import { FloatingIcon, Highlight } from '../components/director';

const DURATION = 120; // 4s at 30fps

const TARGET_RECT = { x: 48, y: 340, width: 160, height: 44 };

export const Scene2Hover: React.FC = () => {
  const frame = useCurrentFrame();

  const highlightOpacity = interpolate(frame, [10, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const glow = interpolate(frame, [20, 80], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const translateZ = interpolate(frame, [0, DURATION], [-100, 200], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const rotateX = interpolate(frame, [0, DURATION], [8, 5], {
    extrapolateRight: 'clamp',
  });
  const rotateY = interpolate(frame, [0, DURATION], [-6, -3], {
    extrapolateRight: 'clamp',
  });
  const translateX = interpolate(frame, [0, DURATION], [100, -50], {
    extrapolateRight: 'clamp',
  });
  const translateY = interpolate(frame, [0, DURATION], [0, -80], {
    extrapolateRight: 'clamp',
  });

  const bgBlur = interpolate(frame, [30, 80], [0, 4], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#0d1117' }}>
      <CameraRig
        perspective={1000}
        rotateX={rotateX}
        rotateY={rotateY}
        translateZ={translateZ}
        translateX={translateX}
        translateY={translateY}
        scale={1.1}
      >
        <FocusBlur blur={bgBlur}>
          <MockWebsite />
        </FocusBlur>

        {highlightOpacity > 0 && (
          <div style={{ opacity: highlightOpacity }}>
            <Highlight
              rect={TARGET_RECT}
              label="button.cta-primary"
              glow={glow}
            />
          </div>
        )}

        <FloatingIcon active />
      </CameraRig>

      <Vignette opacity={0.6} radius={60} />
    </AbsoluteFill>
  );
};
