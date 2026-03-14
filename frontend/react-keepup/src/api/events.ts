import { Event, EventCreateRequest } from './types';
import { API_URL } from './config';

/** Retrieve the session / bearer token stored by the login flow. */
const getStoredToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return (
    localStorage.getItem('KEEPUP_BEARER_TOKEN') ||
    localStorage.getItem('KEEPUP_SESSION_TOKEN') ||
    null
  );
};

/** Build Authorization header if a token is available. */
const authHeaders = (): Record<string, string> => {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Map API response to Event interface
const mapApiEventToEvent = (apiEvent: any): Event => ({
  id: apiEvent.id || 0,
  title: apiEvent.title || apiEvent.event_name || '',
  description: apiEvent.description || `${apiEvent.artist_name || ''} at ${apiEvent.location || ''}`,
  startDate: apiEvent.startDate || apiEvent.event_date || '',
  endDate: apiEvent.endDate || apiEvent.end_date || apiEvent.startDate || apiEvent.event_date || '',
  location: apiEvent.location || '',
  latitude: apiEvent.venue_latitude || apiEvent.latitude,
  longitude: apiEvent.venue_longitude || apiEvent.longitude,
  category: apiEvent.category || 'Music',
  image: apiEvent.image_url || apiEvent.image,
  distance_km: apiEvent.distance_km != null ? parseFloat(apiEvent.distance_km) : undefined,
  attendees: undefined,
  url: (() => {
    const rawUrl = apiEvent.url || apiEvent.ticket_url || '';
    if (rawUrl.includes('foursquare.com')) return '';
    return rawUrl;
  })(),
  organizer: {
    id: 0,
    username: apiEvent.artist_name || 'Unknown Artist',
    email: '',
    role: 'user',
  },
  // Map-specific fields
  showOnMap: apiEvent.showOnMap ?? !!(apiEvent.latitude || apiEvent.venue_latitude),
  hasDate: apiEvent.hasDate ?? !!apiEvent.startDate,
  venue_name: apiEvent.venue_name || '',
  venue_city: apiEvent.venue_city || '',
  source: apiEvent.source || '',
});

export const eventsAPI = {
  getEvents: async (filters?: Record<string, any>): Promise<Event[]> => {
    const query = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) query.append(key, String(value));
      });
    }

    try {
      const response = await fetch(`${API_URL}/api/events/discover?${query}`, {
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }

      const data = await response.json();
      const events = data.events || data;
      return Array.isArray(events) ? events.map(mapApiEventToEvent) : [];
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Events API failed, returning mock events:', err);
        return [
          {
            id: 1,
            title: 'Dev Night: Local Bands',
            description: 'A showcase of local talent',
            startDate: new Date().toISOString(),
            endDate: new Date().toISOString(),
            location: 'Porto Alegre',
            latitude: -30.0346,
            longitude: -51.2177,
            category: 'Music',
            image: undefined,
            attendees: undefined,
            url: '',
            organizer: {
              id: 0,
              username: 'Unknown Artist',
              email: '',
              role: 'user',
            },
          },
          {
            id: 2,
            title: 'Open Air DJ Set',
            description: 'Electronic music by the river',
            startDate: new Date().toISOString(),
            endDate: new Date().toISOString(),
            location: 'Porto Alegre - Riverside',
            latitude: -30.03,
            longitude: -51.22,
            category: 'Music',
            image: undefined,
            attendees: undefined,
            url: '',
            organizer: {
              id: 0,
              username: 'Unknown Artist',
              email: '',
              role: 'user',
            },
          },
        ];
      }
      console.warn("Events API failed, returning mock events:", err);
      return [
        {
          id: 1,
          title: "Dev Night: Local Bands",
          description: "A showcase of local talent",
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString(),
          location: "Porto Alegre",
          latitude: -30.0346,
          longitude: -51.2177,
          category: "Music",
          image: undefined,
          attendees: undefined,
          url: "",
          organizer: {
            id: 0,
            username: "Unknown Artist",
            email: "",
            role: "user",
          },
        },
        {
          id: 2,
          title: "Open Air DJ Set",
          description: "Electronic music by the river",
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString(),
          location: "Porto Alegre - Riverside",
          latitude: -30.03,
          longitude: -51.22,
          category: "Music",
          image: undefined,
          attendees: undefined,
          url: "",
          organizer: {
            id: 0,
            username: "Unknown Artist",
            email: "",
            role: "user",
          },
        },
      ];
    }
  },

  // Search Viagogo for events and auto-save new ones to database
  viagogoSearch: async (query: string): Promise<{ events: Event[]; count: number; searching: boolean }> => {
    if (!query.trim()) {
      return { events: [], count: 0, searching: false };
    }

    try {
      const response = await fetch(`${API_URL}/api/events/viagogo-search?q=${encodeURIComponent(query)}`, {
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Viagogo search failed');
      }

      const data = await response.json();
      const events = data.events || [];
      return {
        events: Array.isArray(events) ? events.map(mapApiEventToEvent) : [],
        count: data.count || 0,
        searching: false,
      };
    } catch (err) {
      console.error('Viagogo search error:', err);
      return { events: [], count: 0, searching: false };
    }
  },

  getEventById: async (id: number): Promise<any> => {
    const response = await fetch(`${API_URL}/api/events/${id}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to fetch event');
    }

    return response.json();
  },

  createEvent: async (event: EventCreateRequest, token: string): Promise<Event> => {
    const body = JSON.stringify(formatEventForCreate(event as any));
    const response = await fetch(`${API_URL}/api/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      credentials: 'include',
      body,
    });

    if (!response.ok) {
      throw new Error('Failed to create event');
    }

    return response.json();
  },

  updateEvent: async (id: number, event: Partial<Event>, token: string): Promise<Event> => {
    const response = await fetch(`${API_URL}/api/events/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      credentials: 'include',
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      throw new Error('Failed to update event');
    }

    return response.json();
  },

  deleteEvent: async (id: number, token: string): Promise<void> => {
    const response = await fetch(`${API_URL}/api/events/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to delete event');
    }
  },

  // Save event to user's saved list
  saveEvent: async (eventId: number): Promise<{ ok: boolean; message: string }> => {
    const response = await fetch(`${API_URL}/api/events/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      credentials: 'include',
      body: JSON.stringify({ event_id: eventId }),
    });

    if (!response.ok) {
      throw new Error('Failed to save event');
    }

    return response.json();
  },

  // Remove event from user's saved list
  unsaveEvent: async (eventId: number): Promise<{ ok: boolean; message: string }> => {
    const response = await fetch(`${API_URL}/api/events/unsave`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      credentials: 'include',
      body: JSON.stringify({ event_id: eventId }),
    });

    if (!response.ok) {
      throw new Error('Failed to unsave event');
    }

    return response.json();
  },

  // Get all saved events for current user
  getSavedEvents: async (): Promise<Event[]> => {
    const response = await fetch(`${API_URL}/api/events/saved`, {
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to fetch saved events');
    }

    const data = await response.json();
    const events = data.events || [];
    return Array.isArray(events) ? events.map(mapApiEventToEvent) : [];
  },

  // Check if event is saved by current user
  checkIsSaved: async (eventId: number): Promise<boolean> => {
    const response = await fetch(`${API_URL}/api/events/is-saved?event_id=${eventId}`, {
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      credentials: 'include',
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return data.is_saved || false;
  },
};

// Helper: ensure an event has the required shape for creating in the DB/API
export function formatEventForCreate(e: Partial<Event> | EventCreateRequest): EventCreateRequest {
  const now = new Date().toISOString();
  return {
    title: e.title || (e as any).event_name || 'Untitled Event',
    description: e.description || '',
    startDate: (e as any).startDate || (e as any).event_date || now,
    endDate: (e as any).endDate || (e as any).end_date || (e as any).startDate || now,
    location: e.location || '',
    latitude: (e as any).latitude,
    longitude: (e as any).longitude,
    category: (e as any).category || 'Other',
  };
}
