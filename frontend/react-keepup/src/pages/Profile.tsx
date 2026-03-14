/**
 * Profile Page - Tinder-style with 4 sections:
 * 1. Photos gallery (swipeable) + Name + Age
 * 2. Bio section
 * 3. Preferences/Interests
 * 4. Confirmed Events
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { userAPI } from '../api/user';
import { interestsAPI, InterestCategory, InterestItem, UserInterestsMap } from '../api/interests';
import { eventsAPI } from '../api/events';
import { API_URL } from '../api/config';

/** Filter out blob: URLs (they don't survive page reloads) */
const sanitizePhotos = (photos: string[], fallback: string): string[] => {
  const valid = photos.filter(p => !p.startsWith('blob:'));
  return valid.length > 0 ? valid : [fallback];
};
import './Profile.css';

interface CategoryWithItems extends InterestCategory {
  items: InterestItem[];
}

interface UserProfile {
  id: number;
  username: string;
  realName: string;
  birthdate?: string;
  bio: string;
  photos: string[];
  interests: string[];
  location?: {
    city: string;
    radius: number; // km
    isPrivate: boolean;
  };
}

interface ConfirmedEvent {
  id: number;
  title: string;
  date: string;
  location: string;
}

const Profile: React.FC = () => {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [confirmedEvents, setConfirmedEvents] = useState<ConfirmedEvent[]>([]);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Dynamic interest categories from API
  const [interestCategories, setInterestCategories] = useState<CategoryWithItems[]>([]);
  const [userInterests, setUserInterests] = useState<UserInterestsMap>({});
  const [interestsLoading, setInterestsLoading] = useState(true);

  // Load interest categories and user's selected interests from API
  const loadInterests = useCallback(async () => {
    try {
      setInterestsLoading(true);
      
      // Load categories from API
      const categories = await interestsAPI.getCategories();
      const categoriesWithItems = await Promise.all(
        categories.map(async (cat) => {
          const { items } = await interestsAPI.getCategoryItems(cat.id);
          return { ...cat, items };
        })
      );
      setInterestCategories(categoriesWithItems);
      
      // Load user's selected interests
      if (user) {
        const interests = await interestsAPI.getUserInterests(user.id, token || undefined);
        setUserInterests(interests);
      }
    } catch (err) {
      console.error('Failed to load interests:', err);
    } finally {
      setInterestsLoading(false);
    }
  }, [user, token]);

  const loadProfile = useCallback(async () => {
    try {
      // Try to load from keepup_profiles API
      // For now, use mock data based on user
          // Try to load Joomla profile (server stores bio/birthdate in clone_users.params)
      try {
        const endpoints = [`${API_URL}/api/profile/get`, `${API_URL}/api/user/profile/get`];
        let loaded = false;

        for (const url of endpoints) {
          try {
            const resp = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username: user!.username })
            });

            const text = await resp.text();
            try {
              const data = JSON.parse(text);
              if (data && data.ok && data.user) {
                const userData = data.user;
                setProfile({
                  id: user!.id,
                  username: user!.username,
                  realName: userData.name || user!.username,
                  birthdate: userData.birthdate || undefined,
                  bio: userData.bio || 'No bio yet. Add one in Edit Profile!',
                  photos: sanitizePhotos(
                    userData.photos && userData.photos.length ? userData.photos : [],
                    `https://api.dicebear.com/7.x/avataaars/svg?seed=${user!.username}`
                  ),
                  interests: profile?.interests || [],
                  location: {
                    city: userData.location || 'Porto Alegre',
                    radius: profile?.location?.radius || 10,
                    isPrivate: profile?.location?.isPrivate ?? true
                  }
                });
                loaded = true;
                break;
              }
            } catch (parseErr) {
              // Not JSON - try next endpoint
              continue;
            }
          } catch (err) {
            continue;
          }
        }

        if (!loaded) {
          // Fallback to sensible defaults
          setProfile({
            id: user!.id,
            username: user!.username,
            realName: user!.name || user!.username,
            bio: 'Add your bio in Edit Profile to tell others about yourself!',
            photos: [`https://api.dicebear.com/7.x/avataaars/svg?seed=${user!.username}`],
            interests: profile?.interests || [],
            location: { city: 'Porto Alegre', radius: 10, isPrivate: true }
          });
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
        // fallback
        setProfile({
          id: user!.id,
          username: user!.username,
          realName: user!.name || user!.username,
          bio: 'Add your bio in Edit Profile to tell others about yourself!',
          photos: [`https://api.dicebear.com/7.x/avataaars/svg?seed=${user!.username}`],
          interests: profile?.interests || [],
          location: { city: 'Porto Alegre', radius: 10, isPrivate: true }
        });
      }
      
      // Load confirmed events from Postgres saved_events (same as "Confirm" button on Events page)
      try {
        const savedEvents = await eventsAPI.getSavedEvents();
        const mapped: ConfirmedEvent[] = savedEvents.map(e => ({
          id: e.id,
          title: e.title,
          date: e.startDate || '',
          location: e.location || ''
        }));
        setConfirmedEvents(mapped.slice(0, 10));
      } catch (evtErr) {
        console.warn('Could not load confirmed events:', evtErr);
        setConfirmedEvents([]);
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setLoading(false);
    }
  }, [token, user]);

  useEffect(() => {
    if (user && token) {
      loadProfile();
      loadInterests();
    }
  }, [user, token, loadProfile, loadInterests]);

  const handleSwipe = (direction: 'left' | 'right') => {
    if (!profile) return;
    
    if (direction === 'right' && currentPhotoIndex < profile.photos.length - 1) {
      setCurrentPhotoIndex(prev => prev + 1);
    } else if (direction === 'left' && currentPhotoIndex > 0) {
      setCurrentPhotoIndex(prev => prev - 1);
    }
  };

  if (!user) {
    return (
      <div className="profile-page">
        <div className="profile-error">
          <h2>Not authenticated</h2>
          <button onClick={() => navigate('/')}>Go to Login</button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="profile-page">
        <div className="profile-loading">
          <div className="loading-spinner"></div>
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="profile-container">
        {/* Section 1: Photos + Name + Age */}
        <div className="profile-section photos-section">
          <div className="photo-gallery">
            <div className="photo-container">
              {profile?.photos.map((photo, index) => (
                <img
                  key={index}
                  src={photo}
                  alt={`Gallery item ${index + 1}`}
                  className={`profile-photo ${index === currentPhotoIndex ? 'active' : ''}`}
                  style={{ transform: `translateX(${(index - currentPhotoIndex) * 100}%)` }}
                />
              ))}
              
              {/* Avatar badge when viewing the first photo */}
              {currentPhotoIndex === 0 && (
                <div className="avatar-badge">
                  {profile?.photos[0]?.startsWith('data:image/svg') ? '⚔️ Custom Avatar' : '📷 Profile Photo'}
                </div>
              )}

              {/* Navigation dots */}
              <div className="photo-dots">
                {profile?.photos.map((_, index) => (
                  <span
                    key={index}
                    className={`dot ${index === currentPhotoIndex ? 'active' : ''}`}
                    onClick={() => setCurrentPhotoIndex(index)}
                  />
                ))}
              </div>
              
              {/* Swipe buttons */}
              <button 
                className="swipe-btn swipe-left"
                onClick={() => handleSwipe('left')}
                disabled={currentPhotoIndex === 0}
              >
                ◀
              </button>
              <button 
                className="swipe-btn swipe-right"
                onClick={() => handleSwipe('right')}
                disabled={currentPhotoIndex === (profile?.photos.length || 1) - 1}
              >
                ▶
              </button>
            </div>
            
            <div className="user-identity">
              {/* Avatar always shows photos[0] as a persistent badge */}
              <div className="user-avatar-circle">
                <img
                  src={profile?.photos[0] || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username}`}
                  alt="Avatar"
                  className="user-avatar-img"
                />
              </div>
              <h1 className="user-name">
                {profile?.realName}
                {profile?.birthdate && (
                  <span className="user-age">, {(() => {
                    const bd = new Date(profile.birthdate as string);
                    const diff = Date.now() - bd.getTime();
                    const age = Math.floor(new Date(diff).getUTCFullYear() - 1970);
                    return age;
                  })()}</span>
                )}
              </h1>
              <p className="user-location">
                📍 {profile?.location?.city || 'Location not set'}
                {profile?.location?.radius && (
                  <span className="location-radius">
                    ({profile.location.radius}km radius)
                  </span>
                )}
              </p>
            </div>
          </div>
          
          <button 
            className="edit-profile-btn"
            onClick={() => navigate('/profile/edit')}
          >
            ✏️ Edit Profile
          </button>
        </div>

        {/* Section 2: Bio */}
        <div className="profile-section bio-section">
          <h2>About Me</h2>
          <p className="bio-text">{profile?.bio || 'No bio yet. Add one in Edit Profile!'}</p>
        </div>

        {/* Section 3: Interests/Preferences */}
        <div className="profile-section preferences-section">
          <h2>My Interests</h2>
          <p className="section-subtitle">KEEP-Up will find events matching your interests</p>
          
          {interestsLoading ? (
            <div className="interests-loading">
              <span className="loading-spinner small"></span>
              <p>Loading interests...</p>
            </div>
          ) : (
            <div className="interests-categories">
              {interestCategories.map(category => {
                // Get user's selected items for this category
                const categoryInterests = userInterests[category.id] || [];
                const selectedItemIds = categoryInterests.map(i => i.itemId);
                
                if (selectedItemIds.length === 0) return null;
                
                // Find the matching items from the category
                const selectedItems = category.items?.filter(item => 
                  selectedItemIds.includes(item.id)
                ) || [];
                
                return (
                  <div key={category.id} className="interest-category">
                    <div className="category-header">
                      <span className="category-icon">{category.icon}</span>
                      <span className="category-name">{category.name}</span>
                    </div>
                    {selectedItems.length > 0 && (
                      <div className="subcategory-tags">
                        {selectedItems.map(item => (
                          <span key={item.id} className="subcategory-tag">
                            {item.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          
          {!interestsLoading && Object.keys(userInterests).length === 0 && (
            <div className="no-interests">
              <p>No interests selected yet</p>
              <button onClick={() => navigate('/profile/edit')}>Add Interests</button>
            </div>
          )}
        </div>

        {/* Section 4: Confirmed Events */}
        <div className="profile-section events-section">
          <h2>My Confirmed Events</h2>
          
          {confirmedEvents.length === 0 ? (
            <div className="no-events">
              <p>No confirmed events yet</p>
              <button onClick={() => navigate('/events')}>Browse Events</button>
            </div>
          ) : (
            <div className="confirmed-events-list">
              {confirmedEvents.map(event => (
                <div key={event.id} className="confirmed-event-card">
                  <div className="event-info">
                    <h4>{event.title}</h4>
                    <p className="event-date">📅 {new Date(event.date).toLocaleDateString()}</p>
                    <p className="event-location">📍 {event.location}</p>
                  </div>
                  <span className="confirmed-badge">✓ Going</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Logout Section */}
        <div className="profile-section logout-section">
          <button
            className="logout-btn"
            onClick={async () => {
              await logout();
              navigate('/');
            }}
          >
            🚪 Logout
          </button>
        </div>
      </div>
    </div>
  );
};

export default Profile;
