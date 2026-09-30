/**
 * HireFlow - Shared Type Definitions
 */

export interface PostAuthor {
  name?: string;
  profileUrl?: string;
  headline?: string;
}

export interface SearchContext {
  query?: string;
  pageUrl?: string;
}

/**
 * Raw hiring post schema extracted from the platform.
 * Preserves the original text intact for future LLM processing pipelines.
 */
export interface RawHiringPost {
  id: string;
  platform: 'linkedin';
  postUrl?: string;
  author?: PostAuthor;
  text: string;
  emails: string[];
  timestamp?: string;
  exactTimestamp?: string;
  isHiringPost?: boolean;
  matchedKeywords?: string[];
  extractedAt: string;
  searchContext?: SearchContext;
}

/**
 * Future LLM structured job model (Section 15 compatibility).
 */
export interface StructuredJob {
  id: string;
  rawPostId: string;
  jobTitle?: string;
  company?: string;
  location?: string;
  experience?: string;
  skills?: string[];
  employmentType?: string;
  workMode?: 'Remote' | 'Hybrid' | 'On-site' | 'Unknown';
  contactEmail: string;
  salary?: string;
  extractedAt: string;
}

export type ExtractorState =
  | 'idle'
  | 'unsupported_page'
  | 'preparing'
  | 'scanning'
  | 'loading_more'
  | 'complete'
  | 'stopped'
  | 'error';

export interface ScanProgress {
  state: ExtractorState;
  targetCount: number;
  postsDiscovered: number;
  postsScanned: number;
  postsMatched: number;
  posts: RawHiringPost[];
  errorMessage?: string;
  activeQuery?: string;
  activeUrl?: string;
}

export interface ScanOptions {
  targetCount: number;
}

export interface ExtractionContext {
  query?: string;
  searchQuery?: string;
  pageUrl?: string;
}

/**
 * Platform adapter interface for DOM resilience and future multi-platform support
 */
export interface PlatformAdapter {
  readonly platformName: string;
  isSupportedPage(url?: string): boolean;
  findPosts(): HTMLElement[];
  extractPost(element: HTMLElement, context?: ExtractionContext): RawHiringPost | null;
  loadMore(): Promise<boolean>;
  expandPostText(element: HTMLElement): Promise<void>;
  getSearchContext(): SearchContext;
}

/**
 * Chrome message protocols
export interface AuthUser {
  id?: string;
  email: string;
  name?: string;
  [key: string]: unknown;
}

export interface MatchedJob {
  id?: string;
  title?: string;
  jobTitle?: string;
  company?: string;
  relevanceScore?: number | string;
  score?: number | string;
  fitCategory?: string;
  recruiterEmails?: string[] | string;
  contactEmails?: string[] | string;
  emails?: string[];
  rationale?: string;
  reasoning?: string;
  recommendedAction?: string;
  postUrl?: string;
  location?: string;
  rawText?: string;
  [key: string]: unknown;
}

export interface MatchResults {
  candidateName?: string;
  totalRelevantJobs?: number;
  matchedJobs?: MatchedJob[];
  totalScanned?: number;
  [key: string]: unknown;
}

/**
 * Message Passing contracts across components
 */
export type MessageAction =
  | 'CHECK_PAGE_SUPPORT'
  | 'PAGE_SUPPORT_RESULT'
  | 'START_EXTRACTION'
  | 'STOP_EXTRACTION'
  | 'GET_STATUS'
  | 'PROGRESS_UPDATE'
  | 'CLEAR_RESULTS'
  | 'PROCESS_SCRAPED_JOBS';

export interface BaseMessage {
  action: MessageAction;
}

export interface CheckPageSupportMessage extends BaseMessage {
  action: 'CHECK_PAGE_SUPPORT';
}

export interface PageSupportResultMessage extends BaseMessage {
  action: 'PAGE_SUPPORT_RESULT';
  payload: {
    isSupported: boolean;
    pageUrl?: string;
    query?: string;
  };
}

export interface StartExtractionMessage extends BaseMessage {
  action: 'START_EXTRACTION';
  payload: ScanOptions;
}

export interface StopExtractionMessage extends BaseMessage {
  action: 'STOP_EXTRACTION';
}

export interface GetStatusMessage extends BaseMessage {
  action: 'GET_STATUS';
}

export interface ProgressUpdateMessage extends BaseMessage {
  action: 'PROGRESS_UPDATE';
  payload: ScanProgress;
}

export interface ClearResultsMessage extends BaseMessage {
  action: 'CLEAR_RESULTS';
}

export interface AuthUser {
  id?: string;
  email: string;
  name?: string;
  [key: string]: unknown;
}

export interface MatchedJob {
  id?: string;
  jobId?: string;
  title?: string;
  jobTitle?: string;
  company?: string;
  location?: string;
  relevanceScore?: number | string;
  score?: number | string;
  fitCategory?: string;
  emails?: string[];
  recruiterEmails?: string[] | string;
  contactEmails?: string[] | string;
  rationale?: string;
  reasoning?: string;
  recommendedAction?: string;
  postUrl?: string;
  sourcePostId?: string;
  [key: string]: unknown;
}

export interface MatchResults {
  runId?: string;
  status?: string;
  candidateName?: string;
  totalRelevantJobs?: number;
  totalScanned?: number;
  matchedJobs: MatchedJob[];
  [key: string]: unknown;
}

export interface ProcessScrapedJobsMessage extends BaseMessage {
  action: 'PROCESS_SCRAPED_JOBS';
  payload: unknown;
}

export type ExtensionMessage =
  | CheckPageSupportMessage
  | PageSupportResultMessage
  | StartExtractionMessage
  | StopExtractionMessage
  | GetStatusMessage
  | ProgressUpdateMessage
  | ClearResultsMessage
  | ProcessScrapedJobsMessage;

export interface StoredData {
  jwtToken?: string;
  currentUser?: AuthUser;
  lastTargetCount?: number;
  lastProgress?: ScanProgress;
  savedPosts?: RawHiringPost[];
  lastScanTimestamp?: string;
  lastMatchResults?: MatchResults;
}


