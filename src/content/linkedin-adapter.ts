/**
 * HireFlow - LinkedIn Platform Adapter
 * Implements PlatformAdapter interface with layered DOM resilience, testid anchors,
 * container climbing, and scroll container target resolution.
 */

import {
  LINKEDIN_SELECTORS,
  SUPPORTED_LINKEDIN_PATTERNS,
  EXPAND_DELAY_MS,
  SCROLL_DELAY_MS,
  HIRING_INTENT_KEYWORDS,
  JOB_SEEKER_KEYWORDS,
} from '../shared/constants.js';
import { extractEmails } from './email-extractor.js';
import {
  delay,
  extractQueryFromUrl,
  hashString,
  normalizePostText,
} from '../shared/utils.js';
import type {
  ExtractionContext,
  PlatformAdapter,
  PostAuthor,
  RawHiringPost,
  SearchContext,
} from '../shared/types.js';

export class LinkedInAdapter implements PlatformAdapter {
  public readonly platformName = 'linkedin';

  /**
   * Checks whether the current or specified URL is a supported LinkedIn page.
   */
  public isSupportedPage(urlStr?: string): boolean {
    const targetUrl = urlStr || (typeof window !== 'undefined' ? window.location.href : '');
    if (!targetUrl) return false;

    try {
      const parsed = new URL(targetUrl);
      if (!parsed.hostname.includes('linkedin.com')) {
        return false;
      }
      return SUPPORTED_LINKEDIN_PATTERNS.some((pattern) => targetUrl.includes(pattern));
    } catch {
      return false;
    }
  }

  /**
   * Checks whether an element contains the post header (author, timestamp, or activity URN).
   */
  public hasPostHeader(element: HTMLElement): boolean {
    if (!element) return false;
    return Boolean(
      element.querySelector(
        '.entity-result__secondary-subtitle, .entity-result__title-text, .entity-result__primary-subtitle, .entity-result, .update-components-actor, .feed-shared-actor, [data-field="timestamp"], [data-view-name*="timestamp"], a[href*="activity"], time, [data-urn*="activity"], [data-chameleon-result-urn]'
      ) ||
      element.hasAttribute('data-chameleon-result-urn') ||
      element.getAttribute('data-urn')?.includes('urn:li:activity') ||
      element.getAttribute('data-id')?.includes('urn:li:activity') ||
      element.closest('[data-chameleon-result-urn]') !== null
    );
  }

  /**
   * Climbs the DOM tree from an inner post marker or text box to find the true post container.
   * Ensures the resulting container includes the post header (author, timestamp, URN).
   */
  public findPostContainer(el: HTMLElement): HTMLElement {
    // 1. Direct match on known full-card selectors using .closest()
    const cardSelectors = [
      'li.reusable-search__result-container',
      '.reusable-search__result-container',
      'div.entity-result',
      '.entity-result',
      'div.feed-shared-update-v2',
      'article.feed-shared-update-v2',
      'div.occludable-update',
      'div[data-chameleon-result-urn]',
      'div[data-urn*="urn:li:activity"]',
      'li[data-chameleon-result-urn]',
      'li.artdeco-card',
      'div.artdeco-card',
      'div.search-results-container li',
      'div[data-view-name*="search-entity"]',
      'div[data-view-name*="feed"]',
    ].join(', ');

    const direct = el.closest<HTMLElement>(cardSelectors);
    if (direct && this.hasPostHeader(direct)) {
      return direct;
    }

    // 2. Climb up parent chain prioritizing containers that contain the actor/timestamp/URN
    let node: HTMLElement | null = el;
    let candidate: HTMLElement | null = direct;

    for (let i = 0; i < 25; i++) {
      if (!node || node === document.body || node.tagName === 'MAIN') break;
      node = node.parentElement;
      if (!node) break;

      if (this.hasPostHeader(node)) {
        return node;
      }

      if (
        node.classList.contains('feed-shared-update-v2') ||
        node.classList.contains('artdeco-card') ||
        node.getAttribute('role') === 'article' ||
        (node.tagName === 'LI' && node.parentElement?.tagName === 'UL')
      ) {
        candidate = node;
      }
    }

    return candidate || el.parentElement || el;
  }

