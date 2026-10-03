import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { apiClient } from '../src/shared/api.js';
import { CONFIG } from '../src/shared/config.js';
import { getAuthToken, getRefreshToken } from '../src/shared/auth.js';

describe('Axios Request & Response Interceptors', () => {
  let mockStorage: Record<string, unknown> = {};

  beforeEach(() => {
    mockStorage = {
      jwtToken: 'initial-access-token',
      refreshToken: 'initial-refresh-token',
      currentUser: { id: 'u1', email: 'test@hireflow.io' },
    };

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
      action: {
        setBadgeText: vi.fn(),
      },
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('attaches current JWT Bearer token via request interceptor', async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (_req: Request) => {
      return new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const res = await apiClient.get('https://example.com/api/test');
    expect(res.status).toBe(200);

    const [req] = (globalThis.fetch as any).mock.calls[0];
    expect(req.headers.get('Authorization')).toBe('Bearer initial-access-token');
  });

  it('automatically refreshes token and retries request when encountering 401', async () => {
    let callCount = 0;

    globalThis.fetch = vi.fn().mockImplementation(async (req: Request) => {
      callCount++;
      const url = typeof req === 'string' ? req : req.url;

      // First call to worker endpoint fails with 401 expired token
      if (url.includes('/worker/test') && callCount === 1) {
        return new Response(JSON.stringify({ message: 'Token expired' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Refresh call succeeds and returns new access + refresh token
      if (url.includes('/auth/refresh')) {
        return new Response(
          JSON.stringify({
            status: 'Ok',
            data: {
              accessToken: 'new-rotated-access-token',
              refreshToken: 'new-rotated-refresh-token',
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // Retried request to worker endpoint with new token
      if (url.includes('/worker/test') && callCount === 3) {
        const authHeader = req.headers.get('Authorization');
        if (authHeader === 'Bearer new-rotated-access-token') {
          return new Response(JSON.stringify({ data: 'success_after_refresh' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }

      return new Response('Not found', { status: 404 });
    });

    const response = await apiClient.get(`${CONFIG.WORKER_BASE_URL}/test`);
    expect(response.status).toBe(200);
    expect(response.data.data).toBe('success_after_refresh');

    // Storage should now reflect the refreshed tokens
    expect(mockStorage['jwtToken']).toBe('new-rotated-access-token');
    expect(mockStorage['refreshToken']).toBe('new-rotated-refresh-token');
  });

  it('coordinates concurrent 401 requests with a single refresh call', async () => {
    let refreshCalls = 0;

    globalThis.fetch = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      let auth: string | null = null;
      if (input instanceof Request) {
        auth = input.headers.get('Authorization');
      } else if (init?.headers) {
        auth = (init.headers as any).Authorization || (init.headers as any).authorization || null;
      }

      if (url.includes('/auth/refresh')) {
        refreshCalls++;
        await new Promise((r) => setTimeout(r, 20));
        return new Response(
          JSON.stringify({
            status: 'Ok',
            data: {
              accessToken: 'single-refresh-access-token',
              refreshToken: 'single-refresh-token-rotated',
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      if (auth === 'Bearer initial-access-token') {
        return new Response(JSON.stringify({ message: 'Token expired' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (auth === 'Bearer single-refresh-access-token') {
        return new Response(JSON.stringify({ success: true, url }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response('Not found', { status: 404 });
    });

    // Fire 3 simultaneous requests that all hit 401
    const [res1, res2, res3] = await Promise.all([
      apiClient.get(`${CONFIG.WORKER_BASE_URL}/res1`),
      apiClient.get(`${CONFIG.WORKER_BASE_URL}/res2`),
      apiClient.get(`${CONFIG.WORKER_BASE_URL}/res3`),
    ]);

    expect(res1.data.success).toBe(true);
    expect(res2.data.success).toBe(true);
    expect(res3.data.success).toBe(true);

    // Exactly 1 refresh call should have been made
    expect(refreshCalls).toBe(1);
    expect(mockStorage['jwtToken']).toBe('single-refresh-access-token');
  });

  it('logs out and clears storage when the refresh token itself is expired/invalid', async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (req: Request) => {
      const url = typeof req === 'string' ? req : req.url;

      if (url.includes('/worker/secure-data')) {
        return new Response(JSON.stringify({ message: 'Token expired' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.includes('/auth/refresh')) {
        return new Response(
          JSON.stringify({
            status: 'NotOk',
            messageCode: 'ERR_INVALID_TOKEN',
            message: 'Invalid or expired session',
          }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      return new Response('Not found', { status: 404 });
    });

    await expect(apiClient.get(`${CONFIG.WORKER_BASE_URL}/secure-data`)).rejects.toThrow();

    // Verify session was cleared on logout
    expect(mockStorage['jwtToken']).toBeUndefined();
    expect(mockStorage['refreshToken']).toBeUndefined();
    expect(mockStorage['currentUser']).toBeUndefined();
    expect(await getAuthToken()).toBeNull();
    expect(await getRefreshToken()).toBeNull();
  });

  it('logs out and clears storage when no refresh token exists', async () => {
    // Delete refresh token from storage
    delete mockStorage['refreshToken'];

    globalThis.fetch = vi.fn().mockImplementation(async (_req: Request) => {
      return new Response(JSON.stringify({ message: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    await expect(apiClient.get(`${CONFIG.WORKER_BASE_URL}/secure-data`)).rejects.toThrow();

    expect(mockStorage['jwtToken']).toBeUndefined();
    expect(mockStorage['currentUser']).toBeUndefined();
  });
});
