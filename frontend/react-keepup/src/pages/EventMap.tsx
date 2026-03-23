import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from 'react-leaflet';
import { Icon, DivIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { eventsAPI } from '../api/events';
import { userAPI } from '../api/user';
import { useAuth } from '../context/AuthContext';
import { Event } from '../api/types';
import { formatEventDate, formatShortDate } from '../utils/dateFormat';
import './EventMap.css';

/* ─────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────── */

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDist(km: number | undefined): string {
  if (km == null) return '';
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;
}

/** Group events by venue (same lat/lng rounded to ~11m) */
function groupByVenue(events: Event[]): Map<string, Event[]> {
  const map = new Map<string, Event[]>();
  for (const e of events) {
    if (!e.latitude || !e.longitude) continue;
    const key = `${e.latitude.toFixed(4)},${e.longitude.toFixed(4)}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }
  return map;
}

/* ─────────────────────────────────────────────
   Marker Icons
   ───────────────────────────────────────────── */

const ICON_EVENT = new Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

const ICON_VENUE = new Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

const ICON_USER = new Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

function clusterIcon(count: number): DivIcon {
  const size = count < 10 ? 36 : count < 50 ? 44 : 52;
  return new DivIcon({
    html: `<div class="cluster-icon" style="width:${size}px;height:${size}px"><span>${count}</span></div>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/* ─────────────────────────────────────────────
   Map inner hooks
   ───────────────────────────────────────────── */

/** Smoothly fly to a position */
const FlyTo: React.FC<{ center: [number, number]; zoom?: number }> = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    if (center[0] && center[1]) map.flyTo(center, zoom ?? map.getZoom(), { duration: 1.2 });
  }, [center, zoom, map]);
  return null;
};

/* ═════════════════════════════════════════════
   MAIN COMPONENT
   ═════════════════════════════════════════════ */

