import React from 'react';
import { Square } from 'lucide-react';
import type { ScanProgress } from '../../shared/types.js';

interface ProgressViewProps {
  progress: ScanProgress;
  onStop: () => void;
}

export const ProgressView: React.FC<ProgressViewProps> = ({ progress, onStop }) => {
  const { state, targetCount, postsDiscovered, postsScanned, postsMatched } = progress;
  const percentage = Math.min(100, Math.round((postsMatched / (targetCount || 1)) * 100));

  const getStateDescription = () => {
    switch (state) {
      case 'preparing':
        return 'Preparing scanner...';
      case 'loading_more':
        return 'Loading more LinkedIn posts...';
      case 'scanning':
        return 'Scanning posts for emails...';
      default:
        return 'Processing...';
    }
  };

  return (
    <div className="panel-card progress-container">
      <div className="progress-header">
        <div className="progress-title-row">
          <div className="pulse-indicator" />
          <span style={{ fontWeight: 600, fontSize: '12px' }}>
            {getStateDescription()}
          </span>
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent-mint)' }}>
          {percentage}%
        </span>
      </div>

      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${percentage}%` }} />
      </div>

      <div className="stats-grid">
        <div className="stat-box">
          <div className="stat-value">{postsDiscovered}</div>
          <div className="stat-label">Discovered</div>
        </div>

        <div className="stat-box">
          <div className="stat-value">{postsScanned}</div>
          <div className="stat-label">Scanned</div>
        </div>

        <div className="stat-box">
          <div className="stat-value" style={{ color: 'var(--accent-mint)' }}>
            {postsMatched}
          </div>
          <div className="stat-label">With Email</div>
        </div>
      </div>

      <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-secondary)' }}>
        <strong style={{ color: 'var(--text-primary)' }}>{postsMatched}</strong> of{' '}
        <strong>{targetCount}</strong> target posts with email found
      </div>

      <button onClick={onStop} className="btn-danger" style={{ width: '100%' }}>
        <Square size={12} fill="currentColor" />
        Stop Extraction
      </button>
    </div>
  );
};
