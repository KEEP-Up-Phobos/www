import React, { useState, useEffect, useRef } from 'react';
import { eventsAPI } from '../api/events';
import { userAPI } from '../api/user';
import { useAuth } from '../context/AuthContext';
import type { Event } from '../api/types';
import './EventGrid.css';
import { SkeletonCard } from '../components/SkeletonCard';
import { formatEventDate, isFutureOrToday } from '../utils/dateFormat';

// Category-appropriate fallback images (no portraits)
const CATEGORY_IMAGES: Record<string, string> = {
  music: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=600&h=400&fit=crop',
  concert: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=600&h=400&fit=crop',
  festival: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=600&h=400&fit=crop',
  sports: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=600&h=400&fit=crop',
  theater: 'https://images.unsplash.com/photo-1503095396549-807759245b35?w=600&h=400&fit=crop',
  comedy: 'https://images.unsplash.com/photo-1585699324551-f6c309eedeca?w=600&h=400&fit=crop',
  conference: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600&h=400&fit=crop',
  default: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&h=400&fit=crop',
};

// List of bad stock portrait Unsplash IDs to filter out
const BAD_STOCK_IDS = [
  'photo-1507003211169-0a1dd7228f2d', // man's face portrait
  'photo-1551818255-e80b9c79e63c',   // generic portrait
  'photo-1521017432531-fbd92d768814', // generic stock
  'photo-1540575467063-178a50c2df87', // conference (OK for conferences, bad for music)
  'photo-1511795409834-ef04bbd61622', // generic stock
];

function getEventImage(event: Event): string {
  // If image exists and is NOT a bad stock portrait, use it
  if (event.image) {
    const isBadStock = BAD_STOCK_IDS.some(id => event.image!.includes(id));
    if (!isBadStock) return event.image;
  }
  // Return category-appropriate fallback
  const cat = (event.category || '').toLowerCase();
  return CATEGORY_IMAGES[cat] || CATEGORY_IMAGES.default;
}

interface UserLocation {
  latitude: number;
  longitude: number;
  city?: string;
  radius: number;
  source: 'profile' | 'geolocation' | 'default';
}

