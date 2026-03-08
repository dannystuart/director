import React from 'react';

interface CameraRigProps {
  perspective: number;
  rotateX: number;
  rotateY: number;
  translateZ: number;
  translateX?: number;
  translateY?: number;
  scale?: number;
  children: React.ReactNode;
}

export const CameraRig: React.FC<CameraRigProps> = ({
  perspective,
  rotateX,
  rotateY,
  translateZ,
  translateX = 0,
  translateY = 0,
  scale = 1,
  children,
}) => {
  return (
    <div
      style={{
        perspective: `${perspective}px`,
        perspectiveOrigin: '50% 50%',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          transformStyle: 'preserve-3d',
          transform: [
            `rotateX(${rotateX}deg)`,
            `rotateY(${rotateY}deg)`,
            `translateZ(${translateZ}px)`,
            `translateX(${translateX}px)`,
            `translateY(${translateY}px)`,
            `scale(${scale})`,
          ].join(' '),
        }}
      >
        {children}
      </div>
    </div>
  );
};
