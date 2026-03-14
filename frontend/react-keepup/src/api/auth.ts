import { AuthResponse, User } from './types';
import { API_URL } from './config';

const apiFetch = (path: string, opts: RequestInit = {}): Promise<Response> => {
  const url = `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;
  return fetch(url, opts);
};

const getStoredToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return (
    localStorage.getItem('KEEPUP_BEARER_TOKEN') ||
    localStorage.getItem('KEEPUP_SESSION_TOKEN') ||
    null
  );
};

export const authAPI = {
  login: async (emailOrUsername: string, password: string): Promise<AuthResponse> => {
    const response = await apiFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email: emailOrUsername, username: emailOrUsername, password }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Login failed');
    }

    const data = await response.json();
    try {
      if (typeof window !== 'undefined') {
        if (data.sessionToken) localStorage.setItem('KEEPUP_SESSION_TOKEN', data.sessionToken);
        if (data.bearerToken) localStorage.setItem('KEEPUP_BEARER_TOKEN', data.bearerToken);
        if (data.user) localStorage.setItem('KEEPUP_USER', JSON.stringify(data.user));
      }
    } catch (e) {
      console.warn('Failed to persist auth tokens locally', e);
    }

    return data;
  },

  register: async (username: string, email: string, password: string): Promise<AuthResponse> => {
    const response = await apiFetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, email, password }),
    });

    if (!response.ok) throw new Error('Registration failed');
    return response.json();
  },

  logout: async (): Promise<void> => {
    const token = getStoredToken();
    try {
      await apiFetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: 'include',
      });
    } catch (err) {
      console.warn('Logout request failed, clearing local state anyway:', err);
    }
    try {
      localStorage.removeItem('KEEPUP_BEARER_TOKEN');
      localStorage.removeItem('KEEPUP_SESSION_TOKEN');
      localStorage.removeItem('KEEPUP_USER');
    } catch (e) {
      /* ignore */
    }
  },

  // Verify Joomla session and get token for React
  verifyJoomlaSession: async (): Promise<AuthResponse | null> => {
    try {
      const token = getStoredToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      const response = await apiFetch('/api/auth/joomla-session', {
        method: 'POST',
        headers,
        credentials: 'include',
      });

      if (!response.ok) return null;
      const result = await response.json();
      try {
        if (typeof window !== 'undefined') {
          if (result.sessionToken) localStorage.setItem('KEEPUP_SESSION_TOKEN', result.sessionToken);
          if (result.bearerToken) localStorage.setItem('KEEPUP_BEARER_TOKEN', result.bearerToken);
          if (result.user) localStorage.setItem('KEEPUP_USER', JSON.stringify(result.user));
        }
      } catch (e) {
        console.warn('Failed to persist Joomla session tokens locally', e);
      }
      return result;
    } catch (err) {
      return null;
    }
  },

  getCurrentUser: async (token: string): Promise<User | null> => {
    const authToken = token || getStoredToken();
    try {
      const response = await apiFetch('/api/auth/check', {
        method: 'GET',
        headers: { ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
        credentials: 'include',
      });

      if (!response.ok) return null;
      const data = await response.json();
      return data && data.ok ? data.user : null;
    } catch (err) {
      return null;
    }
  },
};