const EventMap: React.FC = () => {
  const { token, user } = useAuth();

  // Data
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // User location
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [radius, setRadius] = useState(25); // km
  const [mapCenter, setMapCenter] = useState<[number, number]>([-30.0346, -51.2177]);
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  // UI state
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [selectedVenue, setSelectedVenue] = useState<{
    key: string; events: Event[]; lat: number; lng: number;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<'nearby' | 'venues'>('nearby');

  // Venues grouped
  const venueGroups = useMemo(() => groupByVenue(events), [events]);

  // Sorted events by distance
  const sortedEvents = useMemo(() => {
    if (!userLoc) return events;
    return [...events].sort((a, b) => {
      const dA = a.latitude && a.longitude ? distanceKm(userLoc.lat, userLoc.lng, a.latitude, a.longitude) : 9999;
      const dB = b.latitude && b.longitude ? distanceKm(userLoc.lat, userLoc.lng, b.latitude, b.longitude) : 9999;
      return dA - dB;
    });
  }, [events, userLoc]);

  // Unique venues sorted by distance
  const sortedVenues = useMemo(() => {
    const arr = Array.from(venueGroups.entries()).map(([key, evts]) => {
      const [lat, lng] = key.split(',').map(Number);
      const dist = userLoc ? distanceKm(userLoc.lat, userLoc.lng, lat, lng) : undefined;
      const venueName = evts[0]?.venue_name || evts[0]?.location?.split(' - ')[0] || 'Unknown Venue';
      return { key, events: evts, lat, lng, dist, venueName };
    });
    return arr.sort((a, b) => (a.dist ?? 9999) - (b.dist ?? 9999));
  }, [venueGroups, userLoc]);

  /* ── Location init ── */
  const getIpFallbackLocation = async () => {
    try {
      const response = await fetch('https://ipapi.co/json/');
      if (!response.ok) throw new Error('ip lookup failed');
      const data = await response.json();
      if (data.latitude && data.longitude) {
        return { lat: parseFloat(data.latitude), lng: parseFloat(data.longitude) };
      }
    } catch (err) {
      console.warn('IP location fallback failed:', err);
    }
    return { lat: -30.0346, lng: -51.2177 };
  };

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      // 1. Get radius from profile (always)
      if (token) {
        try {
          const profile = await userAPI.getProfile(token);
          if (!cancelled) {
            if (profile.radiusKm) setRadius(profile.radiusKm);
            else if (profile.location?.radius) setRadius(profile.location.radius);
            if (profile.location?.latitude && profile.location?.longitude) {
              const loc = { lat: profile.location.latitude, lng: profile.location.longitude };
              setUserLoc(loc);
              setMapCenter([loc.lat, loc.lng]);
              setFlyTarget([loc.lat, loc.lng]);
              return;
            }
          }
        } catch { /* continue to geolocation */ }
      }

      // 2. Browser geolocation w/ IP fallback for mobile-denied geo
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (cancelled) return;
            const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            setUserLoc(loc);
            setMapCenter([loc.lat, loc.lng]);
            setFlyTarget([loc.lat, loc.lng]);
            setLocationError(null);
            // Persist to backend
            if (token && user?.id) {
              userAPI.updateCurrentLocation(token, {
                userId: user.id,
                latitude: loc.lat,
                longitude: loc.lng,
              }).catch(() => {});
            }
          },
          async (err) => {
            console.warn('Geolocation failed:', err);
            setLocationError('Geolocation not available or denied. Using fallback location.');
            if (!cancelled) {
              const fallback = await getIpFallbackLocation();
              setUserLoc(fallback);
              setMapCenter([fallback.lat, fallback.lng]);
              setFlyTarget([fallback.lat, fallback.lng]);
            }
          },
          { timeout: 15000, enableHighAccuracy: true }
        );
      } else {
        const fallback = await getIpFallbackLocation();
        setLocationError('Geolocation not supported by this browser. Showing fallback location.');
        setUserLoc(fallback);
        setMapCenter([fallback.lat, fallback.lng]);
        setFlyTarget([fallback.lat, fallback.lng]);
      }
    };
    init();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user]);

  /* ── Fetch events when location or radius changes ── */
  useEffect(() => {
    if (!userLoc) return;
    doFetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLoc, radius]);

  const doFetchEvents = useCallback(async () => {
    if (!userLoc) return;
    try {
      setLoading(true);
      setError(null);
      const data = await eventsAPI.getEvents({
        lat: userLoc.lat,
        lng: userLoc.lng,
        radius,
        limit: 500,
      });
      // ALL events with valid coordinates go on map (including Date TBA)
      const mappable = data.filter(
        (e) => e.latitude && e.longitude && !isNaN(e.latitude) && !isNaN(e.longitude)
      );
      setEvents(mappable);
    } catch (err) {
      setError('Failed to load events');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [userLoc, radius]);

  /* ── Venue click ── */
  const openVenue = (key: string) => {
    const evts = venueGroups.get(key);
    if (!evts?.length) return;
    const [lat, lng] = key.split(',').map(Number);
    setSelectedVenue({ key, events: evts, lat, lng });
    setFlyTarget([lat, lng]);
  };

  const closeVenue = () => setSelectedVenue(null);

  /* ── Re-locate ── */
  const recenter = () => {
    if (userLoc) setFlyTarget([userLoc.lat, userLoc.lng]);
  };

  /* ─────────────────────────────────────────────
     RENDER
     ───────────────────────────────────────────── */
  return (
    <div className="kmap">
      {/* ── Stats bar (top, slim) ── */}
      <div className="kmap-search">
        <div className="kmap-stats">
          <span>{events.length} events</span>
          <span className="kmap-dot">&middot;</span>
          <span>{venueGroups.size} venues</span>
          {userLoc && (
            <>
              <span className="kmap-dot">&middot;</span>
              <span>{radius}km radius</span>
            </>
          )}
        </div>
        {locationError && (
          <div style={{ color: '#FFBABA', background: '#5F2121', padding: '6px 12px', borderRadius: 8, marginTop: 8, fontSize: '0.75rem' }}>
            ⚠️ {locationError}
          </div>
        )}
      </div>

      {/* ── Map container ── */}
      <div className="kmap-body">
        <MapContainer
          center={mapCenter}
          zoom={13}
          className="kmap-leaflet"
          zoomControl={false}
          attributionControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {flyTarget && <FlyTo center={flyTarget} />}

          {/* User location marker */}
          {userLoc && (
            <>
              <Marker position={[userLoc.lat, userLoc.lng]} icon={ICON_USER}>
                <Popup><strong>You are here</strong></Popup>
              </Marker>
              <Circle
                center={[userLoc.lat, userLoc.lng]}
                radius={radius * 1000}
                pathOptions={{ color: '#667eea', fillColor: '#667eea', fillOpacity: 0.06, weight: 1 }}
              />
            </>
          )}

          {/* Venue markers — cluster same-location events */}
          {Array.from(venueGroups.entries()).map(([key, evts]) => {
            const [lat, lng] = key.split(',').map(Number);
            const isMulti = evts.length > 1;
            const venueName = evts[0]?.venue_name || evts[0]?.location?.split(' - ')[0] || 'Venue';
            const hasDated = evts.some((e) => e.hasDate);
            const icon = isMulti ? clusterIcon(evts.length) : (hasDated ? ICON_EVENT : ICON_VENUE);
            return (
              <Marker
                key={key}
                position={[lat, lng]}
                icon={icon}
                eventHandlers={{ click: () => openVenue(key) }}
              >
                <Popup>
                  <div className="kmap-popup">
                    <h3>{venueName}</h3>
                    <p className="kmap-popup-count">
                      {evts.length} event{evts.length > 1 ? 's' : ''} at this location
                    </p>
                    {evts.slice(0, 3).map((e) => (
                      <div key={e.id} className="kmap-popup-event">
                        <span className="kmap-popup-title">{e.title}</span>
                        <span className="kmap-popup-date">
                          {e.hasDate ? formatShortDate(e.startDate) : 'Ongoing'}
                        </span>
                      </div>
                    ))}
                    {evts.length > 3 && (
                      <p className="kmap-popup-more">+{evts.length - 3} more</p>
                    )}
                    <button className="kmap-popup-btn" onClick={() => openVenue(key)}>
                      View all &rarr;
                    </button>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {/* ── Floating controls ── */}
        <div className="kmap-controls">
          <button className="kmap-ctrl-btn" onClick={recenter} title="My location">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
            </svg>
          </button>
          <button
            className="kmap-ctrl-btn"
            onClick={() => setDrawerOpen(!drawerOpen)}
            title="Nearby events"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18M9 21V9" />
            </svg>
          </button>
          <button className="kmap-ctrl-btn" onClick={doFetchEvents} title="Refresh">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
              <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
            </svg>
          </button>
        </div>

        {/* ── Venue detail panel (slide in from right) ── */}
        {selectedVenue && (
          <div className="kmap-venue-panel">
            <div className="kmap-venue-header">
              <div>
                <h2>
                  {selectedVenue.events[0]?.venue_name ||
                    selectedVenue.events[0]?.location?.split(' - ')[0] ||
                    'Venue'}
                </h2>
                <p className="kmap-venue-sub">
                  {selectedVenue.events[0]?.venue_city ||
                    selectedVenue.events[0]?.location ||
                    ''}
                  {userLoc && (
                    <span>
                      {' '}
                      &middot;{' '}
                      {formatDist(
                        distanceKm(userLoc.lat, userLoc.lng, selectedVenue.lat, selectedVenue.lng)
                      )}
                    </span>
                  )}
                </p>
              </div>
              <button className="kmap-venue-close" onClick={closeVenue}>
                &times;
              </button>
            </div>
            <div className="kmap-venue-actions">
              <a
                href={`/create-event?lat=${selectedVenue.lat}&lng=${selectedVenue.lng}&venue=${encodeURIComponent(
                  selectedVenue.events[0]?.venue_name || ''
                )}`}
                className="kmap-btn-create"
              >
                + Create Event Here
              </a>
            </div>
            <div className="kmap-venue-events">
              <h3>
                {selectedVenue.events.length} Event
                {selectedVenue.events.length > 1 ? 's' : ''}
              </h3>
              {selectedVenue.events.map((e) => (
                <div key={e.id} className="kmap-event-card">
                  <div className="kmap-event-card-img">
                    {e.image ? (
                      <img src={e.image} alt={e.title} />
                    ) : (
                      <div className="kmap-event-card-placeholder">&#127925;</div>
                    )}
                  </div>
                  <div className="kmap-event-card-body">
                    <h4>{e.title}</h4>
                    <p className="kmap-event-card-date">
                      {e.hasDate ? formatEventDate(e.startDate) : 'Open Venue'}
                    </p>
                    <p className="kmap-event-card-cat">{e.category}</p>
                  </div>
                  {e.url && (
                    <a
                      href={e.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="kmap-event-card-link"
                    >
                      Tickets &rarr;
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>{/* end kmap-body */}

      {/* ── Events list panel (separate div below map) ── */}
      <div className="kmap-events-panel">
        <div className="kmap-events-panel-header">
          <div className="kmap-drawer-tabs">
            <button
              className={`kmap-tab ${activeTab === 'nearby' ? 'active' : ''}`}
              onClick={() => setActiveTab('nearby')}
            >
              Nearby
            </button>
            <button
              className={`kmap-tab ${activeTab === 'venues' ? 'active' : ''}`}
              onClick={() => setActiveTab('venues')}
            >
              Venues
            </button>
          </div>
        </div>
        <div className="kmap-events-body">
            {activeTab === 'nearby' ? (
              /* ── Nearby events list ── */
              sortedEvents.length === 0 ? (
                <div className="kmap-empty">
                  <p>No events found nearby</p>
                  <p className="kmap-empty-sub">Try increasing the radius or searching</p>
                </div>
              ) : (
                sortedEvents.map((e) => {
                  const dist =
                    userLoc && e.latitude && e.longitude
                      ? distanceKm(userLoc.lat, userLoc.lng, e.latitude, e.longitude)
                      : (e as any).distance_km;
                  return (
                    <div
                      key={e.id}
                      className="kmap-list-item"
                      onClick={() => {
                        if (e.latitude && e.longitude) {
                          setFlyTarget([e.latitude, e.longitude]);
                          const key = `${e.latitude.toFixed(4)},${e.longitude.toFixed(4)}`;
                          openVenue(key);
                        }
                      }}
                    >
                      <div className="kmap-list-img">
                        {e.image ? (
                          <img src={e.image} alt="" />
                        ) : (
                          <div className="kmap-list-placeholder">
                            {e.hasDate ? '\uD83C\uDFAA' : '\uD83D\uDCCD'}
                          </div>
                        )}
                      </div>
                      <div className="kmap-list-info">
                        <h4>{e.title}</h4>
                        <p>
                          {e.hasDate ? formatShortDate(e.startDate) : 'Open Venue'}
                          {e.venue_name ? ` \u00b7 ${e.venue_name}` : ''}
                        </p>
                      </div>
                      <div className="kmap-list-dist">{formatDist(dist)}</div>
                    </div>
                  );
                })
              )
            ) : (
              /* ── Venues tab ── */
              sortedVenues.length === 0 ? (
                <div className="kmap-empty">
                  <p>No venues found</p>
                </div>
              ) : (
                sortedVenues.map((v) => (
                  <div
                    key={v.key}
                    className="kmap-list-item"
                    onClick={() => {
                      openVenue(v.key);
                      setFlyTarget([v.lat, v.lng]);
                    }}
                  >
                    <div className="kmap-list-img">
                      <div className="kmap-list-placeholder kmap-venue-count">{v.events.length}</div>
                    </div>
                    <div className="kmap-list-info">
                      <h4>{v.venueName}</h4>
                      <p>
                        {v.events.length} event{v.events.length > 1 ? 's' : ''} &middot;{' '}
                        {v.events[0]?.category}
                      </p>
                    </div>
                    <div className="kmap-list-dist">{formatDist(v.dist)}</div>
                  </div>
                ))
              )
            )}
          </div>
      </div>{/* end kmap-events-panel */}

      {/* Loading overlay */}
      {loading && (
        <div className="kmap-loading">
          <div className="kmap-spinner" />
          <p>Loading map...</p>
        </div>
      )}
    </div>
  );
};

export default EventMap;
