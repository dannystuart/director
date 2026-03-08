import React from 'react';

interface HighlightProps {
  rect: { x: number; y: number; width: number; height: number };
  label: string;
  glow?: number;
}

export const Highlight: React.FC<HighlightProps> = ({ rect, label, glow = 0 }) => {
  return (
    <>
      <div
        className="va-highlight"
        style={{
          left: rect.x,
          top: rect.y,
          width: rect.width,
          height: rect.height,
          boxShadow: glow > 0
            ? `0 0 ${20 * glow}px rgba(0, 255, 65, ${glow * 0.4}), inset 0 0 ${10 * glow}px rgba(0, 255, 65, ${glow * 0.1})`
            : undefined,
        }}
      />
      <div
        className="va-highlight-tooltip"
        style={{
          left: rect.x,
          top: rect.y - 24,
        }}
      >
        {label}
      </div>
    </>
  );
};
