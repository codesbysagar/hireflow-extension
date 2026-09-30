import React from 'react';
import { AlertCircle, AlertTriangle, ExternalLink } from 'lucide-react';

interface StatusBannerProps {
  type: 'unsupported' | 'error';
  message: string;
  details?: string;
  onOpenLinkedIn?: () => void;
}

export const StatusBanner: React.FC<StatusBannerProps> = ({
  type,
  message,
  details,
  onOpenLinkedIn,
}) => {
  return (
    <div className={`status-banner ${type}`}>
      <div className="status-banner-header">
        {type === 'unsupported' ? (
          <AlertTriangle size={15} />
        ) : (
          <AlertCircle size={15} />
        )}
        <span>{type === 'unsupported' ? 'LinkedIn Page Required' : 'Scan Notice'}</span>
      </div>

      <div className="status-banner-body">{message}</div>

      {details && <div className="status-banner-body" style={{ opacity: 0.8 }}>{details}</div>}

      {type === 'unsupported' && (
        <>
          <ul className="status-banner-tips">
            <li>Search for hiring keywords (e.g., <em>"Golang hiring"</em>)</li>
            <li>Filter by <strong>Posts</strong></li>
            <li>Re-open HireFlow to extract verified contact emails</li>
          </ul>

          {onOpenLinkedIn && (
            <button
              onClick={onOpenLinkedIn}
              className="btn-secondary"
              style={{ marginTop: '8px', width: '100%' }}
            >
              Open LinkedIn Posts Search
              <ExternalLink size={12} />
            </button>
          )}
        </>
      )}
    </div>
  );
};
