import React, { useState } from 'react';
import { ExternalLink, Copy, Check, Mail, Award, Compass, Building2, MapPin } from 'lucide-react';
import type { MatchedJob } from '../../shared/types.js';

interface MatchedJobCardProps {
  job: MatchedJob;
}

export const MatchedJobCard: React.FC<MatchedJobCardProps> = ({ job }) => {
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  const title = job.title || job.jobTitle || 'Hiring Opportunity';
  const company = job.company || 'Company Not Disclosed';

  // Normalize emails array
  const emails: string[] = Array.isArray(job.emails)
    ? job.emails
    : Array.isArray(job.recruiterEmails)
    ? job.recruiterEmails
    : Array.isArray(job.contactEmails)
    ? job.contactEmails
    : typeof job.recruiterEmails === 'string'
    ? [job.recruiterEmails]
    : typeof job.contactEmails === 'string'
    ? [job.contactEmails]
    : [];

  // Format relevance score and badge color
  const rawScore = job.relevanceScore ?? job.score;
  let scoreText = '';
  let scoreNum = 0;

  if (typeof rawScore === 'number') {
    scoreNum = rawScore <= 1 ? Math.round(rawScore * 100) : Math.round(rawScore);
    scoreText = `${scoreNum}%`;
  } else if (typeof rawScore === 'string') {
    scoreText = rawScore.includes('%') ? rawScore : `${rawScore}%`;
    scoreNum = parseInt(rawScore, 10) || 80;
  }

  const fitCategory =
    job.fitCategory ||
    (scoreNum >= 85 ? 'High Match' : scoreNum >= 70 ? 'Moderate Fit' : 'Potential Fit');

  const badgeColorClass =
    scoreNum >= 85
      ? 'badge-high'
      : scoreNum >= 70
      ? 'badge-moderate'
      : 'badge-low';

  const handleCopyEmail = (email: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 1500);
  };

  const rationale = job.rationale || job.reasoning;
  const recommendedAction = job.recommendedAction;

  return (
    <div className="matched-job-card">
      <div className="matched-job-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="matched-job-title-row">
            <h3 className="matched-job-title">{title}</h3>
            {job.postUrl && (
              <a
                href={job.postUrl}
                target="_blank"
                rel="noreferrer"
                className="post-link-icon"
                title="View original LinkedIn post"
              >
                <ExternalLink size={12} />
              </a>
            )}
          </div>
          <div className="matched-job-company-row">
            <Building2 size={11} style={{ marginRight: '4px' }} />
            <span>{company}</span>
            {job.location && (
              <>
                <span style={{ margin: '0 4px' }}>•</span>
                <MapPin size={10} style={{ marginRight: '2px' }} />
                <span>{job.location}</span>
              </>
            )}
          </div>
        </div>

        <div className={`score-badge ${badgeColorClass}`}>
          <Award size={11} style={{ marginRight: '3px' }} />
          <span>{scoreText ? `${scoreText} ${fitCategory}` : fitCategory}</span>
        </div>
      </div>

      {emails.length > 0 && (
        <div className="matched-recruiter-emails">
          <div className="field-label-small">Recruiter Contacts:</div>
          <div className="email-pill-container">
            {emails.map((email) => (
              <div key={email} className="email-action-group">
                <a
                  href={`mailto:${email}`}
                  className="email-pill email-pill-link"
                  title={`Send email to ${email}`}
                >
                  <Mail size={11} style={{ marginRight: '4px' }} />
                  {email}
                </a>
                <button
                  type="button"
                  className="email-copy-btn"
                  onClick={(e) => handleCopyEmail(email, e)}
                  title="Copy email to clipboard"
                >
                  {copiedEmail === email ? (
                    <Check size={11} color="var(--accent-mint)" />
                  ) : (
                    <Copy size={11} />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {rationale && (
        <div className="rationale-box">
          <div className="field-label-small">Match Rationale:</div>
          <p className="rationale-text">{rationale}</p>
        </div>
      )}

      {recommendedAction && (
        <div className="recommendation-box">
          <div className="recommendation-header">
            <Compass size={12} color="var(--accent-mint)" />
            <span>Recommended Action</span>
          </div>
          <p className="recommendation-text">{recommendedAction}</p>
        </div>
      )}
    </div>
  );
};