  /**
   * Finds all rendered post elements on the page using a multi-pass layered strategy:
   * Pass 1: testid-based text boxes anchor matching
   * Pass 2: Direct search and feed container selectors
   * Pass 3: Invariant post markers bottom-up traversal
   */
  public findPosts(): HTMLElement[] {
    if (typeof document === 'undefined') return [];

    const foundElements: HTMLElement[] = [];
    const seenElements = new Set<HTMLElement>();

    // Pass 1: TestID Anchor Strategy (LinkedIn modern UI)
    try {
      const textBoxes = document.querySelectorAll<HTMLElement>(LINKEDIN_SELECTORS.textBoxes);
      if (textBoxes.length > 0) {
        for (const tb of Array.from(textBoxes)) {
          const container = this.findPostContainer(tb);
          if (container && !seenElements.has(container) && this.isValidPostElement(container)) {
            seenElements.add(container);
            foundElements.push(container);
          }
        }
        if (foundElements.length > 0) {
          return foundElements;
        }
      }
    } catch {
      // Continue to next pass
    }

    // Pass 2: Direct Container Selectors
    for (const selector of LINKEDIN_SELECTORS.postContainers) {
      try {
        const matches = document.querySelectorAll<HTMLElement>(selector);
        for (const el of Array.from(matches)) {
          if (!seenElements.has(el) && this.isValidPostElement(el)) {
            const isChildOfSeen = Array.from(seenElements).some((seen) => seen.contains(el));
            if (!isChildOfSeen) {
              seenElements.add(el);
              foundElements.push(el);
            }
          }
        }
      } catch (err) {
        console.warn(`[HireFlow] Selector query failed: ${selector}`, err);
      }
    }

    // Pass 3: Bottom-Up Semantic Discovery via Markers
    if (foundElements.length === 0) {
      for (const markerSelector of LINKEDIN_SELECTORS.postMarkers) {
        try {
          const markers = document.querySelectorAll<HTMLElement>(markerSelector);
          for (const marker of Array.from(markers)) {
            const card = this.findPostContainer(marker);
            if (card && !seenElements.has(card) && this.isValidPostElement(card)) {
              const isChildOfSeen = Array.from(seenElements).some((seen) => seen.contains(card));
              if (!isChildOfSeen) {
                seenElements.add(card);
                foundElements.push(card);
              }
            }
          }
        } catch {
          // Continue to next marker
        }
      }
    }

    return foundElements;
  }

  /**
   * Expands collapsed "...see more" buttons so full post text and email addresses become visible.
   */
  public async expandPostText(element: HTMLElement): Promise<void> {
    for (const btnSelector of LINKEDIN_SELECTORS.seeMoreButtons) {
      const button = element.querySelector<HTMLElement>(btnSelector);
      if (button && typeof button.click === 'function') {
        try {
          button.click();
          await delay(EXPAND_DELAY_MS);
          return;
        } catch {
          // Fall through
        }
      }
    }

    const buttons = element.querySelectorAll<HTMLElement>('button, span[role="button"]');
    for (const btn of Array.from(buttons)) {
      const label = (btn.getAttribute('aria-label') || btn.innerText || btn.textContent || '').trim().toLowerCase();
      if (label.includes('see more') || label.includes('…more') || label.includes('...more') || label === 'more') {
        try {
          btn.click();
          await delay(EXPAND_DELAY_MS);
          return;
        } catch {
          // Ignore
        }
      }
    }
  }

