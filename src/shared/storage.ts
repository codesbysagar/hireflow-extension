/**
 * HireFlow - Safe Chrome Local Storage Helper
 */

import { STORAGE_KEYS } from './constants.js';
import type { RawHiringPost, ScanProgress } from './types.js';

class StorageService {
  private hasChromeStorage(): boolean {
    return (
      typeof chrome !== 'undefined' &&
      Boolean(chrome.storage) &&
      Boolean(chrome.storage.local)
    );
  }

  async getTargetCount(defaultValue = 10): Promise<number> {
    if (!this.hasChromeStorage()) return defaultValue;
    try {
      const res = await chrome.storage.local.get(STORAGE_KEYS.TARGET_COUNT);
      return typeof res[STORAGE_KEYS.TARGET_COUNT] === 'number'
        ? res[STORAGE_KEYS.TARGET_COUNT]
        : defaultValue;
    } catch (e) {
      console.warn('[HireFlow] Failed to read target count from storage:', e);
      return defaultValue;
    }
  }

  async setTargetCount(count: number): Promise<void> {
    if (!this.hasChromeStorage()) return;
    try {
      await chrome.storage.local.set({ [STORAGE_KEYS.TARGET_COUNT]: count });
    } catch (e) {
      console.warn('[HireFlow] Failed to save target count to storage:', e);
    }
  }

  async getProgress(): Promise<ScanProgress | null> {
    if (!this.hasChromeStorage()) return null;
    try {
      const res = await chrome.storage.local.get(STORAGE_KEYS.PROGRESS);
      return (res[STORAGE_KEYS.PROGRESS] as ScanProgress) || null;
    } catch (e) {
      console.warn('[HireFlow] Failed to read progress from storage:', e);
      return null;
    }
  }

  async setProgress(progress: ScanProgress): Promise<void> {
    if (!this.hasChromeStorage()) return;
    try {
      await chrome.storage.local.set({ [STORAGE_KEYS.PROGRESS]: progress });
    } catch (e) {
      console.warn('[HireFlow] Failed to save progress to storage:', e);
    }
  }

  async getSavedPosts(): Promise<RawHiringPost[]> {
    if (!this.hasChromeStorage()) return [];
    try {
      const res = await chrome.storage.local.get(STORAGE_KEYS.POSTS);
      return Array.isArray(res[STORAGE_KEYS.POSTS]) ? res[STORAGE_KEYS.POSTS] : [];
    } catch (e) {
      console.warn('[HireFlow] Failed to read posts from storage:', e);
      return [];
    }
  }

  async setSavedPosts(posts: RawHiringPost[]): Promise<void> {
    if (!this.hasChromeStorage()) return;
    try {
      await chrome.storage.local.set({ [STORAGE_KEYS.POSTS]: posts });
    } catch (e) {
      console.warn('[HireFlow] Failed to save posts to storage:', e);
    }
  }

  async clearAllResults(): Promise<void> {
    if (!this.hasChromeStorage()) return;
    try {
      await chrome.storage.local.remove([
        STORAGE_KEYS.PROGRESS,
        STORAGE_KEYS.POSTS,
        STORAGE_KEYS.MATCH_RESULTS,
      ]);
    } catch (e) {
      console.warn('[HireFlow] Failed to clear storage:', e);
    }
  }

  async getAuthToken(): Promise<string | null> {
    if (!this.hasChromeStorage()) return null;
    try {
      const res = await chrome.storage.local.get(STORAGE_KEYS.JWT_TOKEN);
      return (res[STORAGE_KEYS.JWT_TOKEN] as string) || null;
    } catch (e) {
      console.warn('[HireFlow] Failed to read auth token from storage:', e);
      return null;
    }
  }

  async setAuthToken(token: string): Promise<void> {
    if (!this.hasChromeStorage()) return;
    try {
      await chrome.storage.local.set({ [STORAGE_KEYS.JWT_TOKEN]: token });
    } catch (e) {
      console.warn('[HireFlow] Failed to save auth token to storage:', e);
    }
  }

  async getRefreshToken(): Promise<string | null> {
    if (!this.hasChromeStorage()) return null;
    try {
      const res = await chrome.storage.local.get(STORAGE_KEYS.REFRESH_TOKEN);
      return (res[STORAGE_KEYS.REFRESH_TOKEN] as string) || null;
    } catch (e) {
      console.warn('[HireFlow] Failed to read refresh token from storage:', e);
      return null;
    }
  }

  async setRefreshToken(token: string): Promise<void> {
    if (!this.hasChromeStorage()) return;
    try {
      await chrome.storage.local.set({ [STORAGE_KEYS.REFRESH_TOKEN]: token });
    } catch (e) {
      console.warn('[HireFlow] Failed to save refresh token to storage:', e);
    }
  }

  async setAuthTokens(tokens: { accessToken: string; refreshToken?: string }): Promise<void> {
    if (!this.hasChromeStorage()) return;
    try {
      const updateData: Record<string, string> = {
        [STORAGE_KEYS.JWT_TOKEN]: tokens.accessToken,
      };
      if (tokens.refreshToken) {
        updateData[STORAGE_KEYS.REFRESH_TOKEN] = tokens.refreshToken;
      }
      await chrome.storage.local.set(updateData);
    } catch (e) {
      console.warn('[HireFlow] Failed to save auth tokens to storage:', e);
    }
  }

  async getCurrentUser(): Promise<any | null> {
    if (!this.hasChromeStorage()) return null;
    try {
      const res = await chrome.storage.local.get(STORAGE_KEYS.CURRENT_USER);
      return res[STORAGE_KEYS.CURRENT_USER] || null;
    } catch (e) {
      console.warn('[HireFlow] Failed to read current user from storage:', e);
      return null;
    }
  }

  async setCurrentUser(user: any): Promise<void> {
    if (!this.hasChromeStorage()) return;
    try {
      await chrome.storage.local.set({ [STORAGE_KEYS.CURRENT_USER]: user });
    } catch (e) {
      console.warn('[HireFlow] Failed to save current user to storage:', e);
    }
  }

  async clearAuth(): Promise<void> {
    if (!this.hasChromeStorage()) return;
    try {
      await chrome.storage.local.remove([
        STORAGE_KEYS.JWT_TOKEN,
        STORAGE_KEYS.REFRESH_TOKEN,
        STORAGE_KEYS.CURRENT_USER,
      ]);
    } catch (e) {
      console.warn('[HireFlow] Failed to clear auth from storage:', e);
    }
  }

  async getMatchResults(): Promise<any | null> {
    if (!this.hasChromeStorage()) return null;
    try {
      const res = await chrome.storage.local.get(STORAGE_KEYS.MATCH_RESULTS);
      return res[STORAGE_KEYS.MATCH_RESULTS] || null;
    } catch (e) {
      console.warn('[HireFlow] Failed to read match results from storage:', e);
      return null;
    }
  }

  async setMatchResults(results: any): Promise<void> {
    if (!this.hasChromeStorage()) return;
    try {
      await chrome.storage.local.set({ [STORAGE_KEYS.MATCH_RESULTS]: results });
    } catch (e) {
      console.warn('[HireFlow] Failed to save match results to storage:', e);
    }
  }
}

export const storage = new StorageService();
