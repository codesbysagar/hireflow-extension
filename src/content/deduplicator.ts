/**
 * HireFlow - Post Deduplication System
 * Deduplicates posts across infinite scroll renders using layered identifiers.
 */

import { hashString, normalizePostText } from '../shared/utils.js';
import type { RawHiringPost } from '../shared/types.js';

export class PostDeduplicator {
  private seenIds = new Set<string>();
  private seenUrls = new Set<string>();
  private seenContentHashes = new Set<string>();

  /**
   * Generates a stable composite key for a post.
   */
  public generateKey(post: Pick<RawHiringPost, 'id' | 'postUrl' | 'text' | 'author'>): string {
    if (post.id && post.id !== 'unknown') {
      return `id:${post.id}`;
    }
    if (post.postUrl) {
      const cleanUrl = this.canonicalizeUrl(post.postUrl);
      if (cleanUrl) return `url:${cleanUrl}`;
    }
    const content = `${post.author?.name || ''}|${normalizePostText(post.text).slice(0, 150)}`;
    return `hash:${hashString(content)}`;
  }

  /**
   * Checks if the post has already been recorded.
   */
  public isDuplicate(post: Pick<RawHiringPost, 'id' | 'postUrl' | 'text' | 'author'>): boolean {
    // 1. Check ID
    if (post.id && post.id !== 'unknown' && this.seenIds.has(post.id)) {
      return true;
    }

    // 2. Check canonicalized Post URL
    if (post.postUrl) {
      const canonicalUrl = this.canonicalizeUrl(post.postUrl);
      if (canonicalUrl && this.seenUrls.has(canonicalUrl)) {
        return true;
      }
    }

    // 3. Check normalized text + author content hash
    const textSignature = (post.text || '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (textSignature) {
      const author = (post.author?.name || '').trim().toLowerCase();
      const contentSignature = `${author}::${textSignature.slice(0, 250)}`;
      const hash = hashString(contentSignature);
      if (this.seenContentHashes.has(hash)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Marks a post as seen. Returns true if newly added, false if already seen.
   */
  public markSeen(post: Pick<RawHiringPost, 'id' | 'postUrl' | 'text' | 'author'>): boolean {
    if (this.isDuplicate(post)) {
      return false;
    }

    if (post.id && post.id !== 'unknown') {
      this.seenIds.add(post.id);
    }

    if (post.postUrl) {
      const canonicalUrl = this.canonicalizeUrl(post.postUrl);
      if (canonicalUrl) {
        this.seenUrls.add(canonicalUrl);
      }
    }

    const textSignature = (post.text || '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (textSignature) {
      const author = (post.author?.name || '').trim().toLowerCase();
      const contentSignature = `${author}::${textSignature.slice(0, 250)}`;
      this.seenContentHashes.add(hashString(contentSignature));
    }

    return true;
  }

  /**
   * Cleans LinkedIn URLs of tracking parameters like ?miniMpr=... or ?trackingId=...
   */
  public canonicalizeUrl(urlStr: string): string {
    try {
      const url = new URL(urlStr, 'https://www.linkedin.com');
      // Keep only origin and pathname
      return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
    } catch {
      return urlStr.split('?')[0].replace(/\/+$/, '');
    }
  }

  /**
   * Resets the deduplication cache.
   */
  public clear(): void {
    this.seenIds.clear();
    this.seenUrls.clear();
    this.seenContentHashes.clear();
  }

  public get size(): number {
    return this.seenIds.size || this.seenContentHashes.size;
  }
}
