import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from 'remotion';

const DURATION = 90; // 3s at 30fps
const MARKDOWN_PHASE = 55; // frames for markdown
const LOGO_PHASE = DURATION - MARKDOWN_PHASE; // frames for logo

const MOCK_MARKDOWN = `# UI Annotations — acme.dev

## Annotation #1 — button.cta-primary
- **Priority:** HIGH
- **Actions:** FONT, COLOR
- **Comment:** Button text is hard to read on mobile. Increase contrast and font size.
- **Current styles:**
  - font-size: 14px
  - color: #0d1117
  - background: #00ff41

## Annotation #2 — nav
- **Priority:** MEDIUM
- **Actions:** SPACING
- **Comment:** Nav items too close together on tablet viewport.

## Annotation #3 — div.feature-card
- **Priority:** LOW
- **Actions:** SPACING
- **Comment:** Padding feels too tight on feature cards.
- **Style change:** padding: 28px → 40px

## Annotation #4 — section.hero
- **Priority:** MEDIUM
- **Comment:** Hero heading line-height needs adjustment.

## Annotation #5 — h1
- **Priority:** HIGH
- **Actions:** FONT
- **Comment:** Heading font too large on small screens.`;

export const Scene6Logo: React.FC = () => {
  const frame = useCurrentFrame();
  const mono = "'Berkeley Mono', 'JetBrains Mono', 'Fira Code', monospace";

  const isLogoPhase = frame >= MARKDOWN_PHASE;

  if (!isLogoPhase) {
    const scrollY = interpolate(frame, [0, MARKDOWN_PHASE], [0, -400], {
      extrapolateRight: 'clamp',
    });

    return (
      <AbsoluteFill style={{ backgroundColor: '#0a0a0a' }}>
        <div
          style={{
            transform: `translateY(${scrollY}px)`,
            padding: '60px 200px',
            fontFamily: mono,
            fontSize: 14,
            color: '#c9d1d9',
            lineHeight: 1.8,
            whiteSpace: 'pre-wrap',
          }}
        >
          {MOCK_MARKDOWN.split('\n').map((line, i) => {
            let color = '#c9d1d9';
            if (line.startsWith('# ')) color = '#e6edf3';
            if (line.startsWith('## ')) color = '#00ff41';
            if (line.startsWith('- **')) color = '#8b949e';

            return (
              <div key={i} style={{ color, fontWeight: line.startsWith('#') ? 700 : 400 }}>
                {line || '\u00A0'}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    );
  }

  const logoFrame = frame - MARKDOWN_PHASE;

  const logoOpacity = interpolate(logoFrame, [0, 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  const glowIntensity = interpolate(logoFrame, [5, LOGO_PHASE], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          opacity: logoOpacity,
          fontFamily: mono,
          fontSize: 72,
          fontWeight: 700,
          color: '#00ff41',
          textShadow: [
            `0 0 ${20 * glowIntensity}px rgba(0, 255, 65, 0.8)`,
            `0 0 ${60 * glowIntensity}px rgba(0, 255, 65, 0.4)`,
            `0 0 ${100 * glowIntensity}px rgba(0, 255, 65, 0.2)`,
          ].join(', '),
          letterSpacing: 8,
        }}
      >
        DIRECTOR
      </div>
    </AbsoluteFill>
  );
};
