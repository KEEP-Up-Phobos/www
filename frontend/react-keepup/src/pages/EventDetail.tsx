/**
 * Event Detail Page
 *
 * Displays a single event with full information, map preview,
 * save/confirm button, and related events from the same venue or city.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { eventsAPI } from '../api/events';
import { useAuth } from '../context/AuthContext';
import type { Event } from '../api/types';
import { formatEventDate } from '../utils/dateFormat';
import './EventDetail.css';

// Category-appropriate fallback images (mirrors EventGrid)
const CATEGORY_IMAGES: Record<string, string> = {
  music: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800&h=500&fit=crop',
  concert: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800&h=500&fit=crop',
  festival: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800&h=500&fit=crop',
  sports: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800&h=500&fit=crop',
  theater: 'https://images.unsplash.com/photo-1503095396549-807759245b35?w=800&h=500&fit=crop',
  comedy: 'https://images.unsplash.com/photo-1585699324551-f6c309eedeca?w=800&h=500&fit=crop',
  conference: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&h=500&fit=crop',
  default: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&h=500&fit=crop',
};

function getEventImage(event: Event): string {
  if (event.image) return event.image;
  const cat = (event.category || '').toLowerCase();
  return CATEGORY_IMAGES[cat] || CATEGORY_IMAGES.default;
}

const EventDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();

  const [event, setEvent] = useState<Event | null>(null);
  const [relatedEvents, setRelatedEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [savingAction, setSavingAction] = useState(false);

  const loadEvent = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const eventId = parseInt(id, 10);
      if (isNaN(eventId)) {
        setError('Invalid event ID');
        return;
      }

      const data = await eventsAPI.getEventById(eventId);
      setEvent(data.event);
      setRelatedEvents(data.relatedEvents);

      // Check saved status
      if (token) {
        try {
          const saved = await eventsAPI.checkIsSaved(eventId);
          setIsSaved(saved);
        } catch {
          // ignore — user may not be logged in
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load event');
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    loadEvent();
  }, [loadEvent]);

  const handleSaveToggle = async () => {
    if (!event || savingAction) return;
    setSavingAction(true);
    try {
      if (isSaved) {
        await eventsAPI.unsaveEvent(event.id);
        setIsSaved(false);
      } else {
        await eventsAPI.saveEvent(event.id);
        setIsSaved(true);
      }
    } catch (err) {
      console.error('Failed to save/unsave event:', err);
    } finally {
      setSavingAction(false);
    }
  };

  if (loading) {
    return (
      <div className="event-detail-page">
        <div className="event-detail-loading">
          <div className="loading-spinner" />
          <p>Loading event...</p>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="event-detail-page">
        <div className="event-detail-error">
          <h2>Event not found</h2>
          <p>{error || 'This event may have been removed.'}</p>
          <button onClick={() => navigate('/events')} className="back-btn">
            Back to Events
          </button>
        </div>
      </div>
    );
  }

  const mapUrl = event.latitude && event.longitude
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${event.longitude - 0.01}%2C${event.latitude - 0.008}%2C${event.longitude + 0.01}%2C${event.latitude + 0.008}&layer=mapnik&marker=${event.latitude}%2C${event.longitude}`
    : null;

  const directionsUrl = event.latitude && event.longitude
    ? `https://www.openstreetmap.org/directions?from=&to=${event.latitude}%2C${event.longitude}`
    : null;

  return (
    <div className="event-detail-page">
      {/* Back button */}
      <button onClick={() => navigate(-1)} className="detail-back-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="20" height="20">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      {/* Hero image */}
      <div className="detail-hero">
        <img
          src={getEventImage(event)}
          alt={event.title}
          className="detail-hero-img"
          onError={(e) => {
            const target = e.currentTarget;
            if (!target.dataset.retried) {
              target.dataset.retried = 'true';
              target.src = CATEGORY_IMAGES.default;
            }
          }}
        />
        <div className="detail-hero-overlay" />
        <div className="detail-hero-content">
          <span className="detail-category">{event.category || 'Event'}</span>
          <h1 className="detail-title">{event.title}</h1>
        </div>
      </div>

      {/* Main content */}
      <div className="detail-body">
        {/* Info section */}
        <div className="detail-info-grid">
          {/* Date */}
          <div className="detail-info-card">
            <div className="detail-info-icon">📅</div>
            <div>
              <span className="detail-info-label">Date</span>
              <span className="detail-info-value">
                {event.startDate ? formatEventDate(event.startDate) : 'Date TBA'}
              </span>
            </div>
          </div>

          {/* Location */}
          <div className="detail-info-card">
            <div className="detail-info-icon">📍</div>
            <div>
              <span className="detail-info-label">Location</span>
              <span className="detail-info-value">
                {event.venue_name || event.location || 'Venue TBA'}
              </span>
              {event.venue_city && (
                <span className="detail-info-sub">{event.venue_city}</span>
              )}
            </div>
          </div>

          {/* Distance */}
          {event.distance_km != null && (
            <div className="detail-info-card">
              <div className="detail-info-icon">🧭</div>
              <div>
                <span className="detail-info-label">Distance</span>
                <span className="detail-info-value">{event.distance_km} km away</span>
              </div>
            </div>
          )}

          {/* Source */}
          {event.source && (
            <div className="detail-info-card">
              <div className="detail-info-icon">🔗</div>
              <div>
                <span className="detail-info-label">Source</span>
                <span className="detail-info-value detail-source">{event.source}</span>
              </div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="detail-actions">
          {token && (
            <button
              onClick={handleSaveToggle}
              disabled={savingAction}
              className={`detail-save-btn ${isSaved ? 'saved' : ''}`}
            >
              {savingAction
                ? '...'
                : isSaved
                  ? '✅ Confirmed'
                  : '🎫 Confirm Attendance'}
            </button>
          )}
          {event.url && (
            <a
              href={event.url}
              target="_blank"
              rel="noopener noreferrer"
              className="detail-ticket-btn"
            >
              🎟️ Get Tickets
            </a>
          )}
          {directionsUrl && (
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="detail-directions-btn"
            >
              🗺️ Directions
            </a>
          )}
        </div>

        {/* Description */}
        {event.description && (
          <div className="detail-section">
            <h2 className="detail-section-title">About</h2>
            <p className="detail-description">{event.description}</p>
          </div>
        )}

        {/* Map */}
        {mapUrl && (
          <div className="detail-section">
            <h2 className="detail-section-title">Location</h2>
            <div className="detail-map-container">
              <iframe
                title="Event Location"
                src={mapUrl}
                className="detail-map-iframe"
                loading="lazy"
              />
            </div>
          </div>
        )}

        {/* Related events */}
        {relatedEvents.length > 0 && (
          <div className="detail-section">
            <h2 className="detail-section-title">
              More events in {event.venue_city || 'this area'}
            </h2>
            <div className="detail-related-grid">
              {relatedEvents.map((related) => (
                <Link
                  key={related.id}
                  to={`/event/${related.id}`}
                  className="related-event-card"
                >
                  <img
                    src={getEventImage(related)}
                    alt={related.title}
                    className="related-event-img"
                    loading="lazy"
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (!target.dataset.retried) {
                        target.dataset.retried = 'true';
                        target.src = CATEGORY_IMAGES.default;
                      }
                    }}
                  />
                  <div className="related-event-info">
                    <h4 className="related-event-title">{related.title}</h4>
                    <span className="related-event-date">
                      {related.startDate ? formatEventDate(related.startDate) : 'TBA'}
                    </span>
                    <span className="related-event-venue">
                      {related.venue_name || related.location}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EventDetail;
