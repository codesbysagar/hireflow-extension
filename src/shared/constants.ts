/**
 * HireFlow - Shared Constants & Configuration
 */

export const EXTENSION_NAME = 'HireFlow';
export const EXTENSION_TAGLINE = 'LinkedIn Hiring Post Extractor';

// Scan Quantity Settings
export const DEFAULT_TARGET_POSTS = 10;
export const PREDEFINED_TARGET_OPTIONS = [5, 10, 30, 50, 100] as const;
export const MIN_TARGET_POSTS = 1;
export const MAX_TARGET_POSTS = 500;

// Rate and Timing Configuration
export const SCAN_DELAY_MS = 400;
export const SCROLL_DELAY_MS = 2000;
export const EXPAND_DELAY_MS = 300;
export const MAX_IDLE_RETRIES = 6;
export const MAX_SCROLL_ATTEMPTS = 60;
export const MUTATION_TIMEOUT_MS = 3000;

// Job match request batching (posts per request, interval between requests, +/- jitter)
export const MATCH_BATCH_SIZE = 5;
export const MATCH_BATCH_INTERVAL_MS = 5000;
export const MATCH_BATCH_JITTER_MS = 1000;

// Storage Keys
export const STORAGE_KEYS = {
  PROGRESS: 'hireflow_scan_progress',
  TARGET_COUNT: 'hireflow_target_count',
  POSTS: 'hireflow_saved_posts',
  SETTINGS: 'hireflow_settings',
  JWT_TOKEN: 'jwtToken',
  REFRESH_TOKEN: 'refreshToken',
  CURRENT_USER: 'currentUser',
  MATCH_RESULTS: 'hireflow_match_results',
} as const;

// Supported LinkedIn URLs
export const SUPPORTED_LINKEDIN_PATTERNS = [
  'linkedin.com/search/results/content',
  'linkedin.com/search/results/all',
  'linkedin.com/search/results/posts',
  'linkedin.com/feed',
  'linkedin.com/posts',
];

// Hiring Intent Keywords
export const HIRING_INTENT_KEYWORDS = [
  'hiring', "we're hiring", 'we are hiring', 'now hiring',
  'job opening', 'job opportunity', 'open position', 'open role',
  'looking for', 'seeking', 'join our team', 'join us',
  'career opportunity', 'apply now', 'apply here', 'apply today',
  'vacancy', 'vacancies', 'recruitment', 'recruiter',
  'send resume', 'send your resume', 'send cv', 'share cv', 'share your cv',
  'share resume', 'share profile', 'drop cv', 'drop your cv',
  'interested candidates', 'reach out', 'mail your resume', 'email your resume',
  'reach out to', 'cv to', 'resume to',
] as const;

// Job Seeker Exclusion Keywords (to avoid extracting candidates looking for work)
export const JOB_SEEKER_KEYWORDS = [
  'looking for a new role', 'looking for opportunities', 'actively looking',
  'open to work', '#opentowork', 'seeking a new opportunity', 'looking for job',
  'open for new opportunities', 'looking for a job', 'in search of a job',
] as const;

/**
 * Layered selectors for LinkedIn DOM resilience, incorporated from proven LinkedIn scrapers
 */
