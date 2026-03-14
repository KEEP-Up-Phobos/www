/**
 * KEEP-Up App Core
 */

const API_BASE = window.KEEPUP_CONFIG?.API_BASE || 
    (window.location.port === '3000' ? '' : `http://${window.location.hostname}:3000`);

const USER_ID = 286;

console.log('🚀 KEEP-Up App loaded, API:', API_BASE);

async function api(endpoint, method = 'GET', data = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'X-User-Id': USER_ID.toString()
        }
    };
    
    // Add auth token if available
    if (window.Auth && window.Auth.getToken()) {
        options.headers['Authorization'] = `Bearer ${window.Auth.getToken()}`;
    }
    
    if (data) options.body = JSON.stringify(data);
    
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, options);
        const result = await response.json();
        
        // If unauthorized, redirect to login
        if (response.status === 401) {
            if (window.Auth) window.Auth.logout();
            window.location.href = '/login.html';
            return { ok: false, error: 'Unauthorized' };
        }
        
        return result;
    } catch (error) {
        console.error('API Error:', error);
        return { ok: false, error: error.message };
    }
}

function formatDate(dateStr) {
    if (!dateStr) return 'TBA';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function getCategoryEmoji(category) {
    const emojis = { 'party': '🎉', 'music': '🎵', 'sports': '⚽', 'food': '🍕', 'art': '🎨', 'tech': '💻', 'concert': '🎸', 'default': '📅' };
    return emojis[category?.toLowerCase()] || emojis.default;
}

async function saveEvent(eventId) {
    return (await api('/api/events/save', 'POST', { event_id: eventId })).ok;
}

async function unsaveEvent(eventId) {
    return (await api('/api/events/unsave', 'POST', { event_id: eventId })).ok;
}

async function getSavedEvents() {
    const result = await api('/api/events/saved');
    return result.ok ? result.events : [];
}

async function getProfile() {
    const result = await api('/api/user/profile');
    return result.ok ? result.profile : null;
}

async function updateProfile(data) {
    return await api('/api/user/profile', 'POST', data);
}

function getUserLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error('Geolocation not supported'));
        navigator.geolocation.getCurrentPosition(
            pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            err => reject(err),
            { timeout: 10000 }
        );
    });
}

window.KeepUp = { api, formatDate, getCategoryEmoji, saveEvent, unsaveEvent, getSavedEvents, getProfile, updateProfile, getUserLocation, API_BASE, USER_ID };
