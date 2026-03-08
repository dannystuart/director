import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from 'remotion';
import { CameraRig } from '../effects/CameraRig';
import { FocusBlur } from '../effects/FocusBlur';
import { Vignette } from '../effects/Vignette';
import { MockWebsite } from '../components/MockWebsite';
import { FloatingIcon, Highlight, AnnotationCard } from '../components/director';

const DURATION = 120; // 4s at 30fps

const FULL_COMMENT = 'Button text is hard to read on mobile. Increase contrast and font size.';
const TARGET_RECT = { x: 48, y: 340, width: 160, height: 44 };

export const Scene3Annotate: React.FC = () => {
  const frame = useCurrentFrame();

  const cardTranslateX = interpolate(frame, [0, 20], [100, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const cardOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const typedChars = Math.floor(
    interpolate(frame, [20, 100], [0, FULL_COMMENT.length], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
  );
  const visibleComment = FULL_COMMENT.slice(0, typedChars);

  const rotateY = interpolate(frame, [0, DURATION], [5, 2], {
    extrapolateRight: 'clamp',
  });
  const translateZ = interpolate(frame, [0, DURATION], [0, 100], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.quad),
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#0d1117' }}>
      <CameraRig
        perspective={1100}
        rotateX={2}
        rotateY={rotateY}
        translateZ={translateZ}
        translateX={-20}
        scale={1.08}
      >
        <FocusBlur blur={3}>
          <MockWebsite />
        </FocusBlur>

        <Highlight rect={TARGET_RECT} label="button.cta-primary" glow={0.5} />

        {typedChars > 0 && (
          <div
            style={{
              position: 'fixed',
              left: TARGET_RECT.x,
              top: TARGET_RECT.y + TARGET_RECT.height + 6,
              background: 'rgba(0, 255, 65, 0.12)',
              border: '1px solid rgba(0, 255, 65, 0.3)',
              color: '#00ff41',
              padding: '4px 8px',
              fontSize: 11,
              fontFamily: "'Berkeley Mono', monospace",
              maxWidth: 280,
              lineHeight: 1.4,
              whiteSpace: 'pre-wrap',
            }}
          >
            {visibleComment}
          </div>
        )}

        <AnnotationCard
          position={{ top: 200, left: 1100 }}
          number={1}
          selector="button.cta-primary"
          comment={visibleComment}
          quickActions={typedChars >= FULL_COMMENT.length ? ['FONT', 'COLOR'] : []}
          priority="high"
          opacity={cardOpacity}
          translateX={cardTranslateX}
        />

        <FloatingIcon active />
      </CameraRig>

      <Vignette opacity={0.5} radius={70} />
    </AbsoluteFill>
  );
};
