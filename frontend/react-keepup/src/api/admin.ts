import { User, Event } from './types';
import { API_URL } from './config';

export const adminAPI = {
  getUsers: async (token: string): Promise<User[]> => {
    const response = await fetch(`${API_URL}/api/admin/users`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch users');
    }

    return response.json();
  },

  deleteUser: async (userId: number, token: string): Promise<void> => {
    const response = await fetch(`${API_URL}/api/admin/users/${userId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to delete user');
    }
  },

  deleteEvent: async (eventId: number, token: string): Promise<void> => {
    const response = await fetch(`${API_URL}/api/admin/event/${eventId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to delete event');
  },

  getAllEvents: async (token: string): Promise<Event[]> => {
    const response = await fetch(`${API_URL}/api/admin/events`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch events');
    }

    const data = await response.json();
    return data.events || [];
  },

  approveEvent: async (eventId: number, token: string): Promise<Event> => {
    const response = await fetch(`${API_URL}/api/admin/events/${eventId}/approve`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to approve event');
    }

    return response.json();
  },

  // AI Configuration
  getAIConfig: async (token: string) => {
    const response = await fetch(`${API_URL}/api/admin/ai-config`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch AI config');
    return response.json();
  },

  saveAIConfig: async (config: any, token: string) => {
    const response = await fetch(`${API_URL}/api/admin/ai-config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(config),
    });
    if (!response.ok) throw new Error('Failed to save AI config');
    return response.json();
  },

  testAIConfig: async (config: any, token: string) => {
    const response = await fetch(`${API_URL}/api/admin/ai-config/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(config),
    });
    if (!response.ok) throw new Error('Failed to test AI config');
    return response.json();
  },

  // Fetcher Status
  getFetcherStatus: async (token: string) => {
    const response = await fetch(`${API_URL}/api/admin/fetcher/status`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to fetch status');
    return response.json();
  },

  // Populate Town
  populateTown: async (townData: any, token: string) => {
    const response = await fetch(`${API_URL}/api/admin/populate-town`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(townData),
    });
    if (!response.ok) throw new Error('Failed to populate town');
    return response.json();
  },

  getTownStatus: async (town: string, token: string) => {
    const response = await fetch(`${API_URL}/api/admin/town-status/${town}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to get town status');
    return response.json();
  },

  // Dragons Unleashed
  dragonsUnleashed: async (token: string) => {
    const response = await fetch(`${API_URL}/api/admin/dragons-unleashed`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to unleash dragons');
    return response.json();
  },

  // Cache Management
  getCacheStats: async (token: string) => {
    const response = await fetch(`${API_URL}/api/admin/cache/stats`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to get cache stats');
    return response.json();
  },

  clearCache: async (token: string) => {
    const response = await fetch(`${API_URL}/api/admin/cache/clear`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to clear cache');
    return response.json();
  },

  // Stats (optional queryString for city/country filter, e.g. "city=Porto&country=Brazil")
  getStats: async (token: string, queryString?: string) => {
    const qs = queryString ? `?${queryString}` : '';
    const response = await fetch(`${API_URL}/api/admin/stats${qs}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to get stats');
    return response.json();
  },

  // Unified Fetcher - consolidated multi-API event fetching
  unifiedFetch: async (params: { city: string; country: string; sources?: string[]; maxPerSource?: number }, token: string) => {
    const response = await fetch(`${API_URL}/api/admin/unified-fetch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(params),
    });
    if (!response.ok) throw new Error('Failed to start unified fetch');
    return response.json();
  },

  getUnifiedSources: async (token: string) => {
    const response = await fetch(`${API_URL}/api/admin/unified-sources`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to get unified sources');
    return response.json();
  },

  // Populate World — Python Serpents across all countries
  populateWorld: async (params: { countries?: string[]; maxEventsPerCity?: number }, token: string) => {
    const response = await fetch(`${API_URL}/api/admin/populate-world`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(params),
    });
    if (!response.ok) throw new Error('Failed to start world population');
    return response.json();
  },

  // Populate Country — deep state-level population via Python Serpents
  populateCountry: async (params: { country: string; maxEventsPerCity?: number }, token: string) => {
    const response = await fetch(`${API_URL}/api/admin/populate-country`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(params),
    });
    if (!response.ok) throw new Error('Failed to start country population');
    return response.json();
  },

  // Get list of available countries for population
  getPopulateCountries: async (token: string) => {
    const response = await fetch(`${API_URL}/api/admin/populate-countries`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to get countries list');
    return response.json();
  },

  // Get current populate status (world and per-country)
  getPopulateStatus: async (token: string) => {
    const response = await fetch(`${API_URL}/api/admin/populate-status`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to get populate status');
    return response.json();
  },

  // Jobs API: list jobs, get a job, resume a job
  getPopulateJobs: async (token: string, limit = 20) => {
    const response = await fetch(`${API_URL}/api/admin/populate-jobs?limit=${limit}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to list populate jobs');
    return response.json();
  },

  getPopulateJob: async (id: number, token: string) => {
    const response = await fetch(`${API_URL}/api/admin/populate-job/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to get job');
    return response.json();
  },

  resumePopulateJob: async (id: number, token: string) => {
    const response = await fetch(`${API_URL}/api/admin/populate-job/${id}/resume`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to resume job');
    return response.json();
  },

  // ── HOT REFRESH — restart Node / rebuild React without Docker rebuild ──

  refreshNode: async (token: string) => {
    const response = await fetch(`${API_URL}/api/admin/refresh-node`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    // Note: the server may close the connection before we read the response
    // because it's about to restart. That's expected behavior.
    try {
      if (!response.ok) throw new Error('Failed to trigger Node refresh');
      return response.json();
    } catch {
      return { ok: true, message: 'Node.js is restarting...' };
    }
  },

  refreshReact: async (token: string) => {
    const response = await fetch(`${API_URL}/api/admin/refresh-react`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to trigger React rebuild');
    return response.json();
  },

  getRefreshStatus: async (token: string) => {
    const response = await fetch(`${API_URL}/api/admin/refresh-status`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to get refresh status');
    return response.json();
  },

  // Crawler/Fetcher control - proxied through Node.js backend
  startCrawler: async (token: string) => {
    const response = await fetch(`${API_URL}/api/admin/fetcher/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to start crawler');
    return response.json();
  },

  pauseCrawler: async (token: string) => {
    const response = await fetch(`${API_URL}/api/admin/fetcher/pause`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to pause crawler');
    return response.json();
  },

  resumeCrawler: async (token: string) => {
    const response = await fetch(`${API_URL}/api/admin/fetcher/resume`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to resume crawler');
    return response.json();
  },

  stopCrawler: async (token: string) => {
    const response = await fetch(`${API_URL}/api/admin/fetcher/stop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error('Failed to stop crawler');
    return response.json();
  },
};