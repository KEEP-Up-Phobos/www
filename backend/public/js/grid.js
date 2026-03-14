/**
 * KEEP-Up Grid Page
 */

let events = [];
let savedEventIds = new Set();

document.addEventListener('DOMContentLoaded', init);
document.addEventListener('keepup-page-ready', init);

async function init() {
    if (!document.getElementById('events-grid')) return;
    console.log('📋 Grid initializing...');
    await loadSavedEventIds();
    await loadEvents();
    setupSearch();
}

async function loadSavedEventIds() {
    try {
        const saved = await KeepUp.getSavedEvents();
        savedEventIds = new Set(saved.map(e => e.id));
    } catch (e) {}
}

async function loadEvents(searchQuery = '') {
    const grid = document.getElementById('events-grid');
    grid.innerHTML = '<div class="loading-state" style="grid-column:1/-1;"><div class="spinner"></div><p>Finding events...</p></div>';
    
    try {
        let result = searchQuery 
            ? await KeepUp.api('/api/events/search', 'POST', { query: searchQuery, limit: 50 })
            : await KeepUp.api('/api/events/discover?limit=50');
        
        if (result.ok && result.events?.length > 0) {
            events = result.events;
            renderEvents();
        } else {
            grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><div class="empty-icon">🔍</div><p>No events found</p></div>';
        }
    } catch (error) {
        grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><div class="empty-icon">⚠️</div><p>Failed to load events</p></div>';
    }
}

function renderEvents() {
    const grid = document.getElementById('events-grid');
    grid.innerHTML = events.map(event => {
        const isSaved = savedEventIds.has(event.id);
        const emoji = KeepUp.getCategoryEmoji(event.source);
        const date = KeepUp.formatDate(event.event_date);
        const location = event.location || 'TBA';
        const price = event.price || 0;
        const priceText = price > 0 ? `R$ ${price.toFixed(2)}` : 'Free';
        const priceClass = price > 0 ? '' : 'free';
        const ticketUrl = event.ticket_url || event.url;
        
        return `
            <div class="event-card" data-id="${event.id}">
                <div class="event-image" id="event-img-${event.id}">
                    ${emoji}
                    <span class="event-badge">${event.source || 'Event'}</span>
                    <button class="event-save-btn ${isSaved ? 'saved' : ''}" onclick="toggleSave(event, ${event.id})">${isSaved ? '❤️' : '🤍'}</button>
                </div>
                <div class="event-content">
                    <div class="event-title">${escapeHtml(event.title)}</div>
                    <div class="event-info">
                        <div class="event-info-row">📅 ${date}</div>
                        <div class="event-info-row">📍 ${escapeHtml(location)}</div>
                    </div>
                    <div class="event-footer">
                        <span class="event-price ${priceClass}">${priceText}</span>
                        ${ticketUrl ? `<a href="${ticketUrl}" target="_blank" class="btn btn-primary" style="padding:0.5rem 1rem;font-size:0.85rem;">🎫 Buy</a>` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Load artist photos for events
    events.forEach(event => {
        if (event.artist_name) loadArtistPhoto(event.id, event.artist_name);
    });
}

async function loadArtistPhoto(eventId, artistName) {
    try {
        const result = await KeepUp.api(`/api/artist/photo/${encodeURIComponent(artistName)}`);
        if (result.ok && result.photo) {
            const imgDiv = document.getElementById(`event-img-${eventId}`);
            if (imgDiv) {
                imgDiv.style.backgroundImage = `url('${result.photo}')`;
                imgDiv.style.backgroundSize = 'cover';
                imgDiv.style.backgroundPosition = 'center';
                imgDiv.querySelector('.event-badge')?.remove();
                const emojiSpan = imgDiv.querySelector('span:first-child');
                if (emojiSpan && emojiSpan.textContent.length < 3) emojiSpan.style.display = 'none';
            }
        }
    } catch (e) {}
}

async function toggleSave(e, eventId) {
    e.stopPropagation();
    const btn = e.target;
    if (savedEventIds.has(eventId)) {
        await KeepUp.unsaveEvent(eventId);
        savedEventIds.delete(eventId);
        btn.textContent = '🤍';
        btn.classList.remove('saved');
    } else {
        await KeepUp.saveEvent(eventId);
        savedEventIds.add(eventId);
        btn.textContent = '❤️';
        btn.classList.add('saved');
    }
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

window.toggleSave = toggleSave;