  /**
   * Extracts raw post information from a post element.
   * Returns null if no valid contact email is present in the post.
   */
  public extractPost(element: HTMLElement, context?: ExtractionContext): RawHiringPost | null {
    // 1. Extract post text via targeted containers
    let text = this.extractPostText(element);

    // 2. Email Detection on extracted text + element (including mailto: links)
    let emails = extractEmails(text, element);

    // 3. Fallback: If targeted sub-selectors missed the email, check element's full innerText / textContent
    if (emails.length === 0) {
      const fullText = this.extractDomText(element);
      const fallbackEmails = extractEmails(fullText, element);
      if (fallbackEmails.length > 0) {
        emails = fallbackEmails;
        text = this.cleanCardText(fullText);
      }
    }

    // CRITICAL FILTER: Only include if email is detected
    if (emails.length === 0) {
      return null;
    }

    // Ensure element is the outer post container so author, timestamp, and activity ID are accessible
    let postCard = element;
    if (!this.hasPostHeader(postCard)) {
      const outerCard = this.findPostContainer(postCard);
      if (outerCard && outerCard !== postCard) {
        postCard = outerCard;
      }
    }

    // 4. Extract Post ID
    const id = this.extractPostId(postCard, text);

    // 5. Extract Post URL
    const postUrl = this.extractPostUrl(postCard);

    // 6. Extract Author Information
    const author = this.extractAuthor(postCard);

    // 7. Extract Timestamp (both relative and exact)
    const { timestamp, exactTimestamp } = this.extractTimestampData(postCard, id);

    // 8. Search Context
    const searchContext = context || this.getSearchContext();

    // 9. Hiring Intent and Keyword Analysis
    const lowerText = text.toLowerCase();
    const matchedKeywords: string[] = [];

    for (const kw of HIRING_INTENT_KEYWORDS) {
      if (lowerText.includes(kw) && !matchedKeywords.includes(kw)) {
        matchedKeywords.push(kw);
      }
    }

    if (searchContext.query) {
      const queryTerms = searchContext.query.toLowerCase().split(/\s+/);
      for (const term of queryTerms) {
        if (term.length > 2 && lowerText.includes(term) && !matchedKeywords.includes(term)) {
          matchedKeywords.push(term);
        }
      }
    }

    const isJobSeeker = JOB_SEEKER_KEYWORDS.some((kw) => lowerText.includes(kw));
    const isHiringPost = !isJobSeeker && (matchedKeywords.length > 0 || Boolean(searchContext.pageUrl?.includes('/search/')));

    const post: RawHiringPost = {
      id,
      platform: 'linkedin',
      text: normalizePostText(text),
      emails,
      extractedAt: new Date().toISOString(),
      isHiringPost,
      ...(matchedKeywords.length > 0 ? { matchedKeywords } : {}),
      ...(timestamp ? { timestamp } : {}),
      ...(exactTimestamp ? { exactTimestamp } : {}),
      ...(postUrl ? { postUrl } : {}),
      ...(author ? { author } : {}),
      ...(searchContext ? { searchContext } : {}),
    };

    return post;
  }

  /**
   * Extracts text safely preserving newlines around <br> and block elements
   */
  public extractDomText(element: HTMLElement): string {
    if (!element) return '';
    try {
      const clone = element.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
      clone.querySelectorAll('p, div, li, h1, h2, h3, h4, h5, h6, section, article').forEach((el) => {
        el.insertAdjacentText('afterend', '\n');
      });
      return clone.textContent || '';
    } catch {
      return element.innerText || element.textContent || '';
    }
  }

  /**
   * Extracts the primary text from the post element.
   */
  public extractPostText(element: HTMLElement): string {
    // Check expandable text box first
    const textBox = element.querySelector<HTMLElement>(LINKEDIN_SELECTORS.textBoxes);
    if (textBox) {
      const clone = textBox.cloneNode(true) as HTMLElement;
      const btn = clone.querySelector(LINKEDIN_SELECTORS.expandButton);
      if (btn) btn.remove();
      const content = this.extractDomText(clone);
      if (content.trim().length > 10) {
        return content.trim();
      }
    }

    // Attempt targeted post text containers
    for (const selector of LINKEDIN_SELECTORS.postTextContainers) {
      const textNode = element.querySelector<HTMLElement>(selector);
      if (textNode) {
        const content = this.extractDomText(textNode);
        if (content.trim().length > 15) {
          return content.trim();
        }
      }
    }

    const raw = this.extractDomText(element);
    return this.cleanCardText(raw);
  }

