import React, { useState } from 'react';
import { Sparkles, Download, Copy, CheckCheck, RefreshCw, UserCheck, ArrowLeft } from 'lucide-react';
import { MatchedJobCard } from './MatchedJobCard.js';
import type { MatchResults, MatchedJob } from '../../shared/types.js';

interface MatchResultsViewProps {
  results: MatchResults;
  totalScanned?: number;
  onBackToScraper: () => void;
  onNewScan: () => void;
}

export const MatchResultsView: React.FC<MatchResultsViewProps> = ({
  results,
  totalScanned,
  onBackToScraper,
  onNewScan,
}) => {
  const [copiedToast, setCopiedToast] = useState(false);

  const matchedJobs = results.matchedJobs || [];
  const candidateName = results.candidateName;
  const countRelevant = results.totalRelevantJobs ?? matchedJobs.length;
  const totalEvaluated = totalScanned ?? results.totalScanned ?? matchedJobs.length;

  const handleDownload = () => {
    const jsonStr = JSON.stringify(results, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hireflow-matches-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    const jsonStr = JSON.stringify(results, null, 2);
    await navigator.clipboard.writeText(jsonStr);
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 2000);
  };

  return (
    <div className="panel-card" style={{ gap: '12px' }}>
      <div className="match-results-header">
        <div>
          <div className="match-title-row">
            <Sparkles size={15} color="#8B5CF6" />
            <h2 className="match-headline">Candidate AI Matches</h2>
          </div>
          <div className="match-stats-text">
            Matched <strong style={{ color: 'var(--accent-mint)' }}>{countRelevant}</strong> relevant {countRelevant === 1 ? 'job' : 'jobs'}
            {totalEvaluated > 0 && (
              <> out of <strong>{totalEvaluated}</strong> scanned</>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={onBackToScraper}
            className="header-action-btn"
            title="Return to raw scraper posts"
          >
            <ArrowLeft size={11} />
            Scraper
          </button>
          <button
            onClick={onNewScan}
            className="header-action-btn"
            title="Start a new search and scan"
          >
            <RefreshCw size={11} />
            New
          </button>
        </div>
      </div>

      {candidateName && (
        <div className="candidate-badge-row">
          <UserCheck size={12} color="var(--accent-mint)" />
          <span>Profile: <strong>{candidateName}</strong></span>
        </div>
      )}

      {copiedToast && (
        <div className="toast-notice">
          <CheckCheck size={14} style={{ display: 'inline', marginRight: '6px' }} />
          Match results copied to clipboard!
        </div>
      )}

      {matchedJobs.length > 0 ? (
        <>
          <div className="results-header-actions">
            <button onClick={handleDownload} className="btn-primary" style={{ padding: '7px 10px', fontSize: '11px' }}>
              <Download size={13} />
              Export Matches
            </button>
            <button onClick={handleCopy} className="btn-secondary" style={{ padding: '7px 10px', fontSize: '11px' }}>
              <Copy size={13} />
              Copy JSON
            </button>
          </div>

          <div className="posts-list">
            {matchedJobs.map((job: MatchedJob, idx: number) => (
              <MatchedJobCard
                key={job.id || `${job.title}-${job.company}-${idx}`}
                job={job}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="empty-state-card" style={{ padding: '24px 12px' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px', textAlign: 'center' }}>
            No high-relevance matches found for the scanned batch against your portfolio. Try expanding your search criteria or keywords on LinkedIn.
          </p>
        </div>
      )}
    </div>
  );
};
