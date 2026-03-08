import React from 'react';

interface VignetteProps {
  opacity?: number;
  radius?: number;
}

export const Vignette: React.FC<VignetteProps> = ({
  opacity = 0.8,
  radius = 70,
}) => {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        background: `radial-gradient(ellipse at center, transparent ${radius}%, rgba(0,0,0,${opacity}) 100%)`,
        zIndex: 100,
      }}
    />
  );
};
