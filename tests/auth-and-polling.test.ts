import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { login, getAuthToken, getCurrentUser, logout } from '../src/shared/auth.js';
import { submitScrapedBatch, pollJobRunStatus } from '../src/background/service-worker.js';
import { CONFIG } from '../src/shared/config.js';

describe('Auth & Background Ingestion and Polling', () => {
  let mockStorage: Record<string, unknown> = {};

  beforeEach(() => {
    mockStorage = {};
    // Setup chrome.storage.local mock
    (globalThis as any).chrome = {
      storage: {
        local: {
          get: vi.fn(async (keys: string | string[]) => {
            if (typeof keys === 'string') {
              return { [keys]: mockStorage[keys] };
            }
            const result: Record<string, unknown> = {};
            for (const k of keys) {
              result[k] = mockStorage[k];
            }
            return result;
          }),
          set: vi.fn(async (items: Record<string, unknown>) => {
            Object.assign(mockStorage, items);
          }),
          remove: vi.fn(async (keys: string | string[]) => {
            const keyList = Array.isArray(keys) ? keys : [keys];
            for (const k of keyList) {
              delete mockStorage[k];
            }
          }),
        },
      },
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Auth Service (auth.ts)', () => {
    it('successfully logs in, stores token and user in chrome.storage.local, and returns token', async () => {
      const mockResponse = {
        data: {
          token: 'mock-jwt-token-12345',
          user: { id: 'u1', email: 'recruiter@tech.com', name: 'Jane Doe' },
        },
        message: 'Success',
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const token = await login('recruiter@tech.com', 'secret123');

      expect(token).toBe('mock-jwt-token-12345');
      expect(mockStorage['jwtToken']).toBe('mock-jwt-token-12345');
      expect(mockStorage['currentUser']).toEqual(mockResponse.data.user);

      // Verify fetch arguments
      expect(globalThis.fetch).toHaveBeenCalledWith(`${CONFIG.AUTH_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'recruiter@tech.com', password: 'secret123' }),
      });
    });

    it('throws error when login fails with non-ok status', async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Invalid credentials' }),
      });

      await expect(login('bad@tech.com', 'wrong')).rejects.toThrow('Invalid credentials');
      expect(mockStorage['jwtToken']).toBeUndefined();
    });

    it('retrieves stored auth token and user profile', async () => {
      mockStorage['jwtToken'] = 'saved-token-xyz';
      mockStorage['currentUser'] = { email: 'saved@company.com' };

      const token = await getAuthToken();
      const user = await getCurrentUser();

      expect(token).toBe('saved-token-xyz');
      expect(user).toEqual({ email: 'saved@company.com' });
    });

    it('clears token and user on logout', async () => {
      mockStorage['jwtToken'] = 'saved-token-xyz';
      mockStorage['currentUser'] = { email: 'saved@company.com' };

      await logout();

      expect(mockStorage['jwtToken']).toBeUndefined();
      expect(mockStorage['currentUser']).toBeUndefined();
      expect(await getAuthToken()).toBeNull();
      expect(await getCurrentUser()).toBeNull();
    });
  });

  describe('Async Ingestion & Polling (service-worker.ts)', () => {
    it('throws UNAUTHENTICATED error when submitting batch without token', async () => {
      mockStorage['jwtToken'] = null;

      await expect(submitScrapedBatch({ posts: [] })).rejects.toThrow(
        'UNAUTHENTICATED: Please log in first via the extension popup.'
      );
    });

    it('submits scraped batch with Bearer token and returns runId on HTTP 202', async () => {
      mockStorage['jwtToken'] = 'active-jwt-token';

      globalThis.fetch = vi.fn().mockImplementation(async () => {
        return new Response(
          JSON.stringify({
            status: 'ACCEPTED',
            data: { runId: 'run-uuid-987' },
          }),
          {
            status: 202,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      });

      const payload = { source: 'linkedin', totalScanned: 10, posts: [{ id: 'p1' }] };
      const runId = await submitScrapedBatch(payload);

      expect(runId).toBe('run-uuid-987');
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      const [req] = (globalThis.fetch as any).mock.calls[0];
      expect(req.url).toBe(`${CONFIG.WORKER_BASE_URL}/jobs/match`);
      expect(req.headers.get('Authorization')).toBe('Bearer active-jwt-token');
    });

    it('polls job run status until COMPLETED and returns matched results', async () => {
      mockStorage['jwtToken'] = 'active-jwt-token';

      const mockCompletedResults = {
        candidateName: 'Alex Golang Dev',
        totalRelevantJobs: 2,
        matchedJobs: [
          {
            title: 'Senior Backend Engineer',
            company: 'Cloud Corp',
            relevanceScore: 0.94,
            fitCategory: 'High Match',
            recruiterEmails: ['hiring@cloudcorp.com'],
            rationale: 'Extensive Golang and microservice experience aligns perfectly.',
            recommendedAction: 'Email recruiter with tailored resume.',
          },
        ],
      };

      // Mock sequence: 1st poll -> PROCESSING, 2nd poll -> COMPLETED
      globalThis.fetch = vi
        .fn()
        .mockImplementationOnce(async () => {
          return new Response(
            JSON.stringify({
              data: { status: 'PROCESSING', runId: 'run-uuid-987' },
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        })
        .mockImplementationOnce(async () => {
          return new Response(
            JSON.stringify({
              data: {
                status: 'COMPLETED',
                runId: 'run-uuid-987',
                results: mockCompletedResults,
              },
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        });

      const results = await pollJobRunStatus('run-uuid-987', 15000);

      expect(results).toEqual(mockCompletedResults);
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
      const [pollReq] = (globalThis.fetch as any).mock.calls[0];
      expect(pollReq.url).toBe(`${CONFIG.WORKER_BASE_URL}/jobs/runs/run-uuid-987`);
      expect(pollReq.headers.get('Authorization')).toBe('Bearer active-jwt-token');
    });

    it('throws error when job run status returns FAILED', async () => {
      mockStorage['jwtToken'] = 'active-jwt-token';

      globalThis.fetch = vi.fn().mockImplementation(async () => {
        return new Response(
          JSON.stringify({
            data: {
              status: 'FAILED',
              runId: 'run-uuid-987',
              errorMessage: 'Candidate resume not found in master service',
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      });

      await expect(pollJobRunStatus('run-uuid-987', 5000)).rejects.toThrow(
        'Candidate resume not found in master service'
      );
    });
  });
});
