const express = require('express');
const router = express.Router();
const osmController = require('../controllers/osm.controller');

// OAuth login (redirects to OpenStreetMap)
router.get('/login', osmController.login);
// OAuth callback (OSM -> our backend)
router.get('/callback', osmController.callback);
// Get current OSM user info
router.get('/user', osmController.user);
// Logout
router.post('/logout', osmController.logout);

module.exports = router;
