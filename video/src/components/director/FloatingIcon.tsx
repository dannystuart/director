import React from 'react';

interface FloatingIconProps {
  active?: boolean;
  pulseOpacity?: number;
}

export const FloatingIcon: React.FC<FloatingIconProps> = ({
  active = false,
  pulseOpacity,
}) => {
  return (
    <button
      className={`va-floating-icon ${active ? 'va-floating-icon--active' : ''}`}
      style={{
        bottom: 20,
        right: 20,
        boxShadow:
          pulseOpacity !== undefined
            ? `0 0 ${12 * pulseOpacity}px rgba(0, 255, 65, ${pulseOpacity * 0.6})`
            : undefined,
      }}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="2" y="2" width="16" height="16" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <line x1="6" y1="7" x2="14" y2="7" stroke="currentColor" strokeWidth="1.5" />
        <line x1="6" y1="10" x2="14" y2="10" stroke="currentColor" strokeWidth="1.5" />
        <line x1="6" y1="13" x2="11" y2="13" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </button>
  );
};