  /**
   * Cleans UI boilerplate (social action buttons, counts) from raw card text
   */
  private cleanCardText(raw: string): string {
    if (!raw) return '';
    return raw
      .replace(/\b(Like|Comment|Repost|Send)\b/g, '')
      .replace(/\b\d+\s+(comments?|reposts?)\b/gi, '')
      .trim();
  }

  /**
   * Extracts the post ID from data attributes, URNs, or text hash fallback.
   */
  /**
   * Extracts the post ID from data attributes, URNs, permalinks, or text hash fallback.
   * Prioritizes capturing the 18-20 digit LinkedIn activity ID for exact snowflake timestamp decoding.
   */
  private extractPostId(element: HTMLElement, text: string): string {
    // 1. Check data attributes on container, ancestors (e.g. li.reusable-search__result-container), or descendants
    const urnEl =
      element.hasAttribute('data-chameleon-result-urn') ||
      element.hasAttribute('data-urn') ||
      element.hasAttribute('data-id')
        ? element
        : element.closest<HTMLElement>('[data-chameleon-result-urn], [data-urn], [data-id]') ||
          element.querySelector<HTMLElement>('[data-chameleon-result-urn], [data-urn], [data-id]');

    const rawUrn =
      urnEl?.getAttribute('data-chameleon-result-urn') ||
      urnEl?.getAttribute('data-urn') ||
      urnEl?.getAttribute('data-id');

    if (rawUrn) {
      const match = rawUrn.match(/(?:activity|share|ugcPost)[:\-_]([0-9]{18,20})/i);
      if (match && match[1]) {
        return match[1];
      }
      const genericMatch = rawUrn.match(/urn:li:(?:activity|share|ugcPost):([0-9]+)/);
      if (genericMatch && genericMatch[1]) {
        return genericMatch[1];
      }
    }

    // 2. Check permalinks or update links with activity ID
    const card = element.closest<HTMLElement>('li, .entity-result, .artdeco-card') || element;
    const linkWithActivity = card.querySelector<HTMLAnchorElement>(
      'a[href*="activity-"], a[href*="activity:"], a[href*="activity%3A"], a[href*="urn:li:activity"], a[href*="urn:li:share"]'
    );
    if (linkWithActivity && linkWithActivity.href) {
      const match = linkWithActivity.href.match(/(?:activity[:\-_]|activity%3A|urn:li:activity:)([0-9]{18,20})/i);
      if (match && match[1]) {
        return match[1];
      }
    }

    // 3. Check action buttons or controls containing activity ID
    const controlWithActivity = card.querySelector<HTMLElement>(
      'button[aria-label*="activity:"], button[data-control-name*="activity"], [data-id*="activity"]'
    );
    if (controlWithActivity) {
      const label =
        controlWithActivity.getAttribute('aria-label') ||
        controlWithActivity.getAttribute('data-id') ||
        '';
      const match = label.match(/activity:([0-9]{18,20})/i);
      if (match && match[1]) {
        return match[1];
      }
    }

    // 4. Robust Fallback: Scan full card and parent <li> HTML for any 18-20 digit LinkedIn activity ID
    const html = card.outerHTML || card.innerHTML || '';
    const htmlMatch = html.match(/(?:activity[:\-_]|activity%3A|urn:li:activity:)([0-9]{18,20})/i);
    if (htmlMatch && htmlMatch[1]) {
      return htmlMatch[1];
    }

    return `post_${hashString(text.slice(0, 100))}`;
  }