export const LINKEDIN_SELECTORS = {
  // TestID-based text boxes (LinkedIn modern UI)
  textBoxes: '[data-testid="expandable-text-box"]',
  expandButton: '[data-testid="expandable-text-button"]',

  // Post Containers (ordered from most specific to broadest card container)
  postContainers: [
    // Primary modern post wrappers
    'div.feed-shared-update-v2',
    'div.occludable-update',
    'div.update-components-update-v2',
    'li.reusable-search__result-container',
    '.reusable-search__result-container',
    '.search-results__list > li',
    'div.search-results-container li',
    'ul.reusable-search__entity-result-list > li',
    'div.artdeco-card',
    'li.artdeco-card',
    'div[data-view-name*="search-entity"]',
    'div[data-view-name*="feed"]',
    'div[data-view-name*="update"]',
    'div.scaffold-finite-scroll__content > div',
    'div.scaffold-finite-scroll__content > ul > li',
    // URN & data attribute containers
    '[data-urn*="urn:li:activity"]',
    '[data-urn*="urn:li:share"]',
    '[data-urn*="urn:li:ugcPost"]',
    '[data-id*="urn:li:activity"]',
    '[data-id*="urn:li:share"]',
    '[data-chameleon-result-urn]',
    'div.fie-impression-container',
    'article.feed-shared-update-v2',
    'div.update-components-article',
  ],

  // Markers inside every LinkedIn post card for bottom-up container discovery
  postMarkers: [
    '[data-testid="expandable-text-box"]',
    '.feed-shared-social-actions',
    '.feed-shared-social-action-bar',
    '.social-details-social-counts',
    '.update-components-actor',
    '.feed-shared-actor',
    'button[aria-label*="Like" i]',
    'button[aria-label*="Comment" i]',
    'button[aria-label*="Repost" i]',
    'button.feed-shared-inline-show-more-text__button',
  ],

  // "See more" expansion buttons
  seeMoreButtons: [
    '[data-testid="expandable-text-button"]',
    'button.feed-shared-inline-show-more-text__button',
    'button.feed-shared-inline-show-more-text__see-more-less-toggle',
    'button[aria-label*="see more" i]',
    'button[aria-label*="more" i]',
    'span.feed-shared-inline-show-more-text__button',
    'button.see-more',
    'button[class*="see-more"]',
    'button[class*="show-more"]',
  ],

  // Text content elements inside a post
  postTextContainers: [
    '[data-testid="expandable-text-box"]',
    '.update-components-text.update-components-update-v2__commentary',
    'div.feed-shared-update-v2__description-wrapper',
    'div.feed-shared-inline-show-more-text',
    'div.update-components-text',
    '.feed-shared-text__text-view',
    '[data-test-id="main-feed-activity-card__commentary"]',
    '.attributed-text-segment-list__content',
    'div.feed-shared-text',
    'div.feed-shared-update-v2__description',
    'span.break-words',
    'div[dir="ltr"]',
    'span[dir="ltr"]',
  ],

  // Author information
  authorName: [
    '.entity-result__title-text a span[aria-hidden="true"]',
    '.entity-result__title-text a',
    '.entity-result__title-text span[dir="ltr"]',
    '.entity-result__title-text',
    '.entity-result__title a',
    '.entity-result__title',
    '[data-testid="actor-name"]',
    '[data-testid="feed-actor-name"]',
    'span.update-components-actor__name',
    'span.feed-shared-actor__name',
    '.artdeco-entity-lockup__title span[aria-hidden="true"]',
    '.artdeco-entity-lockup__title a',
    '.artdeco-entity-lockup__title',
    'a[data-field="actor"] span[aria-hidden="true"]',
    'div.update-components-actor__title span[aria-hidden="true"]',
    'a.app-aware-link span[aria-hidden="true"]',
    'a[href*="/in/"] span[aria-hidden="true"]',
    'a[href*="/in/"]',
    'span[dir="ltr"] span[aria-hidden="true"]',
    'a.update-components-actor__image + div a',
    '.update-components-actor__name span',
  ],
  authorHeadline: [
    '.entity-result__primary-subtitle',
    'div.entity-result__primary-subtitle',
    '.entity-result__subtitle',
    '.artdeco-entity-lockup__subtitle span[aria-hidden="true"]',
    '.artdeco-entity-lockup__subtitle',
    '[data-testid="actor-description"]',
    '.update-components-actor__description span[aria-hidden="true"]',
    '.feed-shared-actor__description span[aria-hidden="true"]',
    'span.update-components-actor__description',
    'span.feed-shared-actor__description',
    'div.update-components-actor__subtitle span',
    'div.update-components-actor__container span.update-components-actor__supplementary-actor-info',
    'div.update-components-actor__meta span',
  ],
  authorProfileLink: [
    'a.update-components-actor__meta-link',
    'a.update-components-actor__image',
    'a.feed-shared-actor__container-link',
    'a.app-aware-link[href*="/in/"]',
    'a[href*="linkedin.com/in/"]',
    '.entity-result__title-text a',
  ],

  // Post permalinks & timestamps
  postLinks: [
    '.entity-result__secondary-subtitle a',
    'a[data-view-name="feed-shared-main-feed-card-timestamp"]',
    'a[data-field="timestamp"]',
    '.update-components-actor__sub-description a.app-aware-link',
    '.update-components-actor__sub-description a',
    'a.update-components-actor__sub-description-link',
    'a[href*="/feed/update/urn:li:activity"]',
    'a[href*="/feed/update/urn:li:share"]',
    'a[href*="/posts/"]',
    'a[href*="urn:li:activity"]',
    'a[href*="urn:li:ugcPost"]',
  ],

  timestamp: [
    '.entity-result__secondary-subtitle span[aria-hidden="true"]',
    '.entity-result__secondary-subtitle a',
    '.entity-result__secondary-subtitle',
    'div.entity-result__secondary-subtitle',
    '.entity-result__badge',
    'a[data-view-name="feed-shared-main-feed-card-timestamp"] span[aria-hidden="true"]',
    'a[data-view-name="feed-shared-main-feed-card-timestamp"]',
    '[data-testid="feed-shared-main-feed-card-timestamp"]',
    'a[data-field="timestamp"] span[aria-hidden="true"]',
    'a[data-field="timestamp"]',
    '.update-components-actor__sub-description span[aria-hidden="true"]',
    '.update-components-actor__sub-description a',
    '.update-components-actor__sub-description',
    '.update-components-actor__sub-description-link',
    '.feed-shared-actor__sub-description',
    'time',
  ],
};
