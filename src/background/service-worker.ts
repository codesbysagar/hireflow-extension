/**
 * HireFlow - Background Service Worker (Manifest V3)
 * Manages extension lifecycle, badge updates, async batch ingestion,
 * and exponential backoff polling with full jitter.
 */

import { CONFIG } from '../shared/config.js';
import { getAuthToken } from '../shared/auth.js';
import { storage } from '../shared/storage.js';
import type { ExtensionMessage, MatchResults } from '../shared/types.js';

// Setup extension on installation
if (typeof chrome !== 'undefined' && chrome.runtime?.onInstalled) {
  chrome.runtime.onInstalled.addListener(async (details) => {
    console.log('[HireFlow] Extension installed/updated:', details.reason);
    if (chrome.action?.setBadgeText) {
      await chrome.action.setBadgeText({ text: '' });
    }
  });
}

/**
 * Submits the scraped LinkedIn batch to the Worker service.
 * Expects HTTP 202 Accepted with a runId.
 */
export async function submitScrapedBatch(scrapedPayload: unknown): Promise<string> {
  const token = await getAuthToken();
  if (!token) {
    throw new Error('UNAUTHENTICATED: Please log in first via the extension popup.');
  }

  const res = await fetch(`${CONFIG.WORKER_BASE_URL}/jobs/match`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(scrapedPayload),
  });

  const body = await res.json();
  if (res.status !== 202) {
    throw new Error(body.message || `Failed to submit scraping batch (HTTP ${res.status})`);
  }

  if (!body.data?.runId) {
    throw new Error('Server accepted batch but did not return a valid runId');
  }

  return body.data.runId;
}

/**
 * Polls the job run status with exponential backoff and full jitter.
 * Prevents server throttling and tolerates variable LLM evaluation latency.
 */
export async function pollJobRunStatus(runId: string, maxTimeoutMs = 60000): Promise<MatchResults> {
  const token = await getAuthToken();
  const startTime = Date.now();
  let delay = 1500; // 1.5s starting delay
  const maxDelay = 8000; // Max 8s interval
  const backoffFactor = 1.5;

  while (Date.now() - startTime < maxTimeoutMs) {
    // 1. Full jitter: random sleep between 0 and current delay
    const jitteredDelay = Math.floor(Math.random() * delay);
    await new Promise((resolve) => setTimeout(resolve, jitteredDelay));

    // 2. Fetch run status
    const res = await fetch(`${CONFIG.WORKER_BASE_URL}/jobs/runs/${runId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Polling failed with HTTP ${res.status}`);
    }

    const json = await res.json();
    const run = json.data;

    if (!run) {
      throw new Error('Invalid run status payload returned from server');
    }

    // 3. Check status
    if (run.status === 'COMPLETED') {
      return run.results as MatchResults; // Contains candidateName, totalRelevantJobs, matchedJobs
    }

    if (run.status === 'FAILED') {
      throw new Error(run.errorMessage || 'Job matching failed on the server.');
    }

    // 4. Increase delay for next cycle
    delay = Math.min(delay * backoffFactor, maxDelay);
  }

  throw new Error('Job matching timed out. The worker is still processing in the background.');
}

// Listen for messages from content scripts or popup
if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
    // 1. Process scraped jobs through worker backend and poll status
    if (message.action === 'PROCESS_SCRAPED_JOBS') {
      (async () => {
        try {
          if (chrome.action?.setBadgeText) {
            await chrome.action.setBadgeText({ text: 'AI...' });
            await chrome.action.setBadgeBackgroundColor({ color: '#8B5CF6' }); // Purple
          }

          const runId = await submitScrapedBatch(message.payload);
          const results = await pollJobRunStatus(runId);

          // Persist results for popup display
          await storage.setMatchResults(results);

          if (chrome.action?.setBadgeText) {
            const count = results.totalRelevantJobs ?? results.matchedJobs?.length ?? 0;
            await chrome.action.setBadgeText({ text: String(count) });
            await chrome.action.setBadgeBackgroundColor({ color: '#10B981' }); // Green
          }

          sendResponse({ success: true, results });
        } catch (err) {
          if (chrome.action?.setBadgeText) {
            await chrome.action.setBadgeText({ text: '!' });
            await chrome.action.setBadgeBackgroundColor({ color: '#EF4444' });
          }
          sendResponse({
            success: false,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      })();
      return true; // Keep message channel open for async response
    }

    // 2. Real-time extraction progress updates
    if (message.action === 'PROGRESS_UPDATE') {
      const { state, postsMatched } = message.payload;

      (async () => {
        try {
          if (chrome.action?.setBadgeText) {
            if (state === 'scanning' || state === 'loading_more') {
              await chrome.action.setBadgeText({ text: String(postsMatched || '...') });
              await chrome.action.setBadgeBackgroundColor({ color: '#10B981' });
            } else if (state === 'complete' || state === 'stopped') {
              if (postsMatched > 0) {
                await chrome.action.setBadgeText({ text: String(postsMatched) });
                await chrome.action.setBadgeBackgroundColor({ color: '#059669' });
              } else {
                await chrome.action.setBadgeText({ text: '' });
              }
            } else if (state === 'error') {
              await chrome.action.setBadgeText({ text: '!' });
              await chrome.action.setBadgeBackgroundColor({ color: '#EF4444' });
            } else {
              await chrome.action.setBadgeText({ text: '' });
            }
          }
        } catch (err) {
          console.warn('[HireFlow] Failed to set badge:', err);
        }
        sendResponse({ received: true });
      })();

      return true;
    }

    // 3. Clear results
    if (message.action === 'CLEAR_RESULTS') {
      (async () => {
        await storage.clearAllResults();
        if (chrome.action?.setBadgeText) {
          await chrome.action.setBadgeText({ text: '' });
        }
        sendResponse({ success: true });
      })();
      return true;
    }

    return false;
  });
}
