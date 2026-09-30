import React from 'react';
import { Sparkles, Brain, Cpu } from 'lucide-react';

interface AnalysisSpinnerProps {
  message?: string;
  totalPosts?: number;
}

export const AnalysisSpinner: React.FC<AnalysisSpinnerProps> = ({
  message = 'Matching posts against your candidate portfolio (AI analysis in progress)...',
  totalPosts,
}) => {
  return (
    <div className="panel-card ai-spinner-card">
      <div className="ai-spinner-container">
        <div className="ai-pulse-ring"></div>
        <div className="ai-spinner-icon-wrapper">
          <Brain size={26} className="ai-icon-pulse" color="var(--accent-mint)" />
        </div>
      </div>

      <div className="ai-spinner-text-group">
        <h3 className="ai-spinner-headline">
          <Sparkles size={14} color="#8B5CF6" style={{ display: 'inline', marginRight: '6px' }} />
          AI Matching In Progress
        </h3>
        <p className="ai-spinner-message">{message}</p>
        {typeof totalPosts === 'number' && totalPosts > 0 && (
          <span className="ai-posts-counter">
            Evaluating {totalPosts} scraped LinkedIn {totalPosts === 1 ? 'post' : 'posts'}
          </span>
        )}
      </div>

      <div className="ai-spinner-footer">
        <Cpu size={12} style={{ marginRight: '5px' }} />
        <span>Worker service • Exponential backoff with full jitter polling</span>
      </div>
    </div>
  );
};
