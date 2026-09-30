/**
 * HireFlow - Content Script Entry Point
 * Injected into LinkedIn to run extraction in page context and communicate with popup/background.
 */

import { LinkedInAdapter } from './linkedin-adapter.js';
import { PostScanner } from './post-scanner.js';
import { storage } from '../shared/storage.js';
import type { ExtensionMessage, ScanProgress } from '../shared/types.js';

(() => {
  // Prevent duplicate script execution
  if ((window as unknown as { __HIREFLOW_INJECTED__?: boolean }).__HIREFLOW_INJECTED__) {
    return;
  }
  (window as unknown as { __HIREFLOW_INJECTED__?: boolean }).__HIREFLOW_INJECTED__ = true;

  console.log('[HireFlow] Content script initialized on:', window.location.href);

  const adapter = new LinkedInAdapter();
  const scanner = new PostScanner(adapter, async (progress: ScanProgress) => {
    // Notify runtime (popup & background) of progress updates
    try {
      chrome.runtime.sendMessage({
        action: 'PROGRESS_UPDATE',
        payload: progress,
      }).catch(() => {
        // Expected if popup is closed during scanning
      });
    } catch {
      // Ignored
    }

    // Persist progress to local storage for recovery if popup reopens
    await storage.setProgress(progress);
    if (progress.posts.length > 0) {
      await storage.setSavedPosts(progress.posts);
    }
  });

  // Message Listener
  chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
    switch (message.action) {
      case 'CHECK_PAGE_SUPPORT': {
        const isSupported = adapter.isSupportedPage();
        const searchContext = adapter.getSearchContext();
        sendResponse({
          action: 'PAGE_SUPPORT_RESULT',
          payload: {
            isSupported,
            pageUrl: searchContext.pageUrl || window.location.href,
            query: searchContext.query,
          },
        });
        return false;
      }

      case 'GET_STATUS': {
        sendResponse(scanner.getProgress());
        return false;
      }

      case 'START_EXTRACTION': {
        const targetCount = message.payload.targetCount;
        console.log(`[HireFlow] Starting extraction for ${targetCount} posts`);

        // Async execution of scanner
        (async () => {
          try {
            const finalProgress = await scanner.startScan({ targetCount });
            sendResponse(finalProgress);
          } catch (err) {
            console.error('[HireFlow] Scan failed:', err);
            sendResponse({
              state: 'error',
              errorMessage: err instanceof Error ? err.message : 'Scan execution error',
            });
          }
        })();
        return true; // Keep message channel open for async response
      }

      case 'STOP_EXTRACTION': {
        console.log('[HireFlow] Stop requested by user');
        scanner.stopScan();
        sendResponse({ status: 'stopping', progress: scanner.getProgress() });
        return false;
      }

      case 'CLEAR_RESULTS': {
        storage.clearAllResults().then(() => {
          sendResponse({ success: true });
        });
        return true;
      }

      default:
        return false;
    }
  });
})();
