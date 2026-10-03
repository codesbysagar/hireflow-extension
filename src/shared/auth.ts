import { CONFIG } from './config.js';
import { storage } from './storage.js';
import type { AuthUser } from './types.js';

export interface LoginResponse {
  data?: {
    token?: string;
    accessToken?: string;
    refreshToken?: string;
    user?: AuthUser & { firstName?: string; lastName?: string };
  };
  message?: string;
  status?: string;
  serviceName?: string;
}

export interface RefreshResponse {
  data?: {
    accessToken?: string;
    refreshToken?: string;
    token?: string;
  };
  message?: string;
  status?: string;
  serviceName?: string;
}

/**
 * Logs in a user against the Auth service and stores the JWT, refresh token, and user data in local storage.
 */
export async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${CONFIG.AUTH_BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const body = (await res.json()) as LoginResponse;
  if (!res.ok) {
    throw new Error(body.message || 'Login failed');
  }

  const token = body.data?.accessToken || body.data?.token;
  if (!token) {
    throw new Error('Authentication response did not contain a valid JWT token');
  }

  const rawUser = body.data?.user;
  const displayName = rawUser
    ? rawUser.name ||
      (rawUser.firstName ? `${rawUser.firstName} ${rawUser.lastName || ''}`.trim() : undefined)
    : undefined;

  const user: AuthUser = {
    ...rawUser,
    email: rawUser?.email || email,
    name: displayName,
  };

  const refreshToken = body.data?.refreshToken;

  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    const storageData: Record<string, unknown> = {
      jwtToken: token,
      currentUser: user,
    };
    if (refreshToken) {
      storageData.refreshToken = refreshToken;
    }
    await chrome.storage.local.set(storageData);
  }

  return token;
}

/**
 * Retrieves the stored JWT access token from storage.
 */
export async function getAuthToken(): Promise<string | null> {
  return storage.getAuthToken();
}

/**
 * Retrieves the stored refresh token from storage.
 */
export async function getRefreshToken(): Promise<string | null> {
  return storage.getRefreshToken();
}

/**
 * Saves updated access and optional refresh tokens to storage.
 */
export async function setAuthTokens(tokens: { accessToken: string; refreshToken?: string }): Promise<void> {
  await storage.setAuthTokens(tokens);
}

/**
 * Calls the backend refresh endpoint to exchange a refresh token for new access and rotated refresh tokens.
 */
export async function refreshAccessToken(refreshTokenOverride?: string): Promise<{
  accessToken: string;
  refreshToken?: string;
}> {
  const tokenToUse = refreshTokenOverride || (await getRefreshToken());
  if (!tokenToUse) {
    throw new Error('NO_REFRESH_TOKEN: No refresh token available');
  }

  const res = await fetch(`${CONFIG.AUTH_BASE_URL}/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: tokenToUse }),
  });

  const body = (await res.json()) as RefreshResponse;
  if (!res.ok) {
    throw new Error(body.message || `Token refresh failed with HTTP ${res.status}`);
  }

  const newAccessToken = body.data?.accessToken || body.data?.token;
  if (!newAccessToken) {
    throw new Error('Refresh response did not return a valid accessToken');
  }

  const newRefreshToken = body.data?.refreshToken || tokenToUse;

  await setAuthTokens({
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  });

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
}

/**
 * Retrieves the current authenticated user profile from storage.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  return storage.getCurrentUser();
}

/**
 * Clears authentication credentials from storage and resets badge if available.
 */
export async function logout(): Promise<void> {
  await storage.clearAuth();
  if (typeof chrome !== 'undefined' && chrome.action?.setBadgeText) {
    try {
      await chrome.action.setBadgeText({ text: '' });
    } catch {
      // Ignored if action API is not available
    }
  }
}

