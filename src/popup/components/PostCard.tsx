import React, { useState } from 'react';
import { ExternalLink, Copy, Check, Mail } from 'lucide-react';
import type { RawHiringPost } from '../../shared/types.js';

interface PostCardProps {
  post: RawHiringPost;
}

export const PostCard: React.FC<PostCardProps> = ({ post }) => {
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  const authorName = post.author?.name || 'Recruiter: Not available';
  const headline = post.author?.headline;

  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 1500);
  };

  return (
    <div className="post-card">
      <div className="post-author-row">
        <div>
          <div className="post-author-name">{authorName}</div>
          {headline && <div className="post-author-headline" title={headline}>{headline}</div>}
        </div>
        {(post.timestamp || post.exactTimestamp) && (
          <span
            style={{ fontSize: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap', cursor: post.exactTimestamp ? 'help' : 'default' }}
            title={post.exactTimestamp ? `Posted: ${new Date(post.exactTimestamp).toLocaleString()}` : undefined}
          >
            {post.timestamp || (post.exactTimestamp ? new Date(post.exactTimestamp).toLocaleDateString() : '')}
          </span>
        )}
      </div>

      {post.matchedKeywords && post.matchedKeywords.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
          {post.matchedKeywords.slice(0, 4).map((kw) => (
            <span
              key={kw}
              style={{
                fontSize: '9px',
                padding: '1px 5px',
                borderRadius: '3px',
                background: 'rgba(255, 255, 255, 0.06)',
                color: 'var(--text-secondary)',
                textTransform: 'lowercase',
              }}
            >
              #{kw}
            </span>
          ))}
        </div>
      )}

      <div className="email-pill-container">
        {post.emails.map((email) => (
          <span
            key={email}
            className="email-pill"
            onClick={() => handleCopyEmail(email)}
            style={{ cursor: 'pointer' }}
            title="Click to copy email"
          >
            <Mail size={10} />
            {email}
            {copiedEmail === email ? (
              <Check size={10} style={{ color: 'var(--text-primary)' }} />
            ) : (
              <Copy size={10} style={{ opacity: 0.7 }} />
            )}
          </span>
        ))}
      </div>

      <div className="post-text-snippet" title={post.text}>
        {post.text}
      </div>

      <div className="post-card-footer">
        {post.postUrl ? (
          <a
            href={post.postUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="post-link"
          >
            Open LinkedIn Post
            <ExternalLink size={10} />
          </a>
        ) : (
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            LinkedIn Post URL not available
          </span>
        )}
      </div>
    </div>
  );
};
