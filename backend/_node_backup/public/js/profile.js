/**
 * KEEP-Up Profile Page - Tinder Style
 */

let userProfile = null;
let userPhotos = [];
let draggedElement = null;
let currentPhotoIndex = 0;

document.addEventListener('DOMContentLoaded', init);
document.addEventListener('keepup-page-ready', init);

async function init() {
    console.log('👤 Profile page initializing...');

    setupEventListeners();
    await loadProfile();
    await loadUserPhotos();
    renderProfile();
}

function setupEventListeners() {
    // Edit profile button
    const editBtn = document.getElementById('edit-profile-btn');
    if (editBtn) {
        editBtn.addEventListener('click', openEditModal);
    }

    // Edit modal
    const closeBtn = document.getElementById('close-edit-modal');
    const cancelBtn = document.getElementById('cancel-edit-btn');
    const saveBtn = document.getElementById('save-profile-btn');

    if (closeBtn) closeBtn.addEventListener('click', closeEditModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeEditModal);
    if (saveBtn) saveBtn.addEventListener('click', saveProfile);

    // Photo upload
    const photoInput = document.getElementById('photo-upload-input');
    if (photoInput) {
        photoInput.addEventListener('change', handlePhotoUpload);
    }

    // Edit form
    const editForm = document.getElementById('edit-profile-form');
    if (editForm) {
        editForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveProfile();
        });
    }

    // Keyboard navigation for photo carousel
    document.addEventListener('keydown', (e) => {
        if (document.getElementById('photo-modal').style.display === 'block') {
            // Modal is open, allow escape to close
            if (e.key === 'Escape') {
                document.getElementById('photo-modal').style.display = 'none';
            }
            return;
        }

        // Photo navigation
        if (e.key === 'ArrowLeft') {
            changePhoto(-1);
        } else if (e.key === 'ArrowRight') {
            changePhoto(1);
        }
    });
}

async function loadProfile() {
    try {
        const profile = await KeepUp.getProfile();
        if (!profile) return;

        userProfile = profile;
        console.log('Loaded profile:', profile);
    } catch (error) {
        console.error('Failed to load profile:', error);
    }
}

async function loadUserPhotos() {
    try {
        // For now, initialize with empty array
        // In a real implementation, this would load from server
        userPhotos = userProfile?.photos || [];

        // Ensure we have at least 9 slots
        while (userPhotos.length < 9) {
            userPhotos.push(null);
        }
    } catch (error) {
        console.error('Failed to load photos:', error);
        userPhotos = Array(9).fill(null);
    }
}

function renderProfile() {
    if (!userProfile) return;

    // Update basic info
    const nameEl = document.getElementById('profile-name');
    const ageEl = document.getElementById('profile-age');
    const bioEl = document.getElementById('profile-bio');

    if (nameEl) nameEl.textContent = userProfile.name || 'User';
    if (bioEl) bioEl.textContent = userProfile.bio || 'No bio yet...';

    // Calculate and display age
    if (ageEl && userProfile.birthdate) {
        const age = calculateAge(userProfile.birthdate);
        ageEl.textContent = age ? `${age}` : '';
    }

    // Render photos
    renderPhotoCarousel();
}

function renderPhotoCarousel() {
    const carousel = document.getElementById('photo-carousel');
    const navigation = document.getElementById('photo-navigation');
    if (!carousel || !navigation) return;

    // Clear existing content
    carousel.innerHTML = '';
    navigation.innerHTML = '';

    // Filter out null photos and get valid photos
    const validPhotos = userPhotos.filter(photo => photo !== null);

    if (validPhotos.length === 0) {
        // Show placeholder
        carousel.innerHTML = '<div class="photo-placeholder">📷</div>';
        return;
    }

    // Create photo slides
    validPhotos.forEach((photo, index) => {
        const slide = document.createElement('div');
        slide.className = `photo-slide ${index === currentPhotoIndex ? 'active' : ''}`;
        slide.style.backgroundImage = `url(${photo.url})`;
        slide.onclick = () => openPhotoModal(photo);
        carousel.appendChild(slide);

        // Create navigation dot
        const dot = document.createElement('div');
        dot.className = `photo-dot ${index === currentPhotoIndex ? 'active' : ''}`;
        dot.onclick = () => goToPhoto(index);
        navigation.appendChild(dot);
    });

    // Update navigation arrows
    updateNavigationArrows(validPhotos.length);

    // Add swipe functionality
    addSwipeSupport(carousel);
}

function addSwipeSupport(carousel) {
    let startX = 0;
    let startY = 0;
    let isSwiping = false;

    carousel.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        isSwiping = true;
    });

    carousel.addEventListener('touchmove', (e) => {
        if (!isSwiping) return;

        const currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;
        const diffX = startX - currentX;
        const diffY = startY - currentY;

        // Only handle horizontal swipes
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
            e.preventDefault();
            if (diffX > 0) {
                // Swipe left - next photo
                changePhoto(1);
            } else {
                // Swipe right - previous photo
                changePhoto(-1);
            }
            isSwiping = false;
        }
    });

    carousel.addEventListener('touchend', () => {
        isSwiping = false;
    });
}

function updateNavigationArrows(totalPhotos) {
    const prevBtn = document.getElementById('prev-photo');
    const nextBtn = document.getElementById('next-photo');

    if (prevBtn) {
        prevBtn.classList.toggle('disabled', currentPhotoIndex === 0);
    }
    if (nextBtn) {
        nextBtn.classList.toggle('disabled', currentPhotoIndex === totalPhotos - 1);
    }
}

