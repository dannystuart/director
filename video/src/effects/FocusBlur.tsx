import React from 'react';

interface FocusBlurProps {
  blur: number;
  children: React.ReactNode;
}

export const FocusBlur: React.FC<FocusBlurProps> = ({ blur, children }) => {
  if (blur <= 0) return <>{children}</>;
  return (
    <div style={{ filter: `blur(${blur}px)`, width: '100%', height: '100%' }}>
      {children}
    </div>
  );
};
