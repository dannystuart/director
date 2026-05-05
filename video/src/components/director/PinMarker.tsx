import React from 'react';

interface PinMarkerProps {
  number: number;
  x: number;
  y: number;
  priority?: 'high' | 'medium' | 'low';
  processed?: boolean;
}

export const PinMarker: React.FC<PinMarkerProps> = ({
  number,
  x,
  y,
  priority = 'medium',
  processed = false,
}) => {
  const cls = processed
    ? 'va-pin va-pin--processed'
    : `va-pin va-pin--${priority}`;

  return (
    <div
      className={cls}
      style={{
        position: 'absolute',
        left: x - 11,
        top: y - 11,
      }}
    >
      {processed ? '\u2713' : number}
    </div>
  );
};
