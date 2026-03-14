const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { optionalAuth, requireAuth } = require('../middleware/requireAuth');

// Profile read — optional auth (user can view own profile, or be guest)
router.post('/profile/get', optionalAuth(), userController.getProfile);
router.get('/profile/:userId', optionalAuth(), userController.getProfileById);

// Profile write — require auth
router.post('/profile/save', requireAuth(), userController.saveProfile);
router.put('/profile', requireAuth(), userController.saveProfileById);

// Auto-update current location (lightweight, called on page load)
router.put('/location/current', requireAuth(), userController.updateCurrentLocation);

// Map checkpoints (venues from Foursquare)
router.get('/map/checkpoints', optionalAuth(), userController.getMapCheckpoints);

// User events
router.get('/users/:userId/events', optionalAuth(), userController.getUserEvents);

module.exports = router;
