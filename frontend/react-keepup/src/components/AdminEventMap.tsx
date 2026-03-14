import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Icon, DivIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Event } from '../api/types';

interface CountryCluster {
  country: string;
  count: number;
  lat: number;
  lng: number;
}

interface CityCluster {
  city: string;
  country: string;
  count: number;
  lat: number;
  lng: number;
  events: Event[];
}

/** Country center coordinates (approximate) */
const COUNTRY_COORDS: Record<string, [number, number]> = {
  'US': [37.0902, -95.7129],
  'BR': [-14.2350, -51.9253],
  'CA': [56.1304, -106.3468],
  'UK': [55.3781, -3.4360],
  'MX': [23.6345, -102.5528],
  'DE': [51.1657, 10.4515],
  'FR': [46.2276, 2.2137],
  'IT': [41.8719, 12.5674],
  'ES': [40.4637, -3.7492],
  'AU': [-25.2744, 133.7751],
  'CN': [35.8617, 104.1954],
  'IN': [20.5937, 78.9629],
  'JP': [36.2048, 138.2529],
  'RU': [61.5240, 105.3188],
};

function clusterIcon(count: number, type: 'country' | 'city' | 'venue' = 'country'): DivIcon {
  const colors = {
    country: '#FF6B6B',
    city: '#4ECDC4',
    venue: '#45B7D1',
  };
  const baseSize = type === 'country' ? 50 : type === 'city' ? 40 : 32;
  const size = Math.min(baseSize + Math.floor(Math.log(count) * 5), 70);

  return new DivIcon({
    html: `<div class="admin-cluster-icon" style="
      width:${size}px;
      height:${size}px;
      background-color:${colors[type]};
      border:2px solid white;
      border-radius:50%;
      display:flex;
      align-items:center;
      justify-content:center;
      font-weight:bold;
      color:white;
      font-size:${Math.min(12, size/3)}px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    "><span>${count}</span></div>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

const ICON_EVENT = new Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface Props {
  events: Event[];
}

/** Administrative map showing all events globally with geographic clustering */
const AdminEventMap: React.FC<Props> = ({ events }) => {
  const [zoom, setZoom] = useState(2);

  // Cluster by country (world level)
  const countryClusters = useMemo((): CountryCluster[] => {
    const map = new Map<string, { count: number; lats: number[]; lngs: number[] }>();
    
    for (const event of events) {
      const country = event.location?.split(' - ')[1] || event.venue_country || 'Unknown';
      if (!map.has(country)) {
        map.set(country, { count: 0, lats: [], lngs: [] });
      }
      const entry = map.get(country)!;
      entry.count++;
      if (event.latitude) entry.lats.push(event.latitude);
      if (event.longitude) entry.lngs.push(event.longitude);
    }

    return Array.from(map.entries()).map(([country, data]) => {
      const coords = COUNTRY_COORDS[country] || [0, 0];
      const avgLat = data.lats.length > 0 ? data.lats.reduce((a, b) => a + b) / data.lats.length : coords[0];
      const avgLng = data.lngs.length > 0 ? data.lngs.reduce((a, b) => a + b) / data.lngs.length : coords[1];
      return {
        country,
        count: data.count,
        lat: avgLat,
        lng: avgLng,
      };
    });
  }, [events]);

  // Cluster by city (regional level)
  const cityClusters = useMemo((): CityCluster[] => {
    const map = new Map<string, CityCluster>();
    
    for (const event of events) {
      const city = event.venue_city || event.location?.split(' - ')[0] || 'Unknown';
      const country = event.location?.split(' - ')[1] || event.venue_country || 'Unknown';
      const key = `${city}|${country}`;

      if (!map.has(key)) {
        map.set(key, {
          city,
          country,
          count: 0,
          lat: event.latitude || 0,
          lng: event.longitude || 0,
          events: [],
        });
      }

      const cluster = map.get(key)!;
      cluster.count++;
      cluster.events.push(event);
      // Update lat/lng to average
      const lats = cluster.events.filter(e => e.latitude).map(e => e.latitude!);
      const lngs = cluster.events.filter(e => e.longitude).map(e => e.longitude!);
      if (lats.length > 0) cluster.lat = lats.reduce((a, b) => a + b) / lats.length;
      if (lngs.length > 0) cluster.lng = lngs.reduce((a, b) => a + b) / lngs.length;
    }

    return Array.from(map.values());
  }, [events]);

  // Decide what to show based on zoom level
  const visibleMarkers = useMemo(() => {
    if (zoom < 4) {
      // World view: show countries
      return countryClusters.map(cluster => ({
        key: `country-${cluster.country}`,
        lat: cluster.lat,
        lng: cluster.lng,
        count: cluster.count,
        label: `${cluster.country}: ${cluster.count} events`,
        type: 'country' as const,
      }));
    } else if (zoom < 7) {
      // Regional view: show cities
      return cityClusters.map(cluster => ({
        key: `city-${cluster.city}-${cluster.country}`,
        lat: cluster.lat,
        lng: cluster.lng,
        count: cluster.count,
        label: `${cluster.city}, ${cluster.country}: ${cluster.count} events`,
        type: 'city' as const,
      }));
    } else {
      // Local view: show individual events
      return events
        .filter(e => e.latitude && e.longitude)
        .map(event => ({
          key: `event-${event.id}`,
          lat: event.latitude!,
          lng: event.longitude!,
          count: 1,
          label: event.title,
          type: 'event' as const,
          event,
        }));
    }
  }, [zoom, countryClusters, cityClusters, events]);

  const MapZoomHandler = () => {
    const map = useMap();
    useEffect(() => {
      const handleZoom = () => setZoom(map.getZoom());
      map.on('zoom', handleZoom);
      return () => {
        map.off('zoom', handleZoom);
      };
    }, [map]);
    return null;
  };

  return (
    <div style={{ width: '100%', height: '600px', borderRadius: '8px', overflow: 'hidden' }}>
      <MapContainer
        center={[20, 0]}
        zoom={2}
        style={{ width: '100%', height: '100%' }}
        maxBounds={[[-85, -180], [85, 180]]}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap'
        />
        <MapZoomHandler />

        {visibleMarkers.map(marker => (
          <Marker
            key={marker.key}
            position={[marker.lat, marker.lng]}
            icon={marker.type === 'event' ? ICON_EVENT : clusterIcon(marker.count, marker.type)}
          >
            <Popup>
              {marker.type === 'event' && marker.event ? (
                <div style={{ fontSize: '0.85rem', maxWidth: '250px' }}>
                  <strong>{marker.event.title}</strong>
                  <br />
                  <small>
                    {marker.event.venue_city && `${marker.event.venue_city}, `}
                    {marker.event.venue_country}
                  </small>
                  <br />
                  <small style={{ color: '#888' }}>
                    {marker.event.start_date ? new Date(marker.event.start_date).toLocaleDateString() : 'TBA'}
                  </small>
                </div>
              ) : (
                <div style={{ fontSize: '0.9rem' }}>
                  <strong>{marker.label}</strong>
                  <br />
                  <small style={{ color: '#666' }}>Zoom in to see more details</small>
                </div>
              )}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default AdminEventMap;
