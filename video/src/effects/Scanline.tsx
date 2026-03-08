import React from 'react';

interface ScanlineProps {
  opacity?: number;
  lineHeight?: number;
}

export const Scanline: React.FC<ScanlineProps> = ({
  opacity = 0.03,
  lineHeight = 2,
}) => {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        backgroundImage: `repeating-linear-gradient(
          0deg,
          rgba(0, 0, 0, ${opacity}) 0px,
          rgba(0, 0, 0, ${opacity}) ${lineHeight}px,
          transparent ${lineHeight}px,
          transparent ${lineHeight * 2}px
        )`,
        zIndex: 101,
      }}
    />
  );
};
