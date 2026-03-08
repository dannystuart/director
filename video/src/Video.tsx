import React from 'react';
import { AbsoluteFill } from 'remotion';

export const Video: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0a' }}>
      <div style={{ color: '#00ff41', fontSize: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        Director
      </div>
    </AbsoluteFill>
  );
};
