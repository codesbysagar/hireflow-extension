import { describe, it, expect, beforeEach } from 'vitest';
import { PostDeduplicator } from '../src/content/deduplicator.js';

describe('Post Deduplicator', () => {
  let deduplicator: PostDeduplicator;

  beforeEach(() => {
    deduplicator = new PostDeduplicator();
  });

  it('detects duplicates with identical post ID', () => {
    const post1 = {
      id: 'urn:li:activity:71829384918239',
      postUrl: 'https://www.linkedin.com/feed/update/urn:li:activity:71829384918239/',
      text: 'Hiring Go engineers! Email jobs@go.org',
      author: { name: 'John Doe' },
    };

    const post2 = {
      id: 'urn:li:activity:71829384918239',
      postUrl: 'https://www.linkedin.com/feed/update/urn:li:activity:71829384918239/?trackingId=abc',
      text: 'Different text rendering of same post',
      author: { name: 'John Doe' },
    };

    expect(deduplicator.markSeen(post1)).toBe(true);
    expect(deduplicator.isDuplicate(post2)).toBe(true);
    expect(deduplicator.markSeen(post2)).toBe(false);
  });

  it('detects duplicates with the same canonical URL', () => {
    const post1 = {
      id: 'unknown',
      postUrl: 'https://www.linkedin.com/posts/acme_hiring-backend-activity-12345/',
      text: 'Post text one',
      author: { name: 'Recruiter A' },
    };

    const post2 = {
      id: 'unknown',
      postUrl: 'https://www.linkedin.com/posts/acme_hiring-backend-activity-12345/?utm_source=share&utm_medium=member_desktop',
      text: 'Post text two',
      author: { name: 'Recruiter A' },
    };

    expect(deduplicator.markSeen(post1)).toBe(true);
    expect(deduplicator.isDuplicate(post2)).toBe(true);
  });

  it('detects duplicates by author and normalized text content hash', () => {
    const post1 = {
      id: 'unknown',
      text: 'We are hiring a Senior React Developer!\nLocation: Remote.\nEmail: jobs@react.dev',
      author: { name: 'Sarah Connor' },
    };

    const post2 = {
      id: 'unknown',
      // Same text with extra whitespace and carriage returns
      text: '  We are hiring a Senior React Developer!\r\n\r\nLocation: Remote.\r\nEmail: jobs@react.dev   ',
      author: { name: 'Sarah Connor' },
    };

    expect(deduplicator.markSeen(post1)).toBe(true);
    expect(deduplicator.isDuplicate(post2)).toBe(true);
  });

  it('allows distinct posts from different authors or different content', () => {
    const post1 = {
      id: 'post_1001',
      postUrl: 'https://www.linkedin.com/posts/post-1',
      text: 'Hiring Python Dev: apply@python.org',
      author: { name: 'Alice' },
    };

    const post2 = {
      id: 'post_1002',
      postUrl: 'https://www.linkedin.com/posts/post-2',
      text: 'Hiring Go Dev: apply@golang.org',
      author: { name: 'Bob' },
    };

    expect(deduplicator.markSeen(post1)).toBe(true);
    expect(deduplicator.markSeen(post2)).toBe(true);
    expect(deduplicator.size).toBe(2);
  });

  it('resets state when cleared', () => {
    const post = {
      id: 'activity_999',
      text: 'We need engineers: jobs@dev.io',
      author: { name: 'Charlie' },
    };

    deduplicator.markSeen(post);
    expect(deduplicator.isDuplicate(post)).toBe(true);

    deduplicator.clear();
    expect(deduplicator.isDuplicate(post)).toBe(false);
  });
});