  /**
   * Extracts the permalink to the LinkedIn post.
   */
  private extractPostUrl(element: HTMLElement): string | undefined {
    const card = element.closest<HTMLElement>('li, .entity-result, .artdeco-card') || element;

    for (const selector of LINKEDIN_SELECTORS.postLinks) {
      const link = card.querySelector<HTMLAnchorElement>(selector);
      if (link && link.href && link.href.includes('linkedin.com')) {
        try {
          const url = new URL(link.href, 'https://www.linkedin.com');
          return `${url.origin}${url.pathname}`;
        } catch {
          return link.href.split('?')[0];
        }
      }
    }

    const urn =
      card.getAttribute('data-chameleon-result-urn') ||
      card.getAttribute('data-urn') ||
      card.getAttribute('data-id') ||
      card.closest('[data-chameleon-result-urn]')?.getAttribute('data-chameleon-result-urn');

    if (urn) {
      const match = urn.match(/activity:([0-9]+)/);
      if (match && match[1]) {
        return `https://www.linkedin.com/feed/update/urn:li:activity:${match[1]}`;
      }
    }

    return undefined;
  }

  /**
   * Extracts both relative timestamp (e.g. "4h", "2d") and exact ISO timestamp.
   * Attempts:
   * 1. 64-bit Snowflake ID decoding (millisecond-exact Unix time)
   * 2. <time datetime="..."> attribute or DOM title/aria-label parsing
   * 3. Relative text estimation from current scrape time
   */
  public extractTimestampData(
    element: HTMLElement,
    postId?: string
  ): { timestamp?: string; exactTimestamp?: string } {
    const card = element.closest<HTMLElement>('li, .entity-result, .artdeco-card') || element;

    // 1. Check Snowflake ID first (exact to millisecond)
    let exactTimestamp: string | undefined;
    if (postId) {
      const snowflakeTime = getExactTimestampFromActivityId(postId);
      if (snowflakeTime) {
        exactTimestamp = snowflakeTime;
      }
    }

    // If postId was not a snowflake ID, check element and card HTML for an activity ID
    if (!exactTimestamp) {
      const html = card.outerHTML || card.innerHTML || '';
      const htmlMatch = html.match(/(?:activity[:\-_]|activity%3A|urn:li:activity:)([0-9]{18,20})/i);
      if (htmlMatch && htmlMatch[1]) {
        const snowflakeTime = getExactTimestampFromActivityId(htmlMatch[1]);
        if (snowflakeTime) {
          exactTimestamp = snowflakeTime;
        }
      }
    }

    // 2. Scan DOM for timestamp element (prioritizing card-wide selectors)
    let relativeText: string | undefined;
    for (const selector of LINKEDIN_SELECTORS.timestamp) {
      const el = card.querySelector<HTMLElement>(selector);
      if (el) {
        // Check for <time datetime="..."> attribute
        const datetimeAttr = el.getAttribute('datetime');
        if (datetimeAttr && !exactTimestamp) {
          const parsed = Date.parse(datetimeAttr);
          if (!isNaN(parsed)) {
            exactTimestamp = new Date(parsed).toISOString();
          }
        }

        // Check for tooltip title attribute e.g. "Wednesday, September 30, 2026, 10:14 AM"
        const titleAttr = el.getAttribute('title') || el.closest('a')?.getAttribute('title');
        if (titleAttr && !exactTimestamp) {
          const parsed = Date.parse(titleAttr);
          if (!isNaN(parsed)) {
            exactTimestamp = new Date(parsed).toISOString();
          }
        }

        let t = el.textContent?.trim().split('•')[0].trim() || '';
        t = t.replace(/\s+/g, ' ').replace(/•/g, '').trim();

        const relMatch = t.match(/\b(\d+\s*(?:s|m|h|d|w|mo|y|sec|min|hour|day|week|month|year)s?(?:\s+ago)?|yesterday|just now)\b/i);
        if (relMatch) {
          relativeText = relMatch[1];
          break;
        } else if (t.length > 0 && t.length < 30) {
          relativeText = t;
          break;
        }
      }
    }

    // Scan sub-description containers or search entity subtitles if relativeText was not captured by selectors
    if (!relativeText) {
      const subDesc = card.querySelector<HTMLElement>(
        '.entity-result__secondary-subtitle, .update-components-actor__sub-description, .feed-shared-actor__sub-description, a[data-field="timestamp"], a[data-view-name*="timestamp"]'
      );
      if (subDesc) {
        const text = subDesc.textContent?.trim() || '';
        const match = text.match(/\b(\d+\s*(?:s|m|h|d|w|mo|y|sec|min|hour|day|week|month|year)s?(?:\s+ago)?|yesterday|just now)\b/i);
        if (match) {
          relativeText = match[1];
        }
      }
    }

    // 3. Fallback: estimate exact timestamp from relative text (e.g. "4h" -> Date.now() - 4h)
    if (!exactTimestamp && relativeText) {
      const estimated = estimateTimestampFromRelative(relativeText);
      if (estimated) {
        exactTimestamp = estimated;
      }
    }

    // 4. If exact timestamp was found via snowflake ID, but relative text was missing, synthesize relative text
    if (exactTimestamp && !relativeText) {
      const diffMs = Date.now() - new Date(exactTimestamp).getTime();
      if (diffMs >= 0) {
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        if (diffDays > 0) relativeText = `${diffDays}d`;
        else if (diffHours > 0) relativeText = `${diffHours}h`;
        else relativeText = `${Math.max(1, diffMins)}m`;
      }
    }

    return {
      ...(relativeText ? { timestamp: relativeText } : {}),
      ...(exactTimestamp ? { exactTimestamp } : {}),
    };
  }

