import { useState, useEffect, useCallback } from 'react';
import { User } from '../../api/types';
import { authAPI } from '../../api/auth';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isJoomlaUser, setIsJoomlaUser] = useState(false);

  const logout = useCallback(async () => {
    setUser(null);
    setToken(null);
    try {
      localStorage.removeItem('KEEPUP_TOKEN');
      localStorage.removeItem('KEEPUP_BEARER_TOKEN');
      localStorage.removeItem('KEEPUP_SESSION_TOKEN');
      localStorage.removeItem('KEEPUP_USER');
    } catch (e) {
      console.warn('Failed to clear local auth state', e);
    }
  }, []);

  const verifyToken = useCallback(async (token?: string | null) => {
    try {
      const user = await authAPI.getCurrentUser(token || '');
      if (user) {
        setUser(user);
        setIsJoomlaUser(user.role === 'admin'); // Assuming admin means Joomla user
        return true;
      }
      await logout();
      return false;
    } catch (error) {
      console.error('Token verification failed:', error);
      await logout();
      return false;
    }
  }, [logout]);

  // Initialize from localStorage - prefer bearer token, then session token, then legacy KEEPUP_TOKEN
  useEffect(() => {
    const init = async () => {
      try {
        const bearer = localStorage.getItem('KEEPUP_BEARER_TOKEN');
        const session = localStorage.getItem('KEEPUP_SESSION_TOKEN');
        const legacy = localStorage.getItem('KEEPUP_TOKEN');
        const t = bearer || session || legacy || null;
        if (t) {
          setToken(t);
          await verifyToken(t);
          return;
        }

        // No local token: remain in logged-out state
        // Authentication will happen when user logs in or accesses protected resources
      } catch (e) {
        console.warn('Failed to read auth tokens from localStorage', e);
      } finally {
        // Development convenience: allow automatic dev login when
        // REACT_APP_DEV_AUTO_LOGIN=true is set in the environment.
        // This helps local debugging so the UI doesn't immediately
        // redirect when backend sessions are not present.
        if (
          process.env.NODE_ENV === 'development' &&
          process.env.REACT_APP_DEV_AUTO_LOGIN === 'true' &&
          (!localStorage.getItem('KEEPUP_BEARER_TOKEN') && !localStorage.getItem('KEEPUP_SESSION_TOKEN') && !localStorage.getItem('KEEPUP_TOKEN'))
        ) {
          try {
            const devUser = {
              id: 1,
              username: 'dev',
              name: 'Developer',
              groups: [2],
              role: 'user',
            } as any;
            const devToken = 'dev-local-token';
            setUser(devUser);
            setToken(devToken);
            try {
              localStorage.setItem('KEEPUP_BEARER_TOKEN', devToken);
              localStorage.setItem('KEEPUP_USER', JSON.stringify(devUser));
            } catch (e) { /* ignore */ }
          } catch (e) {
            console.warn('Dev auto-login failed', e);
          }
        }

        setLoading(false);
      }
    };

    init();
  }, [verifyToken]);

  const login = async (emailOrUsername: string, password: string) => {
    try {
      const response = await authAPI.login(emailOrUsername, password);
      setUser(response.user || null);
      const token = response.bearerToken || response.sessionToken || null;
      setToken(token);
      try {
        if (response.bearerToken) localStorage.setItem('KEEPUP_BEARER_TOKEN', response.bearerToken);
        if (response.sessionToken) localStorage.setItem('KEEPUP_SESSION_TOKEN', response.sessionToken);
        if (token) localStorage.setItem('KEEPUP_TOKEN', token);
        if (response.socketTicket) localStorage.setItem('KEEPUP_SOCKET_TICKET', response.socketTicket);
        if (response.user) localStorage.setItem('KEEPUP_USER', JSON.stringify(response.user));
      } catch (e) {
        console.warn('Failed to persist login tokens to localStorage', e);
      }
      // expose socket ticket in memory as well
      const ticket = response.socketTicket || null;
      if (ticket) {
        // no-op store in state via token field or separate getter
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  };

  const getSocketTicket = () => {
    try {
      return localStorage.getItem('KEEPUP_SOCKET_TICKET');
    } catch (e) {
      return null;
    }
  };

  return {
    user,
    token,
    isAuthenticated: !!token,
    login,
    logout,
    loading,
    // backward-compatible alias used across the app
    isLoading: loading,
    isJoomlaUser,
    getSocketTicket,
  };
};
