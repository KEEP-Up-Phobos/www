import { User } from './types';
import { API_URL } from './config';

export const userAPI = {
  getProfile: async (token: string): Promise<any> => {
    // First get the user info from auth check
    const authResponse = await fetch(`${API_URL}/api/auth/check`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      credentials: 'include',
    });

    if (!authResponse.ok) {
      throw new Error('Failed to authenticate');
    }

    const authData = await authResponse.json();
    if (!authData.ok || !authData.user) {
      throw new Error('Not authenticated');
    }

    const userId = authData.user.id;

    // Then get the detailed profile
    const profileResponse = await fetch(`${API_URL}/api/profile/${userId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      credentials: 'include',
    });

    if (!profileResponse.ok) {
      // If profile doesn't exist, return basic user data
      return {
        ...authData.user,
        location: null
      };
    }

    const profileData = await profileResponse.json();
    return {
      ...authData.user,
      ...profileData.profile
    };
  },

  updateProfile: async (user: Partial<User>, token: string): Promise<User> => {
    const response = await fetch(`${API_URL}/api/users/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      credentials: 'include',
      body: JSON.stringify(user),
    });

    if (!response.ok) {
      throw new Error('Failed to update profile');
    }

    return response.json();
  },

  getUserEvents: async (userId: number, token: string): Promise<any[]> => {
    const response = await fetch(`${API_URL}/api/users/${userId}/events`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user events');
    }

    return response.json();
  },

  saveProfile: async (token: string, profileData: {
    userId: number;
    latitude?: number | null;
    longitude?: number | null;
    locationName?: string | null;
    radiusKm?: number;
    homeLatitude?: number | null;
    homeLongitude?: number | null;
    homeLocationName?: string | null;
    preferences?: Record<string, any>;
    musicGenres?: string[];
    favoriteArtists?: string[];
  }): Promise<any> => {
    const response = await fetch(`${API_URL}/api/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      credentials: 'include',
      body: JSON.stringify(profileData),
    });

    if (!response.ok) {
      throw new Error('Failed to save profile');
    }

    return response.json();
  },

  // Lightweight: auto-update current location (called silently on page load)
  updateCurrentLocation: async (token: string, data: {
    userId: number;
    latitude: number;
    longitude: number;
    locationName?: string;
  }): Promise<any> => {
    try {
      const response = await fetch(`${API_URL}/api/location/current`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      return response.ok ? response.json() : null;
    } catch (err) {
      console.warn('Failed to update current location:', err);
      return null;
    }
  },

  getMapCheckpoints: async (lat: number, lng: number, radius?: number): Promise<any> => {
    try {
      const params = new URLSearchParams({
        lat: lat.toString(),
        lng: lng.toString(),
        ...(radius && { radius: radius.toString() })
      });

      const response = await fetch(`${API_URL}/api/map/checkpoints?${params}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch map checkpoints');
      }

      return await response.json();
    } catch (err) {
      console.error('Failed to get map checkpoints:', err);
      return { ok: false, checkpoints: [] };
    }
  },
};
