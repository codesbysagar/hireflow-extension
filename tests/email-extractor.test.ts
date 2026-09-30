import { describe, it, expect } from 'vitest';
import {
  extractEmails,
  normalizeEmail,
  hasContactEmail,
} from '../src/content/email-extractor.js';

describe('Email Extractor', () => {
  it('extracts simple email addresses', () => {
    const text = 'Interested candidates can send their resume to: test@example.com';
    const emails = extractEmails(text);
    expect(emails).toEqual(['test@example.com']);
    expect(hasContactEmail(text)).toBe(true);
  });

  it('handles emails wrapped in angle brackets: <hiring@example.com>', () => {
    const text = 'Reach out to Hiring Team <hiring@example.com> for more info.';
    const emails = extractEmails(text);
    expect(emails).toEqual(['hiring@example.com']);
  });

  it('handles country-code subdomains: jobs@example.co.in', () => {
    const text = 'Contact: jobs@example.co.in';
    const emails = extractEmails(text);
    expect(emails).toEqual(['jobs@example.co.in']);
  });

  it('handles multiple slash-separated emails: hr@example.com / careers@example.com', () => {
    const text = 'Send your CV to hr@example.com / careers@example.com today!';
    const emails = extractEmails(text);
    expect(emails).toHaveLength(2);
    expect(emails).toContain('hr@example.com');
    expect(emails).toContain('careers@example.com');
  });

  it('deduplicates duplicate emails within the same post', () => {
    const text = 'Apply at jobs@acme.com or reach out again to jobs@acme.com if no response.';
    const emails = extractEmails(text);
    expect(emails).toEqual(['jobs@acme.com']);
  });

  it('handles parenthesis and trailing punctuation', () => {
    const text = 'Send resumes to (recruit@tech.io). Or write to dev@company.org, ASAP!';
    const emails = extractEmails(text);
    expect(emails).toEqual(['recruit@tech.io', 'dev@company.org']);
  });

  it('handles square brackets: [talent@startup.ai]', () => {
    const text = 'Direct application: [talent@startup.ai]';
    const emails = extractEmails(text);
    expect(emails).toEqual(['talent@startup.ai']);
  });

  it('extracts obfuscated emails like hr [at] company [dot] com', () => {
    const text = 'Email me directly at hr [at] company [dot] com with your portfolio.';
    const emails = extractEmails(text);
    expect(emails).toEqual(['hr@company.com']);
  });

  it('filters out image asset false-positives like logo@2x.png', () => {
    const text = 'Asset uploaded: banner@2x.png and avatar@3x.jpg';
    const emails = extractEmails(text);
    expect(emails).toEqual([]);
    expect(hasContactEmail(text)).toBe(false);
  });

  it('handles invalid email formats properly', () => {
    expect(normalizeEmail('')).toBeNull();
    expect(normalizeEmail('not-an-email')).toBeNull();
    expect(normalizeEmail('missing-domain@')).toBeNull();
    expect(normalizeEmail('@missing-user.com')).toBeNull();
    expect(normalizeEmail('user@domain')).toBeNull(); // missing TLD
  });

  it('converts uppercase emails to lowercase', () => {
    const text = 'Email: HIRING@BIGCORP.COM';
    const emails = extractEmails(text);
    expect(emails).toEqual(['hiring@bigcorp.com']);
  });

  it('returns false for posts without emails', () => {
    const text = 'We are hiring Golang developers. DM me if interested!';
    expect(extractEmails(text)).toEqual([]);
    expect(hasContactEmail(text)).toBe(false);
  });
});
