import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import { Icon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuth } from '../context/AuthContext';
import { eventsAPI } from '../api/events';
import './CreateEvent.css';

const MARKER_ICON = new Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const EVENT_CATEGORIES = [
  'Music', 'Concert', 'Festival', 'Sports', 'Theater',
  'Comedy', 'Conference', 'Workshop', 'Party', 'Exhibition',
  'Food & Drink', 'Community', 'Nightlife', 'Other'
];

/** Captures map click → calls parent handler */
const MapClickHandler: React.FC<{ onLocationSelect: (lat: number, lng: number) => void }> = ({ onLocationSelect }) => {
  useMapEvents({
    click: (e) => onLocationSelect(e.latlng.lat, e.latlng.lng),
  });
  return null;
};

/** Smooth-flies the map to a new center */
const FlyToLocation: React.FC<{ center: [number, number] }> = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center[0] && center[1]) map.flyTo(center, 15, { duration: 1 });
  }, [center, map]);
  return null;
};

const CreateEvent: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState(searchParams.get('venue') || '');
  const [category, setCategory] = useState('Music');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [price, setPrice] = useState('');
  const [latitude, setLatitude] = useState<number>(parseFloat(searchParams.get('lat') || '') || -30.0346);
  const [longitude, setLongitude] = useState<number>(parseFloat(searchParams.get('lng') || '') || -51.2177);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { token } = useAuth();
  const navigate = useNavigate();

  // Try user geolocation for initial map center (only if no URL params)
  useEffect(() => {
    if (!searchParams.get('lat') && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLatitude(pos.coords.latitude);
          setLongitude(pos.coords.longitude);
        },
        () => {}, // keep Porto Alegre default
        { timeout: 5000 }
      );
    }
  }, [searchParams]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be smaller than 5 MB');
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const removeImage = () => { setImageFile(null); setImagePreview(null); };

  const handleLocationSelect = useCallback((lat: number, lng: number) => {
    setLatitude(lat);
    setLongitude(lng);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setLoading(true);
    setError('');
    try {
      await eventsAPI.createEvent(
        {
          title,
          description,
          location,
          category,
          startDate,
          endDate,
          latitude,
          longitude,
          price: price ? parseFloat(price) : undefined,
          image: imagePreview || undefined,
        } as any,
        token
      );
      navigate('/events');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-event-container">
      <div className="create-event-card">
        <h1>Create New Event</h1>
        <form onSubmit={handleSubmit}>
          {/* ── Photo Upload ───────────────────── */}
          <div className="form-group">
            <label>Event Photo:</label>
            <div className="photo-upload-area">
              {imagePreview ? (
                <div className="photo-preview">
                  <img src={imagePreview} alt="Event preview" />
                  <button type="button" className="remove-photo-btn" onClick={removeImage}>✕ Remove</button>
                </div>
              ) : (
                <label className="photo-upload-label">
                  <div className="upload-placeholder">
                    <span className="upload-icon">📷</span>
                    <span>Click to upload event photo</span>
                    <small>JPG, PNG, WebP — max 5 MB</small>
                  </div>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleImageChange}
                    disabled={loading}
                    style={{ display: 'none' }}
                  />
                </label>
              )}
            </div>
          </div>

          {/* ── Title ──────────────────────────── */}
          <div className="form-group">
            <label htmlFor="title">Event Title:</label>
            <input
              type="text" id="title" value={title}
              onChange={(e) => setTitle(e.target.value)}
              required disabled={loading}
              placeholder="e.g. Summer Music Festival 2026"
            />
          </div>

          {/* ── Description ────────────────────── */}
          <div className="form-group">
            <label htmlFor="description">Description:</label>
            <textarea
              id="description" value={description}
              onChange={(e) => setDescription(e.target.value)}
              required disabled={loading} rows={4}
              placeholder="Tell people about your event..."
            />
          </div>

          {/* ── Venue name ─────────────────────── */}
          <div className="form-group">
            <label htmlFor="location">Venue / Location Name:</label>
            <input
              type="text" id="location" value={location}
              onChange={(e) => setLocation(e.target.value)}
              required disabled={loading}
              placeholder="e.g. Pepsi On Stage, Porto Alegre"
            />
          </div>

          {/* ── Mini-map ───────────────────────── */}
          <div className="form-group">
            <label>Pin Location on Map: <small style={{ color: '#888', fontWeight: 'normal' }}>(click to set)</small></label>
            <div className="minimap-container">
              <MapContainer
                center={[latitude, longitude]}
                zoom={13}
                style={{ width: '100%', height: '250px', borderRadius: '8px' }}
                scrollWheelZoom={true}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapClickHandler onLocationSelect={handleLocationSelect} />
                <FlyToLocation center={[latitude, longitude]} />
                <Marker position={[latitude, longitude]} icon={MARKER_ICON} />
              </MapContainer>
              <small className="coords-display">📍 {latitude.toFixed(5)}, {longitude.toFixed(5)}</small>
            </div>
          </div>

          {/* ── Category + Price (side by side) ── */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="category">Category:</label>
              <select
                id="category" value={category}
                onChange={(e) => setCategory(e.target.value)}
                required disabled={loading}
              >
                {EVENT_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="price">Price (R$):</label>
              <input
                type="number" id="price" value={price}
                onChange={(e) => setPrice(e.target.value)}
                disabled={loading}
                placeholder="0 = Free" min="0" step="0.01"
              />
            </div>
          </div>

          {/* ── Dates (side by side) ───────────── */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="startDate">Start Date:</label>
              <input
                type="datetime-local" id="startDate" value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="endDate">End Date:</label>
              <input
                type="datetime-local" id="endDate" value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required disabled={loading}
              />
            </div>
          </div>

          {error && <div className="error">{error}</div>}
          <button type="submit" disabled={loading} className="submit-btn">
            {loading ? 'Creating...' : '🎉 Create Event'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateEvent;
