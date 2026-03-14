/**
 * KEEP-Up Map Page
 */

let map = null;
let markers = [];

document.addEventListener('DOMContentLoaded', init);
document.addEventListener('keepup-page-ready', init);

async function init() {
    if (!document.getElementById('map-container')) return;
    console.log('🗺️ Map initializing...');
    await initMap();
    setupSearch();
}

async function initMap() {
    let lat = -15.7801, lng = -47.9292, zoom = 4;
    
    try {
        const profile = await KeepUp.getProfile();
        if (profile?.latitude && profile?.longitude) {
            lat = parseFloat(profile.latitude);
            lng = parseFloat(profile.longitude);
            zoom = 12;
        }
    } catch (e) {}
    
    map = L.map('map-container').setView([lat, lng], zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19
    }).addTo(map);
    
    L.circleMarker([lat, lng], {
        radius: 10,
        fillColor: '#6366f1',
        color: '#fff',
        weight: 3,
        fillOpacity: 0.9
    }).addTo(map).bindPopup('📍 You');
    
    document.getElementById('event-count').textContent = 'Loading events...';
    await loadEvents();
}

async function loadEvents(searchQuery = '') {
    const countEl = document.getElementById('event-count');
    
    try {
        let result = searchQuery
            ? await KeepUp.api('/api/events/search', 'POST', { query: searchQuery, limit: 100 })
            : await KeepUp.api('/api/events/discover?limit=100');
        
        if (result.ok && result.events?.length > 0) {
            addMarkers(result.events);
            countEl.textContent = `${result.events.length} events found`;
        } else {
            countEl.textContent = 'No events found';
        }
    } catch (error) {
        countEl.textContent = 'Failed to load events';
    }
}

function addMarkers(events) {
    markers.forEach(m => map.removeLayer(m));
    markers = [];
    const bounds = [];
    
    events.forEach(event => {
        if (!event.latitude || !event.longitude) return;
        const lat = parseFloat(event.latitude);
        const lng = parseFloat(event.longitude);
        if (isNaN(lat) || isNaN(lng)) return;
        
        const emoji = KeepUp.getCategoryEmoji(event.source);
        const marker = L.marker([lat, lng], {
            icon: L.divIcon({
                html: `<div style="font-size:1.5rem;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));">${emoji}</div>`,
                className: 'emoji-marker',
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            })
        }).addTo(map);
        
        marker.bindPopup(`
            <div style="min-width:200px;">
                <h4 style="margin:0 0 0.5rem 0;">${escapeHtml(event.title)}</h4>
                <p style="margin:0.25rem 0;color:#666;font-size:0.85rem;">📅 ${KeepUp.formatDate(event.event_date)}</p>
                <p style="margin:0.25rem 0;color:#666;font-size:0.85rem;">📍 ${escapeHtml(event.location || 'TBA')}</p>
            </div>
        `);
        
        markers.push(marker);
        bounds.push([lat, lng]);
    });
    
    if (bounds.length > 1) map.fitBounds(bounds, { padding: [50, 50] });
}

function setupSearch() {
    const input = document.getElementById('search-input');
    if (!input) return;
    let timeout;
    input.addEventListener('input', (e) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => loadEvents(e.target.value.trim()), 500);
    });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
