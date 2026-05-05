import React from 'react';

interface AnnotationCardProps {
  position: { top: number; left: number };
  number: number;
  selector: string;
  comment: string;
  quickActions?: string[];
  priority?: 'high' | 'medium' | 'low';
  showSlider?: boolean;
  sliderValue?: number;
  sliderLabel?: string;
  opacity?: number;
  translateX?: number;
}

export const AnnotationCard: React.FC<AnnotationCardProps> = ({
  position,
  number,
  selector,
  comment,
  quickActions = [],
  priority = 'medium',
  showSlider = false,
  sliderValue = 28,
  sliderLabel = 'padding',
  opacity = 1,
  translateX = 0,
}) => {
  return (
    <div
      className="va-card"
      style={{
        top: position.top,
        left: position.left,
        opacity,
        transform: `translateX(${translateX}px)`,
        transition: 'none',
      }}
    >
      <div className="va-card-header">
        <span>#{number} {selector}</span>
        <button className="va-card-close">&times;</button>
      </div>

      <div className="va-comment-area">
        <div
          className="va-textarea"
          style={{
            minHeight: 60,
            whiteSpace: 'pre-wrap',
            padding: 8,
          }}
        >
          {comment}
          <span style={{ borderRight: '2px solid #00ff41', animation: 'none' }} />
        </div>
      </div>

      {quickActions.length > 0 && (
        <div className="va-quick-actions-section">
          <div className="va-section-label">Quick Actions</div>
          <div className="va-quick-actions">
            {quickActions.map((action) => (
              <button key={action} className="va-quick-action va-quick-action--active">
                {action}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="va-priority">
        <span className="va-priority-label">Priority</span>
        {(['high', 'medium', 'low'] as const).map((p) => (
          <button
            key={p}
            className={`va-priority-btn va-priority-btn--${p} ${p === priority ? 'va-priority-btn--active' : ''}`}
          >
            {p.toUpperCase()}
          </button>
        ))}
      </div>

      {showSlider && (
        <div style={{ padding: '8px 10px', borderBottom: '1px solid #333' }}>
          <div className="va-slider-row">
            <span className="va-slider-label">{sliderLabel}</span>
            <span className="va-slider-value">{sliderValue}px</span>
            <input
              className="va-slider-range"
              type="range"
              min={0}
              max={80}
              value={sliderValue}
              readOnly
            />
          </div>
        </div>
      )}

      <div className="va-card-actions">
        <button className="va-btn va-btn--danger">DELETE</button>
        <div className="va-card-actions-right">
          <button className="va-btn">CANCEL</button>
          <button className="va-btn va-btn--primary">SAVE</button>
        </div>
      </div>
    </div>
  );
};
