/**
 * KEEP-Up Create Event Page
 */

let locationMap = null;
let locationMarker = null;
let selectedCategory = 'party';

document.addEventListener('DOMContentLoaded', init);
document.addEventListener('keepup-page-ready', init);

function init() {
    if (!document.getElementById('create-form')) return;
    console.log('➕ Create page initializing...');
    setupForm();
    setupCategories();
    setupLocationPicker();
    setDefaultDate();
}

function setDefaultDate() {
    const dateInput = document.getElementById('event-date');
    const timeInput = document.getElementById('event-time');
    if (dateInput) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        dateInput.value = tomorrow.toISOString().split('T')[0];
    }
    if (timeInput) timeInput.value = '19:00';
}

function setupCategories() {
    const chips = document.querySelectorAll('#category-chips .chip');
    chips.forEach(chip => {
        chip.addEventListener('click', () => {
            chips.forEach(c => c.classList.remove('selected'));
            chip.classList.add('selected');
            selectedCategory = chip.dataset.cat;
        });
    });
    if (chips.length > 0) chips[0].classList.add('selected');
}

function setupLocationPicker() {
    const mapContainer = document.getElementById('location-map');
    if (!mapContainer) return;
    
    locationMap = L.map('location-map').setView([-15.7801, -47.9292], 4);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(locationMap);
    
    locationMap.on('click', async (e) => {
        const { lat, lng } = e.latlng;
        if (locationMarker) locationMarker.setLatLng([lat, lng]);
        else locationMarker = L.marker([lat, lng]).addTo(locationMap);
        
        document.getElementById('event-lat').value = lat;
        document.getElementById('event-lng').value = lng;
        
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, { headers: { 'User-Agent': 'KEEP-Up/1.0' } });
            const data = await response.json();
            document.getElementById('event-location').value = data.display_name?.split(',').slice(0, 3).join(',') || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        } catch (e) {
            document.getElementById('event-location').value = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        }
    });
    
    KeepUp.getProfile().then(profile => {
        if (profile?.latitude) locationMap.setView([profile.latitude, profile.longitude], 12);
    }).catch(() => {});
}

function setupForm() {
    document.getElementById('create-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await createEvent();
    });
}

async function createEvent() {
    const title = document.getElementById('event-title').value.trim();
    const description = document.getElementById('event-description').value.trim();
    const date = document.getElementById('event-date').value;
    const time = document.getElementById('event-time').value;
    const location = document.getElementById('event-location').value.trim();
    const lat = document.getElementById('event-lat').value;
    const lng = document.getElementById('event-lng').value;
    const price = document.getElementById('event-price').value;
    
    if (!title || !date || !time || !location) {
        alert('Please fill in all required fields');
        return;
    }
    
    try {
        const result = await KeepUp.api('/api/events/create', 'POST', {
            title, description,
            event_date: `${date}T${time}:00`,
            location,
            latitude: lat || null,
            longitude: lng || null,
            category: selectedCategory,
            price: price ? parseFloat(price) : 0
        });
        
        if (result.ok) {
            document.getElementById('create-form').style.display = 'none';
            document.getElementById('success-message').style.display = 'block';
        } else {
            alert('Failed to create event: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        alert('Failed to create event');
    }
}
