import React, { useState } from 'react';
import { Download, Copy, RefreshCw, CheckCheck, FileText, Sparkles } from 'lucide-react';
import { PostCard } from './PostCard.js';
import { formatFilenameDate } from '../../shared/utils.js';
import type { ScanProgress } from '../../shared/types.js';

interface ResultsViewProps {
  progress: ScanProgress;
  onNewScan: () => void;
  onAnalyzeBatch?: () => void;
}

export const ResultsView: React.FC<ResultsViewProps> = ({ progress, onNewScan, onAnalyzeBatch }) => {
  const [copiedToast, setCopiedToast] = useState(false);
  const posts = progress.posts || [];
  const isStopped = progress.state === 'stopped';

  // Construct structured export object as per Section 20
  const buildExportJson = () => {
    const exportData = {
      source: 'linkedin',
      extractedAt: new Date().toISOString(),
      searchUrl: progress.activeUrl || 'https://www.linkedin.com/search/results/content/',
      searchQuery: progress.activeQuery || undefined,
      totalScanned: progress.postsScanned,
      totalMatched: progress.postsMatched,
      posts: posts,
    };
    return JSON.stringify(exportData, null, 2);
  };

  const handleDownload = () => {
    const jsonStr = buildExportJson();
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = formatFilenameDate();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    const jsonStr = buildExportJson();
    await navigator.clipboard.writeText(jsonStr);
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 2000);
  };

  return (
    <div className="panel-card" style={{ gap: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {isStopped ? 'Extraction Stopped' : 'Extraction Complete'}
          </h2>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            Posts scanned: <strong>{progress.postsScanned}</strong> • Matched with email:{' '}
            <strong style={{ color: 'var(--accent-mint)' }}>{progress.postsMatched}</strong>
          </div>
        </div>

        <button onClick={onNewScan} className="header-action-btn" title="Start a new scan">
          <RefreshCw size={11} />
          New Scan
        </button>
      </div>

      {copiedToast && (
        <div className="toast-notice">
          <CheckCheck size={14} style={{ display: 'inline', marginRight: '6px' }} />
          JSON copied to clipboard!
        </div>
      )}

      {posts.length > 0 ? (
        <>
          <div className="results-header-actions">
            {onAnalyzeBatch && (
              <button
                onClick={onAnalyzeBatch}
                className="btn-primary"
                style={{
                  padding: '8px 10px',
                  background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
                  boxShadow: '0 2px 8px rgba(139, 92, 246, 0.35)',
                }}
                title="Send scraped posts to worker AI matching engine"
              >
                <Sparkles size={13} />
                Analyze with AI
              </button>
            )}
            <button onClick={handleDownload} className="btn-secondary" style={{ padding: '8px 10px' }}>
              <Download size={13} />
              Download JSON
            </button>
            <button onClick={handleCopy} className="btn-secondary">
              <Copy size={13} />
              Copy JSON
            </button>
          </div>

          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '4px' }}>
            Extracted Hiring Posts ({posts.length})
          </div>

          <div className="posts-list">
            {posts.map((post) => (
              <PostCard key={post.id || post.postUrl || Math.random().toString()} post={post} />
            ))}
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '20px 10px', color: 'var(--text-muted)' }}>
          <FileText size={24} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
          <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
            No hiring posts containing contact emails were found.
          </p>
          <p style={{ fontSize: '11px', marginTop: '4px' }}>
            We scanned {progress.postsScanned} available post(s), but none contained a publicly visible recruiter email address.
          </p>
          <button
            onClick={onNewScan}
            className="btn-primary"
            style={{ margin: '14px auto 0', display: 'inline-flex' }}
          >
            <RefreshCw size={12} />
            Try Another Search
          </button>
        </div>
      )}
    </div>
  );
};
