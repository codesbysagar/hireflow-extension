import { describe, it, expect } from 'vitest';
import {
  getExactTimestampFromActivityId,
  estimateTimestampFromRelative,
  LinkedInAdapter,
} from '../src/content/linkedin-adapter.js';

describe('Timestamp Extraction & Snowflake Decoding', () => {
  describe('getExactTimestampFromActivityId', () => {
    it('accurately decodes millisecond-exact Unix timestamp from a 19-digit LinkedIn Activity ID', () => {
      // Known LinkedIn snowflake ID
      const activityId = '7256595441629249537';
      const exactTime = getExactTimestampFromActivityId(activityId);

      expect(exactTime).not.toBeNull();
      expect(exactTime).toBe('2024-10-28T09:19:34.308Z');
    });

    it('accurately decodes synthesized 64-bit snowflake IDs with known timestamp', () => {
      const knownTimestamp = 1790761200000; // 2026-09-30T09:40:00.000Z
      const snowflakeId = ((BigInt(knownTimestamp) << 22n) | 1042n).toString();

      const decoded = getExactTimestampFromActivityId(snowflakeId);
      expect(decoded).toBe(new Date(knownTimestamp).toISOString());
    });

    it('gracefully returns null for non-snowflake IDs and hash IDs', () => {
      expect(getExactTimestampFromActivityId('post_bh6syl')).toBeNull();
      expect(getExactTimestampFromActivityId('')).toBeNull();
      expect(getExactTimestampFromActivityId('12345')).toBeNull();
    });
  });

  describe('estimateTimestampFromRelative', () => {
    const fixedNow = 1790760000000; // Fixed base timestamp

    it('estimates exact timestamp for hours ("4h")', () => {
      const estimated = estimateTimestampFromRelative('4h', fixedNow);
      expect(estimated).not.toBeNull();
      const expected = new Date(fixedNow - 4 * 3600 * 1000).toISOString();
      expect(estimated).toBe(expected);
    });

    it('estimates exact timestamp for days ("2d")', () => {
      const estimated = estimateTimestampFromRelative('2d', fixedNow);
      expect(estimated).not.toBeNull();
      const expected = new Date(fixedNow - 2 * 86400 * 1000).toISOString();
      expect(estimated).toBe(expected);
    });

    it('estimates exact timestamp for minutes ("30m")', () => {
      const estimated = estimateTimestampFromRelative('30m', fixedNow);
      expect(estimated).not.toBeNull();
      const expected = new Date(fixedNow - 30 * 60 * 1000).toISOString();
      expect(estimated).toBe(expected);
    });

    it('estimates exact timestamp for weeks ("1w")', () => {
      const estimated = estimateTimestampFromRelative('1w', fixedNow);
      expect(estimated).not.toBeNull();
      const expected = new Date(fixedNow - 7 * 86400 * 1000).toISOString();
      expect(estimated).toBe(expected);
    });

    it('returns null for non-relative strings', () => {
      expect(estimateTimestampFromRelative('Promoted')).toBeNull();
      expect(estimateTimestampFromRelative('')).toBeNull();
    });
  });

  describe('extractTimestampData in LinkedInAdapter', () => {
    const adapter = new LinkedInAdapter();

    it('prioritizes exact snowflake timestamp when valid activity ID is provided', () => {
      const container = document.createElement('div');
      const timeSpan = document.createElement('span');
      timeSpan.className = 'update-components-actor__sub-description';
      timeSpan.textContent = '4h • Edited';
      container.appendChild(timeSpan);

      const result = adapter.extractTimestampData(container, '7256595441629249537');
      expect(result.exactTimestamp).toBe('2024-10-28T09:19:34.308Z');
      expect(result.timestamp).toBe('4h');
    });

    it('extracts ISO timestamp from DOM datetime attribute if available', () => {
      const container = document.createElement('div');
      const timeEl = document.createElement('time');
      timeEl.setAttribute('datetime', '2026-09-30T04:44:22.000Z');
      timeEl.textContent = '5h';
      container.appendChild(timeEl);

      const result = adapter.extractTimestampData(container);
      expect(result.exactTimestamp).toBe('2026-09-30T04:44:22.000Z');
      expect(result.timestamp).toBe('5h');
    });

    it('falls back to relative estimation when only relative text is present', () => {
      const container = document.createElement('div');
      const span = document.createElement('span');
      span.className = 'update-components-actor__sub-description';
      span.textContent = '3h';
      container.appendChild(span);

      const result = adapter.extractTimestampData(container);
      expect(result.timestamp).toBe('3h');
      expect(result.exactTimestamp).toBeDefined();
      expect(typeof result.exactTimestamp).toBe('string');
    });

    it('extracts activity ID and exact timestamp from inner HTML fallback', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <button aria-label="Copy link to post urn:li:activity:7256595441629249537"></button>
        <span class="update-components-actor__sub-description">2d</span>
      `;

      const result = adapter.extractTimestampData(container);
      expect(result.exactTimestamp).toBe('2024-10-28T09:19:34.308Z');
      expect(result.timestamp).toBe('2d');
    });

    it('self-heals in parsePost: climbs from inner text element to outer card to extract author and exact timestamp', () => {
      // Outer card representing LinkedIn Search Result item
      const outerCard = document.createElement('li');
      outerCard.className = 'reusable-search__result-container artdeco-card';
      outerCard.setAttribute('data-chameleon-result-urn', 'urn:li:activity:7256595441629249537');

      // Actor header with author and timestamp link
      const actor = document.createElement('div');
      actor.className = 'update-components-actor';
      actor.innerHTML = `
        <span class="update-components-actor__name">Zaneta Wijaya</span>
        <span class="update-components-actor__description">Tech Recruiter</span>
        <span class="update-components-actor__sub-description">
          <a class="update-components-actor__sub-description-link" href="https://www.linkedin.com/feed/update/urn:li:activity:7256595441629249537">
            <span aria-hidden="true">4h • Edited</span>
          </a>
        </span>
      `;
      outerCard.appendChild(actor);

      // Inner text element (like expandable-text-box)
      const textContainer = document.createElement('div');
      textContainer.className = 'update-components-text';
      textContainer.innerHTML = `
        <div data-testid="expandable-text-box">
          We are hiring Golang & React Native Developer! Send your CV to zaneta.wijaya@idstar.group
        </div>
      `;
      outerCard.appendChild(textContainer);

      // Pass the INNER text container directly to extractPost
      const innerTextBox = textContainer.querySelector<HTMLElement>('[data-testid="expandable-text-box"]')!;
      const parsed = adapter.extractPost(innerTextBox);

      expect(parsed).not.toBeNull();
      // Should have climbed to outer card and extracted author
      expect(parsed?.author?.name).toBe('Zaneta Wijaya');
      // Should have extracted exact 19-digit activity ID
      expect(parsed?.id).toBe('7256595441629249537');
      // Should have extracted both relative and exact timestamps
      expect(parsed?.timestamp).toBe('4h');
      expect(parsed?.exactTimestamp).toBe('2024-10-28T09:19:34.308Z');
      expect(parsed?.emails).toContain('zaneta.wijaya@idstar.group');
    });

    it('extracts author, headline, exact timestamp, and post ID from LinkedIn Search Entity Results (.entity-result)', () => {
      // Simulates real LinkedIn Content Search Result DOM (from user screenshot)
      const outerLi = document.createElement('li');
      outerLi.className = 'reusable-search__result-container';
      outerLi.setAttribute('data-chameleon-result-urn', 'urn:li:activity:7256595441629249537');

      const entityResult = document.createElement('div');
      entityResult.className = 'entity-result';
      entityResult.innerHTML = `
        <div class="entity-result__content">
          <div class="entity-result__title-text">
            <a class="app-aware-link" href="https://www.linkedin.com/in/jamesrobert/">
              James R. • 3rd+
            </a>
          </div>
          <div class="entity-result__primary-subtitle">
            Founder 'World IT Jobs' | 110k+LinkedIn | Follow World IT Jobs ...
          </div>
          <div class="entity-result__secondary-subtitle">
            4h
          </div>
          <div class="update-components-text">
            <div data-testid="expandable-text-box">
              HIRING | Golang + Python + Kubernetes. Location: Bangalore. Interested candidates reach out to preethi.n@techilaservices.com
            </div>
          </div>
        </div>
      `;
      outerLi.appendChild(entityResult);

      const textBox = entityResult.querySelector<HTMLElement>('[data-testid="expandable-text-box"]')!;
      const post = adapter.extractPost(textBox);

      expect(post).not.toBeNull();
      // Verifies author name and headline extraction from search entity
      expect(post?.author?.name).toBe('James R.');
      expect(post?.author?.headline).toContain("Founder 'World IT Jobs'");
      expect(post?.author?.profileUrl).toBe('https://www.linkedin.com/in/jamesrobert/');
      // Verifies timestamp extraction from .entity-result__secondary-subtitle
      expect(post?.timestamp).toBe('4h');
      // Verifies exact snowflake timestamp from data-chameleon-result-urn on parent li
      expect(post?.id).toBe('7256595441629249537');
      expect(post?.exactTimestamp).toBe('2024-10-28T09:19:34.308Z');
      expect(post?.emails).toContain('preethi.n@techilaservices.com');
    });
  });
});

