import React, { useState, useEffect } from 'react';
import { eventsAPI } from '../api/events';
import { userAPI } from '../api/user';
import { useAuth } from '../context/AuthContext';
import type { Event } from '../api/types';
import './EventGrid.css';
import { SkeletonCard } from '../components/SkeletonCard';
import { formatEventDate, isFutureOrToday } from '../utils/dateFormat';

// Helper: haversine distance in km
function computeDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

interface UserLocation {
  latitude: number;
  longitude: number;
  city?: string;
  radius: number;
}

function EventGrid() {
  const { token } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Event[] | null>(null);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);

  useEffect(() => {
    initializeLocation();
  }, [token]);

  useEffect(() => {
    loadEvents();
  }, [userLocation]);

  const initializeLocation = async () => {
    try {
      // Try to get location from user's profile (uses radius from DB)
      if (token) {
        try {
          const profile = await userAPI.getProfile(token);
          if (profile.latitude && profile.longitude) {
            setUserLocation({
              latitude: profile.latitude,
              longitude: profile.longitude,
              city: profile.locationName || '',
              radius: profile.radiusKm || 25
            });
            return;
          }
        } catch (err) {
          console.warn('Could not load profile location:', err);
        }
      }

      // Fallback to browser geolocation
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            setUserLocation({
              latitude,
              longitude,
              radius: 25 // Default radius
            });
          },
          () => {
            // Use default Porto Alegre location
            setUserLocation({
              latitude: -30.0346,
              longitude: -51.2177,
              radius: 50
            });
          },
          { timeout: 10000 }
        );
      } else {
        // Default location
        setUserLocation({
          latitude: -30.0346,
          longitude: -51.2177,
          radius: 50
        });
      }
    } catch (err) {
      console.error('Location initialization error:', err);
      setUserLocation({
        latitude: -30.0346,
        longitude: -51.2177,
        radius: 50
      });
    }
  };

  const loadEvents = async () => {
    if (!userLocation) return;

    try {
      setLoading(true);
      setError(null);
      const filters = userLocation ? {
        lat: userLocation.latitude,
        lng: userLocation.longitude,
        radius: userLocation.radius
      } : {};
      const fetchedEvents = await eventsAPI.getEvents(filters);
      setEvents(fetchedEvents);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  // Search - searches external source and auto-saves new events
  const handleViagogoSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setSearchMessage(`Searching for "${searchQuery}"...`);
    setSearchResults(null);
    
    try {
      const result = await eventsAPI.viagogoSearch(searchQuery);
      if (result.events.length > 0) {
        setSearchResults(result.events);
        setSearchMessage(`Found ${result.count} events for "${searchQuery}". New events saved to database.`);
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

  // Determine which events to display
  const isShowingSearch = searchResults !== null;
  const displayEvents = isShowingSearch 
    ? searchResults 
    : events.filter(event => isFutureOrToday(new Date(event.startDate)));

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
      <h1>Discover Events Near You</h1>

      {/* Viagogo Search Box */}
      <div className="viagogo-search-box" style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f5f5f5', borderRadius: '8px' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleViagogoSearch()}
            placeholder="Search"
            style={{
              flex: 1,
              minWidth: '200px',
              padding: '0.75rem 1rem',
              fontSize: '1rem',
              border: '2px solid #ddd',
              borderRadius: '6px',
              outline: 'none',
            }}
            disabled={isSearching}
          />
          <button
            onClick={handleViagogoSearch}
            disabled={isSearching || !searchQuery.trim()}
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              background: isSearching ? '#999' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: isSearching ? 'not-allowed' : 'pointer',
            }}
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
          {searchResults !== null && (
            <button
              onClick={clearSearch}
              style={{
                padding: '0.75rem 1rem',
                fontSize: '1rem',
                background: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              ✕ Clear
            </button>
          )}
        </div>
        {searchMessage && (
          <p style={{ marginTop: '0.5rem', marginBottom: 0, fontSize: '0.9rem', color: searchMessage.startsWith('❌') ? '#d32f2f' : '#333' }}>
            {searchMessage}
          </p>
        )}
      </div>

      {/* Location info */}
      {userLocation && userLocation.city && (
        <p className="location-info">📍 Showing events near {userLocation.city}</p>
      )}

      {/* Results */}
      {isShowingSearch && (
        <h2 className="search-results-title">
          🎫 Search Results ({displayEvents.length} events)
        </h2>
      )}

      {displayEvents.length === 0 ? (
        <p className="no-events">
          {isShowingSearch 
            ? `No events found for "${searchQuery}".` 
            : 'No upcoming events found.'}
        </p>
      ) : (
        <div className="event-grid">
          {displayEvents.map((event) => (
            <div key={event.id} className="event-card">
              <div className="event-card-inner">
                <div className="event-thumb-wrap">
                  {event.image ? (
                    <img
                      src={event.image}
                      alt={event.title}
                      className="event-thumb"
                      onError={(e) => { const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(event.title || 'Event')}&background=667eea&color=ffffff&size=256`; (e.currentTarget as HTMLImageElement).src = fallback; }}
                    />
                  ) : (
                    <img
                      src={`https://ui-avatars.com/api/?name=${encodeURIComponent(event.title || 'Event')}&background=667eea&color=ffffff&size=256`}
                      alt={event.title}
                      className="event-thumb"
                    />
                  )}
                </div>
                <div className="event-card-body">
                  <h3>{event.title}</h3>
                  <p className="description">{event.description}</p>
                  <p className="location">📍 {event.location}</p>
                  <p className="date">{formatEventDate(new Date(event.startDate))}</p>
                  {userLocation && event.latitude && event.longitude && (
                    <p className="distance">{computeDistanceKm(userLocation.latitude, userLocation.longitude, event.latitude, event.longitude).toFixed(1)} km</p>
                  )}
                </div>
              </div>
              <div className="event-card-actions">
                {event.url && (
                  <a href={event.url} target="_blank" rel="noopener noreferrer" className="ticket-btn small">Ticket</a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EventGrid;
