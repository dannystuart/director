import React from 'react';

interface ControlPanelProps {
  visionMode?: boolean;
  copyState?: 'idle' | 'copied';
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  visionMode = true,
  copyState = 'idle',
}) => {
  return (
    <div className="va-control-panel">
      {[375, 768, 1024, null].map((w) => (
        <button
          key={w ?? 'full'}
          className={`va-viewport-preset ${w === null ? 'va-viewport-preset--active' : ''}`}
        >
          {w ? `${w}` : 'Full'}
        </button>
      ))}

      <div style={{ width: 1, height: 20, background: '#333' }} />

      <label className={`va-toggle ${visionMode ? 'va-toggle--active' : ''}`}>
        <span className="va-toggle-box">{visionMode ? '\u2713' : ''}</span>
        VISION
      </label>

      <button className="va-btn va-btn--primary" style={{ padding: '4px 10px', fontSize: 11 }}>
        {copyState === 'copied' ? 'COPIED!' : 'COPY'}
      </button>
    </div>
  );
};
