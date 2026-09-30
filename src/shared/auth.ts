/**
 * HireFlow - Authentication Management
 * Handles login, token storage, and session clearance in chrome.storage.local
 */

import { CONFIG } from './config.js';
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

/**
 * Logs in a user against the Auth service and stores the JWT and user data in local extension storage.
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

  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    await chrome.storage.local.set({
      jwtToken: token,
      currentUser: user,
    });
  }

  return token;
}

/**
 * Retrieves the stored JWT token from chrome.storage.local.
 */
export async function getAuthToken(): Promise<string | null> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return null;
  }
  const result = await chrome.storage.local.get('jwtToken');
  return (result.jwtToken as string) || null;
}

/**
 * Retrieves the current authenticated user profile from chrome.storage.local.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return null;
  }
  const result = await chrome.storage.local.get('currentUser');
  return (result.currentUser as AuthUser) || null;
}

/**
 * Clears authentication credentials from chrome.storage.local.
 */
export async function logout(): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    await chrome.storage.local.remove(['jwtToken', 'currentUser']);
  }
}