function EventGrid() {
  const { user, token } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const locationSynced = useRef(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Event[] | null>(null);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);

  // Saved events state
  const [savedEventIds, setSavedEventIds] = useState<Set<number>>(new Set());
  const [loadingSaved, setLoadingSaved] = useState(true);

  useEffect(() => {
    initializeLocation();
  }, [token]);

  useEffect(() => {
    loadEvents();
  }, [userLocation]);

  // Load saved events when token changes
  useEffect(() => {
    if (token) {
      loadSavedEvents();
    } else {
      setSavedEventIds(new Set());
      setLoadingSaved(false);
    }
  }, [token]);

  const initializeLocation = async () => {
    try {
      // Step 1: Always try browser geolocation FIRST (this is "current" location)
      // This ensures we use where the user IS, not where they LIVE
      const geoPromise = new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Geolocation not supported'));
          return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 8000,
          enableHighAccuracy: false,
          maximumAge: 300000 // Cache for 5 minutes
        });
      });

      try {
        const position = await geoPromise;
        const { latitude, longitude } = position.coords;

        // Get radius from profile if available
        let radius = 25;
        if (token) {
          try {
            const profile = await userAPI.getProfile(token);
            if (profile.radiusKm) radius = profile.radiusKm;
          } catch {} // ignore profile fetch errors
        }

        setUserLocation({
          latitude,
          longitude,
          radius,
          source: 'geolocation'
        });
        setLocationMessage(null);

        // Auto-sync current location to server (silently, for logged-in users)
        if (token && user && !locationSynced.current) {
          locationSynced.current = true;
          userAPI.updateCurrentLocation(token, {
            userId: user.id,
            latitude,
            longitude,
          }).catch(() => {}); // fire-and-forget
        }
        return;
      } catch (geoErr) {
        console.warn('Geolocation unavailable or denied:', geoErr);
      }

      // Step 2: Fallback to profile location (home or last known)
      if (token) {
        try {
          const profile = await userAPI.getProfile(token);
          // Prefer current location from profile, then home location
          const lat = profile.latitude || profile.homeLatitude;
          const lng = profile.longitude || profile.homeLongitude;
          if (lat && lng) {
            setUserLocation({
              latitude: lat,
              longitude: lng,
              city: profile.locationName || profile.homeLocationName || '',
              radius: profile.radiusKm || 25,
              source: 'profile'
            });
            return;
          }
        } catch (err) {
          console.warn('Could not load profile location:', err);
        }
      }

      // Step 3: No location at all — show message instead of defaulting to Porto Alegre
      setLocationMessage('📍 Enable location access to see events near you, or set your city in your profile.');
      // Still set a default so we can show SOME events (Porto Alegre)
      setUserLocation({
        latitude: -30.0346,
        longitude: -51.2177,
        city: 'Porto Alegre',
        radius: 50,
        source: 'default'
      });
    } catch (err) {
      console.error('Location initialization error:', err);
      setLocationMessage('Could not detect your location. Showing events in Porto Alegre.');
      setUserLocation({
        latitude: -30.0346,
        longitude: -51.2177,
        city: 'Porto Alegre',
        radius: 50,
        source: 'default'
      });
    }
  };

  const loadEvents = async () => {
    if (!userLocation) return;

    try {
      setLoading(true);
      setError(null);
      const filters: Record<string, any> = {
        lat: userLocation.latitude,
        lng: userLocation.longitude,
        radius: userLocation.radius,
      };
      const fetchedEvents = await eventsAPI.getEvents(filters);
      setEvents(fetchedEvents);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  // Load saved events for current user
  const loadSavedEvents = async () => {
    try {
      setLoadingSaved(true);
      const saved = await eventsAPI.getSavedEvents();
      const savedIds = new Set(saved.map(e => e.id));
      setSavedEventIds(savedIds);
    } catch (err) {
      console.error('Failed to load saved events:', err);
    } finally {
      setLoadingSaved(false);
    }
  };

  // Handle save event
  const handleSaveEvent = async (eventId: number) => {
    try {
      if (savedEventIds.has(eventId)) {
        await eventsAPI.unsaveEvent(eventId);
        setSavedEventIds(prev => {
          const updated = new Set(prev);
          updated.delete(eventId);
          return updated;
        });
      } else {
        await eventsAPI.saveEvent(eventId);
        setSavedEventIds(prev => new Set(prev).add(eventId));
      }
    } catch (err) {
      console.error('Failed to save/unsave event:', err);
    }
  };

  // Search
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setSearchMessage(`Searching for "${searchQuery}"...`);
    setSearchResults(null);
    
    try {
      const result = await eventsAPI.viagogoSearch(searchQuery);
      if (result.events.length > 0) {
        setSearchResults(result.events);
        setSearchMessage(`Found ${result.count} events for "${searchQuery}".`);
      } else {
        setSearchMessage(`No events found for "${searchQuery}". Try a different search term.`);
        setSearchResults([]);
      }
    } catch (err) {
      setSearchMessage(`Search failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsSearching(false);
    }
  };

  // Clear search and show nearby events again
  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults(null);
    setSearchMessage(null);
  };

  // EVENTS page only shows events with actual dates — TBA/undated items belong on MAP page only
  const displayEvents = events.filter(event => event.startDate && formatEventDate(event.startDate) !== 'Date TBA' && isFutureOrToday(event.startDate));

  if (loading) {
    return (
      <div className="event-grid-container">
        <h1>Upcoming Events</h1>
        <div className="event-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="event-grid-container">
        <h1>Discover Events</h1>
        <p className="error">{error}</p>
        <button onClick={() => initializeLocation()} className="retry-btn">
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="event-grid-container">
      {/* Location info / warnings */}
      {locationMessage && (
        <div style={{ padding: '12px 16px', background: '#fff3cd', borderRadius: '8px', marginBottom: '1rem', color: '#856404', fontSize: '0.95rem' }}>
          {locationMessage}
        </div>
      )}

      {displayEvents.length === 0 ? (
        <p className="no-events">
          No upcoming events found nearby. Try increasing your search radius in your profile settings.
        </p>
      ) : (
        <div className="event-grid">
          {displayEvents.map((event) => (
            <div key={event.id} className="event-card">
              <div className="event-card-image">
                <img
                  src={getEventImage(event)}
                  alt={event.title}
                  className="event-hero-img"
                  loading="lazy"
                  onError={(e) => {
                    const target = e.currentTarget as HTMLImageElement;
                    if (!target.dataset.retried) {
                      target.dataset.retried = 'true';
                      target.src = CATEGORY_IMAGES.default;
                    }
                  }}
                />
                {event.url && (
                  <a href={event.url} target="_blank" rel="noopener noreferrer" className="ticket-btn-overlay">🎫 Get Tickets</a>
                )}
              </div>
              <div className="event-card-body">
                <h3 className="event-title">{event.title}</h3>
                {event.description && <p className="event-description">{event.description}</p>}
                <div className="event-meta">
                  <p className="event-location">📍 {event.location}</p>
                  <p className="event-date">
                    {formatEventDate(event.startDate)}
                  </p>
                  {event.distance_km != null && (
                    <p className="event-distance">{event.distance_km} km</p>
                  )}
                </div>
                <div className="event-actions">
                  {token && (
                    <button
                      onClick={() => handleSaveEvent(event.id)}
                      className={`save-btn ${savedEventIds.has(event.id) ? 'saved' : ''}`}
                      title={savedEventIds.has(event.id) ? 'Cancel attendance' : 'Confirm attendance'}
                      style={{
                        padding: '0.5rem 1rem',
                        fontSize: '0.9rem',
                        background: savedEventIds.has(event.id) ? '#e91e63' : '#f0f0f0',
                        color: savedEventIds.has(event.id) ? 'white' : '#333',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        marginTop: '0.75rem',
                        width: '100%',
                      }}
                    >
                      {savedEventIds.has(event.id) ? '✅ Confirmed' : '🎫 Confirm'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EventGrid;