  /**
   * Backwards-compatible timestamp extractor
   */
  public extractTimestamp(element: HTMLElement): string | undefined {
    return this.extractTimestampData(element).timestamp;
  }

  /**
   * Extracts author details: name, profileUrl, and headline.
   */
  private extractAuthor(element: HTMLElement): PostAuthor | undefined {
    const card = element.closest<HTMLElement>('li, .entity-result, .artdeco-card') || element;
    let name: string | undefined;
    let headline: string | undefined;
    let profileUrl: string | undefined;

    // Author Name
    for (const selector of LINKEDIN_SELECTORS.authorName) {
      const nameEl = card.querySelector<HTMLElement>(selector);
      if (nameEl && (nameEl.innerText || nameEl.textContent)) {
        let cleaned = (nameEl.innerText || nameEl.textContent || '').trim();
        cleaned = cleaned.replace(/\s*•\s*(?:1st|2nd|3rd\+?|\d\w+).*$/gi, '').trim();
        if (cleaned && cleaned.length > 1 && cleaned.length < 100) {
          name = cleaned;
          break;
        }
      }
    }

    // Author Headline
    for (const selector of LINKEDIN_SELECTORS.authorHeadline) {
      const headlineEl = card.querySelector<HTMLElement>(selector);
      if (headlineEl && (headlineEl.innerText || headlineEl.textContent)) {
        const cleaned = (headlineEl.innerText || headlineEl.textContent || '').trim();
        if (cleaned && cleaned.length > 3 && cleaned.length < 250) {
          headline = cleaned;
          break;
        }
      }
    }

    // Author Profile Link
    for (const selector of LINKEDIN_SELECTORS.authorProfileLink) {
      const link = card.querySelector<HTMLAnchorElement>(selector);
      if (link && link.href && link.href.includes('/in/')) {
        try {
          const url = new URL(link.href, 'https://www.linkedin.com');
          profileUrl = `${url.origin}${url.pathname}`;
          break;
        } catch {
          profileUrl = link.href.split('?')[0];
          break;
        }
      }
    }

    if (!name && !profileUrl && !headline) {
      return undefined;
    }

    return {
      ...(name ? { name } : {}),
      ...(profileUrl ? { profileUrl } : {}),
      ...(headline ? { headline } : {}),
    };
  }

  /**
   * Determines if an element qualifies as a valid post card.
   */
  private isValidPostElement(element: HTMLElement): boolean {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return false;
    const text = element.innerText || element.textContent || '';
    if (text.length < 30) return false;
    if (element.closest('header, nav, #global-nav, .global-nav')) return false;
    return true;
  }