function changePhoto(direction) {
    const validPhotos = userPhotos.filter(photo => photo !== null);
    const newIndex = currentPhotoIndex + direction;

    if (newIndex >= 0 && newIndex < validPhotos.length) {
        goToPhoto(newIndex);
    }
}

function goToPhoto(index) {
    const validPhotos = userPhotos.filter(photo => photo !== null);
    if (index < 0 || index >= validPhotos.length) return;

    currentPhotoIndex = index;
    renderPhotoCarousel();
}

function calculateAge(birthdate) {
    if (!birthdate) return null;

    const today = new Date();
    const birth = new Date(birthdate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
    }

    return age;
}

function openPhotoModal(photo) {
    if (!photo) {
        // If no specific photo provided, use current photo
        const validPhotos = userPhotos.filter(p => p !== null);
        if (validPhotos.length > 0) {
            photo = validPhotos[currentPhotoIndex];
        } else {
            return;
        }
    }

    const modal = document.getElementById('photo-modal');
    const modalImg = document.getElementById('modal-photo');

    if (modal && modalImg) {
        modalImg.src = photo.url;
        modal.style.display = 'block';
    }
}

function openEditModal() {
    const modal = document.getElementById('edit-profile-modal');
    if (!modal) return;

    // Populate form
    const nameInput = document.getElementById('edit-name');
    const birthdateInput = document.getElementById('edit-birthdate');
    const bioInput = document.getElementById('edit-bio');

    if (nameInput) nameInput.value = userProfile?.name || '';
    if (birthdateInput) birthdateInput.value = userProfile?.birthdate || '';
    if (bioInput) bioInput.value = userProfile?.bio || '';

    // Render edit photos
    renderEditPhotos();

    modal.style.display = 'block';
}

function closeEditModal() {
    const modal = document.getElementById('edit-profile-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function renderEditPhotos() {
    const grid = document.getElementById('edit-photos-grid');
    if (!grid) return;

    grid.innerHTML = '';

    userPhotos.forEach((photo, index) => {
        const slot = document.createElement('div');
        slot.className = 'photo-upload-slot';
        slot.dataset.index = index;

        if (photo) {
            slot.innerHTML = `
                <img src="${photo.url}" alt="Photo ${index + 1}">
                <button class="drag-handle" data-index="${index}">⋮⋮</button>
            `;
        } else {
            slot.className += ' empty';
            slot.innerHTML = '➕';
        }

        // Click to upload
        slot.addEventListener('click', (e) => {
            if (!e.target.classList.contains('drag-handle')) {
                document.getElementById('photo-upload-input').click();
            }
        });

        grid.appendChild(slot);
    });

    // Setup drag and drop
    setupDragAndDrop();
}

function setupDragAndDrop() {
    const slots = document.querySelectorAll('.photo-upload-slot');

    slots.forEach(slot => {
        const handle = slot.querySelector('.drag-handle');
        if (handle) {
            handle.addEventListener('mousedown', startDrag);
            handle.addEventListener('touchstart', startDrag);
        }

        slot.addEventListener('dragover', allowDrop);
        slot.addEventListener('drop', drop);
    });
}

function startDrag(e) {
    e.preventDefault();
    draggedElement = e.target.closest('.photo-upload-slot');
    draggedElement.style.opacity = '0.5';
}

function allowDrop(e) {
    e.preventDefault();
}

function drop(e) {
    e.preventDefault();

    if (!draggedElement) return;

    const targetSlot = e.target.closest('.photo-upload-slot');
    if (!targetSlot || targetSlot === draggedElement) {
        draggedElement.style.opacity = '1';
        draggedElement = null;
        return;
    }

    const fromIndex = parseInt(draggedElement.dataset.index);
    const toIndex = parseInt(targetSlot.dataset.index);

    // Swap photos
    [userPhotos[fromIndex], userPhotos[toIndex]] = [userPhotos[toIndex], userPhotos[fromIndex]];

    // Re-render
    renderEditPhotos();

    draggedElement = null;
}

function handlePhotoUpload(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    files.forEach(file => {
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const photo = {
                    url: e.target.result,
                    file: file
                };

                // Add to first empty slot
                const emptyIndex = userPhotos.findIndex(p => p === null);
                if (emptyIndex !== -1) {
                    userPhotos[emptyIndex] = photo;
                    renderEditPhotos();
                }
            };
            reader.readAsDataURL(file);
        }
    });

    // Clear input
    e.target.value = '';
}

async function saveProfile() {
    try {
        const name = document.getElementById('edit-name').value;
        const birthdate = document.getElementById('edit-birthdate').value;
        const bio = document.getElementById('edit-bio').value;

        const profileData = {
            name,
            birthdate,
            bio,
            photos: userPhotos.filter(p => p !== null)
        };

        // Save to server
        await KeepUp.updateProfile(profileData);

        // Update local profile
        userProfile = { ...userProfile, ...profileData };

        // Reset photo index to show first photo
        currentPhotoIndex = 0;

        // Re-render profile
        renderProfile();

        // Close modal
        closeEditModal();

        alert('Profile updated successfully!');
    } catch (error) {
        console.error('Failed to save profile:', error);
        alert('Failed to save profile. Please try again.');
    }
}

// Global functions for HTML onclick handlers
function changePhoto(direction) {
    const validPhotos = userPhotos.filter(photo => photo !== null);
    const newIndex = currentPhotoIndex + direction;

    if (newIndex >= 0 && newIndex < validPhotos.length) {
        goToPhoto(newIndex);
    }
}

function goToPhoto(index) {
    const validPhotos = userPhotos.filter(photo => photo !== null);
    if (index < 0 || index >= validPhotos.length) return;

    currentPhotoIndex = index;
    renderPhotoCarousel();
}
