/**
 * Edit Profile Page
 * 
 * Allows users to edit:
 * - Photos (upload up to 9)
 * - Real name, age, bio
 * - Interests/preferences for events
 * - Location and search radius (private)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { interestsAPI, InterestCategory, InterestItem } from '../api/interests';
import { API_URL as apiUrl } from '../api/config';
import AvatarCreator, { AvatarOptions } from './AvatarCreator';
import './EditProfile.css';

interface CategoryWithItems extends InterestCategory {
  items: InterestItem[];
}

interface UserProfile {
  realName: string;
  birthdate?: string; // ISO date YYYY-MM-DD
  bio: string;
  photos: string[];
  interests: Record<string, string[]>; // categoryId -> itemIds[]
  location: {
    city: string;
    latitude?: number;
    longitude?: number;
    radius: number;
    isPrivate: boolean;
  };
  homeLocation: {
    city: string;
    latitude?: number;
    longitude?: number;
  };
}

const EditProfile: React.FC = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // default birthdate is today minus 18 years
  const default18Date = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 18);
    return d.toISOString().slice(0,10);
  })();

  const [profile, setProfile] = useState<UserProfile>({
    realName: '',
    birthdate: default18Date,
    bio: '',
    photos: [],
    interests: {},
    location: {
      city: '',
      radius: 10,
      isPrivate: true,
    },
    homeLocation: {
      city: '',
    },
  });

  // Dynamic interest categories from API
  const [interestCategories, setInterestCategories] = useState<CategoryWithItems[]>([]);
  const [interestsLoading, setInterestsLoading] = useState(true);

  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [showAvatarCreator, setShowAvatarCreator] = useState(false);
  const [savedAvatarOptions, setSavedAvatarOptions] = useState<AvatarOptions | null>(null);

  // Load interest categories from API
  const loadInterestCategories = useCallback(async () => {
    try {
      setInterestsLoading(true);
      const categories = await interestsAPI.getCategories();
      const categoriesWithItems = await Promise.all(
        categories.map(async (cat) => {
          const { items } = await interestsAPI.getCategoryItems(cat.id);
          return { ...cat, items };
        })
      );
      setInterestCategories(categoriesWithItems);
    } catch (err) {
      console.error('Failed to load interest categories:', err);
    } finally {
      setInterestsLoading(false);
    }
  }, []);

  // Load user's existing interests
  const loadUserInterests = useCallback(async () => {
    try {
      if (!user) return;
      const interests = await interestsAPI.getUserInterests(user.id, token || undefined);
      
      // Convert from { categoryId: [{itemId, weight}] } to { categoryId: [itemId] }
      const converted: Record<string, string[]> = {};
      for (const [categoryId, items] of Object.entries(interests)) {
        converted[categoryId] = items.map(i => i.itemId);
      }
      
      setProfile(prev => ({ ...prev, interests: converted }));
    } catch (err) {
      console.error('Failed to load user interests:', err);
    }
  }, [user, token]);

  const loadProfile = useCallback(async () => {
    try {
      // Load base defaults
      const base = {
        realName: user?.name || user?.username || '',
        bio: '',
        photos: [ `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username}` ],
        location: { city: 'Porto Alegre', radius: 10, isPrivate: true },
        homeLocation: { city: '' }
      };

      // Load Postgres profile for home location data
      try {
        const pgResp = await fetch(`${apiUrl}/api/profile/${user?.id}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (pgResp.ok) {
          const pgData = await pgResp.json();
          if (pgData.ok && pgData.profile) {
            const p = pgData.profile;
            setProfile(prev => ({
              ...prev,
              location: {
                ...prev.location,
                latitude: p.latitude || prev.location.latitude,
                longitude: p.longitude || prev.location.longitude,
                radius: p.radiusKm || prev.location.radius,
              },
              homeLocation: {
                city: p.homeLocationName || '',
                latitude: p.homeLatitude || undefined,
                longitude: p.homeLongitude || undefined,
              },
            }));
          }
        }
      } catch (e) {
        console.warn('Could not load Postgres profile:', e);
      }

      // Try to load Joomla profile (birthdate, photos, bio) if available.
      try {
        const endpoints = [`${apiUrl}/api/profile/get`, `${apiUrl}/api/user/profile/get`];
        let loaded = false;
        for (const url of endpoints) {
          try {
            const resp = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ username: user?.username }),
            });

            const text = await resp.text();
            try {
              const data = JSON.parse(text);
              if (data && data.ok && data.user) {
                setProfile(prev => ({
                  ...prev,
                  realName: data.user.name || base.realName,
                  birthdate: data.user.birthdate || prev.birthdate || default18Date,
                  bio: data.user.bio || base.bio,
                  photos: data.user.photos && data.user.photos.length ? data.user.photos : base.photos,
                }));
                loaded = true;
                break;
              }
            } catch (parseErr) {
              console.warn(`Profile endpoint ${url} returned non-JSON response; trying fallback.`);
              continue;
            }
          } catch (inner) {
            console.warn('Profile fetch attempt failed, trying fallback:', inner);
            continue;
          }
        }

        if (loaded) return;
      } catch (e) {
        console.warn('Could not load Joomla profile (all endpoints failed):', e);
      }

      setProfile(prev => ({ ...prev, ...base }));
    } catch (err) {
      console.error('Failed to load profile:', err);
    }
  }, [user, token, default18Date]);

  useEffect(() => {
    if (user) {
      // Load existing profile data
      loadProfile();
      loadInterestCategories();
      loadUserInterests();
    }
  }, [user, loadProfile, loadInterestCategories, loadUserInterests]);

  const handleAvatarApply = (dataUrl: string, options: AvatarOptions) => {
    // Avatar always becomes photos[0]
    const newPhotos = [...profile.photos];
    newPhotos[0] = dataUrl;
    setProfile({ ...profile, photos: newPhotos });
    setSavedAvatarOptions(options);
    setShowAvatarCreator(false);
  };

  const handlePhotoUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Convert to base64 data URL so it survives page reloads (blob: URLs are ephemeral)
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const newPhotos = [...profile.photos];
        if (index < newPhotos.length) {
          newPhotos[index] = dataUrl;
        } else {
          newPhotos.push(dataUrl);
        }
        setProfile({ ...profile, photos: newPhotos });
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = (index: number) => {
    const newPhotos = profile.photos.filter((_, i) => i !== index);
    setProfile({ ...profile, photos: newPhotos });
  };

  const toggleInterest = (categoryId: string, itemId: string) => {
    const categoryInterests = profile.interests[categoryId] || [];
    const isSelected = categoryInterests.includes(itemId);
    
    const newCategoryInterests = isSelected
      ? categoryInterests.filter(i => i !== itemId)
      : [...categoryInterests, itemId];
    
    setProfile({
      ...profile,
      interests: {
        ...profile.interests,
        [categoryId]: newCategoryInterests,
      },
    });
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => 
      prev.includes(categoryId)
        ? prev.filter(c => c !== categoryId)
        : [...prev, categoryId]
    );
  };

  const toggleAllInCategory = (categoryId: string, items: InterestItem[]) => {
    const itemIds = items.map(i => i.id);
    const categoryInterests = profile.interests[categoryId] || [];
    const allSelected = itemIds.every(id => categoryInterests.includes(id));
    
    if (allSelected) {
      // Deselect all
      setProfile({
        ...profile,
        interests: {
          ...profile.interests,
          [categoryId]: [],
        },
      });
    } else {
      // Select all
      setProfile({
        ...profile,
        interests: {
          ...profile.interests,
          [categoryId]: itemIds,
        },
      });
    }
  };

  const handleLocationDetect = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setProfile({
            ...profile,
            location: {
              ...profile.location,
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            },
          });
          setMessage({ type: 'success', text: 'Location detected! Your location will remain private.' });
        },
        (error) => {
          setMessage({ type: 'error', text: 'Could not detect location. Please enter manually.' });
        }
      );
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      // Build API URL dynamically
      
      // Validate birthdate (must be 18+)
      if (!profile.birthdate) {
        setMessage({ type: 'error', text: 'Please set your birthdate (you must be 18 or older).' });
        setSaving(false);
        return;
      }
      const birth = new Date(profile.birthdate);
      const today = new Date();
      const minDate = new Date();
      minDate.setFullYear(today.getFullYear() - 18);
      if (birth > minDate) {
        setMessage({ type: 'error', text: 'You must be at least 18 years old to use KEEP-Up.' });
        setSaving(false);
        return;
      }

      // Save interests to the interests API
      if (user) {
        await interestsAPI.saveUserInterests(user.id, profile.interests, token || undefined);
      }

      // Also persist birthdate + basic profile to Joomla (username-based endpoint)
      try {
        const endpoints = [`${apiUrl}/api/profile/save`, `${apiUrl}/api/user/profile/save`];
        let saved = false;
        for (const url of endpoints) {
          try {
            const resp = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({
                username: user?.username,
                name: profile.realName,
                email: (user as any)?.email || '',
                location: profile.location.city,
                fullAddress: '',
                bio: profile.bio,
                birthdate: profile.birthdate,
                photos: profile.photos,
                lat: profile.location.latitude || null,
                lng: profile.location.longitude || null,
              }),
            });

            // Accept any JSON-ok response or simple 200 OK as success. If response is HTML/404 try next endpoint.
            const text = await resp.text();
            try {
              const data = JSON.parse(text);
              if (data && data.ok) {
                saved = true;
                break;
              }
            } catch (parseErr) {
              if (resp.ok) { saved = true; break; }
              continue;
            }
          } catch (inner) {
            console.warn('Profile save attempt failed, trying fallback:', inner);
            continue;
          }
        }

        if (!saved) console.warn('Could not save Joomla profile to any endpoint');
      } catch (e) {
        console.warn('Could not save Joomla profile (unexpected):', e);
      }

      // Save keepup profile data to Postgres (with location for PostGIS)
      const response = await fetch(`${apiUrl}/api/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: user?.id,
          latitude: profile.location.latitude || null,
          longitude: profile.location.longitude || null,
          locationName: profile.location.city || null,
          radiusKm: profile.location.radius || 25,
          homeLatitude: profile.homeLocation.latitude || null,
          homeLongitude: profile.homeLocation.longitude || null,
          homeLocationName: profile.homeLocation.city || null,
          preferences: {
            realName: profile.realName,
            bio: profile.bio,
            photos: profile.photos,
            isPrivate: profile.location.isPrivate,
          },
          musicGenres: Object.keys(profile.interests).filter(k => k.startsWith('music')),
          favoriteArtists: [],
        }),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Profile saved successfully!' });
        setTimeout(() => navigate('/profile'), 1500);
      } else {
        throw new Error('Failed to save profile');
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save profile. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="edit-profile-page">
        <div className="profile-error">
          <p>Please log in to edit your profile</p>
          <button onClick={() => navigate('/')}>Go to Login</button>
        </div>
      </div>
    );
  }

  return (
    <div className="edit-profile-page">
      <div className="edit-profile-container">
        <header className="edit-header">
          <button className="back-btn" onClick={() => navigate('/profile')}>
            ← Back
          </button>
          <h1>Edit Profile</h1>
          <button 
            className="save-btn" 
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </header>

        {message && (
          <div className={`message ${message.type}`}>
            {message.text}
          </div>
        )}

        {/* Photos Section */}
        <section className="edit-section">
          <h2>📷 Photos</h2>
          <p className="section-hint">Add up to 9 photos. The <strong>first slot is always your avatar</strong> — use a real photo or create one below.</p>

          {/* Avatar Creator CTA */}
          <div className="avatar-creator-cta">
            <div className="avatar-cta-left">
              {profile.photos[0] ? (
                <img src={profile.photos[0]} alt="Current avatar" className="avatar-cta-preview" />
              ) : (
                <div className="avatar-cta-empty">👤</div>
              )}
              <div>
                <div className="avatar-cta-title">⚔️ RPG Avatar Creator</div>
                <div className="avatar-cta-desc">Build a fully customised avatar — face, race, equipment, D&amp;D class and more.</div>
              </div>
            </div>
            <button className="open-avatar-creator-btn" onClick={() => setShowAvatarCreator(true)}>
              {profile.photos[0]?.startsWith('data:image/svg') ? '✏️ Edit Avatar' : '🎨 Create Avatar'}
            </button>
          </div>

          <div className="photos-grid">
            {[...Array(9)].map((_, index) => (
              <div key={index} className={`photo-slot ${index === 0 ? 'avatar-slot' : ''}`}>
                {profile.photos[index] ? (
                  <>
                    <img src={profile.photos[index]} alt={`Gallery item ${index + 1}`} />
                    <button 
                      className="remove-photo"
                      onClick={() => removePhoto(index)}
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  index === 0 ? (
                    <button className="add-photo avatar-add" onClick={() => setShowAvatarCreator(true)}>
                      <span className="avatar-add-icon">⚔️</span>
                      <span className="avatar-add-label">Create</span>
                    </button>
                  ) : (
                    <label className="add-photo">
                      <span>+</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handlePhotoUpload(index, e)}
                      />
                    </label>
                  )
                )}
                {index === 0 && <span className="main-badge">Avatar</span>}
              </div>
            ))}
          </div>
        </section>

        {/* Basic Info Section */}
        <section className="edit-section">
          <h2>👤 Basic Info</h2>
          
          <div className="form-group">
            <label>Real Name</label>
            <input
              type="text"
              value={profile.realName}
              onChange={(e) => setProfile({ ...profile, realName: e.target.value })}
              placeholder="Your real name"
            />
          </div>

          <div className="form-group">
            <label>Birthdate</label>
            <input
              type="date"
              value={profile.birthdate}
              max={(() => {
                const d = new Date();
                d.setFullYear(d.getFullYear() - 18);
                return d.toISOString().slice(0,10);
              })()}
              min={(() => {
                const d = new Date();
                d.setFullYear(d.getFullYear() - 100);
                return d.toISOString().slice(0,10);
              })()}
              onChange={(e) => setProfile({ ...profile, birthdate: e.target.value })}
            />
            <small className="hint">You must be at least 18 years old to use KEEP-Up</small>
          </div>

          <div className="form-group">
            <label>Bio</label>
            <textarea
              value={profile.bio}
              onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
              placeholder="Tell others about yourself..."
              rows={4}
              maxLength={500}
            />
            <span className="char-count">{profile.bio.length}/500</span>
          </div>
        </section>

        {/* Interests Section */}
        <section className="edit-section">
          <h2>🎯 Interests</h2>
          <p className="section-hint">Select your interests to get personalized event recommendations</p>
          
          {interestsLoading ? (
            <div className="interests-loading">
              <span className="loading-spinner small"></span>
              <p>Loading interests...</p>
            </div>
          ) : (
          <div className="interests-categories-edit">
            {interestCategories.map(category => {
              const isExpanded = expandedCategories.includes(category.id);
              const categoryInterests = profile.interests[category.id] || [];
              const selectedCount = categoryInterests.length;
              const allSelected = category.items && selectedCount === category.items.length;
              
              return (
                <div key={category.id} className="interest-category-edit">
                  <div 
                    className="category-header-edit"
                    onClick={() => toggleCategory(category.id)}
                  >
                    <div className="category-info">
                      <span className="category-icon">{category.icon}</span>
                      <span className="category-name">{category.name}</span>
                      {selectedCount > 0 && (
                        <span className="selected-count">
                          {selectedCount}/{category.items?.length || 0}
                        </span>
                      )}
                    </div>
                    <span className={`expand-arrow ${isExpanded ? 'expanded' : ''}`}>
                      ▼
                    </span>
                  </div>
                  
                  {isExpanded && category.items && (
                    <div className="subcategories-container">
                      <button
                        type="button"
                        className={`select-all-btn ${allSelected ? 'active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleAllInCategory(category.id, category.items);
                        }}
                      >
                        {allSelected ? '✓ All Selected' : 'Select All'}
                      </button>
                      
                      <div className="subcategories-grid">
                        {category.items.map(item => (
                          <button
                            key={item.id}
                            type="button"
                            className={`subcategory-btn ${categoryInterests.includes(item.id) ? 'active' : ''}`}
                            onClick={() => toggleInterest(category.id, item.id)}
                          >
                            {item.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          )}
        </section>

        {/* Location Section */}
        <section className="edit-section">
          <h2>📍 Location</h2>
          <p className="section-hint">Your location is always private. We use it only to find events near you.</p>
          
          {/* Home Location */}
          <div style={{ background: '#f0f8ff', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '1rem' }}>🏠 Home Location</h3>
            <p style={{ fontSize: '0.85rem', color: '#666', margin: '0 0 12px' }}>
              Where you live. Events near your home are shown when you're there.
            </p>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Home City</label>
              <input
                type="text"
                value={profile.homeLocation.city}
                onChange={(e) => setProfile({
                  ...profile,
                  homeLocation: { ...profile.homeLocation, city: e.target.value }
                })}
                placeholder="e.g. Porto Alegre"
              />
            </div>
          </div>

          {/* Current / Detected Location */}
          <div style={{ background: '#f0fff0', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '1rem' }}>📡 Current Location</h3>
            <p style={{ fontSize: '0.85rem', color: '#666', margin: '0 0 12px' }}>
              Auto-detected when you open the app. Events default to THIS location.
            </p>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Current City</label>
              <div className="input-with-btn">
                <input
                  type="text"
                  value={profile.location.city}
                  onChange={(e) => setProfile({
                    ...profile,
                    location: { ...profile.location, city: e.target.value }
                  })}
                  placeholder="Auto-detected or enter manually"
                />
                <button 
                  type="button" 
                  className="detect-btn"
                  onClick={handleLocationDetect}
                >
                  🎯 Detect
                </button>
              </div>
              {profile.location.latitude && profile.location.longitude && (
                <small className="hint" style={{ color: '#28a745' }}>
                  ✓ Coordinates: {profile.location.latitude.toFixed(4)}, {profile.location.longitude.toFixed(4)}
                </small>
              )}
            </div>
          </div>

          <div className="form-group">
            <label>Search Radius: {profile.location.radius} km {profile.location.radius === 666 ? '(Unlimited)' : ''}</label>
            <input
              type="range"
              min="1"
              max="666"
              value={profile.location.radius}
              onChange={(e) => setProfile({
                ...profile,
                location: { ...profile.location, radius: parseInt(e.target.value) }
              })}
              className="radius-slider"
            />
            <div className="radius-labels">
              <span>1 km</span>
              <span>333 km (continents)</span>
              <span>666 km (unlimited)</span>
            </div>
            <small className="hint">Set to 666 km to see events worldwide</small>
          </div>

          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={profile.location.isPrivate}
                onChange={(e) => setProfile({
                  ...profile,
                  location: { ...profile.location, isPrivate: e.target.checked }
                })}
              />
              <span>Keep my location private from other users</span>
            </label>
          </div>
        </section>

        {/* Save Button (mobile) */}
        <button 
          className="save-btn-mobile" 
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* RPG Avatar Creator Modal */}
      {showAvatarCreator && (
        <AvatarCreator
          onApply={handleAvatarApply}
          onClose={() => setShowAvatarCreator(false)}
          initialOptions={savedAvatarOptions || undefined}
        />
      )}
    </div>
  );
};

export default EditProfile;