  /**
   * Resolves the active scroll container on LinkedIn (search container vs main window)
   */
  private getScrollTarget(): HTMLElement | null {
    if (typeof window === 'undefined' || typeof document === 'undefined') return null;

    if (window.location.href.includes('/search/')) {
      const candidates = [
        document.querySelector<HTMLElement>('.scaffold-layout__main'),
        document.querySelector<HTMLElement>('.search-results-container'),
        document.querySelector<HTMLElement>('main'),
      ];
      for (const el of candidates) {
        if (el && el.scrollHeight > el.clientHeight) return el;
      }
    }
    return null;
  }

  /**
   * Scrolls the page to trigger LinkedIn's dynamic infinite loading.
   */
  public async loadMore(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    const scrollTarget = this.getScrollTarget();

    if (scrollTarget) {
      const prevTop = scrollTarget.scrollTop;
      const prevHeight = scrollTarget.scrollHeight;
      scrollTarget.scrollTo({ top: scrollTarget.scrollHeight, behavior: 'smooth' });

      await delay(SCROLL_DELAY_MS);

      const newTop = scrollTarget.scrollTop;
      const newHeight = scrollTarget.scrollHeight;
      return newHeight > prevHeight || newTop > prevTop;
    } else {
      const prevY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
      const prevHeight = document.documentElement.scrollHeight || document.body.scrollHeight;
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });

      await delay(SCROLL_DELAY_MS);

      const newY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
      const newHeight = document.documentElement.scrollHeight || document.body.scrollHeight;
      return newHeight > prevHeight || newY > prevY;
    }
  }

  /**
   * Captures search context from the active page URL.
   */
  public getSearchContext(): SearchContext {
    if (typeof window === 'undefined') return {};
    const pageUrl = window.location.href;
    const query = extractQueryFromUrl(pageUrl);
    return {
      pageUrl,
      ...(query ? { query } : {}),
    };
  }
}

/**
 * Extracts exact millisecond timestamp from a 64-bit LinkedIn Snowflake ID.
 * In LinkedIn's snowflake scheme, the first 41 bits represent milliseconds since Unix Epoch.
 * By right-shifting 22 bits (BigInt(id) >> 22n), we recover the exact timestamp down to the millisecond.
 */
export function getExactTimestampFromActivityId(activityId: string): string | null {
  try {
    const cleanId = activityId.trim();
    if (!/^\d{18,20}$/.test(cleanId)) return null;
    const idBig = BigInt(cleanId);
    const timestampMs = Number(idBig >> 22n);
    // Sanity check: valid date between 2012 and 2040
    if (timestampMs > 1325376000000 && timestampMs < 2208988800000) {
      return new Date(timestampMs).toISOString();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Estimates exact timestamp from relative strings like "4h", "4 hours ago", "2d", "1w", "3mo", "45m", "yesterday"
 */
export function estimateTimestampFromRelative(relative: string, baseTime = Date.now()): string | null {
  if (!relative) return null;
  const clean = relative.trim().toLowerCase();

  if (clean.includes('yesterday')) {
    return new Date(baseTime - 86400 * 1000).toISOString();
  }
  if (clean.includes('just now') || clean.includes('moments ago')) {
    return new Date(baseTime).toISOString();
  }

  const match = clean.match(/^(\d+)\s*(s|sec|seconds?|m|min|minutes?|h|hr|hours?|d|days?|w|wks?|weeks?|mo|months?|y|yrs?|years?)(?:\s+ago)?/i);
  if (!match) return null;

  const val = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  let ms = 0;

  if (unit.startsWith('s')) ms = val * 1000;
  else if (unit === 'm' || unit.startsWith('min')) ms = val * 60 * 1000;
  else if (unit.startsWith('h')) ms = val * 3600 * 1000;
  else if (unit.startsWith('d')) ms = val * 86400 * 1000;
  else if (unit.startsWith('w')) ms = val * 7 * 86400 * 1000;
  else if (unit.startsWith('mo')) ms = val * 30 * 86400 * 1000;
  else if (unit.startsWith('y')) ms = val * 365 * 86400 * 1000;

  if (ms > 0) {
    return new Date(baseTime - ms).toISOString();
  }
  return null;
}
