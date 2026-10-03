/**
 * HireFlow - Central Axios API Client
 * Configured with request & response interceptors for:
 * 1. Automatic JWT Bearer token attachment on outgoing requests.
 * 2. Intercepting 401 Unauthorized errors to automatically refresh the access token.
 * 3. Single-flight token refresh locking to avoid duplicate refresh calls during concurrent requests.
 * 4. Automatic user logout and local session clearance if the refresh token expires or is invalid.
 */

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { getAuthToken, getRefreshToken, refreshAccessToken, logout } from './auth.js';

export interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
  skipAuth?: boolean;
}

// Single-flight refresh token promise so concurrent 401s share the same refresh call
let refreshPromise: Promise<string | null> | null = null;

export const apiClient = axios.create({
  adapter: 'fetch',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach Bearer token
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const customConfig = config as CustomAxiosRequestConfig;
    if (customConfig.skipAuth) {
      return config;
    }

    if (!config.headers.Authorization) {
      const token = await getAuthToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: 401 Token Refresh & Auto-Logout
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as CustomAxiosRequestConfig | undefined;

    // If there is no request config or the status isn't 401, reject immediately
    if (!originalRequest || error.response?.status !== 401) {
      return Promise.reject(error);
    }

    // Do not attempt refresh for login, refresh itself, or if already retried
    const url = originalRequest.url || '';
    if (originalRequest._retry || url.includes('/auth/login') || url.includes('/auth/refresh')) {
      if (url.includes('/auth/refresh') || originalRequest._retry) {
        console.warn('[HireFlow] Refresh token invalid/expired or retry failed. Logging user out.');
        await logout();
      }
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = (async () => {
          try {
            const currentRefreshToken = await getRefreshToken();
            if (!currentRefreshToken) {
              console.warn('[HireFlow] No refresh token present. Logging out.');
              await logout();
              return null;
            }

            const refreshed = await refreshAccessToken(currentRefreshToken);
            return refreshed.accessToken;
          } catch (refreshErr) {
            console.warn('[HireFlow] Failed to refresh token. Logging out:', refreshErr);
            await logout();
            return null;
          } finally {
            refreshPromise = null;
          }
        })();
      }

      const newAccessToken = await refreshPromise;
      if (!newAccessToken) {
        return Promise.reject(error);
      }

      // Update Authorization header on original request and retry
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      return apiClient(originalRequest);
    } catch (refreshErr) {
      await logout();
      return Promise.reject(refreshErr);
    }
  }
);
