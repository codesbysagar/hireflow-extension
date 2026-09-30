/**
 * HireFlow - Progressive Post Scanner
 * Coordinates page crawling, expansion, email filtering, and deduplication.
 */

import { PostDeduplicator } from './deduplicator.js';
import {
  MAX_IDLE_RETRIES,
  MAX_SCROLL_ATTEMPTS,
  SCAN_DELAY_MS,
} from '../shared/constants.js';
import { delay } from '../shared/utils.js';
import type {
  PlatformAdapter,
  ScanOptions,
  ScanProgress,
} from '../shared/types.js';

export type ProgressCallback = (progress: ScanProgress) => void;

export class PostScanner {
  private adapter: PlatformAdapter;
  private deduplicator: PostDeduplicator;
  private isScanning = false;
  private stopRequested = false;
  private progress: ScanProgress;
  private onProgress?: ProgressCallback;

  constructor(adapter: PlatformAdapter, onProgress?: ProgressCallback) {
    this.adapter = adapter;
    this.deduplicator = new PostDeduplicator();
    this.onProgress = onProgress;
    this.progress = this.createInitialProgress(10);
  }

  public setProgressCallback(callback: ProgressCallback): void {
    this.onProgress = callback;
  }

  public getProgress(): ScanProgress {
    return { ...this.progress, posts: [...this.progress.posts] };
  }

  public isRunning(): boolean {
    return this.isScanning;
  }

  /**
   * Starts progressive extraction up to the requested targetCount.
   */
  public async startScan(options: ScanOptions): Promise<ScanProgress> {
    if (this.isScanning) {
      console.warn('[HireFlow] Scan already in progress');
      return this.getProgress();
    }

    this.isScanning = true;
    this.stopRequested = false;
    this.deduplicator.clear();

    const searchContext = this.adapter.getSearchContext();

    this.progress = {
      state: 'preparing',
      targetCount: options.targetCount,
      postsDiscovered: 0,
      postsScanned: 0,
      postsMatched: 0,
      posts: [],
      activeQuery: searchContext.query,
      activeUrl: searchContext.pageUrl,
    };
    this.emitProgress();

    try {
      this.updateState('scanning');

      let idleRetries = 0;
      let scrollAttempts = 0;
      const inspectedElements = new WeakSet<HTMLElement>();

      while (
        !this.stopRequested &&
        this.progress.postsMatched < this.progress.targetCount &&
        scrollAttempts < MAX_SCROLL_ATTEMPTS
      ) {
        // 1. Discover posts currently in the DOM
        let postElements = this.adapter.findPosts();

        // If no posts found on first attempt, retry once after a short delay
        if (postElements.length === 0 && scrollAttempts === 0) {
          await delay(600);
          postElements = this.adapter.findPosts();
        }

        this.progress.postsDiscovered = postElements.length;
        this.emitProgress();
        console.log(`[HireFlow] Discovered ${postElements.length} candidate post cards in DOM`);

        let newPostsInBatch = 0;

        // 2. Process newly discovered uninspected post elements
        for (const el of postElements) {
          if (this.stopRequested || this.progress.postsMatched >= this.progress.targetCount) {
            break;
          }

          if (inspectedElements.has(el)) {
            continue;
          }
          inspectedElements.add(el);
          newPostsInBatch++;
          this.progress.postsScanned++;

          // Expand "...see more" button to reveal full post content and contact emails
          await this.adapter.expandPostText(el);

          // Extract post details
          const post = this.adapter.extractPost(el, searchContext);

          // If post has a contact email and is not a duplicate, save it!
          if (post && post.emails.length > 0) {
            const isNew = this.deduplicator.markSeen(post);
            if (isNew) {
              this.progress.postsMatched++;
              this.progress.posts.push(post);
              console.log(`[HireFlow] ✅ Matched post with email (${post.emails.join(', ')}):`, post.author?.name || 'Recruiter');
              this.emitProgress();
            }
          } else {
            console.log(`[HireFlow] ⏭️ Post #${this.progress.postsScanned} scanned (no contact email found)`);
            this.emitProgress();
          }

          // Gentle delay between DOM inspections
          await delay(SCAN_DELAY_MS);
        }

        // Check if target is satisfied
        if (this.progress.postsMatched >= this.progress.targetCount) {
          console.log(`[HireFlow] Target reached: ${this.progress.postsMatched}/${this.progress.targetCount}`);
          break;
        }

        // 3. Load more content via gentle scrolling
        this.updateState('loading_more');
        scrollAttempts++;

        const scrolled = await this.adapter.loadMore();

        // If no new posts were found and scroll did not alter page height
        if (newPostsInBatch === 0 && !scrolled) {
          idleRetries++;
          console.log(`[HireFlow] Idle attempt ${idleRetries}/${MAX_IDLE_RETRIES}`);
          if (idleRetries >= MAX_IDLE_RETRIES) {
            console.log('[HireFlow] No further posts loaded after maximum retries');
            break;
          }
        } else {
          idleRetries = 0;
        }

        this.updateState('scanning');
      }

      // Finalize state
      if (this.stopRequested) {
        this.updateState('stopped');
      } else {
        this.updateState('complete');
      }
    } catch (err) {
      console.error('[HireFlow] Error during scan:', err);
      this.progress.errorMessage = err instanceof Error ? err.message : 'Unknown scanning error';
      this.updateState('error');
    } finally {
      this.isScanning = false;
      this.stopRequested = false;
      this.emitProgress();
    }

    return this.getProgress();
  }

  /**
   * Gracefully requests stopping the scan while keeping all extracted data.
   */
  public stopScan(): void {
    if (this.isScanning) {
      this.stopRequested = true;
    }
  }

  private updateState(state: ScanProgress['state']): void {
    this.progress.state = state;
    this.emitProgress();
  }

  private emitProgress(): void {
    if (this.onProgress) {
      this.onProgress(this.getProgress());
    }
  }

  private createInitialProgress(targetCount: number): ScanProgress {
    return {
      state: 'idle',
      targetCount,
      postsDiscovered: 0,
      postsScanned: 0,
      postsMatched: 0,
      posts: [],
    };
  }
}
